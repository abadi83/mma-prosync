import { NextResponse } from 'next/server';
import { getBarangMasuk, addBarangMasuk } from '@/app/services/barangMasukService';
import { apiSuccess, apiCreated, apiBadRequest, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired, validatePositiveNumber, runValidations } from '@/app/lib/validation';

export const dynamic = 'force-dynamic';

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokoId = searchParams.get('toko_id') ?? DEFAULT_TOKO;
    const data = await getBarangMasuk(tokoId);
    return apiSuccess(data);
  } catch (error) {
    return apiServerError('GET /api/barang-masuk');
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { produk, jumlah, supplier, tanggal } = body;

    const error = runValidations(
      validateRequired({ produk, jumlah, supplier, tanggal }),
      validatePositiveNumber(jumlah, 'jumlah'),
    );

    if (error) return apiBadRequest(error);

    const tokoId = body.toko_id ?? DEFAULT_TOKO;
    const entry = await addBarangMasuk(tokoId, { produk, jumlah, supplier, tanggal });
    return apiCreated(entry);
  } catch (error) {
    return apiServerError('POST /api/barang-masuk');
  }
}
