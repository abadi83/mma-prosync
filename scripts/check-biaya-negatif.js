// Cek baris retur/dibatalkan dengan total_biaya negatif (dobel hitung)
const { Pool } = require('pg');
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await p.query(
    `SELECT id, no_pesanan, marketplace, toko_nama, tanggal, pendapatan_kotor, pendapatan_bersih,
            total_biaya, total_hpp, status_pesanan
     FROM marketplace_order
     WHERE total_biaya < 0
     ORDER BY tanggal DESC`
  );
  console.log('TOTAL baris total_biaya < 0:', rows.length);
  console.log(JSON.stringify(rows.slice(0, 30), null, 2));
  const retur = await p.query(
    `SELECT COUNT(*)::int AS n, COALESCE(SUM(pendapatan_bersih),0)::float AS total_bersih,
            COALESCE(SUM(pendapatan_kotor),0)::float AS total_kotor
     FROM marketplace_order
     WHERE total_biaya < 0 AND (lower(status_pesanan) LIKE '%retur%' OR lower(status_pesanan) LIKE '%dibatalkan%')`
  );
  console.log('=== RETUR dengan biaya negatif ===');
  console.log(JSON.stringify(retur.rows, null, 2));
  const nonRetur = await p.query(
    `SELECT id, no_pesanan, marketplace, tanggal, pendapatan_kotor, pendapatan_bersih, total_biaya, status_pesanan
     FROM marketplace_order
     WHERE total_biaya < 0 AND lower(status_pesanan) NOT LIKE '%retur%' AND lower(status_pesanan) NOT LIKE '%dibatalkan%'
     ORDER BY tanggal DESC LIMIT 20`
  );
  console.log('=== NON-RETUR dengan biaya negatif ===');
  console.log(JSON.stringify(nonRetur.rows, null, 2));
  await p.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
