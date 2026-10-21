// Investigasi sync pembayaran PO vs arsip invoice (temp, read-only)
const fs = require('fs');
const path = 'data';

const read = (f) => { try { return JSON.parse(fs.readFileSync(`${path}/${f}`, 'utf8')); } catch { return null; } };
const stat = (f) => { try { return fs.statSync(`${path}/${f}`); } catch { return null; } };

const hpp = read('mma_hpp_purchases.json') || [];
const pay = read('mma_payment_history.json') || [];
const bukti = read('mma_bukti_bayar.json') || [];

console.log('=== server file ===');
for (const f of ['mma_hpp_purchases.json', 'mma_payment_history.json', 'mma_bukti_bayar.json']) {
  const s = stat(f);
  console.log(`${f}: ${s ? s.mtime.toISOString() : 'MISSING'} size=${s ? s.size : '-'}`);
}
console.log(`hpp items: ${hpp.length}`);

// Pembayaran terakhir 10
const lastPay = [...pay].sort((a, b) => (b.tanggalBayar || '').localeCompare(a.tanggalBayar || '')).slice(0, 10);
console.log('\n=== 10 pembayaran terakhir ===');
for (const p of lastPay) {
  console.log(`${p.tanggalBayar} | ${p.noPO} | Rp ${p.jumlahDibayar} | ${p.dibayarOleh} | sisaSesudah=${p.sisaSesudah}`);
}

// Per PO: hitung lunas vs pembayaran total di hpp
const byPo = new Map();
for (const it of hpp) {
  const g = byPo.get(it.noPO) || { total: 0, dibayar: 0, lunas: true, n: 0, tanggal: it.tanggal };
  g.total += it.total || 0;
  g.dibayar += it.dibayar || 0;
  if (!it.lunas) g.lunas = false;
  g.n++;
  byPo.set(it.noPO, g);
}

console.log('\n=== PO yang dibayar tapi TIDAK lunas di hpp (server) ===');
let mismatch = 0;
for (const p of lastPay) {
  const g = byPo.get(p.noPO);
  if (!g) { console.log(`${p.noPO}: PO TIDAK ADA di hpp!`); mismatch++; continue; }
  const totalDibayarDariHpp = g.dibayar;
  if (!g.lunas) { console.log(`${p.noPO}: hpp dibayar=${totalDibayarDariHpp} total=${g.total} lunas=${g.lunas} (sisaSesudah pembayaran=${p.sisaSesudah})`); mismatch++; }
  else console.log(`${p.noPO}: OK lunas (hpp dibayar=${totalDibayarDariHpp}/${g.total})`);
}
console.log(`\nmismatch count: ${mismatch}`);
