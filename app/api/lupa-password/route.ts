import crypto from 'crypto';
import { apiSuccess, apiBadRequest, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired } from '@/app/lib/validation';
import { query } from '@/lib/db';

/**
 * POST /api/lupa-password — buat token reset asli (berlaku 1 jam, sekali pakai).
 * Kalau SMTP belum dikonfigurasi, link reset di-log server (owner bisa membagikannya).
 * Respons selalu generik → tidak membocorkan apakah email terdaftar.
 */
export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    const err = validateRequired({ email });
    if (err) return apiBadRequest(err);

    const ident = String(email).trim();
    const { rows: users } = await query('SELECT email FROM users WHERE email = $1', [ident]);
    const { rows: pegawai } = await query('SELECT email FROM pegawai WHERE email = $1', [ident]);

    if (users.length > 0 || pegawai.length > 0) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      // Ganti token lama email ini (satu token aktif per email)
      await query('DELETE FROM password_reset_tokens WHERE email = $1', [ident]);
      await query(
        `INSERT INTO password_reset_tokens (email, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
        [ident, tokenHash]
      );
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;
      // TODO: kirim email kalau SMTP dikonfigurasi (mis. Nodemailer).
      console.log(`[Lupa Password] Link reset untuk ${ident}: ${resetUrl}`);
    }

    return apiSuccess({ message: 'Jika email terdaftar, link reset password telah dikirim ke email Anda.' });
  } catch {
    return apiServerError('POST /api/lupa-password');
  }
}
