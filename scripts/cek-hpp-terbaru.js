/* Cek data HPP terbaru di server: apakah input pegawai sampai ke server? */
const fs = require('fs');
const path = require('path');
const rows = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'mma_hpp_purchases.json'), 'utf8'));
console.log('TOTAL ROWS:', rows.length);
// urutkan berdasarkan timestamp di id (hpp-<ms>-<sku>) — baris terbaru
const withTs = rows.map(r => {
  const m = /hpp-(\d+)-/.exec(r.id || '');
  return { ...r, _ts: m ? Number(m[1]) : 0 };
}).sort((a, b) => b._ts - a._ts);
console.log('=== 12 baris TERBARU (berdasarkan id) ===');
for (const r of withTs.slice(0, 12)) {
  console.log(`${new Date(r._ts).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} | ${r.noPO} | ${r.sku} | ${r.supplierNama} | tgl=${r.tanggal} | id=${r.id}`);
}
// noPO terbaru pola PO-
const poList = [...new Set(rows.map(r => r.noPO).filter(n => /^PO-\d{6}-\d+$/.test(n)))].sort();
console.log('\nPO terbaru:', poList.slice(-8).join(', '));
// tombstones
try {
  const tombs = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'mma_tombstones.json'), 'utf8'));
  console.log('TOMBSTONES:', tombs.length);
  const poTomb = tombs.filter(t => t.kind === 'po');
  console.log('tombstone kind po:', poTomb.map(t => t.id).join(', ') || '-');
} catch (e) { console.log('tombstones baca gagal', e.message); }
