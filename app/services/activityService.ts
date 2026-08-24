import { query } from '@/lib/db';

export interface ActivityEntry {
  modul: string;
  aksi: string;
  refLabel?: string;
  detail?: Record<string, any>;
}

const DEFAULT_TOKO = process.env.DEFAULT_TOKO_ID || 'a0a0a0a0-0000-0000-0000-000000000001';

export async function recordActivities(
  entries: ActivityEntry[],
  ctx: { username?: string; namaUser?: string },
  tokoId?: string
): Promise<number> {
  let count = 0;
  for (const e of entries) {
    await query(
      `INSERT INTO activity_log (toko_id, username, nama_user, modul, aksi, ref_label, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        tokoId || DEFAULT_TOKO,
        ctx.username || '',
        ctx.namaUser || '',
        String(e.modul || '').slice(0, 30),
        String(e.aksi || '').slice(0, 20),
        String(e.refLabel || '').slice(0, 255),
        JSON.stringify(e.detail || {}),
      ]
    );
    count++;
  }
  return count;
}

export async function listActivities(opts: { username?: string; modul?: string; limit?: number; tokoId?: string } = {}) {
  const limit = Math.min(opts.limit || 300, 1000);
  const params: any[] = [opts.tokoId || DEFAULT_TOKO];
  let where = 'toko_id = $1';
  if (opts.username) {
    params.push(opts.username);
    where += ` AND username = $${params.length}`;
  }
  if (opts.modul) {
    params.push(opts.modul);
    where += ` AND modul = $${params.length}`;
  }
  params.push(limit);
  const { rows } = await query(
    `SELECT id, username, nama_user, modul, aksi, ref_label, detail, created_at
     FROM activity_log
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return rows.map(r => ({
    id: r.id,
    username: r.username || '',
    namaUser: r.nama_user || '',
    modul: r.modul,
    aksi: r.aksi,
    refLabel: r.ref_label || '',
    detail: r.detail || {},
    createdAt: r.created_at,
  }));
}
