/* Verifikasi sync sig: request batch 2x — kedua harus "same:true" & kecil */
const http = require('http');
function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: 3000, path }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}
(async () => {
  const keys = 'mma_hpp_purchases,mma_sku_data,mma_tombstones,mma_opex_purchases';
  const r1 = await get(`/api/data?keys=${keys}&t=1`);
  const j1 = JSON.parse(r1.body);
  const e = j1.keys['mma_hpp_purchases'];
  console.log('RESPON 1:', r1.body.length, 'bytes | hpp.sig =', e.sig);
  const sigs = keys.split(',').map(k => j1.keys[k].sig).join(',');
  const r2 = await get(`/api/data?keys=${keys}&sigs=${encodeURIComponent(sigs)}&t=2`);
  const j2 = JSON.parse(r2.body);
  const e2 = j2.keys['mma_hpp_purchases'];
  console.log('RESPON 2:', r2.body.length, 'bytes | hpp same =', e2.same, '| sig sama =', e2.sig === e.sig);
  const j2all = Object.values(j2.keys).every(x => x.same === true);
  console.log('Semua key "same":', j2all);
})().catch(err => { console.error('GAGAL:', err.message); process.exit(1); });
