// Cek data activity_log (diagnosa sementara — tidak mengubah apa pun)
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const total = await c.query('SELECT COUNT(*)::int AS n, COUNT(DISTINCT username) AS users, COUNT(DISTINCT modul) AS moduls FROM activity_log');
  console.log('TOTAL:', JSON.stringify(total.rows[0]));
  const perUser = await c.query("SELECT username, nama_user, COUNT(*)::int AS n, MAX(created_at) AS terakhir FROM activity_log GROUP BY username, nama_user ORDER BY terakhir DESC NULLS LAST LIMIT 20");
  console.log('PER-USER:');
  for (const r of perUser.rows) console.log(' -', r.username, '|', r.nama_user, '|', r.n, 'aktivitas | terakhir:', r.terakhir);
  const perModul = await c.query("SELECT modul, COUNT(*)::int AS n, MAX(created_at) AS terakhir FROM activity_log GROUP BY modul ORDER BY terakhir DESC NULLS LAST");
  console.log('PER-MODUL:');
  for (const r of perModul.rows) console.log(' -', r.modul, '|', r.n, '| terakhir:', r.terakhir);
  const recent = await c.query("SELECT username, nama_user, modul, aksi, ref_label, to_char(created_at,'YYYY-MM-DD HH24:MI') AS tgl FROM activity_log ORDER BY created_at DESC LIMIT 15");
  console.log('TERBARU 15:');
  for (const r of recent.rows) console.log(' -', r.tgl, '|', r.username, '|', r.nama_user, '|', r.modul, '|', r.aksi, '|', r.ref_label);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
