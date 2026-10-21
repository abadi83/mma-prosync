// Verifikasi ARITMETIKA refund (temp, read-only): simulasi tombstones pembayaran ganda
const fs = require('fs');
const read = (f) => { try { return JSON.parse(fs.readFileSync(`data/${f}`, 'utf8')); } catch { return null; } };

const hpp = read('mma_hpp_purchases.json') || [];
const payments = read('mma_payment_history.json') || [];

// Simulasi: refund pembayaran ganda Dessy utk 01/07/2026 & 02/07/2026
const refundIds = new Set([
  payments.find(p => p.noPO === '01/07/2026' && p.jumlahDibayar === 6341394 && p.dibayarOleh === 'Dessy')?.id,
  payments.find(p => p.noPO === '02/07/2026' && p.dibayarOleh === 'DESSY')?.id,
].filter(Boolean));

for (const po of ['01/07/2026', '02/07/2026']) {
  const remaining = payments.filter(p => p.noPO === po && !refundIds.has(p.id));
  const totalDibayar = remaining.reduce((s, p) => s + p.jumlahDibayar, 0);
  const items = hpp.filter(x => x.noPO === po);
  const total = items.reduce((s, i) => s + (i.total || 0), 0);
  const dibayar = Math.min(totalDibayar, total);
  const sisa = Math.max(0, total - dibayar);
  console.log(`${po}: pembayaran tersisa ${remaining.length}x (${remaining.map(p => p.dibayarOleh || '-').join(', ')})`);
  console.log(`  total=${total} dibayar=${dibayar} sisa=${sisa} ${sisa > 0 ? '→ MUNCUL DI PEMBAYARAN PO (belum lunas)' : '→ tetap lunas'}`);
  if (po === '01/07/2026' && sisa !== 1040000) console.log('  ⚠ ekspektasi sisa koreksi 1.040.000');
  if (po === '02/07/2026' && sisa !== 0) console.log('  ⚠ ekspektasi sisa 0');
}
