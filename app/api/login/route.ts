import { loginUser } from '@/app/services/authService';
import { apiSuccess, apiBadRequest, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired, runValidations } from '@/app/lib/validation';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const err = runValidations(validateRequired({ email, password }));
    if (err) return apiBadRequest(err);

    const result = await loginUser(email, password);
    if ('error' in result) return apiBadRequest(result.error);
    return apiSuccess(result);
  } catch {
    return apiServerError('POST /api/login');
  }
}
