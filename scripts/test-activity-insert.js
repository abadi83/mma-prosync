// Tes insert activity_log + notifikasi langsung (diagnosa)
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const tId = 'a0a0a0a0-0000-0000-0000-000000000001';
  try {
    await c.query(
      `INSERT INTO activity_log (toko_id, username, nama_user, modul, aksi, ref_label, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [tId, 'TEST', 'Test User', 'operasional', 'qc', 'TES-DB', JSON.stringify({ a: 1 })]
    );
    console.log('INSERT activity_log OK');
  } catch (e) { console.log('INSERT activity_log ERROR:', e.message); }
  try {
    await c.query(`INSERT INTO notifikasi (user_id, tipe, pesan) VALUES ($1,$2,$3)`, [tId, 'aktivitas', 'tes pesan']);
    console.log('INSERT notifikasi OK');
  } catch (e) { console.log('INSERT notifikasi ERROR:', e.message); }
  const res = await c.query('SELECT COUNT(*)::int AS n FROM activity_log');
  console.log('TOTAL ROWS:', res.rows[0].n);
  await c.end();
})().catch(e => { console.error('CONN ERROR:', e.message); process.exit(1); });
