import type { StockSummaryData } from '@/app/types';
import { query } from '@/lib/db';

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getStockSummary(tokoId?: string): Promise<StockSummaryData> {
  const { rows: items } = await query(
    `SELECT p.nama AS name, p.stok AS stock, p.stok_minimum AS "minStock",
            COALESCE(k.nama, 'Umum') AS category
     FROM produk p
     LEFT JOIN kategori k ON p.kategori_id = k.id
     WHERE p.toko_id = $1
     ORDER BY p.stok ASC
     LIMIT 10`,
    [tokoId || DEFAULT_TOKO]
  );

  const totalResult = await query('SELECT COUNT(*)::int AS count FROM produk WHERE toko_id = $1', [tokoId || DEFAULT_TOKO]);
  const lowResult = await query('SELECT COUNT(*)::int AS count FROM produk WHERE toko_id = $1 AND stok < stok_minimum', [tokoId || DEFAULT_TOKO]);

  return {
    totalItems: totalResult.rows[0]?.count || 0,
    lowStockCount: lowResult.rows[0]?.count || 0,
    items: items.map((i: any) => ({
      name: i.name,
      stock: Number(i.stock),
      minStock: Number(i.minStock),
      category: i.category,
    })),
  };
}
