// Fix: GMT -> Lazada (marketplace_order) + normalisasi nama master 'GMT/Aerr.com' -> 'GMT/Aeer.com'
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    await c.query('BEGIN');

    const up = await c.query(
      `UPDATE marketplace_order SET marketplace='Lazada' WHERE marketplace='GMT'`
    );
    console.log('marketplace_order GMT -> Lazada:', up.rowCount, 'baris');

    const nor = await c.query(
      `UPDATE marketplace_toko SET nama='GMT/Aeer.com' WHERE nama='GMT/Aerr.com'`
    );
    console.log('marketplace_toko normalisasi GMT/Aerr.com:', nor.rowCount, 'baris');

    const chk = await c.query(
      `SELECT marketplace, toko_nama, COUNT(*)::int n FROM marketplace_order GROUP BY 1,2 ORDER BY 3 DESC`
    );
    console.log('\n== marketplace_order setelah fix ==');
    for (const r of chk.rows) console.log(' ', JSON.stringify(r));

    await c.query('COMMIT');
    console.log('\nCOMMIT OK');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('ROLLBACK karena error:', e.message);
  }
  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
