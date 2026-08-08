import { apiSuccess, apiBadRequest, apiServerError } from '@/app/lib/apiResponse';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, base64 } = body;
    if (!type || !base64) return apiBadRequest('Field type (foto/logo) dan base64 wajib.');
    if (!['foto', 'logo'].includes(type)) return apiBadRequest('Type harus foto atau logo.');

    // Simulasi upload — return URL placeholder
    const url = `/uploads/${type}_${Date.now()}.png`;
    return apiSuccess({ url, message: `${type === 'foto' ? 'Foto' : 'Logo'} berhasil diunggah.` });
  } catch { return apiServerError('POST /api/upload'); }
}
