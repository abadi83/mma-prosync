/**
 * Backfill: rebuild tabel transaksi & detail_transaksi DB dari data/mma_penjualan_transaksi.json.
 *
 * Kenapa perlu: bug produk lookup (produk asli tidak ada di tabel `produk` legacy) membuat
 * semua transaksi kasir gagal insert detail → header yatim tanpa detail → tidak muncul di Daftar Transaksi.
 * Data penjualan tetap utuh di JSON (dipakai Laporan), jadi bisa di-rebuild ke DB.
 *
 * Aman dijalankan ulang: tabel DB dibangun ulang dari JSON (bukan duplikat).
 * Cara pakai (di VPS):
 *   cd /home/mma-prosync && set -a && . ./.env.local && set +a
 *   node scripts/backfill-transaksi-db.js
 */
const fs = require('fs');
const { Pool } = require('pg');

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';
const JSON_FILE = 'data/mma_penjualan_transaksi.json';

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
  if (!fs.existsSync(JSON_FILE)) {
    console.error(`❌ ${JSON_FILE} tidak ditemukan.`);
    process.exit(1);
  }
  const items = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
  if (!Array.isArray(items) || items.length === 0) {
    console.log('⏭️  JSON kosong, tidak ada yang di-backfill.');
    return;
  }

  const pool = createPool();
  const c = await pool.connect();
  try {
    // Bangun ulang (header yatim lama ikut terhapus — detail count sebelumnya 0)
    const delDetail = await c.query('DELETE FROM detail_transaksi');
    const delTx = await c.query('DELETE FROM transaksi');
    console.log(`🧹 Reset: ${delDetail.rowCount} detail, ${delTx.rowCount} transaksi dihapus.`);

    let inserted = 0;
    for (const item of items) {
      if (!item.produk || !item.qty || !item.tanggal) continue;
      const produk = String(item.produk).slice(0, 255);
      const qty = +item.qty || 1;
      const totalNet = Math.max(0, Math.round(+item.total || 0));
      const hargaSatuan = Math.max(0, Math.round(+item.hargaSatuan || 0));
      const tanggal = String(item.tanggal).slice(0, 10);

      // Auto-buat produk legacy kalau belum ada
      let produkId = null;
      const pRows = await c.query('SELECT id FROM produk WHERE nama = $1 AND toko_id = $2 LIMIT 1', [produk, DEFAULT_TOKO]);
      if (pRows.rows.length > 0) {
        produkId = pRows.rows[0].id;
      } else {
        const created = await c.query('INSERT INTO produk (toko_id, nama) VALUES ($1, $2) RETURNING id', [DEFAULT_TOKO, produk]);
        produkId = created.rows[0].id;
      }

      const tRows = await c.query(
        "INSERT INTO transaksi (toko_id, pelanggan_id, total, tanggal) VALUES ($1, NULL, $2, $3::date) RETURNING id",
        [DEFAULT_TOKO, totalNet, tanggal]
      );
      const transaksiId = tRows.rows[0].id;

      await c.query(
        'INSERT INTO detail_transaksi (transaksi_id, produk_id, jumlah, harga_satuan, subtotal) VALUES ($1, $2, $3, $4, $5)',
        [transaksiId, produkId, qty, hargaSatuan, totalNet]
      );
      inserted++;
    }
    console.log(`✅ Backfill selesai: ${inserted} transaksi masuk DB (tabel produk auto-dibuat bila perlu).`);
  } catch (err) {
    console.error('❌ Gagal:', err.message);
    process.exit(1);
  } finally {
    c.release();
    await pool.end();
  }
}

run();
