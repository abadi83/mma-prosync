import { query } from '@/lib/db';

export interface LabaRugiResponse {
  pendapatan: number;
  hargaPokok: number;
  biayaOperasional: number;
  biayaLain: number;
  labaKotor: number;
  labaBersih: number;
  marginKotor: number;
  marginBersih: number;
}

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getLabaRugi(tokoId?: string, _periode?: string): Promise<LabaRugiResponse> {
  const tid = tokoId || DEFAULT_TOKO;

  // Pendapatan dari transaksi 30 hari terakhir
  const { rows: pendapatanRows } = await query(
    `SELECT COALESCE(SUM(total), 0)::int AS pendapatan
     FROM transaksi WHERE toko_id = $1 AND tanggal::date >= CURRENT_DATE - 30`,
    [tid]
  );

  // HPP dari detail_transaksi (harga beli produk)
  const { rows: hppRows } = await query(
    `SELECT COALESCE(SUM(dt.jumlah * p.harga_beli), 0)::int AS hpp
     FROM detail_transaksi dt
     JOIN transaksi t ON dt.transaksi_id = t.id
     JOIN produk p ON dt.produk_id = p.id
     WHERE t.toko_id = $1 AND t.tanggal::date >= CURRENT_DATE - 30`,
    [tid]
  );

  const pendapatan = pendapatanRows[0]?.pendapatan || 0;
  const hargaPokok = hppRows[0]?.hpp || 0;
  const biayaOperasional = 0; // TODO: tabel biaya operasional
  const biayaLain = 0;
  const labaKotor = pendapatan - hargaPokok;
  const labaBersih = labaKotor - biayaOperasional - biayaLain;

  return {
    pendapatan,
    hargaPokok,
    biayaOperasional,
    biayaLain,
    labaKotor,
    labaBersih,
    marginKotor: pendapatan > 0 ? parseFloat(((labaKotor / pendapatan) * 100).toFixed(1)) : 0,
    marginBersih: pendapatan > 0 ? parseFloat(((labaBersih / pendapatan) * 100).toFixed(1)) : 0,
  };
}
