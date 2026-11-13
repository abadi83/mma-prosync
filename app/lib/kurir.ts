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
export const STATUS_SELESAI = new Set(['dikirim', 'dibatalkan', 'selesai', 'delivered', 'cancelled', 'batal', 'diterima', 'retur']);

/** Normalisasi status → huruf kecil, tanpa spasi ganda (Shopee "Perlu Dikirim" vs TikTok "Perlu dikirim"). */
export function normStatus(s?: string): string {
  return String(s || '').trim().toLowerCase();
}

/** Apakah statusProses ini berarti "belum diproses" (perlu picking)? case-insensitive. */
export function isPerluDikirim(statusProses?: string): boolean {
  const sp = normStatus(statusProses);
  return sp === '' || sp === 'perlu dikirim';
}

/** Apakah statusPesanan dari marketplace berarti "belum diproses operasional"?
 *  Shopee: "Perlu Dikirim" | TikTok: "Perlu dikirim" | Lazada: "ready_to_ship". */
export function isPerluProses(statusPesanan?: string): boolean {
  const st = normStatus(statusPesanan).replace(/[^a-z0-9]/g, '');
  if (!st) return false;
  return (
    st === 'perludikirim' ||
    st === 'perludikrim' ||       // typo / variasi TikTok
    st === 'readytoship' ||
    st === 'toship' ||
    st === 'belumdikirim'
  );
}

/** Status "sudah diproses gudang" (sedang/telah masuk workflow, belum tentu selesai). */
export function isDalamProsesGudang(statusProses?: string): boolean {
  const sp = normStatus(statusProses);
  if (!sp || sp === 'perlu dikirim') return false;
  return !STATUS_SELESAI.has(sp);
}

export function isStatusAktif(row: { statusProses?: string; statusPesanan?: string }): boolean {
  const sp = normStatus(row.statusProses);
  const st = normStatus(row.statusPesanan);

  // Pesanan yang status gudangnya sudah selesai/dikirim/batal → tidak dihitung
  if (STATUS_SELESAI.has(sp)) return false;

  // statusPesanan dari marketplace beragam → cek kata kunci
  if (/dibatalkan|cancelled|batal/.test(st)) return false;
  // CATATAN: "perlu dikirim" JUGA mengandung kata "dikirim" → kecualikan dulu.
  if (/perlu\s*dikirim|to\s*ship|belum\s*dikirim|ready\s*to\s*ship/.test(st)) return true;
  if (/selesai|delivered|diterima|retur|dikirim|shipped|completed/.test(st)) return false;
  return true;
}

export function kurirBadge(kurir: string): { label: string; icon: string; cls: string } | null {
  const cat = kategoriKurir(kurir);
  if (cat === 'prioritas') return { label: '🔥 Prioritas', icon: '🔥', cls: 'bg-rose-100 text-rose-700 border-rose-200' };
  if (cat === 'instant') return { label: '⚡ Instant', icon: '⚡', cls: 'bg-red-100 text-red-700 border-red-200' };
  if (cat === 'sameday') return { label: '🚀 Same Day', icon: '🚀', cls: 'bg-orange-100 text-orange-700 border-orange-200' };
  return null; // reguler tidak perlu badge khusus
}
