import { query } from '@/lib/db';

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function registerUser(namaToko: string, email: string, password: string): Promise<{ success: true; email: string; namaToko: string } | { error: string }> {
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) return { error: 'Email sudah terdaftar.' };

  // Simple hash: dalam production ganti bcrypt
  const passwordHash = `mock_hash_${password}`;
  await query(
    'INSERT INTO users (email, password_hash, nama_toko) VALUES ($1, $2, $3)',
    [email, passwordHash, namaToko]
  );
  return { success: true, email, namaToko };
}

export async function loginUser(email: string, password: string): Promise<{ token: string; email: string; namaToko: string; tokoId: string } | { error: string }> {
  // Default admin
  if (email === 'demo@mma.id' && password === 'demo123') {
    const token = `tok_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return { token, email, namaToko: 'Toko Berkah Abadi', tokoId: DEFAULT_TOKO };
  }

  // Cek dari database
  const passwordHash = `mock_hash_${password}`;
  const { rows } = await query(
    'SELECT id, email, nama_toko FROM users WHERE email = $1 AND password_hash = $2',
    [email, passwordHash]
  );
  if (rows.length === 0) return { error: 'Email atau password salah.' };

  const user = rows[0];
  const token = `tok_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return { token, email: user.email, namaToko: user.nama_toko, tokoId: user.id };
}
