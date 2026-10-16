import { query } from '@/lib/db';
import { periodeRange, readSyncedArray, sumInRange } from '@/app/lib/reportData';

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

export async function getArusKas(tokoId?: string, periode?: string | null): Promise<ArusKasResponse> {
  const tid = tokoId || DEFAULT_TOKO;
  const range = periodeRange(periode);

  // Pemasukan dari penjualan (periode terpilih)
  const { rows: pemasukan } = await query(
    `SELECT 'Penjualan' AS sumber, COALESCE(SUM(total), 0)::int AS jumlah
     FROM transaksi WHERE toko_id = $1 AND tanggal::date >= $2::date
       AND ($3::date IS NULL OR tanggal::date <= $3::date)`,
    [tid, range.start, range.end]
  );

  // Pengeluaran dari mutasi stok masuk (perkiraan biaya pembelian)
  const { rows: pengeluaran } = await query(
    `SELECT 'Pembelian Stok' AS sumber, COALESCE(SUM(ms.jumlah * p.harga_beli), 0)::int AS jumlah
     FROM mutasi_stok ms JOIN produk p ON ms.produk_id = p.id
     WHERE ms.toko_id = $1 AND ms.tipe = 'masuk' AND ms.tanggal::date >= $2::date
       AND ($3::date IS NULL OR ms.tanggal::date <= $3::date)`,
    [tid, range.start, range.end]
  );

  // Saldo awal = modal tersimpan + saldo kas kecil (semua waktu — sama seperti halaman laporan)
  const modal = readSyncedArray('mma_modal.json').reduce((s: number, m: any) => s + (Number(m?.jumlah) || 0), 0);
  const kasKecilNet = readSyncedArray('mma_kas_kecil.json').reduce(
    (s: number, e: any) => s + (e?.jenis === 'masuk' ? Number(e.jumlah) || 0 : -(Number(e.jumlah) || 0)),
    0
  );

  // Biaya operasional & OPEX dari data sync antar perangkat
  const biayaOps = sumInRange(readSyncedArray('mma_biaya_operasional.json'), 'tanggal', 'jumlah', range);
  const opex = sumInRange(readSyncedArray('mma_opex_purchases.json'), 'tanggal', 'total', range);

  const masuk = Number(pemasukan[0]?.jumlah) || 0;
  const beliStok = Number(pengeluaran[0]?.jumlah) || 0;

  const daftarPemasukan: CashItem[] = [{ sumber: 'Penjualan', jumlah: masuk }];
  const daftarPengeluaran: CashItem[] = [
    { sumber: 'Pembayaran PO (Pembelian Stok)', jumlah: beliStok },
    { sumber: 'Biaya Operasional', jumlah: Math.round(biayaOps) },
    { sumber: 'OPEX', jumlah: Math.round(opex) },
  ];

  const saldoAwal = Math.round(modal + kasKecilNet);
  const totalMasuk = daftarPemasukan.reduce((s, i) => s + i.jumlah, 0);
  const totalKeluar = daftarPengeluaran.reduce((s, i) => s + i.jumlah, 0);

  return {
    saldoAwal,
    pemasukan: daftarPemasukan,
    pengeluaran: daftarPengeluaran,
    totalMasuk,
    totalKeluar,
    saldoAkhir: saldoAwal + totalMasuk - totalKeluar,
  };
}
