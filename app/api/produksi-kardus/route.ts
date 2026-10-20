import { NextRequest } from 'next/server';
import {
  listProduksiKardus, ringkasanProduksiKardus, createProduksiKardus, updateProduksiKardus, deleteProduksiKardus,
  KARDUS_KATEGORI,
} from '@/app/services/produksiKardusService';
import { apiSuccess, apiCreated, apiBadRequest, apiNotFound, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired, validatePositiveNumber } from '@/app/lib/validation';
import { recordActivities } from '@/app/services/activityService';

export const dynamic = 'force-dynamic';

function getActor(request: NextRequest): { nama: string; pegawaiId?: string | null } {
  return {
    nama: request.cookies.get('user_name')?.value || 'User',
    pegawaiId: request.cookies.get('user_pegawai_id')?.value || null,
  };
}

/** GET /api/produksi-kardus?dari=&sampai=&kategori=&limit= | ?ringkasan=1 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('ringkasan')) {
      return apiSuccess(await ringkasanProduksiKardus());
    }
    const data = await listProduksiKardus(undefined, {
      dari: searchParams.get('dari') || undefined,
      sampai: searchParams.get('sampai') || undefined,
      kategori: searchParams.get('kategori') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
    });
    return apiSuccess(data);
  } catch (e: any) {
    console.error('GET /api/produksi-kardus error:', e?.message);
    return apiServerError('GET /api/produksi-kardus');
  }
}

/** POST /api/produksi-kardus — input produksi harian */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const err = validateRequired({ kategori: body.kategori })
      || validatePositiveNumber(body.qty, 'qty');
    if (err) return apiBadRequest(err);
    const kategoriValid = KARDUS_KATEGORI.some(k => k.key === body.kategori);
    if (!kategoriValid) return apiBadRequest('Kategori tidak dikenal.');

    const actor = getActor(request);
    const item = await createProduksiKardus(undefined, {
      kategori: body.kategori,
      ukuran: body.ukuran,
      qty: Number(body.qty),
      tanggal: body.tanggal,
      catatan: body.catatan,
    }, actor);

    await recordActivities([{ modul: 'operasional', aksi: 'produksi-kardus', refLabel: `${item.kategori} ${item.ukuran}`.trim(), detail: { qty: item.qty, tanggal: item.tanggal } }], { username: actor.pegawaiId || actor.nama, namaUser: actor.nama });
    return apiCreated(item);
  } catch (e: any) {
    console.error('POST /api/produksi-kardus error:', e?.message);
    return apiServerError('POST /api/produksi-kardus');
  }
}

/** PUT /api/produksi-kardus — edit entry */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return apiBadRequest('id wajib');
    if (body.qty !== undefined) {
      const err = validatePositiveNumber(body.qty, 'qty');
      if (err) return apiBadRequest(err);
    }
    const item = await updateProduksiKardus(undefined, body.id, {
      kategori: body.kategori,
      ukuran: body.ukuran,
      qty: body.qty !== undefined ? Number(body.qty) : undefined,
      tanggal: body.tanggal,
      catatan: body.catatan,
    });
    if (!item) return apiNotFound('Data produksi tidak ditemukan.');
    return apiSuccess(item);
  } catch (e: any) {
    console.error('PUT /api/produksi-kardus error:', e?.message);
    return apiServerError('PUT /api/produksi-kardus');
  }
}

/** DELETE /api/produksi-kardus?id= */
export async function DELETE(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return apiBadRequest('Parameter id wajib');
    const ok = await deleteProduksiKardus(undefined, id);
    if (!ok) return apiNotFound('Data produksi tidak ditemukan.');
    return apiSuccess({ deleted: true });
  } catch (e: any) {
    console.error('DELETE /api/produksi-kardus error:', e?.message);
    return apiServerError('DELETE /api/produksi-kardus');
  }
}
