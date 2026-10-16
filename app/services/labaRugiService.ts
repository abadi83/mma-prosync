import { query } from '@/lib/db';
import { periodeRange, readSyncedArray, sumInRange } from '@/app/lib/reportData';

export interface LabaRugiResponse {
  pendapatan: number;
  pendapatanLain: number;
  hargaPokok: number;
  biayaOperasional: number;
  biayaLain: number;
  labaKotor: number;
  labaBersih: number;
  marginKotor: number;
  marginBersih: number;
}

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getLabaRugi(tokoId?: string, periode?: string | null): Promise<LabaRugiResponse> {
  const tid = tokoId || DEFAULT_TOKO;
  const range = periodeRange(periode);

  // Pendapatan dari transaksi (periode terpilih)
  const { rows: pendapatanRows } = await query(
    `SELECT COALESCE(SUM(total), 0)::int AS pendapatan
     FROM transaksi WHERE toko_id = $1 AND tanggal::date >= $2::date
       AND ($3::date IS NULL OR tanggal::date <= $3::date)`,
    [tid, range.start, range.end]
  );

  // HPP dari detail_transaksi (harga beli produk)
  const { rows: hppRows } = await query(
    `SELECT COALESCE(SUM(dt.jumlah * p.harga_beli), 0)::int AS hpp
     FROM detail_transaksi dt
     JOIN transaksi t ON dt.transaksi_id = t.id
     JOIN produk p ON dt.produk_id = p.id
     WHERE t.toko_id = $1 AND t.tanggal::date >= $2::date
       AND ($3::date IS NULL OR t.tanggal::date <= $3::date)`,
    [tid, range.start, range.end]
  );

  // Biaya marketplace (fee) dari pesanan marketplace
  const { rows: feeRows } = await query(
    `SELECT COALESCE(SUM(total_biaya), 0)::int AS fee
     FROM marketplace_order WHERE toko_id = $1 AND tanggal::date >= $2::date
       AND ($3::date IS NULL OR tanggal::date <= $3::date)`,
    [tid, range.start, range.end]
  );

  // Biaya operasional & OPEX: dari data sync antar perangkat (folder data/)
  const biayaOps = sumInRange(readSyncedArray('mma_biaya_operasional.json'), 'tanggal', 'jumlah', range);
  const opex = sumInRange(readSyncedArray('mma_opex_purchases.json'), 'tanggal', 'total', range);
  const pendapatanLain = sumInRange(readSyncedArray('mma_penjualan_lain.json'), 'tanggal', 'jumlah', range);

  const pendapatan = Number(pendapatanRows[0]?.pendapatan) || 0;
  const hargaPokok = Number(hppRows[0]?.hpp) || 0;
  const feeMarketplace = Number(feeRows[0]?.fee) || 0;
  const biayaOperasional = Math.round(biayaOps);
  const biayaLain = Math.round(opex + feeMarketplace);

  const labaKotor = pendapatan - hargaPokok;
  const labaBersih = labaKotor - biayaOperasional - biayaLain + pendapatanLain;

  return {
    pendapatan,
    pendapatanLain,
    hargaPokok,
    biayaOperasional,
    biayaLain,
    labaKotor,
    labaBersih,
    marginKotor: pendapatan > 0 ? parseFloat(((labaKotor / pendapatan) * 100).toFixed(1)) : 0,
    marginBersih: pendapatan > 0 ? parseFloat(((labaBersih / pendapatan) * 100).toFixed(1)) : 0,
  };
}
