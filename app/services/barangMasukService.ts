import { query } from '@/lib/db';
import { todayLocal } from '@/app/lib/dateLocal';

export interface BarangMasukItem {
  id: string;
  produk: string;
  jumlah: number;
  supplier: string;
  tanggal: string;
  noPO?: string;
  duplicate?: boolean;
}

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getBarangMasuk(tokoId?: string): Promise<BarangMasukItem[]> {
  const { rows } = await query(
    `SELECT ms.id, p.nama AS produk, ms.jumlah, COALESCE(ms.keterangan, '') AS supplier,
            to_char(ms.tanggal, 'YYYY-MM-DD') AS tanggal, COALESCE(ms.no_po, '') AS "noPO"
     FROM mutasi_stok ms
     JOIN produk p ON ms.produk_id = p.id
     WHERE ms.toko_id = $1 AND ms.tipe = 'masuk'
     ORDER BY ms.tanggal DESC`,
    [tokoId || DEFAULT_TOKO]
  );
  return rows.map((r: any) => ({ ...r, jumlah: Number(r.jumlah) }));
}

export async function addBarangMasuk(
  tokoId: string | undefined,
  entry: Omit<BarangMasukItem, 'id'>,
): Promise<BarangMasukItem> {
  const tid = tokoId || DEFAULT_TOKO;

  // Cari produk — kalau belum ada di tabel produk, auto-buat (agar sync PO Checklist → Barang Masuk selalu berhasil)
  const { rows: pRows } = await query('SELECT id FROM produk WHERE nama = $1 AND toko_id = $2 LIMIT 1', [entry.produk, tid]);
  let produkId: string | null = pRows.length > 0 ? pRows[0].id : null;
  if (!produkId) {
    const { rows: created } = await query(
      'INSERT INTO produk (toko_id, nama) VALUES ($1, $2) RETURNING id',
      [tid, entry.produk]
    );
    produkId = created.length > 0 ? created[0].id : null;
  }

  const noPO = String(entry.noPO || '').trim();
  if (noPO) {
    // Idempotent per PO + produk: retry / double click tidak boleh membuat mutasi kedua.
    const { rows: existing } = await query(
      `SELECT ms.id, p.nama AS produk, ms.jumlah,
              COALESCE(ms.keterangan, '') AS supplier,
              to_char(ms.tanggal, 'YYYY-MM-DD') AS tanggal,
              COALESCE(ms.no_po, '') AS "noPO"
       FROM mutasi_stok ms
       JOIN produk p ON p.id = ms.produk_id
       WHERE ms.toko_id = $1 AND ms.produk_id = $2 AND ms.tipe = 'masuk' AND ms.no_po = $3
       ORDER BY ms.tanggal ASC LIMIT 1`,
      [tid, produkId, noPO],
    );
    if (existing[0]) return { ...existing[0], jumlah: Number(existing[0].jumlah), duplicate: true };
  }

  try {
    const { rows } = await query(
      `INSERT INTO mutasi_stok (produk_id, toko_id, tipe, jumlah, keterangan, tanggal, no_po)
       VALUES ($1, $2, 'masuk', $3, $4, $5::date, $6)
       RETURNING id, (SELECT nama FROM produk WHERE id = $1) AS produk, jumlah,
                 COALESCE(no_po, '') AS "noPO"`,
      [produkId, tid, entry.jumlah, entry.supplier || 'Barang masuk', entry.tanggal || todayLocal(), noPO || null]
    );

    return {
      id: rows[0].id,
      produk: entry.produk,
      jumlah: entry.jumlah,
      supplier: entry.supplier,
      tanggal: entry.tanggal || todayLocal(),
      noPO,
    };
  } catch (error: any) {
    // Dua perangkat bisa konfirmasi PO/SKU bersamaan; unique index memastikan hanya satu stok masuk.
    if (noPO && error?.code === '23505') {
      const { rows: existing } = await query(
        `SELECT ms.id, p.nama AS produk, ms.jumlah,
                COALESCE(ms.keterangan, '') AS supplier,
                to_char(ms.tanggal, 'YYYY-MM-DD') AS tanggal,
                COALESCE(ms.no_po, '') AS "noPO"
         FROM mutasi_stok ms JOIN produk p ON p.id = ms.produk_id
         WHERE ms.toko_id = $1 AND ms.produk_id = $2 AND ms.tipe = 'masuk' AND ms.no_po = $3
         LIMIT 1`,
        [tid, produkId, noPO],
      );
      if (existing[0]) return { ...existing[0], jumlah: Number(existing[0].jumlah), duplicate: true };
    }
    throw error;
  }
}
