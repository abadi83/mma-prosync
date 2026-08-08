import { NextResponse } from 'next/server';
import { getTransaksiHarian } from '@/app/services/transaksiHarianService';

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

/**
 * GET /api/transaksi-harian?toko_id=<uuid>&tanggal=YYYY-MM-DD
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokoId = searchParams.get('toko_id') ?? DEFAULT_TOKO;
    const tanggal = searchParams.get('tanggal') ?? undefined;

    const data = await getTransaksiHarian(tokoId, tanggal);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/transaksi-harian error:', error);
    return NextResponse.json({ error: 'Gagal mengambil transaksi harian' }, { status: 500 });
  }
}
