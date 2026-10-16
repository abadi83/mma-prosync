import { describe, it, expect } from 'vitest';
import { computeBelanjaOrders, computeBelanjaSkuSummary } from '@/app/lib/belanja';
import type { AgregasiRow } from '@/app/context/AgregasiContext';

const base = {
  id: 'r1',
  marketplace: 'Shopee',
  namaToko: 'TokoA',
  hargaJual: 10000,
  kurir: 'JNE',
  dibuat: '2026-08-01',
  sla: '2026-08-03',
  statusPesanan: 'Selesai',
  statusProses: 'Dipicking' as const,
};

const rows: AgregasiRow[] = [
  { ...base, id: 'r1', noPesanan: 'PO-1', noResi: 'RS-1', sku: 'SKU-A', namaProduk: 'Produk A', kuantity: 2 },
  { ...base, id: 'r2', noPesanan: 'PO-1', noResi: 'RS-1', sku: 'SKU-A', namaProduk: 'Produk A', kuantity: 3 },
  { ...base, id: 'r3', noPesanan: 'PO-1', noResi: 'RS-1', sku: 'SKU-B', namaProduk: 'Produk B', kuantity: 1 },
];

describe('computeBelanja*', () => {
  it('menjumlahkan qty untuk baris SKU yang sama dalam satu pesanan', () => {
    const orders = computeBelanjaOrders(rows, []);
    expect(orders).toHaveLength(1);
    const itemA = orders[0].items.find(i => i.sku === 'SKU-A');
    expect(itemA?.qty).toBe(5);
    expect(orders[0].items).toHaveLength(2);
  });

  it('ringkasan per SKU konsisten dengan daftar per pesanan', () => {
    const orders = computeBelanjaOrders(rows, []);
    const summary = computeBelanjaSkuSummary(rows, []);
    const orderQty = orders[0].items.find(i => i.sku === 'SKU-A')?.qty || 0;
    const summaryQty = summary.find(s => s.sku.toLowerCase() === 'sku-a')?.qty || 0;
    expect(orderQty).toBe(summaryQty);
  });
});
