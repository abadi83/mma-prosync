import { NextRequest } from 'next/server';
import { listTugas, getTugas, listProgress, createTugas, updateTugas, deleteTugas, TugasActor } from '@/app/services/tugasService';
import { apiSuccess, apiCreated, apiBadRequest, apiNotFound, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired } from '@/app/lib/validation';
import { recordActivities } from '@/app/services/activityService';

export const dynamic = 'force-dynamic';

/** Identitas user dari cookie login (sama seperti /api/activity — tidak bisa dipalsukan) */
function getActor(request: NextRequest): TugasActor {
  const pegawaiId = request.cookies.get('user_pegawai_id')?.value || null;
  const nama = request.cookies.get('user_name')?.value || 'User';
  return { nama, pegawaiId };
}

/** GET /api/tugas?status=&petugas_id=&search=&id= */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      const item = await getTugas(undefined, id);
      if (!item) return apiNotFound('Tugas tidak ditemukan.');
      return apiSuccess({ ...item, riwayat: await listProgress(id) });
    }
    const data = await listTugas(undefined, {
      status: searchParams.get('status') || undefined,
      petugasId: searchParams.get('petugas_id') || undefined,
      search: searchParams.get('search') || undefined,
    });
    return apiSuccess(data);
  } catch (e: any) {
    console.error('GET /api/tugas error:', e?.message);
    return apiServerError('GET /api/tugas');
  }
}

/** POST /api/tugas — buat tugas baru (pemberi = user yang login) */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const err = validateRequired({ judul: body.judul });
    if (err) return apiBadRequest(err);

    const actor = getActor(request);
    const item = await createTugas(undefined, {
      judul: body.judul,
      deskripsi: body.deskripsi,
      petugasId: body.petugasId || null,
      prioritas: body.prioritas,
      tanggalMulai: body.tanggalMulai || null,
      tenggat: body.tenggat || null,
    }, actor);

    await recordActivities([{ modul: 'tugas', aksi: 'tambah', refLabel: item.judul, detail: { petugas: item.petugasNama || '', tenggat: item.tenggat || '' } }], { username: actor.pegawaiId || actor.nama, namaUser: actor.nama });
    return apiCreated(item);
  } catch (e: any) {
    console.error('POST /api/tugas error:', e?.message);
    return apiServerError('POST /api/tugas');
  }
}

/** PUT /api/tugas — update: edit deskripsi, assign ulang, progress, status, laporan selesai */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return apiBadRequest('id wajib');

    const actor = getActor(request);
    const item = await updateTugas(undefined, body.id, {
      judul: body.judul,
      deskripsi: body.deskripsi,
      petugasId: body.petugasId,
      prioritas: body.prioritas,
      tanggalMulai: body.tanggalMulai,
      tenggat: body.tenggat,
      progress: body.progress,
      status: body.status,
      laporanSelesai: body.laporanSelesai,
      catatan: body.catatan,
    }, actor);
    if (!item) return apiNotFound('Tugas tidak ditemukan.');

    const aksi = body.status === 'selesai' ? 'selesai'
      : body.progress !== undefined ? 'progress'
      : body.petugasId !== undefined ? 'assign'
      : 'ubah';
    await recordActivities([{ modul: 'tugas', aksi, refLabel: item.judul, detail: { status: item.status, progress: item.progress, petugas: item.petugasNama || '' } }], { username: actor.pegawaiId || actor.nama, namaUser: actor.nama });
    return apiSuccess(item);
  } catch (e: any) {
    console.error('PUT /api/tugas error:', e?.message);
    return apiServerError('PUT /api/tugas');
  }
}

/** DELETE /api/tugas?id= */
export async function DELETE(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return apiBadRequest('Parameter id wajib');
    const ok = await deleteTugas(undefined, id);
    if (!ok) return apiNotFound('Tugas tidak ditemukan.');
    return apiSuccess({ deleted: true });
  } catch (e: any) {
    console.error('DELETE /api/tugas error:', e?.message);
    return apiServerError('DELETE /api/tugas');
  }
}
