// Investigasi: pesanan MMA Shopee (baru 55) vs agregasi operasional 390 (temp read-only)
const fs = require('fs');
const read = (f) => { try { return JSON.parse(fs.readFileSync(`data/${f}`, 'utf8')); } catch { return null; } };
const stat = (f) => { try { return fs.statSync(`data/${f}`); } catch { return null; } };

const aggr = read('mma_agregasi_rows.json') || [];
const orders = read('mma_marketplace_orders.json') || [];

console.log('=== file ===');
for (const f of ['mma_agregasi_rows.json', 'mma_marketplace_orders.json']) {
  const s = stat(f);
  console.log(`${f}: mtime=${s ? s.mtime.toISOString() : '-'} size=${s ? s.size : '-'}`);
}

console.log(`\nagregasi rows total: ${aggr.length}`);
console.log(`marketplace orders total: ${orders.length}`);

// Breakdown per marketplace (agregasi)
const perMp = new Map();
for (const r of aggr) perMp.set(r.marketplace || '?', (perMp.get(r.marketplace || '?') || 0) + 1);
console.log('\n=== agregasi per marketplace ===');
for (const [mp, n] of [...perMp.entries()].sort((a, b) => b[1] - a[1])) console.log(`${mp}: ${n}`);

// Breakdown orders per marketplace
const perMpOrd = new Map();
for (const o of orders) perMpOrd.set(o.marketplace || '?', (perMpOrd.get(o.marketplace || '?') || 0) + 1);
console.log('\n=== orders per marketplace ===');
for (const [mp, n] of [...perMpOrd.entries()].sort((a, b) => b[1] - a[1])) console.log(`${mp}: ${n}`);

// Duplikat di agregasi (kunci noPesanan||noResi||sku)
const keyCount = new Map();
for (const r of aggr) {
  const k = `${r.noPesanan || ''}||${r.noResi || ''}||${r.sku || ''}`;
  keyCount.set(k, (keyCount.get(k) || 0) + 1);
}
const dups = [...keyCount.entries()].filter(([, n]) => n > 1);
console.log(`\nduplikat agregasi (kunci sama >1): ${dups.length} kunci, total baris dobel=${dups.reduce((s, [, n]) => s + (n - 1), 0)}`);
console.log(dups.slice(0, 8).map(([k, n]) => `${k.slice(0, 60)} x${n}`).join('\n'));

// Baris Shopee MMA (MITRA MULIA ABADI) terbaru
const mmaRows = aggr.filter(r => (r.marketplace || '').toLowerCase().includes('shopee') && (r.namaToko || '').toUpperCase().includes('MITRA MULIA'));
console.log(`\nagregasi Shopee MITRA MULIA ABADI: ${mmaRows.length} baris`);
const tglCount = new Map();
for (const r of mmaRows) tglCount.set(String(r.dibuat || '').slice(0, 10), (tglCount.get(String(r.dibuat || '').slice(0, 10)) || 0) + 1);
console.log('per tanggal (dibuat):');
for (const [d, n] of [...tglCount.entries()].sort()) console.log(`  ${d}: ${n}`);
