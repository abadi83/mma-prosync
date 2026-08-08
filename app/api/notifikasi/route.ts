import { getNotifikasi, markRead, markAllRead } from '@/app/services/notifikasiService';
import { apiSuccess, apiNotFound, apiServerError } from '@/app/lib/apiResponse';

export async function GET() { try { return apiSuccess(await getNotifikasi()); } catch { return apiServerError('GET /api/notifikasi'); } }

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) { const n = await markRead(id); if (!n) return apiNotFound(); return apiSuccess(n); }
    await markAllRead(); return apiSuccess({ allRead: true });
  } catch { return apiServerError('PUT /api/notifikasi'); }
}
