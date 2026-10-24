import { query } from '@/lib/db';

export interface AppUpdateHistoryItem {
  id: string; versi: string; tipe: string; judul: string; deskripsi: string;
  oleh: string; tanggal: string;
}

const DEFAULT_TOKO = process.env.DEFAULT_TOKO_ID || 'a0a0a0a0-0000-0000-0000-000000000001';

const SELECT_SQL = `SELECT id, versi, tipe, judul, deskripsi, oleh, created_at
  FROM app_update_history`;

function mapRow(row: any): AppUpdateHistoryItem {
  return {
    id: row.id, versi: row.versi || '', tipe: row.tipe || 'update',
    judul: row.judul || '', deskripsi: row.deskripsi || '', oleh: row.oleh || '',
    tanggal: row.created_at ? new Date(row.created_at).toISOString() : '',
  };
}

export async function getAllAppUpdateHistory(tokoId?: string): Promise<AppUpdateHistoryItem[]> {
  const { rows } = await query(
    `${SELECT_SQL} WHERE toko_id = $1 ORDER BY created_at DESC, id DESC`,
    [tokoId || DEFAULT_TOKO]
  );
  return rows.map(mapRow);
}

export async function createAppUpdateHistory(
  data: { versi: string; tipe: string; judul: string; deskripsi: string; oleh: string },
  tokoId?: string
): Promise<AppUpdateHistoryItem> {
  const tipe = ['fitur', 'perbaikan', 'update'].includes(data.tipe) ? data.tipe : 'update';
  const { rows } = await query(
    `INSERT INTO app_update_history (toko_id, versi, tipe, judul, deskripsi, oleh)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, versi, tipe, judul, deskripsi, oleh, created_at`,
    [tokoId || DEFAULT_TOKO, data.versi || '', tipe, data.judul, data.deskripsi || '', data.oleh || '']
  );
  return mapRow(rows[0]);
}
