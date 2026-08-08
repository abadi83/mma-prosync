import { apiSuccess, apiBadRequest, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired } from '@/app/lib/validation';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    const err = validateRequired({ email });
    if (err) return apiBadRequest(err);

    // Simulasi pengiriman email reset password
    console.log(`[Lupa Password] Reset link dikirim ke: ${email}`);
    return apiSuccess({ message: 'Link reset password telah dikirim ke email Anda.' });
  } catch {
    return apiServerError('POST /api/lupa-password');
  }
}
