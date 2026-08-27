// Cek entri Juli di data pembelian (diagnosa)
const fs = require('fs');
for (const f of ['mma_hpp_purchases', 'mma_opex_purchases', 'mma_biaya_operasional']) {
  try {
    const raw = fs.readFileSync('data/' + f + '.json', 'utf8');
    const d = JSON.parse(raw);
    const arr = Array.isArray(d) ? d : (d && Array.isArray(d.data) ? d.data : []);
    const jul = arr.filter(x => String(x.tanggal || '').startsWith('2026-07'));
    const agu = arr.filter(x => String(x.tanggal || '').startsWith('2026-08'));
    console.log(f, '| total:', arr.length, '| juli:', jul.length, '| agustus:', agu.length);
    const last = arr.length > 0 ? arr[arr.length - 1] : null;
    if (last) console.log('   entri terakhir:', JSON.stringify({ tanggal: last.tanggal, noPO: last.noPO, nama: last.namaItem || last.deskripsi }));
  } catch (e) { console.log(f, 'ERROR:', e.message); }
}
