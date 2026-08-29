import { NextResponse } from 'next/server';
import { getTransaksi, createTransaksi } from '@/app/services/transaksiService';
import { apiSuccess, apiCreated, apiBadRequest, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired, validatePositiveNumber, validateDate, runValidations } from '@/app/lib/validation';

export const dynamic = 'force-dynamic';

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokoId = searchParams.get('toko_id') ?? DEFAULT_TOKO;
    const data = await getTransaksi(tokoId);
    return apiSuccess(data);
  } catch (error) {
    return apiServerError('GET /api/transaksi');
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { produk, jumlah, hargaSatuan, tanggal, diskon } = body;

    const error = runValidations(
      validateRequired({ produk, jumlah, hargaSatuan }),
      validatePositiveNumber(jumlah, 'jumlah'),
      validatePositiveNumber(hargaSatuan, 'hargaSatuan'),
      tanggal != null ? validateDate(tanggal, 'tanggal') : null,
    );

    if (error) return apiBadRequest(error);

    const tokoId = body.toko_id ?? DEFAULT_TOKO;
    const entry = await createTransaksi(tokoId, {
      produk,
      jumlah,
      hargaSatuan,
      pelanggan: body.pelanggan ?? 'Umum',
      tanggal: tanggal ?? new Date().toISOString().slice(0, 10),
      diskon: diskon != null ? Number(diskon) : undefined,
    });

    return apiCreated(entry);
  } catch (error) {
    return apiServerError('POST /api/transaksi');
  }
}
