import { apiSuccess, apiBadRequest, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired, runValidations } from '@/app/lib/validation';

export async function POST(request: Request) {
  try {
    const { oldPassword, newPassword, konfirmasi } = await request.json();
    const err = runValidations(validateRequired({ oldPassword, newPassword, konfirmasi }));
    if (err) return apiBadRequest(err);
    if (oldPassword !== 'demo123') return apiBadRequest('Password lama salah.');
    if (newPassword.length < 6) return apiBadRequest('Password baru minimal 6 karakter.');
    if (newPassword !== konfirmasi) return apiBadRequest('Konfirmasi tidak cocok.');
    return apiSuccess({ message: 'Password berhasil diubah.' });
  } catch { return apiServerError('POST /api/ubah-password'); }
}
