import type { SalesSummaryData } from '@/app/types';
import { mockDashboardData } from '@/app/mockData';

/**
 * Mengambil ringkasan penjualan harian + perbandingan dengan kemarin.
 * Saat ini mengembalikan data tiruan — akan diganti query DB nyata.
 */
export async function getSalesSummary(_tokoId: string): Promise<SalesSummaryData> {
  // TODO: Ganti dengan query nyata ke tabel transaksi + detail_transaksi:
  //   SELECT COALESCE(SUM(total), 0) AS today, COUNT(*) AS transactions
  //     FROM transaksi WHERE toko_id = $1 AND tanggal::date = CURRENT_DATE;
  //   SELECT COALESCE(SUM(total), 0) AS yesterday
  //     FROM transaksi WHERE toko_id = $1 AND tanggal::date = CURRENT_DATE - 1;
  //   Trend = today > yesterday ? 'up' : 'down';

  return mockDashboardData.salesSummary;
}
