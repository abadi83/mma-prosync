import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DATA_DIR = path.join(process.cwd(), 'data');
const AGR_KEY = 'mma_agregasi_rows';
const RESET_MARKER_KEY = 'mma_agregasi_reset_at';

function getFilePath(key: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(DATA_DIR, `${safeKey}.json`);
}

function readData(key: string): any {
  try {
    const p = getFilePath(key);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function writeData(key: string, data: any): void {
  const p = getFilePath(key);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf-8');
  fs.renameSync(tmp, p);
}

const TAHAP_WORKFLOW = new Set(['dipicking', 'diqc', 'dipacking', 'discanrunner', 'pendingpickup']);

/**
 * POST /api/agregasi/reset-workflow
 * Body: { keys?: string[] }  — (opsional) daftar key "noPesanan||noResi" spesifik.
 * Tanpa keys → reset SEMUA baris yang status workflow-nya aktif.
 *
 * Server menulis langsung ke file data dengan timestamp SERVER (bukan clock klien),
 * dan menyimpan "reset marker" global. Saat klien lain sync, baris dengan updatedAt
 * lebih tua dari marker akan dipaksa kembali ke "belum diproses" — ini memastikan
 * reset menyebar ke semua perangkat tanpa bergantung clock klien.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const keysParam = Array.isArray(body?.keys) ? body.keys.map((k: unknown) => String(k)) : null;

    const rows = readData(AGR_KEY);
    if (!Array.isArray(rows)) {
      return NextResponse.json({ success: true, count: 0, message: 'Tidak ada data agregasi.' });
    }

    const now = Date.now();
    let count = 0;
    const next = rows.map((r: any) => {
      const sp = String(r?.statusProses || '').trim().toLowerCase();
      const key = `${r?.noPesanan || ''}||${r?.noResi || ''}`;
      const isActiveWorkflow = TAHAP_WORKFLOW.has(sp);
      const isTargeted = keysParam ? keysParam.includes(key) : true;
      if (isActiveWorkflow && isTargeted) {
        count++;
        return { ...r, statusProses: undefined, handoverId: undefined, handoverAt: undefined, updatedAt: now };
      }
      return r;
    });

    writeData(AGR_KEY, next);
    // Reset marker global: klien yang sync akan memaksa baris dengan updatedAt < marker ke "belum diproses".
    writeData(RESET_MARKER_KEY, { resetAt: now });
    return NextResponse.json({ success: true, count, resetAt: now });
  } catch (err: any) {
    console.error('POST /api/agregasi/reset-workflow error:', err?.message);
    return NextResponse.json({ error: 'Gagal reset workflow.' }, { status: 500 });
  }
}

/**
 * GET /api/agregasi/reset-workflow — baca reset marker global (untuk klien saat sync).
 */
export async function GET() {
  try {
    const marker = readData(RESET_MARKER_KEY);
    return NextResponse.json({ resetAt: marker?.resetAt || 0 });
  } catch (err: any) {
    console.error('GET /api/agregasi/reset-workflow error:', err?.message);
    return NextResponse.json({ error: 'Gagal baca reset marker.' }, { status: 500 });
  }
}

