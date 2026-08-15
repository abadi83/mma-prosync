import { query, queryRow } from '@/lib/db';

export interface TokoItem { id: string; nama: string; marketplace: string; link: string; persenFee: number; }

const DEFAULT_TOKO = process.env.DEFAULT_TOKO_ID || 'a0a0a0a0-0000-0000-0000-000000000001';

function mapRow(row: any): TokoItem {
  return { id: row.id, nama: row.nama, marketplace: row.marketplace, link: row.link || '', persenFee: row.persen_fee || 0 };
}

export async function getMarketplaceToko(tokoId?: string): Promise<TokoItem[]> {
  const { rows } = await query('SELECT id, nama, marketplace, link, persen_fee FROM marketplace_toko WHERE toko_id = $1 ORDER BY nama', [tokoId || DEFAULT_TOKO]);
  return rows.map(mapRow);
}

export async function createMarketplaceToko(data: Omit<TokoItem, 'id'>, tokoId?: string): Promise<TokoItem> {
  const { rows } = await query(
    'INSERT INTO marketplace_toko (toko_id, nama, marketplace, link, persen_fee) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [tokoId || DEFAULT_TOKO, data.nama, data.marketplace, data.link || '', data.persenFee || 0]
  );
  return mapRow(rows[0]);
}

export async function updateMarketplaceToko(id: string, data: Partial<TokoItem>, tokoId?: string): Promise<TokoItem | null> {
  const existing = await queryRow('SELECT * FROM marketplace_toko WHERE id = $1 AND toko_id = $2', [id, tokoId || DEFAULT_TOKO]);
  if (!existing) return null;
  const sets: string[] = []; const vals: any[] = []; let i = 1;
  const add = (col: string, val: any) => { sets.push(`${col} = $${i++}`); vals.push(val); };
  if (data.nama !== undefined) add('nama', data.nama); if (data.marketplace !== undefined) add('marketplace', data.marketplace);
  if (data.link !== undefined) add('link', data.link); if (data.persenFee !== undefined) add('persen_fee', data.persenFee);
  if (sets.length === 0) return mapRow(existing);
  vals.push(id);
  const { rows } = await query(`UPDATE marketplace_toko SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteMarketplaceToko(id: string, tokoId?: string): Promise<boolean> {
  const { rowCount } = await query('DELETE FROM marketplace_toko WHERE id = $1 AND toko_id = $2', [id, tokoId || DEFAULT_TOKO]);
  return (rowCount || 0) > 0;
}
