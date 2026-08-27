// Fix: Digo Tools Mart marketplace -> Shopee
// 1) marketplace_order: 'Digo Tools' -> 'Shopee'
// 2) marketplace_toko: hapus duplikat Lazada, normalisasi nama baris Shopee
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    await c.query('BEGIN');

    const up = await c.query(
      `UPDATE marketplace_order SET marketplace='Shopee' WHERE marketplace='Digo Tools'`
    );
    console.log('marketplace_order Digo Tools -> Shopee:', up.rowCount, 'baris');

    const del = await c.query(
      `DELETE FROM marketplace_toko WHERE nama ILIKE '%digo%' AND marketplace <> 'Shopee'`
    );
    console.log('marketplace_toko duplikat non-Shopee dihapus:', del.rowCount, 'baris');

    const nor = await c.query(
      `UPDATE marketplace_toko SET nama='Digo Tools Mart' WHERE nama ILIKE '%digo%' AND marketplace='Shopee'`
    );
    console.log('marketplace_toko Dinormalisasi:', nor.rowCount, 'baris');

    const chk = await c.query(
      `SELECT marketplace, toko_nama, COUNT(*)::int n FROM marketplace_order GROUP BY 1,2 ORDER BY 3 DESC`
    );
    console.log('\n== marketplace_order setelah fix ==');
    for (const r of chk.rows) console.log(' ', JSON.stringify(r));

    const mt = await c.query(`SELECT nama, marketplace FROM marketplace_toko ORDER BY marketplace, nama`);
    console.log('\n== marketplace_toko setelah fix ==');
    for (const r of mt.rows) console.log(' ', JSON.stringify(r));

    await c.query('COMMIT');
    console.log('\nCOMMIT OK');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('ROLLBACK karena error:', e.message);
  }
  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
