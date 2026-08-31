/**
 * Bersihkan copy server data/mma_kas_kecil.json & data/mma_kas_besar_masuk.json
 * dari entry yang sudah di-tombstone (hapus permanen) tapi belum ter-filter di server.
 * Idempotent.
 *
 * Cara pakai (di VPS):
 *   cd /home/mma-prosync && set -a && . ./.env.local && set +a
 *   node scripts/clean-kas-tombstones.js
 */
const fs = require('fs');

function read(file) {
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}

function run() {
  const tombs = read('data/mma_tombstones.json');
  const kasKecilIds = new Set(tombs.filter(t => t.kind === 'kaskecil').map(t => t.id));
  const kasBesarIds = new Set(tombs.filter(t => t.kind === 'kasbesar').map(t => t.id));

  let removed = 0;

  const kkFile = 'data/mma_kas_kecil.json';
  const kk = read(kkFile);
  const kkClean = kk.filter(e => !kasKecilIds.has(e.id));
  if (kkClean.length !== kk.length) {
    fs.writeFileSync(kkFile, JSON.stringify(kkClean));
    removed += kk.length - kkClean.length;
    console.log(`🧹 mma_kas_kecil: ${kk.length - kkClean.length} entry tombstone dihapus (sisa ${kkClean.length})`);
  } else {
    console.log('   mma_kas_kecil: bersih');
  }

  const kbFile = 'data/mma_kas_besar_masuk.json';
  const kb = read(kbFile);
  const kbClean = kb.filter(e => !kasBesarIds.has(e.id));
  if (kbClean.length !== kb.length) {
    fs.writeFileSync(kbFile, JSON.stringify(kbClean));
    removed += kb.length - kbClean.length;
    console.log(`🧹 mma_kas_besar_masuk: ${kb.length - kbClean.length} entry tombstone dihapus (sisa ${kbClean.length})`);
  } else {
    console.log('   mma_kas_besar_masuk: bersih');
  }

  console.log(removed > 0 ? `✅ Selesai — ${removed} entry dihapus.` : '✅ Tidak ada yang perlu dibersihkan.');
}

run();
