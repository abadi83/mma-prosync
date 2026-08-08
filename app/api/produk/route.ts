import { getProduk, createProduk, updateProduk, deleteProduk } from '@/app/services/produkService';
import { apiSuccess, apiCreated, apiBadRequest, apiNotFound, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired, validatePositiveNumber, runValidations } from '@/app/lib/validation';

export async function GET() {
  try { return apiSuccess(await getProduk()); }
  catch { return apiServerError('GET /api/produk'); }
}

export async function POST(request: Request) {
  try {
    const { nama, kategoriId, kategoriNama, hargaBeli, hargaJual, stokMin } = await request.json();
    const err = runValidations(
      validateRequired({ nama, kategoriId, kategoriNama, hargaBeli, hargaJual, stokMin }),
      validatePositiveNumber(hargaBeli, 'hargaBeli'),
      validatePositiveNumber(hargaJual, 'hargaJual'),
      validatePositiveNumber(stokMin, 'stokMin'),
    );
    if (err) return apiBadRequest(err);
    return apiCreated(await createProduk({ nama, kategoriId, kategoriNama, hargaBeli, hargaJual, stokMin }));
  } catch { return apiServerError('POST /api/produk'); }
}

export async function PUT(request: Request) {
  try {
    const { id, nama, kategoriId, kategoriNama, hargaBeli, hargaJual, stokMin } = await request.json();
    const err = runValidations(
      validateRequired({ id, nama, kategoriId, kategoriNama, hargaBeli, hargaJual, stokMin }),
      validatePositiveNumber(hargaBeli, 'hargaBeli'),
      validatePositiveNumber(hargaJual, 'hargaJual'),
      validatePositiveNumber(stokMin, 'stokMin'),
    );
    if (err) return apiBadRequest(err);
    const item = await updateProduk(id, { nama, kategoriId, kategoriNama, hargaBeli, hargaJual, stokMin });
    if (!item) return apiNotFound();
    return apiSuccess(item);
  } catch { return apiServerError('PUT /api/produk'); }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return apiBadRequest('Parameter id wajib');
    const ok = await deleteProduk(id);
    if (!ok) return apiNotFound();
    return apiSuccess({ deleted: true });
  } catch { return apiServerError('DELETE /api/produk'); }
}
