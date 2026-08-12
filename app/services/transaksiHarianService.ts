import { query } from '@/lib/db';
import type { TransaksiItem } from '@/app/services/transaksiService';

export interface TransaksiHarianResponse {
  tanggal: string;
  transaksi: TransaksiItem[];
  totalPenjualan: number;
  jumlahTransaksi: number;
}

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getTransaksiHarian(
  tokoId?: string,
  tanggal?: string,
): Promise<TransaksiHarianResponse> {
  const hariIni = tanggal ?? new Date().toISOString().slice(0, 10);

  const { rows } = await query(
    `SELECT dt.id, p.nama AS produk, dt.jumlah, dt.harga_satuan AS "hargaSatuan",
            dt.subtotal AS total, COALESCE(pl.nama, 'Umum') AS pelanggan,
            to_char(t.tanggal, 'YYYY-MM-DD') AS tanggal
     FROM detail_transaksi dt
     JOIN transaksi t ON dt.transaksi_id = t.id
     JOIN produk p ON dt.produk_id = p.id
     LEFT JOIN pelanggan pl ON t.pelanggan_id = pl.id
     WHERE t.toko_id = $1 AND t.tanggal::date = $2::date
     ORDER BY t.tanggal DESC`,
    [tokoId || DEFAULT_TOKO, hariIni]
  );

  const totalPenjualan = rows.reduce((sum: number, t: any) => sum + Number(t.total), 0);

  return {
    tanggal: hariIni,
    transaksi: rows,
    totalPenjualan,
    jumlahTransaksi: rows.length,
  };
}
