import { getPelanggan, createPelanggan, updatePelanggan, deletePelanggan } from '@/app/services/pelangganService';
import { apiSuccess, apiCreated, apiBadRequest, apiNotFound, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired } from '@/app/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET() { try { return apiSuccess(await getPelanggan()); } catch { return apiServerError('GET /api/pelanggan'); } }

export async function POST(request: Request) {
  try {
    const { nama, kontak } = await request.json();
    const err = validateRequired({ nama });
    if (err) return apiBadRequest(err);
    return apiCreated(await createPelanggan(nama, kontak));
  } catch { return apiServerError('POST /api/pelanggan'); }
}

export async function PUT(request: Request) {
  try {
    const { id, nama, kontak } = await request.json();
    const err = validateRequired({ id, nama });
    if (err) return apiBadRequest(err);
    const item = await updatePelanggan(id, nama, kontak);
    if (!item) return apiNotFound();
    return apiSuccess(item);
  } catch { return apiServerError('PUT /api/pelanggan'); }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return apiBadRequest('Parameter id wajib');
    const ok = await deletePelanggan(id);
    if (!ok) return apiNotFound();
    return apiSuccess({ deleted: true });
  } catch { return apiServerError('DELETE /api/pelanggan'); }
}
