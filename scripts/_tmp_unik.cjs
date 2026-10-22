// Unik noPesanan per tanggal + per toko (temp read-only)
const fs = require('fs');
const aggr = JSON.parse(fs.readFileSync('data/mma_agregasi_rows.json', 'utf8'));

const perTgl = new Map();
for (const r of aggr) {
  const d = String(r.dibuat || '').slice(0, 10);
  if (!perTgl.has(d)) perTgl.set(d, new Set());
  perTgl.get(d).add(`${r.noPesanan || ''}|${r.noResi || ''}`);
}
console.log('=== unik noPesanan+noResi per tanggal dibuat ===');
for (const [d, s] of [...perTgl.entries()].sort()) console.log(`${d}: ${s.size} pesanan (${aggr.filter(r => String(r.dibuat || '').slice(0, 10) === d).length} baris SKU)`);

const perToko = new Map();
for (const r of aggr) {
  const k = `${r.marketplace} — ${r.namaToko}`;
  if (!perToko.has(k)) perToko.set(k, new Set());
  perToko.get(k).add(`${r.noPesanan || ''}|${r.noResi || ''}`);
}
console.log('\n=== unik pesanan per toko ===');
for (const [k, s] of [...perToko.entries()].sort((a, b) => b[1].size - a[1].size)) console.log(`${k}: ${s.size}`);
