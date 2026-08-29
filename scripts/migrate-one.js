/**
 * Jalankan SATU file migration secara eksplisit (aman — tidak menjalankan ulang migrasi lain).
 *
 * Cara pakai (di VPS):
 *   cd /home/mma-prosync && set -a && . ./.env.local && set +a
 *   node scripts/migrate-one.js 017_add_sku_konten.sql
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/migrate-one.js <nama-file.sql di folder migrations>');
  process.exit(1);
}

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
  const sqlPath = path.join(__dirname, '..', 'migrations', file);
  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ File tidak ditemukan: migrations/${file}`);
    process.exit(1);
  }
  const rawSql = fs.readFileSync(sqlPath, 'utf-8');
  const sql = rawSql.split('\n').filter(line => !line.trim().startsWith('\\')).join('\n');

  const pool = createPool();
  const c = await pool.connect();
  try {
    console.log(`▶️  Running ${file} ...`);
    await c.query(sql);
    console.log(`✅ ${file} ok`);
  } catch (err) {
    console.error('❌ Gagal:', err.message);
    process.exit(1);
  } finally {
    c.release();
    await pool.end();
  }
}

run();
