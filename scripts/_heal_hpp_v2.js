// PERBAIKAN DATA v2 (satu kali): terapkan pembayaran PO dengan CAP maks = total PO.
// (Pembayaran ganda tercatat di riwayat — status HPP tetap dipatok lunas = dibayar ≤ total.)
const fs = require('fs');

const HPP = 'data/mma_hpp_purchases.json';
const PAY = 'data/mma_payment_history.json';
const TOMB = 'data/mma_tombstones.json';

const read = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

const hpp = read(HPP) || [];
const payments = read(PAY) || [];
const tombs = read(TOMB) || [];

const poTomb = new Set((tombs || []).filter(t => t.kind === 'po').map(t => String(t.id)));
const payTomb = new Set((tombs || []).filter(t => t.kind === 'payment').map(t => String(t.id)));
const aktif = payments.filter(p => !payTomb.has(p.id) && !poTomb.has(String(p.noPO)));

const totalPay = new Map();
for (const p of aktif) {
  const po = String(p.noPO || '').trim();
  if (!po || po.startsWith('OPEX-') || po.startsWith('BIAYA-')) continue;
  totalPay.set(po, (totalPay.get(po) || 0) + (Number(p.jumlahDibayar) || 0));
}

const now = Date.now();
const groups = new Map();
for (const item of hpp) {
  const paid = totalPay.get(String(item.noPO));
  if (paid === undefined || paid <= 0) continue;
  if (!groups.has(item.noPO)) groups.set(item.noPO, []);
  groups.get(item.noPO).push(item);
}

let diubah = 0;
const poList = [];
for (const [noPO, items] of groups) {
  const paid = Math.min(totalPay.get(noPO), items.reduce((s, i) => s + (Number(i.total) || 0), 0));
  const total = items.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const ratio = total > 0 ? paid / total : 0;
  for (const it of items) {
    const alokasi = Math.round((Number(it.total) || 0) * ratio);
    const newDibayar = Math.min(alokasi, Number(it.total) || 0);
    if (it.dibayar === newDibayar && it.lunas === (newDibayar >= (Number(it.total) || 0))) continue;
    it.dibayar = newDibayar;
    it.sisaTagihan = Math.max(0, (Number(it.total) || 0) - newDibayar);
    it.lunas = newDibayar >= (Number(it.total) || 0);
    it.updatedAt = now;
    diubah++;
  }
  poList.push(`${noPO}: ${items.length} item, total Rp ${total.toLocaleString('id-ID')}, dibayar(dicap) Rp ${paid.toLocaleString('id-ID')}`);
}

fs.writeFileSync(HPP, JSON.stringify(hpp));
console.log(`=== PERBAIKAN v2 SELESAI — item diperbarui: ${diubah} ===`);
for (const s of poList) console.log('  ' + s);
