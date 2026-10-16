import { query } from '@/lib/db';
import { hashPassword, verifyPassword, isLegacyHash } from '@/app/lib/password';
import { signAuthToken } from '@/app/lib/authToken';

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function registerUser(namaToko: string, email: string, password: string): Promise<{ success: true; email: string; namaToko: string } | { error: string }> {
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) return { error: 'Email sudah terdaftar.' };

  const passwordHash = hashPassword(password);
  await query(
    'INSERT INTO users (email, password_hash, nama_toko) VALUES ($1, $2, $3)',
    [email, passwordHash, namaToko]
  );
  return { success: true, email, namaToko };
}

export async function loginUser(email: string, password: string): Promise<{ token: string; email: string; namaToko: string; tokoId: string; role: string; roles: string[]; nama: string; pegawaiId?: string } | { error: string }> {
  const ident = String(email || '').trim();
  if (!ident || !password) return { error: 'Email atau password salah.' };

  // ── Owner/admin dari tabel users ──
  const { rows: users } = await query(
    'SELECT id, email, nama_toko, password_hash, COALESCE(nama, nama_toko) AS nama FROM users WHERE email = $1',
    [ident]
  );
  if (users.length > 0) {
    const user = users[0];
    if (!verifyPassword(password, user.password_hash)) return { error: 'Email atau password salah.' };
    // Upgrade hash legacy → scrypt diam-diam setelah login sukses
    if (isLegacyHash(user.password_hash)) {
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashPassword(password), user.id]);
    }
    const roles = ['admin'];
    const token = signAuthToken({
      sub: user.email,
      name: user.nama,
      tokoId: user.id,
      role: 'admin',
      roles,
    });
    return { token, email: user.email, namaToko: user.nama_toko, tokoId: user.id, role: 'admin', roles, nama: user.nama };
  }

  // ── Pegawai dari tabel pegawai (username/email/nik) ──
  const { rows: pegawai } = await query(
    `SELECT id, nama, username, email, nik, roles, password_hash FROM pegawai
     WHERE toko_id = $1 AND (email = $2 OR username = $2 OR nik = $2)`,
    [DEFAULT_TOKO, ident]
  );
  if (pegawai.length > 0) {
    const p = pegawai[0];
    if (!verifyPassword(password, p.password_hash)) return { error: 'Email atau password salah.' };
    if (isLegacyHash(p.password_hash)) {
      await query('UPDATE pegawai SET password_hash = $1 WHERE id = $2', [hashPassword(password), p.id]);
    }
    const roles = Array.isArray(p.roles) && p.roles.length > 0 ? p.roles : ['pegawai'];
    const role = roles.includes('admin') ? 'admin' : 'pegawai';
    const token = signAuthToken({
      sub: p.email || p.username || p.nik || String(p.id),
      name: p.nama,
      tokoId: DEFAULT_TOKO,
      role,
      roles,
      pegawaiId: p.id,
    });
    return { token, email: p.email || p.username || ident, namaToko: 'Toko Berkah Abadi', tokoId: DEFAULT_TOKO, role, roles, nama: p.nama, pegawaiId: p.id };
  }

  return { error: 'Email atau password salah.' };
}
