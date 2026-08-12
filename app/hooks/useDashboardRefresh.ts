'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DashboardData } from '@/app/types';

async function fetchApi<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${url} gagal`);
  return res.json();
}

export function useDashboardRefresh(intervalMs = 30000) {
  const [data, setData] = useState<DashboardData>({
    stockSummary: { totalItems: 0, lowStockCount: 0, items: [] },
    salesSummary: { today: 0, transactions: 0, trend: 'up' },
    shortcuts: [
      { title: 'Inventory', category: 'Inventory', description: 'Stok opname, barang masuk/keluar & riwayat mutasi.', href: '/stok-barang' },
      { title: 'Input Penjualan', category: 'Operasional', description: 'Catat penjualan harian dengan cepat.', href: '/penjualan' },
      { title: 'Laporan', category: 'Finance', description: 'Lihat laba rugi, arus kas, dan stok.', href: '/laporan' },
      { title: 'Keuangan', category: 'Finance', description: 'Pembayaran PO, arus kas, & riwayat pembayaran supplier.', href: '/keuangan' },
      { title: 'Akuntansi', category: 'Finance', description: 'Jurnal umum, COA, aset & modal, laba rugi & neraca.', href: '/akuntansi' },
      { title: 'Data Master', category: 'Master Data', description: 'Kelola SKU, supplier, toko marketplace & pelanggan.', href: '/data-master' },
      { title: 'Pembelian & Biaya', category: 'Purchasing', description: 'Pembelian HPP SKU, OPEX packing, & biaya operasional harian.', href: '/pembelian' },
      { title: 'Operasional Gudang', category: 'Warehouse', description: 'Stok opname, mutasi, retur & penyesuaian.', href: '/operasional-gudang' },
      { title: 'Pengaturan', category: 'System', description: 'Info toko, akun, ubah password & preferensi.', href: '/pengaturan' },
      { title: 'Kepegawaian', category: 'HR', description: 'Data pegawai, absensi harian, rekap kehadiran & penilaian KPI.', href: '/kepegawaian' },
      { title: 'Data Entry', category: 'Operasional', description: 'Input data operasional & keuangan per marketplace.', href: '/data-entry' },
    ],
  });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const refresh = useCallback(async () => {
    try {
      const [stockSummary, salesSummary] = await Promise.all([
        fetchApi<any>('/api/stock-summary').catch(() => null),
        fetchApi<any>('/api/sales-summary').catch(() => null),
      ]);

      setData(prev => ({
        stockSummary: stockSummary ?? prev.stockSummary,
        salesSummary: salesSummary ?? prev.salesSummary,
        shortcuts: prev.shortcuts,
      }));
      setLastUpdated(new Date());
    } catch {
      // keep existing data on error
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh
  useEffect(() => {
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { data, lastUpdated, refresh };
}
