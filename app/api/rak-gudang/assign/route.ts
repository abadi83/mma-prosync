import { NextRequest } from 'next/server';
import { assignSku, updateAssign, deleteAssign } from '@/app/services/rakGudangService';
import { apiSuccess, apiCreated, apiBadRequest, apiNotFound, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired } from '@/app/lib/validation';

export const dynamic = 'force-dynamic';

/** POST /api/rak-gudang/assign — taruh SKU di rak + susun (ambalan 1-5) */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const err = validateRequired({ rakId: body.rakId, sku: body.sku });
    if (err) return apiBadRequest(err);
    const res = await assignSku(undefined, {
      rakId: body.rakId,
      ambalan: body.ambalan ? Number(body.ambalan) : 1,
      sku: body.sku,
      namaSku: body.namaSku,
      catatan: body.catatan,
    });
    if (!res.ok) return apiBadRequest(res.error || 'Gagal menyimpan penempatan.');
    return apiCreated({ success: true });
  } catch (e: any) {
    console.error('POST /api/rak-gudang/assign error:', e?.message);
    return apiServerError('POST /api/rak-gudang/assign');
  }
}

/** PUT /api/rak-gudang/assign — pindah susun / ubah catatan */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return apiBadRequest('id wajib');
    const ok = await updateAssign(undefined, body.id, {
      ambalan: body.ambalan !== undefined ? Number(body.ambalan) : undefined,
      catatan: body.catatan,
    });
    if (!ok) return apiNotFound('Penempatan tidak ditemukan.');
    return apiSuccess({ success: true });
  } catch (e: any) {
    console.error('PUT /api/rak-gudang/assign error:', e?.message);
    return apiServerError('PUT /api/rak-gudang/assign');
  }
}

/** DELETE /api/rak-gudang/assign?id= — lepas SKU dari rak */
export async function DELETE(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return apiBadRequest('Parameter id wajib');
    const ok = await deleteAssign(undefined, id);
    if (!ok) return apiNotFound('Penempatan tidak ditemukan.');
    return apiSuccess({ deleted: true });
  } catch (e: any) {
    console.error('DELETE /api/rak-gudang/assign error:', e?.message);
    return apiServerError('DELETE /api/rak-gudang/assign');
  }
}
