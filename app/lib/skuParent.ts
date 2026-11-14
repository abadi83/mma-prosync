/** Helper relasi SKU induk <-> varian (share stok). */

export type TipeStok = 'share' | 'mandiri';

/** Deteksi otomatis: SKU mengandung '+' → dianggap varian, induk = sebelum '+' pertama.
 *  Contoh: "BC-2-C+MUYA-112" → induk "BC-2-C". */
export function deteksiParentSku(sku: string): string | null {
  const s = String(sku || '').trim();
  if (!s) return null;
  const i = s.indexOf('+');
  if (i <= 0) return null; // tidak ada '+' di awal → bukan varian
  const parent = s.slice(0, i).trim();
  return parent || null;
}

/** Resolve SKU yang harus memegang stok. Kalau varian share → induknya; selain itu dirinya. */
export function resolveSkuStok(sku: string, parentSku?: string | null, tipeStok?: string): string {
  const tipe: TipeStok = tipeStok === 'share' ? 'share' : 'mandiri';
  if (tipe === 'share') {
    const parent = (parentSku || '').trim() || deteksiParentSku(sku) || '';
    return parent || sku;
  }
  return sku;
}
