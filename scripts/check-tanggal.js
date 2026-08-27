// Diagnosa: distribusi tanggal order vs waktu upload (kenapa data Juli masuk Agustus)
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const byBulan = await c.query(`SELECT substr(COALESCE(tanggal,''),1,7) AS bulan, COUNT(*)::int AS n FROM marketplace_order GROUP BY 1 ORDER BY 1`);
  console.log('marketplace_order per bulan (kolom tanggal):');
  for (const r of byBulan.rows) console.log(' ', r.bulan || '(kosong)', ':', r.n);
  const recent = await c.query(`SELECT no_pesanan, marketplace, tanggal, to_char(created_at,'YYYY-MM-DD HH24:MI') AS diupload FROM marketplace_order ORDER BY created_at DESC LIMIT 12`);
  console.log('12 upload terbaru (tanggal vs waktu upload):');
  for (const r of recent.rows) console.log(' ', r.no_pesanan, '|', r.marketplace, '| tanggal:', r.tanggal, '| diupload:', r.diupload);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
