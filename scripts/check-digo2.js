// Diagnosa: cari semua tabel/kolom yang menyimpan 'Digo' / 'GMT' (root cause mapping toko-mp)
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const tables = (await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`)).rows.map(r => r.table_name);
  for (const t of tables) {
    const cols = (await c.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND data_type IN ('text','character varying')`,
      [t]
    )).rows.map(r => r.column_name);
    for (const col of cols) {
      const r = await c.query(`SELECT COUNT(*)::int AS n FROM ${t} WHERE ${col} ILIKE '%digo%' OR ${col} ILIKE '%gmt%'`);
      if (r.rows[0].n > 0) console.log(`${t}.${col}: ${r.rows[0].n} baris mengandung digo/gmt`);
    }
  }
  console.log('--- selesai ---');
  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
