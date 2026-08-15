import { query, queryRow } from '@/lib/db';

export interface PelangganItem {
  id: string; nama: string; kontak: string; marketplace?: string; totalTransaksi: number;
}

const DEFAULT_TOKO = process.env.DEFAULT_TOKO_ID || 'a0a0a0a0-0000-0000-0000-000000000001';

function mapRow(row: any): PelangganItem {
  return { id: row.id, nama: row.nama, kontak: row.kontak || '', marketplace: row.marketplace || '', totalTransaksi: row.total_transaksi || 0 };
}

export async function getPelanggan(tokoId?: string): Promise<PelangganItem[]> {
  const { rows } = await query(
    'SELECT id, nama, COALESCE(kontak, \'\') AS kontak, COALESCE(marketplace, \'\') AS marketplace, COALESCE(total_transaksi, 0) AS total_transaksi FROM pelanggan WHERE toko_id = $1 ORDER BY nama',
    [tokoId || DEFAULT_TOKO]
  );
  return rows.map(mapRow);
}

export async function createPelanggan(data: Omit<PelangganItem, 'id'>, tokoId?: string) {
  const { rows } = await query(
    'INSERT INTO pelanggan (toko_id, nama, kontak, marketplace, total_transaksi) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [tokoId || DEFAULT_TOKO, data.nama, data.kontak || null, data.marketplace || null, data.totalTransaksi || 0]
  );
  return mapRow(rows[0]);
}

export async function updatePelanggan(id: string, data: Partial<PelangganItem>, tokoId?: string) {
  const existing = await queryRow('SELECT * FROM pelanggan WHERE id = $1 AND toko_id = $2', [id, tokoId || DEFAULT_TOKO]);
  if (!existing) return null;
  const sets: string[] = []; const vals: any[] = []; let i = 1;
  const add = (col: string, val: any) => { sets.push(`${col} = $${i++}`); vals.push(val); };
  if (data.nama !== undefined) add('nama', data.nama); if (data.kontak !== undefined) add('kontak', data.kontak || null);
  if (data.marketplace !== undefined) add('marketplace', data.marketplace || null); if (data.totalTransaksi !== undefined) add('total_transaksi', data.totalTransaksi || 0);
  if (sets.length === 0) return mapRow(existing);
  vals.push(id);
  const { rows } = await query(`UPDATE pelanggan SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deletePelanggan(id: string) {
  const { rowCount } = await query('DELETE FROM pelanggan WHERE id = $1', [id]);
  return (rowCount || 0) > 0;
}

