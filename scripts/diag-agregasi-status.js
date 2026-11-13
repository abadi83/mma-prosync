#!/usr/bin/env node
/** Lihat distribusi statusProses & statusPesanan di data agregasi tersimpan (server). */
const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // Cari tabel penyimpanan data sync (daftar semua tabel)
  const tables = await c.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
  );
  console.log('tabel public:', tables.rows.map(r => r.table_name).join(', '));

  for (const t of tables.rows) {
    const name = t.table_name;
    try {
      const cols = await c.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name=$1`, [name]
      );
      console.log(`\n== ${name} kolom:`, cols.rows.map(x => x.column_name).join(', '));
      const r = await c.query(`SELECT * FROM ${name} WHERE key = 'mma_agregasi_rows' LIMIT 1`);
      if (r.rowCount === 0) { console.log('  (tidak ada key mma_agregasi_rows)'); continue; }
      const row = r.rows[0];
      const contentCol = Object.keys(row).find(k => k !== 'key' && k !== 'id' && k !== 'updated_at' && k !== 'sig');
      let data = row[contentCol];
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch {} }
      const arr = Array.isArray(data) ? data : (data && Array.isArray(data.rows) ? data.rows : []);
      console.log('  jumlah baris:', arr.length);

      const map = new Map();
      for (const it of arr) {
        const k = JSON.stringify(it.statusProses ?? null);
        map.set(k, (map.get(k) || 0) + 1);
      }
      console.log('  statusProses:', [...map.entries()].sort((a, b) => b[1] - a[1]));

      const map2 = new Map();
      for (const it of arr) {
        const k = JSON.stringify(it.statusPesanan ?? null);
        map2.set(k, (map2.get(k) || 0) + 1);
      }
      console.log('  statusPesanan:', [...map2.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15));
    } catch (e) { console.log(`  error ${name}:`, e.message); }
  }

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
