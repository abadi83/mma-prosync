import { query } from '@/lib/db';

interface CashItem { sumber: string; jumlah: number; }

export interface ArusKasResponse {
  saldoAwal: number;
  pemasukan: CashItem[];
  pengeluaran: CashItem[];
  totalMasuk: number;
  totalKeluar: number;
  saldoAkhir: number;
}

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getArusKas(tokoId?: string, _periode?: string): Promise<ArusKasResponse> {
  const tid = tokoId || DEFAULT_TOKO;

  // Pemasukan dari penjualan
  const { rows: pemasukan } = await query(
    `SELECT 'Penjualan' AS sumber, COALESCE(SUM(total), 0)::int AS jumlah
     FROM transaksi WHERE toko_id = $1 AND tanggal::date >= CURRENT_DATE - 30`,
    [tid]
  );

  // Pengeluaran dari mutasi stok masuk (perkiraan biaya pembelian)
  const { rows: pengeluaran } = await query(
    `SELECT 'Pembelian Stok' AS sumber, COALESCE(SUM(ms.jumlah * p.harga_beli), 0)::int AS jumlah
     FROM mutasi_stok ms JOIN produk p ON ms.produk_id = p.id
     WHERE ms.toko_id = $1 AND ms.tipe = 'masuk' AND ms.tanggal::date >= CURRENT_DATE - 30`,
    [tid]
  );

  const masukan = pemasukan[0] || { sumber: 'Penjualan', jumlah: 0 };
  const keluar = pengeluaran[0] || { sumber: 'Pembelian Stok', jumlah: 0 };
  const saldoAwal = 5000000;

  return {
    saldoAwal,
    pemasukan: [masukan],
    pengeluaran: [keluar],
    totalMasuk: Number(masukan.jumlah),
    totalKeluar: Number(keluar.jumlah),
    saldoAkhir: saldoAwal + Number(masukan.jumlah) - Number(keluar.jumlah),
  };
}
