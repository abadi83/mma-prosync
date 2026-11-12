/** Klasifikasi kurir/pengiriman untuk badge khusus (terutama Instant / Same Day / Prioritas). */

export type KurirKategori = 'instant' | 'sameday' | 'prioritas' | 'reguler';

export function kategoriKurir(kurir: string): KurirKategori {
  const k = (kurir || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!k) return 'reguler';
  if (k.includes('prioritas') || k.includes('priority') || k.includes('priorit')) return 'prioritas';
  if (k.includes('instant') || k.includes('gosend') || k.includes('grabexpress') || k.includes('grab') || k.includes('dash') || k.includes('lalamove') || k.includes('borzo')) return 'instant';
  if (k.includes('sameday') || k.includes('same-day') || k.includes('samedaydelivery') || k.includes('kilat') || k.includes('sehari') || k.includes('nextday') || k.includes('next-day')) return 'sameday';
  return 'reguler';
}

/** Apakah kurir tergolong mendesak (instant / sameday / prioritas)? */
export function isKurirMendesak(kurir: string): boolean {
  const c = kategoriKurir(kurir);
  return c === 'instant' || c === 'sameday' || c === 'prioritas';
}

/** Status workflow yang berarti "masih berjalan" (belum selesai / dibatalkan / dikirim). */
export const STATUS_SELESAI = new Set(['Dikirim', 'Dibatalkan', 'Selesai', 'delivered', 'cancelled', 'Batal']);
export function isStatusAktif(row: { statusProses?: string; statusPesanan?: string }): boolean {
  const sp = row.statusProses || '';
  const st = row.statusPesanan || '';
  if (STATUS_SELESAI.has(sp)) return false;
  if (/dibatalkan|cancelled|batal/i.test(st)) return false;
  return true;
}

export function kurirBadge(kurir: string): { label: string; icon: string; cls: string } | null {
  const cat = kategoriKurir(kurir);
  if (cat === 'prioritas') return { label: '🔥 Prioritas', icon: '🔥', cls: 'bg-rose-100 text-rose-700 border-rose-200' };
  if (cat === 'instant') return { label: '⚡ Instant', icon: '⚡', cls: 'bg-red-100 text-red-700 border-red-200' };
  if (cat === 'sameday') return { label: '🚀 Same Day', icon: '🚀', cls: 'bg-orange-100 text-orange-700 border-orange-200' };
  return null; // reguler tidak perlu badge khusus
}
