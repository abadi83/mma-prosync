import { getPelanggan, createPelanggan, updatePelanggan, deletePelanggan, PelangganItem } from '@/app/services/pelangganService';
import { apiSuccess, apiCreated, apiBadRequest, apiNotFound, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired } from '@/app/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET() { try { return apiSuccess(await getPelanggan()); } catch { return apiServerError('GET /api/pelanggan'); } }

export async function POST(request: Request) {
  try {
    const body: Partial<PelangganItem> = await request.json();
    const err = validateRequired({ nama: body.nama });
    if (err) return apiBadRequest(err);
    return apiCreated(await createPelanggan(body as Omit<PelangganItem, 'id'>));
  } catch { return apiServerError('POST /api/pelanggan'); }
}

export async function PUT(request: Request) {
  try {
    const { id, ...rest }: Partial<PelangganItem> & { id: string } = await request.json();
    const err = validateRequired({ id, nama: rest.nama });
    if (err) return apiBadRequest(err);
    const item = await updatePelanggan(id, rest);
    if (!item) return apiNotFound();
    return apiSuccess(item);
  } catch { return apiServerError('PUT /api/pelanggan'); }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return apiBadRequest('Parameter id wajib');
    const ok = await deletePelanggan(id);
    if (!ok) return apiNotFound();
    return apiSuccess({ deleted: true });
  } catch { return apiServerError('DELETE /api/pelanggan'); }
}
