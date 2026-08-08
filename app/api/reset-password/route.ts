import { apiSuccess, apiBadRequest, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired, runValidations } from '@/app/lib/validation';

export async function POST(request: Request) {
  try {
    const { token, password, konfirmasi } = await request.json();
    const err = runValidations(validateRequired({ token, password, konfirmasi }));
    if (err) return apiBadRequest(err);
    if (password !== konfirmasi) return apiBadRequest('Password tidak cocok.');
    if (password.length < 6) return apiBadRequest('Password minimal 6 karakter.');

    // Simulasi verifikasi token & update password
    return apiSuccess({ message: 'Password berhasil direset.' });
  } catch {
    return apiServerError('POST /api/reset-password');
  }
}
