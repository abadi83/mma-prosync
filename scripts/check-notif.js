// Diagnosa notifikasi nyangkut: distribusi user_id & dibaca
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r1 = await c.query(`SELECT COUNT(*)::int AS total FROM notifikasi`);
  console.log('total notifikasi:', r1.rows[0].total);
  const r2 = await c.query(`SELECT user_id, dibaca, COUNT(*)::int AS n FROM notifikasi GROUP BY 1,2 ORDER BY 3 DESC`);
  console.log('distribusi user_id/dibaca:');
  for (const r of r2.rows) console.log(' ', JSON.stringify(r));
  const r3 = await c.query(`SELECT id, user_id, tipe, dibaca, to_char(created_at,'YYYY-MM-DD HH24:MI') AS tgl, left(pesan,60) AS pesan FROM notifikasi WHERE dibaca = false ORDER BY created_at DESC LIMIT 8`);
  console.log('\ncontoh baris belum dibaca:');
  for (const r of r3.rows) console.log(' ', JSON.stringify(r));
  const r4 = await c.query(`SELECT COUNT(*)::int AS dup FROM (SELECT id FROM notifikasi GROUP BY id HAVING COUNT(*)>1) x`);
  console.log('id duplikat:', r4.rows[0].dup);
  const r5 = await c.query(`SELECT COUNT(*)::int AS null_dibaca FROM notifikasi WHERE dibaca IS NULL`);
  console.log('dibaca NULL:', r5.rows[0].null_dibaca);
  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
