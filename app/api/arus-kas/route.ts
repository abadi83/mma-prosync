import { getArusKas } from '@/app/services/arusKasService';
import { apiSuccess, apiServerError } from '@/app/lib/apiResponse';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await getArusKas(
      searchParams.get('toko_id') ?? 'a0a0a0a0-0000-0000-0000-000000000001',
      searchParams.get('periode') ?? undefined,
    );
    return apiSuccess(data);
  } catch {
    return apiServerError('GET /api/arus-kas');
  }
}
