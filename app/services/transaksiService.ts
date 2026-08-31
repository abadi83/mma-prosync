import { query } from '@/lib/db';

export interface TransaksiItem {
  id: string;
  produk: string;
  jumlah: number;
  hargaSatuan: number;
  total: number;
  pelanggan: string;
  tanggal: string;
}

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getTransaksi(tokoId?: string): Promise<TransaksiItem[]> {
  const { rows } = await query(
    `SELECT dt.id, p.nama AS produk, dt.jumlah, dt.harga_satuan AS "hargaSatuan",
            dt.subtotal AS total, COALESCE(pl.nama, 'Umum') AS pelanggan,
            to_char(t.tanggal, 'YYYY-MM-DD') AS tanggal
     FROM detail_transaksi dt
     JOIN transaksi t ON dt.transaksi_id = t.id
     JOIN produk p ON dt.produk_id = p.id
     LEFT JOIN pelanggan pl ON t.pelanggan_id = pl.id
     WHERE t.toko_id = $1
     ORDER BY t.tanggal DESC
    LIMIT 1000`,
    [tokoId || DEFAULT_TOKO]
  );
  return rows;
}

export async function createTransaksi(
  tokoId: string | undefined,
  entry: Omit<TransaksiItem, 'id' | 'total'> & { hargaSatuan: number; produkId?: string; pelangganId?: string; diskon?: number },
): Promise<TransaksiItem> {
  const tid = tokoId || DEFAULT_TOKO;
  // Total otomatis: qty × harga − diskon (share per item, minimal 0)
  const total = Math.max(0, entry.jumlah * entry.hargaSatuan - Math.round(entry.diskon || 0));

  // Cari produk by nama — kalau belum ada, auto-buat row di tabel produk (FK aman, SKU asli bukan di tabel produk legacy)
  let produkId = entry.produkId;
  if (!produkId) {
    const { rows: pRows } = await query('SELECT id FROM produk WHERE nama = $1 AND toko_id = $2 LIMIT 1', [entry.produk, tid]);
    if (pRows.length > 0) {
      produkId = pRows[0].id;
    } else {
      const { rows: created } = await query(
        'INSERT INTO produk (toko_id, nama) VALUES ($1, $2) RETURNING id',
        [tid, entry.produk]
      );
      produkId = created.length > 0 ? created[0].id : null;
    }
  }

  // Cari pelanggan by nama atau pakai default
  let pelangganId = entry.pelangganId;
  if (!pelangganId && entry.pelanggan && entry.pelanggan !== 'Umum') {
    const { rows: plRows } = await query('SELECT id FROM pelanggan WHERE nama = $1 AND toko_id = $2 LIMIT 1', [entry.pelanggan, tid]);
    if (plRows.length > 0) pelangganId = plRows[0].id;
  }
  if (!pelangganId) {
    const { rows: defRows } = await query('SELECT id FROM pelanggan WHERE nama = $1 AND toko_id = $2 LIMIT 1', ['Pelanggan Umum', tid]);
    pelangganId = defRows.length > 0 ? defRows[0].id : null;
  }

  // Buat transaksi (tanggal mendukung input backdate, default hari ini)
  const tanggal = entry.tanggal || new Date().toISOString().slice(0, 10);
  const { rows: tRows } = await query(
    'INSERT INTO transaksi (toko_id, pelanggan_id, total, tanggal) VALUES ($1, $2, $3, $4::date) RETURNING id',
    [tid, pelangganId, total, tanggal]
  );
  const transaksiId = tRows[0].id;

  // Buat detail transaksi
  await query(
    'INSERT INTO detail_transaksi (transaksi_id, produk_id, jumlah, harga_satuan, subtotal) VALUES ($1, $2, $3, $4, $5)',
    [transaksiId, produkId, entry.jumlah, entry.hargaSatuan, total]
  );

  return {
    id: transaksiId,
    produk: entry.produk,
    jumlah: entry.jumlah,
    hargaSatuan: entry.hargaSatuan,
    total,
    pelanggan: entry.pelanggan || 'Umum',
    tanggal,
  };
}
