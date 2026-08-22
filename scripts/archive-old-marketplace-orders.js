/**
 * Arsip & hapus order marketplace yang lebih lama dari N bulan.
 * Sebelum dihapus, data di-export dulu ke /home/backups/archive/*.json
 * (aman — bisa di-restore kapan pun).
 *
 * Cara pakai (di VPS):
 *   cd /home/mma-prosync && set -a && . ./.env.local && set +a
 *   node scripts/archive-old-marketplace-orders.js [bulan=3]
 */
const fs = require('fs');
const { Pool } = require('pg');

const months = parseInt(process.argv[2] || '3', 10);

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
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const { rows } = await pool.query(
    `SELECT * FROM marketplace_order
     WHERE tanggal IS NOT NULL AND tanggal <> '' AND tanggal < $1
     ORDER BY tanggal`,
    [cutoffStr]
  );

  if (rows.length === 0) {
    console.log(`✅ Tidak ada order lebih lama dari ${cutoffStr} (${months} bulan terakhir). Tidak ada yang dihapus.`);
    await pool.end();
    return;
  }

  const archiveDir = '/home/backups/archive';
  fs.mkdirSync(archiveDir, { recursive: true });
  const file = `${archiveDir}/marketplace_orders_before_${cutoffStr}_${Date.now()}.json`;
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));

  const { rowCount } = await pool.query(
    `DELETE FROM marketplace_order
     WHERE tanggal IS NOT NULL AND tanggal <> '' AND tanggal < $1`,
    [cutoffStr]
  );

  console.log(`✅ ${rowCount} order (lebih lama dari ${months} bulan) diarsipkan ke:\n   ${file}\n   dan dihapus dari tabel aktif. Backup harian tetap aman di /home/backups/db.`);
  await pool.end();
}

run().catch(e => { console.error('❌ Gagal:', e.message); process.exit(1); });
