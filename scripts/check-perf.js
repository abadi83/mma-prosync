// Diagnosa kelambatan: ukuran tabel & payload
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const n1 = await c.query('SELECT COUNT(*)::int AS n FROM notifikasi');
  const n2 = await c.query('SELECT COUNT(*)::int AS n FROM activity_log');
  const n3 = await c.query('SELECT COUNT(*)::int AS n FROM marketplace_order');
  const n4 = await c.query('SELECT COUNT(*)::int AS n FROM operasional_log');
  const size = await c.query(`SELECT pg_size_pretty(pg_total_relation_size('notifikasi')) AS s1, pg_size_pretty(pg_total_relation_size('activity_log')) AS s2, pg_size_pretty(pg_total_relation_size('marketplace_order')) AS s3`);
  console.log('notifikasi rows:', n1.rows[0].n, '| size:', size.rows[0].s1);
  console.log('activity_log rows:', n2.rows[0].n, '| size:', size.rows[0].s2);
  console.log('marketplace_order rows:', n3.rows[0].n, '| size:', size.rows[0].s3);
  console.log('operasional_log rows:', n4.rows[0].n);
  const n5 = await c.query("SELECT COUNT(*)::int AS n, MAX(LENGTH(pesan)) AS maxlen FROM notifikasi");
  console.log('notif max pesan length:', n5.rows[0].maxlen);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
