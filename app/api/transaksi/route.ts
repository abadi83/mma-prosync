import { NextResponse } from 'next/server';
import { todayLocal } from '@/app/lib/dateLocal';
import { getTransaksi, createTransaksi, deleteTransaksiById, deleteTransaksiByMatch } from '@/app/services/transaksiService';
import { apiSuccess, apiCreated, apiBadRequest, apiNotFound, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired, validatePositiveNumber, validateDate, runValidations } from '@/app/lib/validation';

export const dynamic = 'force-dynamic';

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const tokoId = body.toko_id ?? DEFAULT_TOKO;

    // Jalur utama: hapus by id DB (presisi — tidak mungkin salah transaksi)
    if (body.id) {
      const ok = await deleteTransaksiById(tokoId, String(body.id));
      if (!ok) return apiNotFound('Transaksi tidak ditemukan.');
      return apiSuccess({ deleted: 1 });
    }

    // Fallback baris lama tanpa dbId: match by (tanggal, produk, total)
    const { tanggal, produk, total } = body;
    if (!tanggal || !produk || total == null) return apiBadRequest('id (atau tanggal, produk, dan total) wajib diisi.');
    const count = await deleteTransaksiByMatch(tokoId, { tanggal, produk, total: Number(total) });
    return apiSuccess({ deleted: count });
  } catch (error) {
    return apiServerError('DELETE /api/transaksi');
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokoId = searchParams.get('toko_id') ?? DEFAULT_TOKO;
    const pelangganId = searchParams.get('pelanggan_id') ?? undefined;
    const data = await getTransaksi(tokoId, pelangganId ? { pelangganId } : undefined);
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
      pelangganId: body.pelangganId ?? undefined,
      tanggal: tanggal ?? todayLocal(),
      diskon: diskon != null ? Number(diskon) : undefined,
    });

    return apiCreated(entry);
  } catch (error) {
    return apiServerError('POST /api/transaksi');
  }
}
