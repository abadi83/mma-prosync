import { NextRequest } from 'next/server';
import { listRnd, getRnd, listProgress, createRnd, updateRnd, deleteRnd, promoteToSku, RndActor } from '@/app/services/rndService';
import { apiSuccess, apiCreated, apiBadRequest, apiNotFound, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired } from '@/app/lib/validation';
import { recordActivities } from '@/app/services/activityService';

export const dynamic = 'force-dynamic';

function getActor(request: NextRequest): RndActor {
  const pegawaiId = request.cookies.get('user_pegawai_id')?.value || null;
  const nama = request.cookies.get('user_name')?.value || 'User';
  return { nama, pegawaiId };
}

/** GET /api/rnd?status=&petugas_id=&search=&id= */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      const item = await getRnd(undefined, id);
      if (!item) return apiNotFound('Research tidak ditemukan.');
      return apiSuccess({ ...item, riwayat: await listProgress(id) });
    }
    const data = await listRnd(undefined, {
      status: searchParams.get('status') || undefined,
      petugasId: searchParams.get('petugas_id') || undefined,
      search: searchParams.get('search') || undefined,
    });
    return apiSuccess(data);
  } catch (e: any) {
    console.error('GET /api/rnd error:', e?.message);
    return apiServerError('GET /api/rnd');
  }
}

/** POST /api/rnd — buat tugas research produk baru */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const err = validateRequired({ namaBarang: body.namaBarang });
    if (err) return apiBadRequest(err);

    const actor = getActor(request);
    const item = await createRnd(undefined, {
      namaBarang: body.namaBarang,
      kategori: body.kategori,
      supplier: body.supplier,
      linkWeb: body.linkWeb,
      fotoContoh: body.fotoContoh,
      hargaModalTarget: body.hargaModalTarget,
      catatan: body.catatan,
      petugasIds: Array.isArray(body.petugasIds) ? body.petugasIds : (body.petugasId ? [body.petugasId] : []),
      prioritas: body.prioritas,
      tenggat: body.tenggat || null,
    }, actor);

    await recordActivities([{ modul: 'rnd', aksi: 'tambah', refLabel: item.namaBarang, detail: { petugas: item.petugas.map(p => p.nama).join(', '), tenggat: item.tenggat || '' } }], { username: actor.pegawaiId || actor.nama, namaUser: actor.nama });
    return apiCreated(item);
  } catch (e: any) {
    console.error('POST /api/rnd error:', e?.message);
    return apiServerError('POST /api/rnd');
  }
}

/** PUT /api/rnd — update: edit detail, assign ulang, hasil research, status */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return apiBadRequest('id wajib');

    const actor = getActor(request);
    const item = await updateRnd(undefined, body.id, {
      namaBarang: body.namaBarang,
      kategori: body.kategori,
      supplier: body.supplier,
      linkWeb: body.linkWeb,
      fotoContoh: body.fotoContoh,
      hargaModalTarget: body.hargaModalTarget,
      hargaModalFinal: body.hargaModalFinal,
      catatan: body.catatan,
      hasilResearch: body.hasilResearch,
      petugasIds: Array.isArray(body.petugasIds) ? body.petugasIds : (body.petugasId ? [body.petugasId] : undefined),
      prioritas: body.prioritas,
      tenggat: body.tenggat,
      status: body.status,
    }, actor);
    if (!item) return apiNotFound('Research tidak ditemukan.');

    const aksi = body.status === 'selesai' ? 'selesai'
      : body.hasilResearch !== undefined ? 'hasil'
      : body.petugasIds !== undefined || body.petugasId !== undefined ? 'assign'
      : 'ubah';
    await recordActivities([{ modul: 'rnd', aksi, refLabel: item.namaBarang, detail: { status: item.status, hargaModalFinal: item.hargaModalFinal, petugas: item.petugas.map(p => p.nama).join(', ') } }], { username: actor.pegawaiId || actor.nama, namaUser: actor.nama });
    return apiSuccess(item);
  } catch (e: any) {
    console.error('PUT /api/rnd error:', e?.message);
    return apiServerError('PUT /api/rnd');
  }
}

/** DELETE /api/rnd?id= */
export async function DELETE(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return apiBadRequest('Parameter id wajib');
    const ok = await deleteRnd(undefined, id);
    if (!ok) return apiNotFound('Research tidak ditemukan.');
    return apiSuccess({ deleted: true });
  } catch (e: any) {
    console.error('DELETE /api/rnd error:', e?.message);
    return apiServerError('DELETE /api/rnd');
  }
}
