import { NextRequest } from 'next/server';
import { promoteToSku, RndActor } from '@/app/services/rndService';
import { apiSuccess, apiBadRequest, apiServerError } from '@/app/lib/apiResponse';
import { recordActivities } from '@/app/services/activityService';

export const dynamic = 'force-dynamic';

function getActor(request: NextRequest): RndActor {
  const pegawaiId = request.cookies.get('user_pegawai_id')?.value || null;
  const nama = request.cookies.get('user_name')?.value || 'User';
  return { nama, pegawaiId };
}

/** POST /api/rnd/promote — masukkan research ke Master Data SKU */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return apiBadRequest('id wajib');
    const actor = getActor(request);
    const result = await promoteToSku(undefined, body.id, actor);
    if (!result.ok) return apiBadRequest(result.error || 'Gagal memasukkan ke SKU.');
    await recordActivities([{ modul: 'sku', aksi: 'tambah', refLabel: result.sku, detail: { sumber: 'R&D' } }], { username: actor.pegawaiId || actor.nama, namaUser: actor.nama });
    return apiSuccess(result);
  } catch (e: any) {
    console.error('POST /api/rnd/promote error:', e?.message);
    return apiServerError('POST /api/rnd/promote');
  }
}
