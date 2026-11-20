import { getInfoToko, updateInfoToko } from '@/app/services/tokoService';
import { apiSuccess, apiServerError } from '@/app/lib/apiResponse';

export const dynamic = 'force-dynamic';

export async function GET() { try { return apiSuccess(await getInfoToko()); } catch (e: any) { console.error('GET /api/info-toko error:', e?.message); return apiServerError('GET /api/info-toko'); } }
export async function PUT(request: Request) {
  try { const body = await request.json(); return apiSuccess(await updateInfoToko(body)); }
  catch (e: any) { console.error('PUT /api/info-toko error:', e?.message); return apiServerError('PUT /api/info-toko'); }
}
