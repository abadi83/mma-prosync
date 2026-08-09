import { NextResponse } from 'next/server';
import { getRingkasanHarian } from '@/app/services/ringkasanHarianService';

export const dynamic = 'force-dynamic';

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

/**
 * GET /api/ringkasan-harian?toko_id=<uuid>&tanggal=YYYY-MM-DD
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokoId = searchParams.get('toko_id') ?? DEFAULT_TOKO;
    const tanggal = searchParams.get('tanggal') ?? undefined;

    const data = await getRingkasanHarian(tokoId, tanggal);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/ringkasan-harian error:', error);
    return NextResponse.json({ error: 'Gagal mengambil ringkasan harian' }, { status: 500 });
  }
}
