import fs from 'fs';
import path from 'path';

/**
 * Helper laporan server-side: baca data JSON hasil sync antar perangkat
 * (ditulis /api/data di folder data/) + rentang tanggal per periode.
 * Dipakai labaRugiService & arusKasService supaya angka laporan REAL,
 * bukan hardcoded.
 */

export type Periode = 'minggu' | 'bulan' | 'bulanLalu' | 'tahun';

const DATA_DIR = path.join(process.cwd(), 'data');

export function readSyncedArray(fileName: string): any[] {
  try {
    const filePath = path.join(DATA_DIR, fileName);
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string | null; // null = sampai hari ini
}

/** Sama seperti filterByPeriode di halaman laporan (client) — pakai tanggal LOKAL. */
export function periodeRange(periode?: string | null): DateRange {
  const now = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  if (periode === 'minggu') {
    return { start: fmt(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)), end: null };
  }
  if (periode === 'bulanLalu') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: fmt(start), end: fmt(end) };
  }
  if (periode === 'tahun') {
    return { start: fmt(new Date(now.getFullYear(), 0, 1)), end: null };
  }
  // default: bulan ini
  return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: null };
}

/** Jumlah nilai `numField` dari list dalam rentang (tanggal `dateField` / fallback `tanggal`). */
export function sumInRange(
  list: any[],
  dateField: string,
  numField: string,
  range: DateRange,
): number {
  return list.reduce((sum: number, item: any) => {
    const d: string = String(item?.[dateField] || item?.tanggal || '');
    if (d < range.start) return sum;
    if (range.end && d > range.end) return sum;
    const v = Number(item?.[numField]);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);
}
