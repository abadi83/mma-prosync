import { NextResponse } from 'next/server';
import { loginUser } from '@/app/services/authService';
import { apiBadRequest, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired, runValidations } from '@/app/lib/validation';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const err = runValidations(validateRequired({ email, password }));
    if (err) return apiBadRequest(err);

    const result = await loginUser(email, password);
    if ('error' in result) return apiBadRequest(result.error);

    // Set auth cookies via NextResponse (cara yang benar untuk multi Set-Cookie)
    const response = NextResponse.json({ success: true, ...result });
    response.cookies.set('auth_token', result.token, { path: '/', maxAge: 86400, sameSite: 'lax', httpOnly: true });
    response.cookies.set('user_name', result.nama, { path: '/', maxAge: 86400, sameSite: 'lax' });
    response.cookies.set('user_role', result.role, { path: '/', maxAge: 86400, sameSite: 'lax' });
    response.cookies.set('user_roles', result.roles.join(','), { path: '/', maxAge: 86400, sameSite: 'lax' });
    if (result.pegawaiId) response.cookies.set('user_pegawai_id', result.pegawaiId, { path: '/', maxAge: 86400, sameSite: 'lax' });

    return response;
  } catch {
    return apiServerError('POST /api/login');
  }
}
