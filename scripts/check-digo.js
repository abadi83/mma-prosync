// Diagnosa: mapping toko -> marketplace di marketplace_order (cek Digo Tools Mart)
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r1 = await c.query(
    `SELECT toko_nama, marketplace, COUNT(*)::int AS n, MIN(tanggal) AS min_tgl, MAX(tanggal) AS max_tgl
     FROM marketplace_order
     WHERE toko_nama ILIKE '%digo%'
     GROUP BY toko_nama, marketplace ORDER BY n DESC`
  );
  console.log('== marketplace_order: toko mengandung "digo" ==');
  for (const r of r1.rows) console.log(' ', JSON.stringify(r));

  const r2 = await c.query(
    `SELECT marketplace, toko_nama, COUNT(*)::int AS n
     FROM marketplace_order
     GROUP BY marketplace, toko_nama ORDER BY marketplace, n DESC`
  );
  console.log('\n== semua pasangan marketplace+toko (top) ==');
  for (const r of r2.rows) console.log(' ', JSON.stringify(r));

  const r3 = await c.query(`SELECT COUNT(*)::int AS total FROM marketplace_order`);
  console.log('\ntotal rows:', r3.rows[0].total);
  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
