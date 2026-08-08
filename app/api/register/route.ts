import { registerUser } from '@/app/services/authService';
import { apiCreated, apiBadRequest, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired, runValidations } from '@/app/lib/validation';

export async function POST(request: Request) {
  try {
    const { namaToko, email, password } = await request.json();
    const err = runValidations(validateRequired({ namaToko, email, password }));
    if (err) return apiBadRequest(err);
    if (password.length < 6) return apiBadRequest('Password minimal 6 karakter.');

    const result = await registerUser(namaToko, email, password);
    if ('error' in result) return apiBadRequest(result.error);
    return apiCreated(result);
  } catch {
    return apiServerError('POST /api/register');
  }
}
