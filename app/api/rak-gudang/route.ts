import { NextRequest } from 'next/server';
import { listRakGudang, createRak, updateRak, deleteRak } from '@/app/services/rakGudangService';
import { apiSuccess, apiCreated, apiBadRequest, apiNotFound, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired } from '@/app/lib/validation';

export const dynamic = 'force-dynamic';

/** GET /api/rak-gudang — semua rak + penempatan SKU per susun */
export async function GET() {
  try {
    return apiSuccess(await listRakGudang());
  } catch (e: any) {
    console.error('GET /api/rak-gudang error:', e?.message);
    return apiServerError('GET /api/rak-gudang');
  }
}

/** POST /api/rak-gudang — tambah rak */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const err = validateRequired({ nomor: body.nomor });
    if (err) return apiBadRequest(err);
    const item = await createRak(undefined, { nomor: body.nomor, nama: body.nama });
    if (!item) return apiBadRequest('Nomor rak wajib diisi.');
    return apiCreated(item);
  } catch (e: any) {
    console.error('POST /api/rak-gudang error:', e?.message);
    if (e?.code === '23505') return apiBadRequest('Nomor rak sudah ada.');
    return apiServerError('POST /api/rak-gudang');
  }
}

/** PUT /api/rak-gudang — ganti nomor/nama rak */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return apiBadRequest('id wajib');
    const item = await updateRak(undefined, body.id, { nomor: body.nomor, nama: body.nama });
    if (!item) return apiNotFound('Rak tidak ditemukan.');
    return apiSuccess(item);
  } catch (e: any) {
    console.error('PUT /api/rak-gudang error:', e?.message);
    if (e?.code === '23505') return apiBadRequest('Nomor rak sudah dipakai rak lain.');
    return apiServerError('PUT /api/rak-gudang');
  }
}

/** DELETE /api/rak-gudang?id= — hapus rak (semua penempatan SKU ikut terhapus) */
export async function DELETE(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return apiBadRequest('Parameter id wajib');
    const ok = await deleteRak(undefined, id);
    if (!ok) return apiNotFound('Rak tidak ditemukan.');
    return apiSuccess({ deleted: true });
  } catch (e: any) {
    console.error('DELETE /api/rak-gudang error:', e?.message);
    return apiServerError('DELETE /api/rak-gudang');
  }
}
