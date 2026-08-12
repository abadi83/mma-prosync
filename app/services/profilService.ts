import { query } from '@/lib/db';

const DEFAULT_USER = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getProfil(userId?: string) {
  const { rows } = await query(
    `SELECT COALESCE(nama, nama_toko, '') AS nama, email, COALESCE(telepon, '') AS telepon, COALESCE(avatar_url, '') AS avatar
     FROM users WHERE id = $1`,
    [userId || DEFAULT_USER]
  );
  return rows[0] || { nama: 'Administrator', email: 'demo@mma.id', telepon: '', avatar: '' };
}

export async function updateProfil(data: { nama?: string; email?: string; telepon?: string; avatar?: string }, userId?: string) {
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (data.nama !== undefined) { sets.push(`nama = $${i++}`); vals.push(data.nama); }
  if (data.email !== undefined) { sets.push(`email = $${i++}`); vals.push(data.email); }
  if (data.telepon !== undefined) { sets.push(`telepon = $${i++}`); vals.push(data.telepon); }
  if (data.avatar !== undefined) { sets.push(`avatar_url = $${i++}`); vals.push(data.avatar); }
  if (sets.length === 0) return getProfil(userId);
  vals.push(userId || DEFAULT_USER);
  const { rows } = await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING COALESCE(nama, nama_toko, '') AS nama, email, COALESCE(telepon, '') AS telepon, COALESCE(avatar_url, '') AS avatar`,
    vals
  );
  return rows[0];
}
