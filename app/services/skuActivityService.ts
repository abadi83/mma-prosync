import { query } from '@/lib/db';

export interface SkuActivityEntry {
  username: string;
  namaUser: string;
  aksi: 'tambah' | 'ubah' | 'hapus' | 'upload' | string;
  sku: string;
  nama: string;
  detail: Record<string, any>;
}

const DEFAULT_TOKO = process.env.DEFAULT_TOKO_ID || 'a0a0a0a0-0000-0000-0000-000000000001';

export async function recordSkuActivities(entries: SkuActivityEntry[], tokoId?: string): Promise<number> {
  let count = 0;
  for (const e of entries) {
    await query(
      `INSERT INTO sku_activity_log (toko_id, username, nama_user, aksi, sku, nama, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [tokoId || DEFAULT_TOKO, e.username || '', e.namaUser || '', e.aksi, e.sku || '', e.nama || '', JSON.stringify(e.detail || {})]
    );
    count++;
  }
  return count;
}

export async function listSkuActivities(opts: { username?: string; limit?: number; tokoId?: string } = {}) {
  const limit = Math.min(opts.limit || 300, 1000);
  const params: any[] = [opts.tokoId || DEFAULT_TOKO];
  let where = 'toko_id = $1';
  if (opts.username) {
    params.push(opts.username);
    where += ` AND username = $${params.length}`;
  }
  params.push(limit);
  const { rows } = await query(
    `SELECT id, username, nama_user, aksi, sku, nama, detail, created_at
     FROM sku_activity_log
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return rows.map(r => ({
    id: r.id,
    username: r.username || '',
    namaUser: r.nama_user || '',
    aksi: r.aksi,
    sku: r.sku || '',
    nama: r.nama || '',
    detail: r.detail || {},
    createdAt: r.created_at,
  }));
}
