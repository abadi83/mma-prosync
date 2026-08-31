/**
 * Debug: cek isi tabel transaksi & detail_transaksi (untuk investigasi data kasir yang hilang).
 * Cara pakai (di VPS): cd /home/mma-prosync && set -a && . ./.env.local && set +a && node scripts/check-transaksi.js
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
  const c = await pool.connect();
  try {
    const t = await c.query("SELECT COUNT(*)::int AS jml, MIN(tanggal) AS min, MAX(tanggal) AS max FROM transaksi");
    console.log('transaksi:', JSON.stringify(t.rows[0]));

    const last = await c.query("SELECT id, total, to_char(tanggal,'YYYY-MM-DD') AS tgl, pelanggan_id FROM transaksi ORDER BY tanggal DESC LIMIT 10");
    console.log('last10:', JSON.stringify(last.rows, null, 2));

    const d = await c.query('SELECT COUNT(*)::int AS jml FROM detail_transaksi');
    console.log('detail count:', d.rows[0].jml);

    const p = await c.query('SELECT COUNT(*)::int AS jml FROM produk');
    console.log('produk count:', p.rows[0].jml);

    // Cek produk yang dipakai detail (apakah produk legacy ada)
    const pk = await c.query('SELECT DISTINCT p.nama FROM detail_transaksi dt LEFT JOIN produk p ON dt.produk_id = p.id LIMIT 10');
    console.log('produk di detail:', JSON.stringify(pk.rows));

    // Cek file sinkronisasi laporan (localStorage → server JSON)
    const fs = require('fs');
    const f = 'data/mma_penjualan_transaksi.json';
    if (!fs.existsSync(f)) {
      console.log('file data/mma_penjualan_transaksi.json tidak ada');
    } else {
      const d = JSON.parse(fs.readFileSync(f, 'utf8'));
      console.log('total entry JSON:', d.length);
      const july = d.filter(x => String(x.tanggal).startsWith('2026-07'));
      console.log('entry Juli:', july.length);
      if (july.length > 0) console.log('contoh Juli:', JSON.stringify(july.slice(0, 3), null, 2));
      console.log('5 terakhir:', JSON.stringify(d.slice(0, 5).map(x => ({ sku: x.sku, total: x.total, tanggal: x.tanggal }))));
    }
  } catch (err) {
    console.error('❌ Gagal:', err.message);
    process.exit(1);
  } finally {
    c.release();
    await pool.end();
  }
}

run();
