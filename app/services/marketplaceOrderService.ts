import { query } from '@/lib/db';

export interface MarketplaceOrderItem { sku: string; nama: string; qty: number; hargaJual: number; hpp: number; }

export interface MarketplaceOrder {
  id: string;
  noPesanan: string;
  tanggal: string;
  marketplace: string;
  tokoNama: string;
  pendapatanKotor: number;
  pendapatanBersih: number;
  totalBiaya: number;
  feeAdmin: number;
  feeLayanan: number;
  ongkirAktual: number;
  subsidiOngkir: number;
  biayaPemrosesan: number;
  premiProteksi: number;
  biayaAMS: number;
  biayaTransaksi: number;
  komisi: number;
  items: MarketplaceOrderItem[];
  totalHPP: number;
  labaKotor: number;
  catatan: string;
  statusPesanan: string;
}

const DEFAULT_TOKO = process.env.DEFAULT_TOKO_ID || 'a0a0a0a0-0000-0000-0000-000000000001';

function mapRow(r: any): MarketplaceOrder {
  let items: MarketplaceOrderItem[] = [];
  try { items = Array.isArray(r.items) ? r.items : []; } catch { items = []; }
  return {
    id: r.id,
    noPesanan: r.no_pesanan || '',
    tanggal: r.tanggal || '',
    marketplace: r.marketplace || '',
    tokoNama: r.toko_nama || '',
    pendapatanKotor: Number(r.pendapatan_kotor || 0),
    pendapatanBersih: Number(r.pendapatan_bersih || 0),
    totalBiaya: Number(r.total_biaya || 0),
    feeAdmin: Number(r.fee_admin || 0),
    feeLayanan: Number(r.fee_layanan || 0),
    ongkirAktual: Number(r.ongkir_aktual || 0),
    subsidiOngkir: Number(r.subsidi_ongkir || 0),
    biayaPemrosesan: Number(r.biaya_pemrosesan || 0),
    premiProteksi: Number(r.premi_proteksi || 0),
    biayaAMS: Number(r.biaya_ams || 0),
    biayaTransaksi: Number(r.biaya_transaksi || 0),
    komisi: Number(r.komisi || 0),
    items,
    totalHPP: Number(r.total_hpp || 0),
    labaKotor: Number(r.laba_kotor || 0),
    catatan: r.catatan || '',
    statusPesanan: r.status_pesanan || '',
  };
}

export async function listMarketplaceOrders(tokoId?: string): Promise<MarketplaceOrder[]> {
  const { rows } = await query(
    `SELECT id, no_pesanan, tanggal, marketplace, toko_nama, pendapatan_kotor, pendapatan_bersih,
            total_biaya, fee_admin, fee_layanan, ongkir_aktual, subsidi_ongkir, biaya_pemrosesan,
            premi_proteksi, biaya_ams, biaya_transaksi, komisi, items, total_hpp, laba_kotor,
            catatan, status_pesanan
     FROM marketplace_order
     WHERE toko_id = $1
     ORDER BY created_at DESC, id DESC`,
    [tokoId || DEFAULT_TOKO]
  );
  return rows.map(mapRow);
}

export async function upsertMarketplaceOrders(orders: MarketplaceOrder[], tokoId?: string): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;
  for (const o of orders) {
    const { rows } = await query(
      `INSERT INTO marketplace_order (
         toko_id, no_pesanan, marketplace, tanggal, toko_nama, pendapatan_kotor, pendapatan_bersih,
         total_biaya, fee_admin, fee_layanan, ongkir_aktual, subsidi_ongkir, biaya_pemrosesan,
         premi_proteksi, biaya_ams, biaya_transaksi, komisi, items, total_hpp, laba_kotor,
         catatan, status_pesanan
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,$21,$22
       )
       ON CONFLICT (toko_id, marketplace, no_pesanan) DO UPDATE SET
         tanggal = EXCLUDED.tanggal,
         toko_nama = EXCLUDED.toko_nama,
         pendapatan_kotor = EXCLUDED.pendapatan_kotor,
         pendapatan_bersih = EXCLUDED.pendapatan_bersih,
         total_biaya = EXCLUDED.total_biaya,
         fee_admin = EXCLUDED.fee_admin,
         fee_layanan = EXCLUDED.fee_layanan,
         ongkir_aktual = EXCLUDED.ongkir_aktual,
         subsidi_ongkir = EXCLUDED.subsidi_ongkir,
         biaya_pemrosesan = EXCLUDED.biaya_pemrosesan,
         premi_proteksi = EXCLUDED.premi_proteksi,
         biaya_ams = EXCLUDED.biaya_ams,
         biaya_transaksi = EXCLUDED.biaya_transaksi,
         komisi = EXCLUDED.komisi,
         items = EXCLUDED.items,
         total_hpp = EXCLUDED.total_hpp,
         laba_kotor = EXCLUDED.laba_kotor,
         catatan = EXCLUDED.catatan,
         status_pesanan = EXCLUDED.status_pesanan
       RETURNING (xmax = 0) AS is_inserted`,
      [
        tokoId || DEFAULT_TOKO, o.noPesanan, o.marketplace, o.tanggal || '', o.tokoNama || '',
        o.pendapatanKotor || 0, o.pendapatanBersih || 0, o.totalBiaya || 0,
        o.feeAdmin || 0, o.feeLayanan || 0, o.ongkirAktual || 0, o.subsidiOngkir || 0,
        o.biayaPemrosesan || 0, o.premiProteksi || 0, o.biayaAMS || 0, o.biayaTransaksi || 0,
        o.komisi || 0, JSON.stringify(o.items || []), o.totalHPP || 0, o.labaKotor || 0,
        o.catatan || '', o.statusPesanan || '',
      ]
    );
    if (rows[0]?.is_inserted) inserted++; else updated++;
  }
  return { inserted, updated };
}

export async function deleteAllMarketplaceOrders(tokoId?: string): Promise<number> {
  const { rowCount } = await query('DELETE FROM marketplace_order WHERE toko_id = $1', [tokoId || DEFAULT_TOKO]);
  return rowCount || 0;
}
