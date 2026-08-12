import type { SalesSummaryData } from '@/app/types';
import { query } from '@/lib/db';

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getSalesSummary(tokoId?: string): Promise<SalesSummaryData> {
  const todayResult = await query(
    `SELECT COALESCE(SUM(total), 0)::int AS today, COUNT(*)::int AS transactions
     FROM transaksi WHERE toko_id = $1 AND tanggal::date = CURRENT_DATE`,
    [tokoId || DEFAULT_TOKO]
  );
  const yesterdayResult = await query(
    `SELECT COALESCE(SUM(total), 0)::int AS yesterday
     FROM transaksi WHERE toko_id = $1 AND tanggal::date = CURRENT_DATE - 1`,
    [tokoId || DEFAULT_TOKO]
  );

  const today = todayResult.rows[0]?.today || 0;
  const yesterday = yesterdayResult.rows[0]?.yesterday || 0;
  const transactions = todayResult.rows[0]?.transactions || 0;

  return {
    today,
    transactions,
    trend: today >= yesterday ? 'up' : 'down',
  };
}
