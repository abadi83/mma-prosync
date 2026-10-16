import { apiSuccess, apiBadRequest, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired, runValidations } from '@/app/lib/validation';
import { query } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/app/lib/password';
import { AUTH_COOKIE, verifyAuthToken } from '@/app/lib/authToken';

export async function POST(request: Request) {
  try {
    const { oldPassword, newPassword, konfirmasi } = await request.json();
    const err = runValidations(validateRequired({ oldPassword, newPassword, konfirmasi }));
    if (err) return apiBadRequest(err);
    if (newPassword.length < 6) return apiBadRequest('Password baru minimal 6 karakter.');
    if (newPassword !== konfirmasi) return apiBadRequest('Konfirmasi tidak cocok.');

    // Wajib login — identitas dari token yang terverifikasi
    const cookieHeader = request.headers.get('cookie') || '';
    const token = cookieHeader.match(new RegExp(`(?:^|;\\s*)${AUTH_COOKIE}=([^;]*)`))?.[1];
    const payload = verifyAuthToken(token);
    if (!payload) {
      return Response.json({ error: 'Sesi berakhir. Silakan login ulang.' }, { status: 401 });
    }

    if (payload.pegawaiId) {
      const { rows } = await query('SELECT password_hash FROM pegawai WHERE id = $1', [payload.pegawaiId]);
      const row = rows[0];
      if (!row || !verifyPassword(oldPassword, row.password_hash)) return apiBadRequest('Password lama salah.');
      await query('UPDATE pegawai SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hashPassword(newPassword), payload.pegawaiId]);
    } else {
      const { rows } = await query('SELECT password_hash FROM users WHERE email = $1', [payload.sub]);
      const row = rows[0];
      if (!row || !verifyPassword(oldPassword, row.password_hash)) return apiBadRequest('Password lama salah.');
      await query('UPDATE users SET password_hash = $1 WHERE email = $2', [hashPassword(newPassword), payload.sub]);
    }

    return apiSuccess({ message: 'Password berhasil diubah.' });
  } catch { return apiServerError('POST /api/ubah-password'); }
}
