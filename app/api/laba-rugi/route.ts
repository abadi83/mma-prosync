import { getLabaRugi } from '@/app/services/labaRugiService';
import { apiSuccess, apiServerError } from '@/app/lib/apiResponse';

export const dynamic = 'force-dynamic';

const DK = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await getLabaRugi(searchParams.get('toko_id') ?? DK, searchParams.get('periode') ?? undefined);
    return apiSuccess(data);
  } catch {
    return apiServerError('GET /api/laba-rugi');
  }
}
