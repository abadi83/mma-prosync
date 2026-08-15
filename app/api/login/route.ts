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

    // Set auth cookies
    const cookieOptions = 'Path=/; Max-Age=86400; SameSite=Lax; HttpOnly';
    const headers = new Headers();
    headers.append('Set-Cookie', `auth_token=${encodeURIComponent(result.token)}; ${cookieOptions}`);
    headers.append('Set-Cookie', `user_name=${encodeURIComponent(result.nama)}; Path=/; Max-Age=86400; SameSite=Lax`);
    headers.append('Set-Cookie', `user_role=${encodeURIComponent(result.role)}; Path=/; Max-Age=86400; SameSite=Lax`);
    headers.append('Set-Cookie', `user_roles=${encodeURIComponent(result.roles.join(','))}; Path=/; Max-Age=86400; SameSite=Lax`);
    if (result.pegawaiId) headers.append('Set-Cookie', `user_pegawai_id=${encodeURIComponent(result.pegawaiId)}; Path=/; Max-Age=86400; SameSite=Lax`);

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...Object.fromEntries(headers) },
    });
  } catch {
    return apiServerError('POST /api/login');
  }
}
