/* Lihat role semua pegawai */
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  try {
    const r = await p.query('SELECT nama, username, roles FROM pegawai ORDER BY nama');
    for (const row of r.rows) console.log((row.username || '-').padEnd(15), '|', (row.nama || '-').padEnd(25), '|', (row.roles || []).join(','));
    console.log('TOTAL:', r.rows.length);
  } catch (e) { console.error('GAGAL:', e.message); process.exit(1); }
  await p.end();
})();
