/**
 * Perbaiki label marketplace order lama di DB berdasarkan nama toko.
 * Jalankan sekali di VPS:
 *   cd /home/mma-prosync && set -a && . ./.env.local && set +a
 *   node scripts/fix-marketplace-labels.js
 */
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
  const pool = createPool();
  const r = await pool.query(`UPDATE marketplace_order SET marketplace = CASE
    WHEN toko_nama ILIKE '%digo%' THEN 'Digo Tools'
    WHEN toko_nama ILIKE '%gmt%' OR toko_nama ILIKE '%aeer%' THEN 'GMT'
    WHEN toko_nama ILIKE '%mitra%' THEN 'Shopee'
    ELSE marketplace END`);
  console.log(`✅ Label marketplace diperbaiki pada ${r.rowCount} baris.`);
  const s = await pool.query('SELECT marketplace, COUNT(*) AS jumlah FROM marketplace_order GROUP BY marketplace ORDER BY jumlah DESC');
  console.table(s.rows);
  await pool.end();
}

run().catch(e => { console.error('❌ Gagal:', e.message); process.exit(1); });
