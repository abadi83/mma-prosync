// Lihat isi tabel marketplace_toko + detail baris yang perlu dikoreksi
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r1 = await c.query(`SELECT * FROM marketplace_toko ORDER BY nama`);
  console.log('== marketplace_toko (semua) ==');
  for (const r of r1.rows) console.log(' ', JSON.stringify(r));
  const r2 = await c.query(
    `SELECT marketplace, toko_nama, COUNT(*)::int n FROM marketplace_order GROUP BY 1,2 ORDER BY 3 DESC`
  );
  console.log('\n== marketplace_order grouping ==');
  for (const r of r2.rows) console.log(' ', JSON.stringify(r));
  const r3 = await c.query(`SELECT DISTINCT status_upload_toko FROM sku_master WHERE status_upload_toko ILIKE '%digo%' OR status_upload_toko ILIKE '%gmt%' LIMIT 30`);
  console.log('\n== status_upload_toko (digo/gmt) ==');
  for (const r of r3.rows) console.log(' ', r.status_upload_toko);
  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
