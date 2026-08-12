import { query } from '@/lib/db';

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getInfoToko(tokoId?: string) {
  const { rows } = await query(
    'SELECT nama_toko AS nama, COALESCE(alamat_toko, \'\') AS alamat, COALESCE(logo_url, \'\') AS logo FROM users WHERE id = $1',
    [tokoId || DEFAULT_TOKO]
  );
  return rows[0] || { nama: 'Toko Berkah Abadi', alamat: '', logo: '' };
}

export async function updateInfoToko(data: { nama?: string; alamat?: string; logo?: string }, tokoId?: string) {
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (data.nama !== undefined) { sets.push(`nama_toko = $${i++}`); vals.push(data.nama); }
  if (data.alamat !== undefined) { sets.push(`alamat_toko = $${i++}`); vals.push(data.alamat); }
  if (data.logo !== undefined) { sets.push(`logo_url = $${i++}`); vals.push(data.logo); }
  if (sets.length === 0) return getInfoToko(tokoId);
  vals.push(tokoId || DEFAULT_TOKO);
  const { rows } = await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING nama_toko AS nama, COALESCE(alamat_toko, '') AS alamat, COALESCE(logo_url, '') AS logo`,
    vals
  );
  return rows[0];
}
