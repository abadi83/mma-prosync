import { NextResponse } from 'next/server';
import { getCekStok } from '@/app/services/cekStokService';

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

/**
 * GET /api/cek-stok?toko_id=<uuid>&search=<keyword>
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokoId = searchParams.get('toko_id') ?? DEFAULT_TOKO;
    const search = searchParams.get('search') ?? undefined;

    const data = await getCekStok(tokoId, search);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/cek-stok error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data stok' }, { status: 500 });
  }
}
