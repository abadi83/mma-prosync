/**
 * Backfill: impor data order marketplace lama dari data/mma_marketplace_orders.json
 * (hasil sinkronisasi GlobalSyncProvider sebelum migrasi ke PostgreSQL).
 * Jalankan sekali di VPS:
 *   cd /home/mma-prosync && set -a && . ./.env.local && set +a
 *   node scripts/backfill-marketplace-orders.js
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    return new Pool({ connectionString, ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined });
  }
  return new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'mma_prosync',
    user: process.env.DB_USER || 'mma_admin',
    password: process.env.DB_PASSWORD || 'mma_prosync_2024!',
  });
}

async function run() {
  const jsonPath = path.join(__dirname, '..', 'data', 'mma_marketplace_orders.json');
  if (!fs.existsSync(jsonPath)) {
    console.log('Tidak ada file lama data/mma_marketplace_orders.json — tidak ada yang di-backfill.');
    return;
  }
  const orders = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  if (!Array.isArray(orders) || orders.length === 0) {
    console.log('File lama kosong — tidak ada yang di-backfill.');
    return;
  }

  const pool = createPool();
  const tokoId = process.env.DEFAULT_TOKO_ID || 'a0a0a0a0-0000-0000-0000-000000000001';
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const o of orders) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO marketplace_order (
           toko_id, no_pesanan, marketplace, tanggal, toko_nama, pendapatan_kotor, pendapatan_bersih,
           total_biaya, fee_admin, fee_layanan, ongkir_aktual, subsidi_ongkir, biaya_pemrosesan,
           premi_proteksi, biaya_ams, biaya_transaksi, komisi, items, total_hpp, laba_kotor,
           catatan, status_pesanan
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,$21,$22
         )
         ON CONFLICT (toko_id, marketplace, no_pesanan) DO UPDATE SET
           tanggal = EXCLUDED.tanggal, toko_nama = EXCLUDED.toko_nama,
           pendapatan_kotor = EXCLUDED.pendapatan_kotor, pendapatan_bersih = EXCLUDED.pendapatan_bersih,
           total_biaya = EXCLUDED.total_biaya, fee_admin = EXCLUDED.fee_admin,
           fee_layanan = EXCLUDED.fee_layanan, ongkir_aktual = EXCLUDED.ongkir_aktual,
           subsidi_ongkir = EXCLUDED.subsidi_ongkir, biaya_pemrosesan = EXCLUDED.biaya_pemrosesan,
           premi_proteksi = EXCLUDED.premi_proteksi, biaya_ams = EXCLUDED.biaya_ams,
           biaya_transaksi = EXCLUDED.biaya_transaksi, komisi = EXCLUDED.komisi,
           items = EXCLUDED.items, total_hpp = EXCLUDED.total_hpp, laba_kotor = EXCLUDED.laba_kotor,
           catatan = EXCLUDED.catatan, status_pesanan = EXCLUDED.status_pesanan
         RETURNING (xmax = 0) AS is_inserted`,
        [
          tokoId, o.noPesanan || '', o.marketplace || '', o.tanggal || '', o.tokoNama || '',
          o.pendapatanKotor || 0, o.pendapatanBersih || 0, o.totalBiaya || 0,
          o.feeAdmin || 0, o.feeLayanan || 0, o.ongkirAktual || 0, o.subsidiOngkir || 0,
          o.biayaPemrosesan || 0, o.premiProteksi || 0, o.biayaAMS || 0, o.biayaTransaksi || 0,
          o.komisi || 0, JSON.stringify(o.items || []), o.totalHPP || 0, o.labaKotor || 0,
          o.catatan || '', o.statusPesanan || '',
        ]
      );
      if (rows[0]?.is_inserted) inserted++; else updated++;
    } catch (e) {
      errors++;
      console.error('❌ Gagal impor order:', o.noPesanan, e.message);
    }
  }

  console.log(`✅ Backfill selesai: ${inserted} baru, ${updated} diperbarui, ${errors} gagal, dari total ${orders.length} order lama.`);
  await pool.end();
}

run().catch(e => { console.error('❌ Backfill gagal:', e.message); process.exit(1); });
