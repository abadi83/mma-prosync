/* ── Helper bersama: deteksi SKU pesanan yang KOSONG / TIDAK ADA di Inventory ──
   Dipakai oleh Operasional Gudang (tab Harus Belanja + tahan picking)
   dan Purchasing (tab Belanja Picking). */
import type { AgregasiRow } from '@/app/context/AgregasiContext';

export interface BelanjaItem {
  sku: string;
  namaProduk: string;
  qty: number;
  reason: 'not-found' | 'stok-kosong';
}

export interface BelanjaOrder {
  key: string;
  noPesanan: string;
  noResi: string;
  marketplace: string;
  namaToko: string;
  statusPesanan: string;
  statusProses?: string;
  items: BelanjaItem[];
}

/** Ringkasan per SKU untuk tim purchasing: total qty yang harus dibeli */
export interface BelanjaSkuSummary {
  sku: string;
  namaProduk: string;
  qty: number;       // total qty dibutuhkan semua pesanan aktif
  orders: number;    // jumlah pesanan yang butuh SKU ini
  reason: 'not-found' | 'stok-kosong';
}

/** SKU tidak ada di inventory → 'not-found'; ada tapi stok 0 → 'stok-kosong'; selain itu null */
export function skuInventoryStatus(sku: string, inv: Map<string, number>): 'not-found' | 'stok-kosong' | null {
  const s = sku.trim().toLowerCase();
  if (!s) return null;
  const stok = inv.get(s);
  if (stok === undefined) return 'not-found';
  if (stok <= 0) return 'stok-kosong';
  return null;
}

function buildInvMap(skus: { sku: string; stok: number }[]): Map<string, number> {
  const inv = new Map<string, number>();
  for (const s of skus) inv.set(s.sku.toLowerCase(), s.stok);
  return inv;
}

/** Pesanan yang punya SKU kosong / tidak terdaftar di Inventory → Harus Belanja */
export function computeBelanjaOrders(allRows: AgregasiRow[], skus: { sku: string; stok: number }[]): BelanjaOrder[] {
  const inv = buildInvMap(skus);
  const map = new Map<string, BelanjaOrder>();
  for (const r of allRows) {
    // Skip pesanan yang dibatalkan — gak perlu belanja
    if (r.statusProses === 'Dibatalkan') continue;
    if (/dibatalkan|cancelled|batal/i.test(r.statusPesanan)) continue;
    const status = skuInventoryStatus(r.sku, inv);
    if (!status) continue;
    const key = `${r.noPesanan}||${r.noResi}`;
    if (!map.has(key)) map.set(key, { key, noPesanan: r.noPesanan, noResi: r.noResi, marketplace: r.marketplace, namaToko: r.namaToko, statusPesanan: r.statusPesanan, statusProses: r.statusProses, items: [] });
    const bo = map.get(key)!;
    if (!bo.items.some(i => i.sku === r.sku)) {
      bo.items.push({ sku: r.sku, namaProduk: r.namaProduk, qty: r.kuantity, reason: status });
    }
  }
  return Array.from(map.values());
}

/** Agregat per SKU — daftar belanja otomatis untuk tim purchasing */
export function computeBelanjaSkuSummary(allRows: AgregasiRow[], skus: { sku: string; stok: number }[]): BelanjaSkuSummary[] {
  const inv = buildInvMap(skus);
  const map = new Map<string, BelanjaSkuSummary>();
  for (const r of allRows) {
    if (r.statusProses === 'Dibatalkan') continue;
    if (/dibatalkan|cancelled|batal/i.test(r.statusPesanan)) continue;
    const status = skuInventoryStatus(r.sku, inv);
    if (!status) continue;
    const key = r.sku.trim().toLowerCase();
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      existing.qty += r.kuantity;
      existing.orders += 1;
      if (existing.reason === 'stok-kosong' && status === 'not-found') existing.reason = 'not-found';
    } else {
      map.set(key, { sku: r.sku.trim(), namaProduk: r.namaProduk, qty: r.kuantity, orders: 1, reason: status });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
}
