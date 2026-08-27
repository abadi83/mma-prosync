// Bersihkan baris tes activity_log (jangan sentuh data asli Administrator)
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query(`DELETE FROM activity_log WHERE username IN ('TEST','TEST-1') OR ref_label LIKE 'TES-%'`);
  console.log('dihapus:', r.rowCount);
  const c2 = await c.query('SELECT COUNT(*)::int AS n FROM activity_log');
  console.log('sisa rows:', c2.rows[0].n);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
