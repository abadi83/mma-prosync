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
}

/**
 * GET /api/data?key=mma_sku_data
 * POST /api/data { key, data }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    if (!key) {
      return NextResponse.json({ error: 'Parameter key wajib.' }, { status: 400 });
    }
    const data = readData(key);
    return NextResponse.json({ key, data: data || [] });
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
    if (!Array.isArray(data)) {
      return NextResponse.json({ error: 'Field data harus array.' }, { status: 400 });
    }
    writeData(key, data);
    return NextResponse.json({ success: true, key, count: data.length });
  } catch (err: any) {
    console.error('POST /api/data error:', err?.message);
    return NextResponse.json({ error: 'Gagal menyimpan data.' }, { status: 500 });
  }
}
