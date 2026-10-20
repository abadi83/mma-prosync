import { query } from '@/lib/db';
import { KARDUS_KATEGORI, KATEGORI_LABEL, kategoriLabel, ProduksiKardusItem, RingkasanRow, KategoriDef } from '@/app/lib/produksiKardus';

export { KARDUS_KATEGORI, kategoriLabel, KATEGORI_LABEL };
export type { KategoriDef, ProduksiKardusItem, RingkasanRow };

const DEFAULT_TOKO = process.env.DEFAULT_TOKO_ID || 'a0a0a0a0-0000-0000-0000-000000000001';

function mapRow(row: any): ProduksiKardusItem {
  return {
    id: row.id,
    kategori: row.kategori,
    ukuran: row.ukuran || '',
    qty: row.qty || 0,
    tanggal: row.tanggal,
    catatan: row.catatan || '',
    pegawaiNama: row.pegawai_nama || '',
    createdAt: row.created_at || '',
  };
}

export async function listProduksiKardus(
  tokoId?: string,
  opts: { dari?: string; sampai?: string; kategori?: string; limit?: number } = {},
): Promise<ProduksiKardusItem[]> {
  const tid = tokoId || DEFAULT_TOKO;
  const params: any[] = [tid];
  let where = 'toko_id = $1';
  if (opts.kategori) { params.push(opts.kategori); where += ` AND kategori = $${params.length}`; }
  if (opts.dari) { params.push(opts.dari); where += ` AND tanggal >= $${params.length}::date`; }
  if (opts.sampai) { params.push(opts.sampai); where += ` AND tanggal <= $${params.length}::date`; }
  params.push(Math.min(opts.limit || 100, 1000));
  const { rows } = await query(
    `SELECT id, kategori, ukuran, qty, to_char(tanggal, 'YYYY-MM-DD') AS tanggal,
            COALESCE(catatan, '') AS catatan, COALESCE(pegawai_nama, '') AS pegawai_nama,
            to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at
     FROM produksi_kardus WHERE ${where}
     ORDER BY tanggal DESC, created_at DESC LIMIT $${params.length}`,
    params,
  );
  return rows.map(mapRow);
}

/**
 * Rekap otomatis per kategori+ukuran:
 *  - hari   = hari ini (tanggal = CURRENT_DATE)
 *  - minggu = minggu ini (Senin–Minggu, ISO week)
 *  - bulan  = bulan ini
 *  - tahun  = tahun ini
 */
export async function ringkasanProduksiKardus(tokoId?: string): Promise<RingkasanRow[]> {
  const tid = tokoId || DEFAULT_TOKO;
  const { rows } = await query(
    `SELECT kategori, COALESCE(ukuran, '') AS ukuran,
            COALESCE(SUM(qty) FILTER (WHERE tanggal = CURRENT_DATE), 0)::int AS hari,
            COALESCE(SUM(qty) FILTER (WHERE date_trunc('week', tanggal) = date_trunc('week', CURRENT_DATE)), 0)::int AS minggu,
            COALESCE(SUM(qty) FILTER (WHERE date_trunc('month', tanggal) = date_trunc('month', CURRENT_DATE)), 0)::int AS bulan,
            COALESCE(SUM(qty) FILTER (WHERE date_trunc('year', tanggal) = date_trunc('year', CURRENT_DATE)), 0)::int AS tahun
     FROM produksi_kardus
     WHERE toko_id = $1
     GROUP BY kategori, ukuran
     ORDER BY kategori, ukuran`,
    [tid],
  );
  return rows.map((r: any) => ({
    kategori: r.kategori,
    ukuran: r.ukuran || '',
    hari: r.hari || 0,
    minggu: r.minggu || 0,
    bulan: r.bulan || 0,
    tahun: r.tahun || 0,
  }));
}

export interface ProduksiInput {
  kategori: string;
  ukuran?: string;
  qty: number;
  tanggal?: string;
  catatan?: string;
}

export async function createProduksiKardus(
  tokoId: string | undefined,
  data: ProduksiInput,
  actor: { nama: string; pegawaiId?: string | null },
): Promise<ProduksiKardusItem> {
  const tid = tokoId || DEFAULT_TOKO;
  const { rows } = await query(
    `INSERT INTO produksi_kardus (toko_id, kategori, ukuran, qty, tanggal, catatan, pegawai_id, pegawai_nama)
     VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8)
     RETURNING id, kategori, ukuran, qty, to_char(tanggal, 'YYYY-MM-DD') AS tanggal,
               COALESCE(catatan, '') AS catatan, COALESCE(pegawai_nama, '') AS pegawai_nama,
               to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at`,
    [
      tid,
      data.kategori,
      (data.ukuran || '').trim(),
      Math.max(0, Math.round(data.qty || 0)),
      data.tanggal || new Date().toISOString().slice(0, 10),
      (data.catatan || '').trim() || null,
      actor.pegawaiId || null,
      actor.nama || '',
    ],
  );
  return mapRow(rows[0]);
}

export async function updateProduksiKardus(
  tokoId: string | undefined,
  id: string,
  patch: Partial<ProduksiInput>,
): Promise<ProduksiKardusItem | null> {
  const tid = tokoId || DEFAULT_TOKO;
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  const add = (col: string, val: any) => { sets.push(`${col} = $${i++}`); vals.push(val); };
  if (patch.kategori !== undefined) add('kategori', patch.kategori);
  if (patch.ukuran !== undefined) add('ukuran', String(patch.ukuran).trim());
  if (patch.qty !== undefined) add('qty', Math.max(0, Math.round(patch.qty)));
  if (patch.tanggal !== undefined) add('tanggal', patch.tanggal);
  if (patch.catatan !== undefined) add('catatan', String(patch.catatan).trim() || null);
  if (sets.length === 0) {
    const { rows } = await query(
      `SELECT id, kategori, ukuran, qty, to_char(tanggal, 'YYYY-MM-DD') AS tanggal,
              COALESCE(catatan, '') AS catatan, COALESCE(pegawai_nama, '') AS pegawai_nama,
              to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at
       FROM produksi_kardus WHERE id = $1 AND toko_id = $2`,
      [id, tid],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }
  add('updated_at', new Date());
  vals.push(id, tid);
  const { rows } = await query(
    `UPDATE produksi_kardus SET ${sets.join(', ')} WHERE id = $${i++} AND toko_id = $${i}
     RETURNING id, kategori, ukuran, qty, to_char(tanggal, 'YYYY-MM-DD') AS tanggal,
               COALESCE(catatan, '') AS catatan, COALESCE(pegawai_nama, '') AS pegawai_nama,
               to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at`,
    vals,
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteProduksiKardus(tokoId: string | undefined, id: string): Promise<boolean> {
  const tid = tokoId || DEFAULT_TOKO;
  const { rowCount } = await query('DELETE FROM produksi_kardus WHERE id = $1 AND toko_id = $2', [id, tid]);
  return (rowCount || 0) > 0;
}
