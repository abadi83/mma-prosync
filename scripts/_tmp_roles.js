const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query("SELECT nama, roles FROM pegawai WHERE status='Aktif' ORDER BY nama");
  console.log(r.rows.map(x => `${x.nama} -> ${JSON.stringify(x.roles)}`).join('\n'));
  await c.end();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
