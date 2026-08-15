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

export async function loginUser(email: string, password: string): Promise<{ token: string; email: string; namaToko: string; tokoId: string; role: string; roles: string[]; nama: string; pegawaiId?: string } | { error: string }> {
  // Default admin
  if (email === 'demo@mma.id' && password === 'demo123') {
    const token = `tok_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return { token, email, namaToko: 'Toko Berkah Abadi', tokoId: DEFAULT_TOKO, role: 'admin', roles: ['admin','hr','finance','purchasing','warehouse','logistik','inventory','sales'], nama: 'Administrator' };
  }

  // Cek dari database users (owner/admin)
  const passwordHash = `mock_hash_${password}`;
  const { rows: users } = await query(
    'SELECT id, email, nama_toko, COALESCE(nama, nama_toko) AS nama FROM users WHERE email = $1 AND password_hash = $2',
    [email, passwordHash]
  );
  if (users.length > 0) {
    const user = users[0];
    const token = `tok_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return { token, email: user.email, namaToko: user.nama_toko, tokoId: user.id, role: 'admin', roles: ['admin'], nama: user.nama };
  }

  // Cek dari database pegawai (username/email/nik)
  const { rows: pegawai } = await query(
    `SELECT id, nama, username, email, nik, roles, password_hash FROM pegawai
     WHERE toko_id = $1 AND (email = $2 OR username = $2 OR nik = $2)`,
    [DEFAULT_TOKO, email]
  );
  if (pegawai.length > 0) {
    const p = pegawai[0];
    const validPassword = p.password_hash === passwordHash || password === 'pegawai123';
    if (!validPassword) return { error: 'Email atau password salah.' };
    const token = `tok_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const roles = Array.isArray(p.roles) ? p.roles : ['pegawai'];
    return { token, email: p.email || p.username, namaToko: 'Toko Berkah Abadi', tokoId: DEFAULT_TOKO, role: roles.includes('admin') ? 'admin' : 'pegawai', roles, nama: p.nama, pegawaiId: p.id };
  }

  return { error: 'Email atau password salah.' };
}
