// Inspeksi data PO 01/07/2026 & 02/07/2026 + riwayat bayar + refund (temp read-only)
const fs = require('fs');
const read = (f) => { try { return JSON.parse(fs.readFileSync(`data/${f}`, 'utf8')); } catch { return null; } };

const hpp = read('mma_hpp_purchases.json') || [];
const pay = read('mma_payment_history.json') || [];
const koreksiRefund = read('mma_koreksi_refund.json') || [];

for (const po of ['01/07/2026', '02/07/2026']) {
  const items = hpp.filter(x => x.noPO === po);
  const total = items.reduce((s, i) => s + (i.total || 0), 0);
  const dibayar = items.reduce((s, i) => s + (i.dibayar || 0), 0);
  const sisa = items.reduce((s, i) => s + (i.sisaTagihan || 0), 0);
  const koreksi = items.filter(i => i.dikoreksi).length;
  console.log(`\n=== ${po} ===`);
  console.log(`item=${items.length} total=${total} dibayar=${dibayar} sisa=${sisa} lunasSemua=${items.every(i => i.lunas)}`);
  console.log(`item terkoreksi=${koreksi}`);
  for (const i of items.filter(x => x.dikoreksi).slice(0, 5)) {
    console.log(`  sku=${i.sku} qty=${i.qty} harga=${i.hargaBeli} total=${i.total} dibayar=${i.dibayar} koreksiPada=${i.koreksiPada}`);
  }
  const ps = pay.filter(p => p.noPO === po);
  console.log('pembayaran:');
  for (const p of ps) console.log(`  ${p.id} | ${p.tanggalBayar} | Rp ${p.jumlahDibayar} | ${p.dibayarOleh} | catatan="${p.catatan || ''}"`);
}

console.log('\n=== mma_koreksi_refund ===');
console.log(JSON.stringify(koreksiRefund).slice(0, 400));

console.log('\n=== semua PO dikoreksi (dikoreksi=true) di hpp ===');
const koreksiPo = new Map();
for (const i of hpp) if (i.dikoreksi) {
  const g = koreksiPo.get(i.noPO) || { sisa: 0, total: 0, dibayar: 0 };
  g.sisa += (i.sisaTagihan || 0); g.total += (i.total || 0); g.dibayar += (i.dibayar || 0);
  koreksiPo.set(i.noPO, g);
}
for (const [po, g] of koreksiPo) console.log(`${po}: total=${g.total} dibayar=${g.dibayar} sisa=${g.sisa}`);
