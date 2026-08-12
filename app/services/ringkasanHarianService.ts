import { query } from '@/lib/db';

export interface RingkasanHarianData {
  tanggal: string;
  totalPenjualan: number;
  jumlahTransaksi: number;
  rataRataTransaksi: number;
}

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getRingkasanHarian(
  tokoId?: string,
  tanggal?: string,
): Promise<RingkasanHarianData> {
  const hariIni = tanggal ?? new Date().toISOString().slice(0, 10);

  const { rows } = await query(
    `SELECT COALESCE(SUM(total), 0)::int AS total_penjualan, COUNT(*)::int AS jumlah_transaksi
     FROM transaksi WHERE toko_id = $1 AND tanggal::date = $2::date`,
    [tokoId || DEFAULT_TOKO, hariIni]
  );

  const totalPenjualan = rows[0]?.total_penjualan || 0;
  const jumlahTransaksi = rows[0]?.jumlah_transaksi || 0;
  const rataRataTransaksi = jumlahTransaksi > 0 ? Math.round(totalPenjualan / jumlahTransaksi) : 0;

  return { tanggal: hariIni, totalPenjualan, jumlahTransaksi, rataRataTransaksi };
}
