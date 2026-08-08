import type { StockSummaryData } from '@/app/types';
import { mockDashboardData } from '@/app/mockData';

/**
 * Mengambil ringkasan stok untuk toko tertentu.
 * Saat ini mengembalikan data tiruan — akan diganti dengan query DB
 * setelah Supabase/InsForge client dikonfigurasi.
 */
export async function getStockSummary(_tokoId: string): Promise<StockSummaryData> {
  // TODO: Ganti dengan query nyata ke tabel `produk`:
  //   SELECT COUNT(*) AS totalItems FROM produk WHERE toko_id = $1;
  //   SELECT COUNT(*) AS lowStockCount FROM produk WHERE toko_id = $1 AND stok < stok_minimum;
  //   SELECT nama, stok, stok_minimum, kategori.nama AS category
  //     FROM produk JOIN kategori ON produk.kategori_id = kategori.id
  //     WHERE toko_id = $1 ORDER BY stok ASC LIMIT 10;

  return mockDashboardData.stockSummary;
}
