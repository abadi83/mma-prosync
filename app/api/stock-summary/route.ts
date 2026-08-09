import { NextResponse } from 'next/server';
import { getStockSummary } from '@/app/services/stockService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stock-summary
 *
 * Mengembalikan ringkasan stok: total produk aktif & produk di bawah stok minimum.
 *
 * Query params (opsional):
 *   ?toko_id=<uuid>  — ID toko pemilik data (default: demo user)
 *
 * Response:
 *   200 — { totalItems, lowStockCount, items[] }
 *   500 — { error }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokoId = searchParams.get('toko_id') ?? 'a0a0a0a0-0000-0000-0000-000000000001';

    const data = await getStockSummary(tokoId);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/stock-summary error:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil ringkasan stok' },
      { status: 500 },
    );
  }
}
