// Fix baris RETUR/DIBATALKAN dengan total_biaya negatif (dobel hitung klaim/refund).
// Biaya negatif pada retur = fee yang dibalikin → tidak boleh menambah pendapatan.
const { Pool } = require('pg');
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rowCount } = await p.query(
    `UPDATE marketplace_order
     SET total_biaya = 0,
         pendapatan_bersih = pendapatan_kotor - total_hpp,
         laba_kotor = pendapatan_kotor - total_hpp
     WHERE total_biaya < 0
       AND (lower(status_pesanan) LIKE '%retur%' OR lower(status_pesanan) LIKE '%dibatalkan%')`
  );
  console.log('Baris diperbaiki:', rowCount);
  const { rows } = await p.query(
    `SELECT id, no_pesanan, marketplace, toko_nama, pendapatan_kotor, pendapatan_bersih, total_biaya, total_hpp, status_pesanan
     FROM marketplace_order
     WHERE no_pesanan = '2694966588779018'`
  );
  console.log('=== Verifikasi 2694966588779018 ===');
  console.log(JSON.stringify(rows, null, 2));
  await p.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
