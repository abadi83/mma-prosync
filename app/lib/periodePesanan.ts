export type PeriodePesanan = 'semua' | 'hari-ini' | '7-hari';

const HARI_MS = 86_400_000;
const WIB_MS = 7 * 3_600_000;

function hariPesanan(raw: string): number | null {
  const value = raw.trim();
  // Excel menyimpan tanggal tanpa zona waktu sebagai nomor seri (sistem 1900).
  if (/^\d{5}(?:\.\d+)?$/.test(value)) return Math.floor(Number(value)) - 25569;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?=$|[T\s])/.exec(value);
  const lokal = /^(\d{1,2})([/.-])(\d{1,2})\2(\d{4})(?=$|\s)/.exec(value);
  if (!iso && !lokal) return null;
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]].map(Number) : [lokal![4], lokal![3], lokal![1]].map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;

  if (iso && /[T\s]\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    const timestamp = Date.parse(value.replace(' ', 'T'));
    return Number.isFinite(timestamp) ? Math.floor((timestamp + WIB_MS) / HARI_MS) : null;
  }
  return date.getTime() / HARI_MS;
}

export function filterPesananByPeriode<T extends { noPesanan: string; noResi: string; dibuat?: string }>(
  rows: T[], periode: PeriodePesanan, now = Date.now(),
): T[] {
  if (periode === 'semua') return rows;
  const hariIni = Math.floor((now + WIB_MS) / HARI_MS);
  const awal = hariIni - (periode === '7-hari' ? 6 : 0);
  const key = (row: T) => `${row.noPesanan}||${row.noResi}`;
  const tanggalByOrder = new Map<string, number>();
  for (const row of rows) {
    const order = key(row);
    if (tanggalByOrder.has(order)) continue;
    const hari = hariPesanan(row.dibuat ?? '');
    if (hari !== null) tanggalByOrder.set(order, hari);
  }
  // Saring per paket supaya SKU dengan tanggal kosong tidak terpotong.
  return rows.filter(row => {
    const hari = tanggalByOrder.get(key(row));
    return hari !== undefined && hari >= awal && hari <= hariIni;
  });
}
