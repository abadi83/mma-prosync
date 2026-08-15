import { query, queryRow } from '@/lib/db';

export interface FleetItem {
  id: string; nama: string; platNomor: string; tipe: string; kapasitas: string;
  driver: string; tahun: string; status: string;
}

const DEFAULT_TOKO = process.env.DEFAULT_TOKO_ID || 'a0a0a0a0-0000-0000-0000-000000000001';

function mapRow(row: any): FleetItem {
  return { id: row.id, nama: row.nama, platNomor: row.plat_nomor, tipe: row.tipe,
           kapasitas: row.kapasitas || '', driver: row.driver || '', tahun: row.tahun || '', status: row.status || 'Tersedia' };
}

export async function getFleet(tokoId?: string): Promise<FleetItem[]> {
  const { rows } = await query('SELECT id, nama, plat_nomor, tipe, kapasitas, driver, tahun, status FROM fleet WHERE toko_id = $1 ORDER BY nama', [tokoId || DEFAULT_TOKO]);
  return rows.map(mapRow);
}

export async function createFleet(data: Omit<FleetItem, 'id'>, tokoId?: string): Promise<FleetItem> {
  const { rows } = await query(
    'INSERT INTO fleet (toko_id, nama, plat_nomor, tipe, kapasitas, driver, tahun, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [tokoId || DEFAULT_TOKO, data.nama, data.platNomor, data.tipe, data.kapasitas || '', data.driver || '', data.tahun || '', data.status || 'Tersedia']
  );
  return mapRow(rows[0]);
}

export async function updateFleet(id: string, data: Partial<FleetItem>, tokoId?: string): Promise<FleetItem | null> {
  const existing = await queryRow('SELECT * FROM fleet WHERE id = $1 AND toko_id = $2', [id, tokoId || DEFAULT_TOKO]);
  if (!existing) return null;
  const sets: string[] = []; const vals: any[] = []; let i = 1;
  const add = (col: string, val: any) => { sets.push(`${col} = $${i++}`); vals.push(val); };
  if (data.nama !== undefined) add('nama', data.nama); if (data.platNomor !== undefined) add('plat_nomor', data.platNomor);
  if (data.tipe !== undefined) add('tipe', data.tipe); if (data.kapasitas !== undefined) add('kapasitas', data.kapasitas);
  if (data.driver !== undefined) add('driver', data.driver); if (data.tahun !== undefined) add('tahun', data.tahun);
  if (data.status !== undefined) add('status', data.status);
  if (sets.length === 0) return mapRow(existing);
  vals.push(id);
  const { rows } = await query(`UPDATE fleet SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteFleet(id: string, tokoId?: string): Promise<boolean> {
  const { rowCount } = await query('DELETE FROM fleet WHERE id = $1 AND toko_id = $2', [id, tokoId || DEFAULT_TOKO]);
  return (rowCount || 0) > 0;
}
