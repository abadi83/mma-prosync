import { NextResponse } from 'next/server';
import { getRiwayatMutasi } from '@/app/services/riwayatMutasiService';

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

/**
 * GET /api/riwayat-mutasi?toko_id=<uuid>&tipe=masuk|keluar&produk=<keyword>
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokoId = searchParams.get('toko_id') ?? DEFAULT_TOKO;
    const tipe = searchParams.get('tipe') as 'masuk' | 'keluar' | null;
    const produk = searchParams.get('produk') ?? undefined;

    const data = await getRiwayatMutasi(tokoId, {
      tipe: tipe === 'masuk' || tipe === 'keluar' ? tipe : undefined,
      produk,
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/riwayat-mutasi error:', error);
    return NextResponse.json({ error: 'Gagal mengambil riwayat mutasi' }, { status: 500 });
  }
}
