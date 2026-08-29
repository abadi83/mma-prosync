/**
 * Cleanup data demo dari seed migrasi:
 *   - 001_seed_beranda.sql   → produk (Minyak Goreng, Beras Premium, Sabun Cuci, Kopi Arabika)
 *   - 002_seed_mutasi_stok.sql → mutasi_stok (barang masuk/keluar demo)
 *   - 003_seed_transaksi.sql   → transaksi + detail_transaksi (penjualan demo)
 *
 * HANYA menghapus row dengan UUID seed demo (ON CONFLICT id) — data asli aman.
 * users demo (a0a0...0001), pelanggan "Pelanggan Umum", dan kategori DIPERTAHANKAN
 * karena masih dipakai sebagai default oleh aplikasi.
 *
 * Cara pakai (di VPS):
 *   cd /home/mma-prosync && set -a && . ./.env.local && set +a
 *   node scripts/cleanup-demo-data.js
 */
const { Pool } = require('pg');

const DEMO = {
  produk: [
    'c1c1c1c1-2001-4000-8000-000000000001',
    'c1c1c1c1-2001-4000-8000-000000000002',
    'c1c1c1c1-2001-4000-8000-000000000003',
    'c1c1c1c1-2001-4000-8000-000000000004',
  ],
  mutasiStok: [
    'e1e1e1e1-4001-4000-8000-000000000001',
    'e1e1e1e1-4001-4000-8000-000000000002',
    'e1e1e1e1-4001-4000-8000-000000000003',
    'e1e1e1e1-4001-4000-8000-000000000004',
    'e1e1e1e1-4001-4000-8000-000000000005',
    'e1e1e1e1-4001-4000-8000-000000000006',
    'e1e1e1e1-4001-4000-8000-000000000007',
    'e1e1e1e1-4001-4000-8000-000000000008',
  ],
  transaksi: [
    'f1f1f1f1-5001-4000-8000-000000000001',
    'f1f1f1f1-5001-4000-8000-000000000002',
    'f1f1f1f1-5001-4000-8000-000000000003',
    'f1f1f1f1-5001-4000-8000-000000000004',
    'f1f1f1f1-5001-4000-8000-000000000005',
  ],
  detailTransaksi: [
    'f1f1f1f1-5001-4000-8000-000000000101',
    'f1f1f1f1-5001-4000-8000-000000000102',
    'f1f1f1f1-5001-4000-8000-000000000201',
    'f1f1f1f1-5001-4000-8000-000000000301',
    'f1f1f1f1-5001-4000-8000-000000000401',
    'f1f1f1f1-5001-4000-8000-000000000501',
  ],
};

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
  const pool = createPool();
  const c = await pool.connect();
  try {
    console.log('🧹 Membersihkan data demo...');

    const r1 = await c.query(
      'DELETE FROM detail_transaksi WHERE id = ANY($1::uuid[]) OR transaksi_id = ANY($2::uuid[])',
      [DEMO.detailTransaksi, DEMO.transaksi]
    );
    console.log(`   detail_transaksi: ${r1.rowCount} baris dihapus`);

    const r2 = await c.query('DELETE FROM transaksi WHERE id = ANY($1::uuid[])', [DEMO.transaksi]);
    console.log(`   transaksi: ${r2.rowCount} baris dihapus`);

    const r3 = await c.query('DELETE FROM mutasi_stok WHERE id = ANY($1::uuid[])', [DEMO.mutasiStok]);
    console.log(`   mutasi_stok (barang masuk/keluar): ${r3.rowCount} baris dihapus`);

    const r4 = await c.query('DELETE FROM produk WHERE id = ANY($1::uuid[])', [DEMO.produk]);
    console.log(`   produk: ${r4.rowCount} baris dihapus`);

    console.log('✅ Selesai. Data demo sudah bersih, data asli tidak tersentuh.');
  } catch (err) {
    console.error('❌ Gagal:', err.message);
    process.exit(1);
  } finally {
    c.release();
    await pool.end();
  }
}

run();
