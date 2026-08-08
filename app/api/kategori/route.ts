import { getKategori, createKategori, updateKategori, deleteKategori } from '@/app/services/kategoriService';
import { apiSuccess, apiCreated, apiBadRequest, apiNotFound, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired } from '@/app/lib/validation';

export async function GET() {
  try { return apiSuccess(await getKategori()); }
  catch { return apiServerError('GET /api/kategori'); }
}

export async function POST(request: Request) {
  try {
    const { nama } = await request.json();
    const err = validateRequired({ nama });
    if (err) return apiBadRequest(err);
    return apiCreated(await createKategori(nama));
  } catch { return apiServerError('POST /api/kategori'); }
}

export async function PUT(request: Request) {
  try {
    const { id, nama } = await request.json();
    const err = validateRequired({ id, nama });
    if (err) return apiBadRequest(err);
    const item = await updateKategori(id, nama);
    if (!item) return apiNotFound('Kategori tidak ditemukan');
    return apiSuccess(item);
  } catch { return apiServerError('PUT /api/kategori'); }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return apiBadRequest('Parameter id wajib diisi');
    const ok = await deleteKategori(id);
    if (!ok) return apiNotFound('Kategori tidak ditemukan');
    return apiSuccess({ deleted: true });
  } catch { return apiServerError('DELETE /api/kategori'); }
}
