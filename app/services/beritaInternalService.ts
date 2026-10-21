import { query } from '@/lib/db';
import { BeritaInternalItem, BeritaKategori } from '@/app/lib/beritaInternal';

const DEFAULT_TOKO = process.env.DEFAULT_TOKO_ID || 'a0a0a0a0-0000-0000-0000-000000000001';

function mapRow(row: any): BeritaInternalItem {
  return {
    id: row.id,
    kategori: row.kategori,
    judul: row.judul,
    isi: row.isi || '',
    penulisId: row.penulis_id || null,
    penulisNama: row.penulis_nama || '',
    waktu: row.waktu,
    gambarBg: row.gambar_bg || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

export async function listBeritaInternal(
  tokoId?: string,
  opts: { kategori?: string; limit?: number } = {},
): Promise<BeritaInternalItem[]> {
  const tid = tokoId || DEFAULT_TOKO;
  const params: any[] = [tid];
  let where = 'toko_id = $1';
  if (opts.kategori) { params.push(opts.kategori); where += ` AND kategori = $${params.length}`; }
  params.push(Math.min(opts.limit || 100, 500));
  const { rows } = await query(
    `SELECT id, kategori, judul, COALESCE(isi, '') AS isi, penulis_id, COALESCE(penulis_nama, '') AS penulis_nama,
            to_char(waktu, 'YYYY-MM-DD"T"HH24:MI') AS waktu, COALESCE(gambar_bg, '') AS gambar_bg,
            to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at, to_char(updated_at, 'YYYY-MM-DD HH24:MI') AS updated_at
     FROM berita_internal WHERE ${where}
     ORDER BY waktu DESC, created_at DESC LIMIT $${params.length}`,
    params,
  );
  return rows.map(mapRow);
}

/** Satu berita TERBARU per kategori (untuk 3 slide dashboard). */
export async function latestPerKategori(tokoId?: string): Promise<BeritaInternalItem[]> {
  const tid = tokoId || DEFAULT_TOKO;
  const { rows } = await query(
    `SELECT DISTINCT ON (kategori) id, kategori, judul, COALESCE(isi, '') AS isi, penulis_id,
            COALESCE(penulis_nama, '') AS penulis_nama,
            to_char(waktu, 'YYYY-MM-DD"T"HH24:MI') AS waktu, COALESCE(gambar_bg, '') AS gambar_bg,
            to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at, to_char(updated_at, 'YYYY-MM-DD HH24:MI') AS updated_at
     FROM berita_internal
     WHERE toko_id = $1
     ORDER BY kategori, waktu DESC, created_at DESC`,
    [tid],
  );
  return rows.map(mapRow);
}

export interface BeritaInternalInput {
  kategori: BeritaKategori;
  judul: string;
  isi?: string;
  penulisId?: string | null;
  penulisNama?: string;
  waktu?: string | null;
  gambarBg?: string;
}

export async function createBeritaInternal(
  tokoId: string | undefined,
  data: BeritaInternalInput,
  actor: { nama: string; pegawaiId?: string | null },
): Promise<BeritaInternalItem> {
  const tid = tokoId || DEFAULT_TOKO;
  const waktu = data.waktu || new Date().toISOString().slice(0, 16);
  const penulisId = data.penulisId || actor.pegawaiId || null;
  const { rows } = await query(
    `INSERT INTO berita_internal (toko_id, kategori, judul, isi, penulis_id, penulis_nama, waktu, gambar_bg)
     VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8) RETURNING id`,
    [
      tid,
      data.kategori,
      data.judul.trim().slice(0, 255),
      (data.isi || '').trim() || null,
      penulisId,
      data.penulisNama || actor.nama || '',
      waktu,
      data.gambarBg || null,
    ],
  );
  const { rows: full } = await query(
    `SELECT id, kategori, judul, COALESCE(isi, '') AS isi, penulis_id, COALESCE(penulis_nama, '') AS penulis_nama,
            to_char(waktu, 'YYYY-MM-DD"T"HH24:MI') AS waktu, COALESCE(gambar_bg, '') AS gambar_bg,
            to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at, to_char(updated_at, 'YYYY-MM-DD HH24:MI') AS updated_at
     FROM berita_internal WHERE id = $1`,
    [rows[0].id],
  );
  return mapRow(full[0]);
}

export async function updateBeritaInternal(
  tokoId: string | undefined,
  id: string,
  patch: Partial<BeritaInternalInput>,
): Promise<BeritaInternalItem | null> {
  const tid = tokoId || DEFAULT_TOKO;
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  const add = (col: string, val: any) => { sets.push(`${col} = $${i++}`); vals.push(val); };
  if (patch.kategori !== undefined) add('kategori', patch.kategori);
  if (patch.judul !== undefined) add('judul', String(patch.judul).trim().slice(0, 255));
  if (patch.isi !== undefined) add('isi', String(patch.isi).trim() || null);
  if (patch.penulisId !== undefined) add('penulis_id', patch.penulisId || null);
  if (patch.penulisNama !== undefined) add('penulis_nama', patch.penulisNama || '');
  if (patch.waktu !== undefined) add('waktu', patch.waktu);
  if (patch.gambarBg !== undefined) add('gambar_bg', patch.gambarBg || null);
  if (sets.length === 0) {
    const { rows } = await query(
      `SELECT id FROM berita_internal WHERE id = $1 AND toko_id = $2`, [id, tid],
    );
    if (rows.length === 0) return null;
    const item = await getBeritaInternal(tid, id);
    return item;
  }
  add('updated_at', new Date());
  vals.push(id, tid);
  await query(`UPDATE berita_internal SET ${sets.join(', ')} WHERE id = $${i++} AND toko_id = $${i}`, vals);
  return getBeritaInternal(tid, id);
}

export async function getBeritaInternal(tokoId: string | undefined, id: string): Promise<BeritaInternalItem | null> {
  const tid = tokoId || DEFAULT_TOKO;
  const { rows } = await query(
    `SELECT id, kategori, judul, COALESCE(isi, '') AS isi, penulis_id, COALESCE(penulis_nama, '') AS penulis_nama,
            to_char(waktu, 'YYYY-MM-DD"T"HH24:MI') AS waktu, COALESCE(gambar_bg, '') AS gambar_bg,
            to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at, to_char(updated_at, 'YYYY-MM-DD HH24:MI') AS updated_at
     FROM berita_internal WHERE id = $1 AND toko_id = $2`,
    [id, tid],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteBeritaInternal(tokoId: string | undefined, id: string): Promise<boolean> {
  const tid = tokoId || DEFAULT_TOKO;
  const { rowCount } = await query('DELETE FROM berita_internal WHERE id = $1 AND toko_id = $2', [id, tid]);
  return (rowCount || 0) > 0;
}
