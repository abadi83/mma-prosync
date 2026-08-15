import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Increase body size limit for large SKU data (4700+ items = ~2MB)
export const maxDuration = 60;

const DATA_DIR = path.join(process.cwd(), 'data');

// Pastikan folder data ada
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getFilePath(key: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(DATA_DIR, `${safeKey}.json`);
}

function readData(key: string): any {
  try {
    const filePath = getFilePath(key);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeData(key: string, data: any): void {
  const filePath = getFilePath(key);
  // Tulis atomik: temp dulu, lalu rename
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data), 'utf-8');
  fs.renameSync(tmpPath, filePath);
  // Data baru masuk → hapus tombstone kalau ada
  clearTombstone(key);
}

function getTombstonePath(key: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(DATA_DIR, `${safeKey}.deleted`);
}

function readTombstone(key: string): number | null {
  try {
    const p = getTombstonePath(key);
    if (!fs.existsSync(p)) return null;
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return typeof parsed.deletedAt === 'number' ? parsed.deletedAt : null;
  } catch { return null; }
}

function writeTombstone(key: string): void {
  fs.writeFileSync(getTombstonePath(key), JSON.stringify({ deletedAt: Date.now() }), 'utf-8');
}

function clearTombstone(key: string): void {
  const p = getTombstonePath(key);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

/**
 * GET /api/data?key=mma_sku_data
 * POST /api/data { key, data }
 * DELETE /api/data?key=...  — hapus global
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    if (!key) {
      return NextResponse.json({ error: 'Parameter key wajib.' }, { status: 400 });
    }
    const data = readData(key);
    const deletedAt = readTombstone(key);
    return NextResponse.json({ key, data: data || [], deletedAt: deletedAt || undefined });
  } catch {
    return NextResponse.json({ error: 'Gagal membaca data.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, data } = body;
    if (!key) {
      return NextResponse.json({ error: 'Field key wajib.' }, { status: 400 });
    }
    if (data === undefined || data === null) {
      return NextResponse.json({ error: 'Field data wajib.' }, { status: 400 });
    }
    writeData(key, data);
    return NextResponse.json({ success: true, key, count: Array.isArray(data) ? data.length : 1 });
  } catch (err: any) {
    console.error('POST /api/data error:', err?.message);
    return NextResponse.json({ error: 'Gagal menyimpan data.' }, { status: 500 });
  }
}

/**
 * DELETE /api/data?key=...  — hapus global (propagasi ke semua user)
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    if (!key) {
      return NextResponse.json({ error: 'Parameter key wajib.' }, { status: 400 });
    }
    const filePath = getFilePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    // Tulis tombstone agar device lain tahu data ini dihapus global
    writeTombstone(key);
    return NextResponse.json({ success: true, key, deleted: true });
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus data.' }, { status: 500 });
  }
}
