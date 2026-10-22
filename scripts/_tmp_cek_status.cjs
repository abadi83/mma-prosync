// Status agregasi + kemungkinan angka 390 (temp read-only)
const fs = require('fs');
const read = (f) => { try { return JSON.parse(fs.readFileSync(`data/${f}`, 'utf8')); } catch { return null; } };
const aggr = read('mma_agregasi_rows.json') || [];

const st = new Map();
for (const r of aggr) {
  const s = String(r.statusPesanan || '(kosong)');
  st.set(s, (st.get(s) || 0) + 1);
}
console.log('=== statusPesanan agregasi ===');
for (const [s, n] of [...st.entries()].sort((a, b) => b[1] - a[1])) console.log(`${s}: ${n}`);

// Unik noPesanan
const unikPo = new Set(aggr.map(r => `${r.noPesanan || ''}|${r.namaToko || ''}`));
console.log(`\nunik noPesanan (mentah): ${unikPo.size}`);

// status selain selesai/dikirim
const aktifStatus = ['Dikonfirmasi', 'Siap Dikirim', 'Sedang Dikemas', 'Menunggu Pembayaran', 'Pesanan Baru', 'Belum Dibayar', '(kosong)'];
const belum = aggr.filter(r => aktifStatus.includes(String(r.statusPesanan || '(kosong)')));
console.log(`belum diproses (status aktif/kosong): ${belum.length}`);
