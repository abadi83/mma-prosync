import { NextRequest } from 'next/server';
import {
  listBeritaInternal, latestPerKategori, createBeritaInternal, updateBeritaInternal, deleteBeritaInternal,
} from '@/app/services/beritaInternalService';
import { KATEGORI_BERITA } from '@/app/lib/beritaInternal';
import { apiSuccess, apiCreated, apiBadRequest, apiNotFound, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired } from '@/app/lib/validation';
import { recordActivities } from '@/app/services/activityService';

export const dynamic = 'force-dynamic';

function getActor(request: NextRequest): { nama: string; pegawaiId?: string | null } {
  return {
    nama: request.cookies.get('user_name')?.value || 'User',
    pegawaiId: request.cookies.get('user_pegawai_id')?.value || null,
  };
}

/** GET /api/berita-internal?kategori=&limit= | ?latest=1 (1 terbaru per kategori) */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('latest')) {
      return apiSuccess(await latestPerKategori());
    }
    const data = await listBeritaInternal(undefined, {
      kategori: searchParams.get('kategori') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
    });
    return apiSuccess(data);
  } catch (e: any) {
    console.error('GET /api/berita-internal error:', e?.message);
    return apiServerError('GET /api/berita-internal');
  }
}

/** POST /api/berita-internal — buat berita internal */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const err = validateRequired({ judul: body.judul, kategori: body.kategori });
    if (err) return apiBadRequest(err);
    if (!KATEGORI_BERITA.some(k => k.key === body.kategori)) return apiBadRequest('Kategori tidak dikenal.');

    const actor = getActor(request);
    const item = await createBeritaInternal(undefined, {
      kategori: body.kategori,
      judul: body.judul,
      isi: body.isi,
      penulisId: body.penulisId || null,
      penulisNama: body.penulisNama,
      waktu: body.waktu,
      gambarBg: body.gambarBg,
    }, actor);

    await recordActivities([{ modul: 'operasional', aksi: 'berita-internal', refLabel: item.judul, detail: { kategori: item.kategori, penulis: item.penulisNama } }], { username: actor.pegawaiId || actor.nama, namaUser: actor.nama });
    return apiCreated(item);
  } catch (e: any) {
    console.error('POST /api/berita-internal error:', e?.message);
    return apiServerError('POST /api/berita-internal');
  }
}

/** PUT /api/berita-internal — edit berita */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return apiBadRequest('id wajib');
    if (body.kategori !== undefined && !KATEGORI_BERITA.some(k => k.key === body.kategori)) return apiBadRequest('Kategori tidak dikenal.');
    const item = await updateBeritaInternal(undefined, body.id, {
      kategori: body.kategori,
      judul: body.judul,
      isi: body.isi,
      penulisId: body.penulisId,
      penulisNama: body.penulisNama,
      waktu: body.waktu,
      gambarBg: body.gambarBg,
    });
    if (!item) return apiNotFound('Berita tidak ditemukan.');
    return apiSuccess(item);
  } catch (e: any) {
    console.error('PUT /api/berita-internal error:', e?.message);
    return apiServerError('PUT /api/berita-internal');
  }
}

/** DELETE /api/berita-internal?id= */
export async function DELETE(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return apiBadRequest('Parameter id wajib');
    const ok = await deleteBeritaInternal(undefined, id);
    if (!ok) return apiNotFound('Berita tidak ditemukan.');
    return apiSuccess({ deleted: true });
  } catch (e: any) {
    console.error('DELETE /api/berita-internal error:', e?.message);
    return apiServerError('DELETE /api/berita-internal');
  }
}
