/** Merge sinkron bersama — dipakai klien (GlobalSyncProvider) DAN server (/api/data).
 *  Aturan inti: item yang punya updatedAt TIDAK BOLEH ditimpa salinan yang lebih
 *  tua / tanpa timestamp (akar masalah "data balik lagi" antar komputer). */

export function itemKey(key: string, item: any): string {
  if (item == null || typeof item !== 'object') return String(item);
  if (key === 'mma_agregasi_rows') return `${item.noPesanan || ''}||${item.noResi || ''}||${item.sku || ''}`;
  if (key === 'mma_marketplace_orders') return `${item.noPesanan || item.id || ''}||${item.id || ''}`;
  if (key === 'mma_sku_data') return `${item.sku || item.id || ''}`;
  if (item.id !== undefined) return String(item.id);
  return JSON.stringify(item);
}

/* Ranking workflow gudang — versi dengan status lebih maju TIDAK BOLEH ditimpa
   versi lama dari perangkat lain (akar masalah "handover hilang" setelah sync). */
const AGREGASI_STATUS_RANK: Record<string, number> = {
  'Perlu Dikirim': 0,
  'Dipicking': 1,
  'DiQC': 2,
  'Dipacking': 3,
  'DiScanRunner': 4,
  'Dikirim': 5,
  'PendingPickup': 4,
  'Dibatalkan': 6,
};

/** Status workflow yang lebih maju menang saat merge item agregasi yang sama. */
function agregasiMenang(incoming: any, existing: any): boolean {
  const rIn = AGREGASI_STATUS_RANK[incoming?.statusProses] ?? -1;
  const rEx = AGREGASI_STATUS_RANK[existing?.statusProses] ?? -1;
  if (rIn !== rEx) return rIn > rEx;
  // Rank sama: yang punya handoverId menang, lalu yang terbaru berdasar updatedAt
  if (!!incoming?.handoverId !== !!existing?.handoverId) return !!incoming?.handoverId;
  const tsIn = Number(incoming?.updatedAt);
  const tsEx = Number(existing?.updatedAt);
  if (isFinite(tsIn) || isFinite(tsEx)) return isFinite(tsIn) && (!isFinite(tsEx) || tsIn >= tsEx);
  return true; // default: lokal (incoming) menang
}

/**
 * Union dua array berdasarkan kunci unik tiap item.
 * a = sisi lokal/push (diproses terakhir → menang saat tanpa timestamp)
 * b = sisi server/existing.
 */
export function mergeUnion<T>(key: string, a: T[], b: T[], excluded?: Set<string>): T[] {
  const map = new Map<string, T>();
  for (const item of [...b, ...a]) {
    const k = itemKey(key, item);
    if (excluded && excluded.has(k)) continue; // item dihapus lokal → jangan dihidupkan lagi
    const existing = map.get(k);
    if (!existing) {
      map.set(k, item);
      continue;
    }
    // Item yang sama dari dua sisi: kalau salah satu/keduanya punya updatedAt (timestamp edit),
    // versi TERBARU yang menang. Sisi yang TIDAK punya updatedAt dianggap paling tua —
    // supaya edit baru (mis. pembayaran PO) tidak bisa ditimpa salinan lama dari
    // tab/perangkat lain yang belum kebagian timestamp.
    const tsItem = (item as any)?.updatedAt;
    const tsExisting = (existing as any)?.updatedAt;
    const itemHas = typeof tsItem === 'number' && isFinite(tsItem);
    const existingHas = typeof tsExisting === 'number' && isFinite(tsExisting);
    if (key === 'mma_agregasi_rows') {
      // Workflow gudang: status lebih maju / yang punya handover selalu menang,
      // agar scan→handover dari perangkat A tidak ditimpa copy lama dari perangkat B.
      if (agregasiMenang(item, existing)) map.set(k, item);
      continue;
    }
    if (itemHas || existingHas) {
      if (itemHas && (!existingHas || tsItem >= tsExisting)) map.set(k, item);
      // kalau existing lebih baru (atau satu-satunya yang punya timestamp) → biarkan existing
    } else {
      map.set(k, item); // keduanya tanpa timestamp: perilaku lama (sisi lokal menang)
    }
  }
  return Array.from(map.values());
}
