#!/usr/bin/env node
/** Hapus entri changelog berdasarkan judul (argumen digabung spasi). */
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

async function main() {
  const [, , ...parts] = process.argv;
  const judul = parts.join(' ').trim();
  if (!judul) { console.error('Judul wajib.'); process.exit(1); }
  const pool = createPool();
  const r = await pool.query('DELETE FROM app_update_history WHERE judul = $1', [judul]);
  console.log(`🗑 Hapus ${r.rowCount} entri changelog dengan judul "${judul}"`);
  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
