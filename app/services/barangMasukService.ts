import { query } from '@/lib/db';

export interface BarangMasukItem {
  id: string;
  produk: string;
  jumlah: number;
  supplier: string;
  tanggal: string;
}

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getBarangMasuk(tokoId?: string): Promise<BarangMasukItem[]> {
  const { rows } = await query(
    `SELECT ms.id, p.nama AS produk, ms.jumlah, COALESCE(ms.keterangan, '') AS supplier,
            to_char(ms.tanggal, 'YYYY-MM-DD') AS tanggal
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

  // Cari produk
  const { rows: pRows } = await query('SELECT id FROM produk WHERE nama = $1 AND toko_id = $2 LIMIT 1', [entry.produk, tid]);
  const produkId = pRows.length > 0 ? pRows[0].id : null;

  const { rows } = await query(
    `INSERT INTO mutasi_stok (produk_id, toko_id, tipe, jumlah, keterangan, tanggal)
     VALUES ($1, $2, 'masuk', $3, $4, $5::date)
     RETURNING id, (SELECT nama FROM produk WHERE id = $1) AS produk, jumlah`,
    [produkId, tid, entry.jumlah, entry.supplier || 'Barang masuk', entry.tanggal || new Date().toISOString().slice(0, 10)]
  );

  return {
    id: rows[0].id,
    produk: entry.produk,
    jumlah: entry.jumlah,
    supplier: entry.supplier,
    tanggal: entry.tanggal || new Date().toISOString().slice(0, 10),
  };
}
