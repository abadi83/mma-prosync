#!/usr/bin/env node
/** Cek status QC & Packing di log operasional + data agregasi tersimpan. */
const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // 1) Dari log operasional (tabel DB)
  const log = await c.query(
    `SELECT status_proses, COUNT(*) AS jumlah,
            MAX(created_at) AS terakhir
     FROM operasional_log
     WHERE status_proses IN ('DiQC','Dipacking')
     GROUP BY status_proses`
  );
  console.log('--- operasional_log ---');
  console.log(JSON.stringify(log.rows, null, 2));

  // 2) Detail beberapa baris terbaru
  const detail = await c.query(
    `SELECT no_pesanan, no_resi, status_proses, created_at
     FROM operasional_log
     WHERE status_proses IN ('DiQC','Dipacking')
     ORDER BY created_at DESC LIMIT 20`
  );
  console.log('--- detail terbaru ---');
  for (const r of detail.rows) {
    console.log(`${r.created_at} | ${r.status_proses} | ${r.no_pesanan || '-'} | ${r.no_resi || '-'}`);
  }

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
