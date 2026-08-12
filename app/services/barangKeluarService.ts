import { query } from '@/lib/db';

export interface BarangKeluarItem {
  id: string;
  produk: string;
  jumlah: number;
  keperluan: string;
  tanggal: string;
}

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getBarangKeluar(tokoId?: string): Promise<BarangKeluarItem[]> {
  const { rows } = await query(
    `SELECT ms.id, p.nama AS produk, ms.jumlah, COALESCE(ms.keterangan, '') AS keperluan,
            to_char(ms.tanggal, 'YYYY-MM-DD') AS tanggal
     FROM mutasi_stok ms
     JOIN produk p ON ms.produk_id = p.id
     WHERE ms.toko_id = $1 AND ms.tipe = 'keluar'
     ORDER BY ms.tanggal DESC`,
    [tokoId || DEFAULT_TOKO]
  );
  return rows.map((r: any) => ({ ...r, jumlah: Number(r.jumlah) }));
}

export async function addBarangKeluar(
  tokoId: string | undefined,
  entry: Omit<BarangKeluarItem, 'id'>,
): Promise<BarangKeluarItem> {
  const tid = tokoId || DEFAULT_TOKO;

  const { rows: pRows } = await query('SELECT id FROM produk WHERE nama = $1 AND toko_id = $2 LIMIT 1', [entry.produk, tid]);
  const produkId = pRows.length > 0 ? pRows[0].id : null;

  const { rows } = await query(
    `INSERT INTO mutasi_stok (produk_id, toko_id, tipe, jumlah, keterangan, tanggal)
     VALUES ($1, $2, 'keluar', $3, $4, $5::date)
     RETURNING id`,
    [produkId, tid, entry.jumlah, entry.keperluan || 'Barang keluar', entry.tanggal || new Date().toISOString().slice(0, 10)]
  );

  return {
    id: rows[0].id,
    produk: entry.produk,
    jumlah: entry.jumlah,
    keperluan: entry.keperluan,
    tanggal: entry.tanggal || new Date().toISOString().slice(0, 10),
  };
}
