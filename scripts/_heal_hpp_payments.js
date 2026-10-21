// PERBAIKAN DATA (satu kali): terapkan pembayaran PO dari riwayat bayar ke item HPP di server.
// Salinan lama dari perangkat lain sempat menimpa status lunas — skrip ini memulihkannya.
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

// Pembayaran aktif: buang yang di-tombstone & yang PO-nya dihapus
const aktif = payments.filter(p => !payTomb.has(p.id) && !poTomb.has(String(p.noPO)));

// Total pembayaran per PO
const totalPay = new Map();
for (const p of aktif) {
  const po = String(p.noPO || '').trim();
  if (!po || po.startsWith('OPEX-') || po.startsWith('BIAYA-')) continue;
  totalPay.set(po, (totalPay.get(po) || 0) + (Number(p.jumlahDibayar) || 0));
}

// Hitung ulang per item (algoritma sama dengan handleBayar: alokasi proporsional)
const now = Date.now();
let diubah = 0, poList = [];
const healed = hpp.map(item => {
  const paid = totalPay.get(String(item.noPO));
  if (paid === undefined || paid <= 0) return item;
  if (item.lunas && item.dibayar > 0 && item.dibayar >= item.total) return item; // sudah benar
  return { ...item, updatedAt: now, _heal: true }; // ditandai dulu, dihitung setelah grouping
});

// Group per PO untuk distribusi proporsional
const groups = new Map();
for (const item of healed) {
  if (!item._heal) continue;
  if (!groups.has(item.noPO)) groups.set(item.noPO, []);
  groups.get(item.noPO).push(item);
}

for (const [noPO, items] of groups) {
  const paid = totalPay.get(noPO);
  const total = items.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const ratio = total > 0 ? paid / total : 0;
  for (const it of items) {
    const alokasi = Math.round((Number(it.total) || 0) * ratio);
    it.dibayar = alokasi;
    it.sisaTagihan = Math.max(0, (Number(it.total) || 0) - alokasi);
    it.lunas = alokasi >= (Number(it.total) || 0);
    delete it._heal;
    diubah++;
  }
  poList.push(`${noPO}: ${items.length} item, total Rp ${total.toLocaleString('id-ID')}, dibayar Rp ${paid.toLocaleString('id-ID')}`);
}

// Pastikan tidak ada sisa _heal
for (const it of healed) delete it._heal;

// Backup lalu tulis
fs.copyFileSync(HPP, `${HPP}.bak-${Date.now()}`);
fs.writeFileSync(HPP, JSON.stringify(healed));

console.log(`=== PERBAIKAN SELESAI ===`);
console.log(`item diperbarui: ${diubah}`);
console.log(`PO yang dipulihkan:`);
for (const s of poList) console.log('  ' + s);
