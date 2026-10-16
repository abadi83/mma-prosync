import crypto from 'crypto';
import { apiSuccess, apiBadRequest, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired, runValidations } from '@/app/lib/validation';
import { query } from '@/lib/db';
import { hashPassword } from '@/app/lib/password';

const TOKEN_RE = /^[a-f0-9]{64}$/i;

export async function POST(request: Request) {
  try {
    const { token, password, konfirmasi } = await request.json();
    const err = runValidations(validateRequired({ token, password, konfirmasi }));
    if (err) return apiBadRequest(err);
    if (password !== konfirmasi) return apiBadRequest('Password tidak cocok.');
    if (password.length < 6) return apiBadRequest('Password minimal 6 karakter.');
    if (typeof token !== 'string' || !TOKEN_RE.test(token.trim())) return apiBadRequest('Token reset tidak valid.');

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const { rows } = await query(
      'SELECT email, expires_at, used FROM password_reset_tokens WHERE token_hash = $1',
      [tokenHash]
    );
    if (rows.length === 0) return apiBadRequest('Token reset tidak valid atau sudah kedaluwarsa.');
    const row = rows[0];
    if (row.used) return apiBadRequest('Token reset sudah dipakai.');
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return apiBadRequest('Token reset sudah kedaluwarsa. Minta link baru.');
    }

    // Update password user (owner) atau pegawai sesuai pemilik email
    const { rows: users } = await query('SELECT id FROM users WHERE email = $1', [row.email]);
    if (users.length > 0) {
      await query('UPDATE users SET password_hash = $1 WHERE email = $2', [hashPassword(password), row.email]);
    } else {
      const { rows: pegawai } = await query('SELECT id FROM pegawai WHERE email = $1', [row.email]);
      if (pegawai.length === 0) return apiBadRequest('Akun tidak ditemukan.');
      await query('UPDATE pegawai SET password_hash = $1, updated_at = NOW() WHERE email = $2', [hashPassword(password), row.email]);
    }

    // Tandai token terpakai (sekali pakai)
    await query('UPDATE password_reset_tokens SET used = TRUE WHERE token_hash = $1', [tokenHash]);

    return apiSuccess({ message: 'Password berhasil direset. Silakan login.' });
  } catch {
    return apiServerError('POST /api/reset-password');
  }
}
