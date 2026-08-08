import { getProfil, updateProfil } from '@/app/services/profilService';
import { apiSuccess, apiBadRequest, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired } from '@/app/lib/validation';

export async function GET() { try { return apiSuccess(await getProfil()); } catch { return apiServerError('GET /api/profil'); } }

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const err = validateRequired({ nama: body.nama ?? 'x' });
    if (err) return apiBadRequest(err);
    return apiSuccess(await updateProfil(body));
  } catch { return apiServerError('PUT /api/profil'); }
}
