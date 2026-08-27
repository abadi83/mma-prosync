// Fix final: GMT/Aeer.com => Shopee (semua order), toko GMT => Lazada
// 1) DB marketplace_order: semua toko_nama='GMT/Aeer.com' -> marketplace='Shopee'
// 2) DB sku_master.status_upload_toko: 'Lazada <dash> GMT/Aeer.com' -> 'Lazada <dash> GMT'
// 3) File JSON: mma_toko_master (rename entry Lazada), mma_sku_data (replace string),
//    mma_price_tasks (Lazada|GMT/Aeer.com -> Lazada|GMT)
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    await c.query('BEGIN');

    const up = await c.query(
      `UPDATE marketplace_order SET marketplace='Shopee' WHERE toko_nama='GMT/Aeer.com'`
    );
    console.log('marketplace_order GMT/Aeer.com -> Shopee:', up.rowCount, 'baris');

    const sk = await c.query(
      `UPDATE sku_master SET status_upload_toko =
         REPLACE(status_upload_toko, 'Lazada ' || chr(8212) || ' GMT/Aeer.com', 'Lazada ' || chr(8212) || ' GMT')
       WHERE status_upload_toko LIKE '%Lazada ' || chr(8212) || ' GMT/Aeer.com%'`
    );
    console.log('sku_master status dirapikan:', sk.rowCount, 'baris');

    const chk = await c.query(
      `SELECT marketplace, toko_nama, COUNT(*)::int n FROM marketplace_order GROUP BY 1,2 ORDER BY 3 DESC`
    );
    console.log('\n== marketplace_order setelah fix final ==');
    for (const r of chk.rows) console.log(' ', JSON.stringify(r));

    await c.query('COMMIT');
    console.log('COMMIT OK');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('ROLLBACK:', e.message);
  }
  await c.end();

  // ── File JSON ──
  const dir = path.join(process.cwd(), 'data');
  const DASH = '\u2014';

  const tokoMaster = path.join(dir, 'mma_toko_master.json');
  if (fs.existsSync(tokoMaster)) {
    const j = JSON.parse(fs.readFileSync(tokoMaster, 'utf-8'));
    let n = 0;
    for (const t of j) {
      if (t.nama === 'GMT/Aeer.com' && t.marketplace === 'Lazada') { t.nama = 'GMT'; n++; }
    }
    if (n > 0) { fs.writeFileSync(tokoMaster, JSON.stringify(j)); console.log(`mma_toko_master.json: ${n} entry Lazada -> nama 'GMT'`); }
    else console.log('mma_toko_master.json: tidak ada yang perlu diubah');
  }

  const skuData = path.join(dir, 'mma_sku_data.json');
  if (fs.existsSync(skuData)) {
    const s = fs.readFileSync(skuData, 'utf-8');
    const from = 'Lazada ' + DASH + ' GMT/Aeer.com';
    const to = 'Lazada ' + DASH + ' GMT';
    const k = s.split(from).length - 1;
    if (k > 0) {
      fs.writeFileSync(skuData, s.split(from).join(to));
      console.log(`mma_sku_data.json: ${k} kemunculan diubah`);
    } else console.log('mma_sku_data.json: tidak ada yang perlu diubah');
  }

  const priceTasks = path.join(dir, 'mma_price_tasks.json');
  if (fs.existsSync(priceTasks)) {
    const j = JSON.parse(fs.readFileSync(priceTasks, 'utf-8'));
    let n = 0;
    for (const t of j) {
      if (t.tokoId === 'Lazada|GMT/Aeer.com') { t.tokoId = 'Lazada|GMT'; if (t.tokoNama === 'GMT/Aeer.com') t.tokoNama = 'GMT'; n++; }
    }
    if (n > 0) { fs.writeFileSync(priceTasks, JSON.stringify(j)); console.log(`mma_price_tasks.json: ${n} task Lazada -> toko 'GMT'`); }
    else console.log('mma_price_tasks.json: tidak ada yang perlu diubah');
  }

  console.log('\nSELESAI');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
