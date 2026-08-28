// Cek isi payment history + hpp purchases di server (data/*.json)
const fs = require('fs');
const path = require('path');
const dir = path.join(process.cwd(), 'data');
for (const k of ['mma_payment_history.json', 'mma_hpp_purchases.json']) {
  const p = path.join(dir, k);
  if (!fs.existsSync(p)) { console.log(k, ': TIDAK ADA'); continue; }
  const d = JSON.parse(fs.readFileSync(p, 'utf-8'));
  console.log(k, ':', Array.isArray(d) ? d.length + ' baris' : typeof d);
  if (Array.isArray(d) && d.length) console.log(' contoh:', JSON.stringify(d[0]).slice(0, 300));
}
