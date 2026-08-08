import { NextResponse } from 'next/server';
import { getSalesSummary } from '@/app/services/salesService';

/**
 * GET /api/sales-summary
 *
 * Mengembalikan ringkasan penjualan harian dengan perbandingan kemarin.
 *
 * Query params (opsional):
 *   ?toko_id=<uuid>  — ID toko pemilik data (default: demo user)
 *
 * Response:
 *   200 — { today, transactions, trend }
 *   500 — { error }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokoId = searchParams.get('toko_id') ?? 'a0a0a0a0-0000-0000-0000-000000000001';

    const data = await getSalesSummary(tokoId);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/sales-summary error:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil ringkasan penjualan' },
      { status: 500 },
    );
  }
}
