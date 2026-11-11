#!/usr/bin/env node
/** Diagnostik singkat Master SKU: jumlah baris, keberadaan kolom paket_besar, waktu query. */
const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query('SELECT count(*) FROM sku_master');
  console.log('SKU count =', r.rows[0].count);
  const col = await c.query(
    'SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND column_name=$2',
    ['sku_master', 'paket_besar'],
  );
  console.log('paket_besar col =', col.rowCount > 0 ? 'ADA' : 'TIDAK ADA');
  const t = Date.now();
  await c.query('SELECT id, sku, nama FROM sku_master ORDER BY nama LIMIT 5000');
  console.log('query (5000) ms =', Date.now() - t);
  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
