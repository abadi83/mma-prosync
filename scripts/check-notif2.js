// Cek: berapa notif unread yang TIDAK muncul di list (di luar 50 terbaru)?
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r1 = await c.query(
    `SELECT COUNT(*)::int AS n FROM notifikasi WHERE dibaca = false`
  );
  const r2 = await c.query(
    `SELECT COUNT(*)::int AS n FROM (
       SELECT id FROM notifikasi WHERE dibaca = false
       ORDER BY created_at DESC LIMIT 50
     ) x`
  );
  console.log('total unread:', r1.rows[0].n);
  console.log('unread dalam 50 terbaru:', r2.rows[0].n);
  console.log('unread tersembunyi (di luar list):', r1.rows[0].n - r2.rows[0].n);
  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
