import { getInfoToko, updateInfoToko } from '@/app/services/tokoService';
import { apiSuccess, apiServerError } from '@/app/lib/apiResponse';

export async function GET() { try { return apiSuccess(await getInfoToko()); } catch { return apiServerError('GET /api/info-toko'); } }
export async function PUT(request: Request) {
  try { const body = await request.json(); return apiSuccess(await updateInfoToko(body)); }
  catch { return apiServerError('PUT /api/info-toko'); }
}
