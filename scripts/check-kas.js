/**
 * Debug: bandingkan data kas (riwayat uang masuk) vs data laporan (penjualan, pencairan, refund).
 * Cara pakai (di VPS): cd /home/mma-prosync && set -a && . ./.env.local && set +a && node scripts/check-kas.js
 */
const fs = require('fs');

function read(file) {
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.log('ERR read', file, e.message); return []; }
}

function run() {
  const kasKecil = read('data/mma_kas_kecil.json');
  const kasBesar = read('data/mma_kas_besar_masuk.json');
  const penjualan = read('data/mma_penjualan_transaksi.json');
  const penjualanLain = read('data/mma_penjualan_lain.json');
  const pencairan = read('data/mma_pencairan.json');
  const refund = read('data/mma_koreksi_refund.json');
  const tombstones = read('data/mma_tombstones.json');

  console.log('=== KAS KECIL ===');
  for (const e of kasKecil) console.log(`  ${e.id} | ${e.tanggal} | ${e.jenis} | ${e.jumlah} | ${e.sumber} | ${e.keterangan}`);
  console.log('  saldo kas kecil =', kasKecil.reduce((s, e) => s + (e.jenis === 'masuk' ? e.jumlah : -e.jumlah), 0));

  console.log('=== KAS BESAR MASUK ===');
  for (const e of kasBesar) console.log(`  ${e.id} | ${e.tanggal} | ${e.jumlah} | ${e.sumber} | ${e.keterangan}`);
  console.log('  total kas besar masuk =', kasBesar.reduce((s, e) => s + e.jumlah, 0));

  console.log('=== PENJUALAN (kasir) ===');
  for (const t of penjualan) console.log(`  ${t.tanggal} | ${t.metode} | total ${t.total} | ${t.produk}`);
  const cash = penjualan.filter(t => t.metode === 'cash').reduce((s, t) => s + t.total, 0);
  const transfer = penjualan.filter(t => t.metode === 'transfer').reduce((s, t) => s + t.total, 0);
  console.log('  total cash =', cash, '| total transfer =', transfer);

  console.log('=== PENJUALAN LAIN ===');
  for (const p of penjualanLain) console.log(`  ${p.id} | ${p.tanggal} | ${p.jumlah} | ${p.kas} | ${p.kategori} | kasEntryId=${p.kasEntryId}`);
  console.log('  total =', penjualanLain.reduce((s, p) => s + p.jumlah, 0));

  console.log('=== PENCAIRAN ===');
  for (const p of pencairan) console.log(`  ${p.id} | ${p.tanggal} | ${p.jumlah} | ${p.tokoNama || ''}`);
  console.log('  total =', pencairan.reduce((s, p) => s + p.jumlah, 0));

  console.log('=== REFUND ===');
  for (const r of refund) console.log(`  ${r.id} | ${r.tanggal} | nilai=${r.nilaiRefund} | status=${r.status} | tujuan=${r.tujuanKas} | ${r.noPO}`);

  console.log('=== TOMBSTONES ===');
  for (const t of tombstones) console.log(`  ${t.kind} | ${t.id} | ${t.deletedAt}`);
}

run();
