/**
 * Backfill: catat penjualan kasir metode TRANSFER ke data/mma_kas_besar_masuk.json
 * (riwayat uang masuk Kas Besar) — dari data/mma_penjualan_transaksi.json.
 *
 * Sebelum fitur ini, penjualan transfer tidak tercatat eksplisit di Kas Besar.
 * Idempotent: entry dengan (tanggal + jumlah + sumber) yang sama tidak diduplikasi.
 *
 * Cara pakai (di VPS):
 *   cd /home/mma-prosync && set -a && . ./.env.local && set +a
 *   node scripts/backfill-kas-besar-masuk.js
 */
const fs = require('fs');

const PENJUALAN_FILE = 'data/mma_penjualan_transaksi.json';
const KAS_FILE = 'data/mma_kas_besar_masuk.json';

function readJson(file) {
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}

function run() {
  const penjualan = readJson(PENJUALAN_FILE);
  const kas = readJson(KAS_FILE);

  // Group per transaksi (id prefix tx-<timestamp>) → satu transaksi checkout = satu entry kas
  const groups = new Map();
  for (const t of penjualan) {
    if (String(t.metode || '') !== 'transfer') continue;
    const txKey = String(t.id || '').split('-').slice(0, 2).join('-'); // "tx-<ts>"
    const key = txKey || `tx-${t.tanggal}-${t.jam}`;
    const g = groups.get(key) || { tanggal: t.tanggal, jumlah: 0, items: [] };
    g.tanggal = t.tanggal || g.tanggal;
    g.jumlah += Math.round(+t.total || 0);
    g.items.push(t.produk);
    groups.set(key, g);
  }

  let added = 0;
  for (const [key, g] of groups) {
    const exists = kas.some(e =>
      e.tanggal === g.tanggal && Math.round(+e.jumlah || 0) === g.jumlah && (e.sumber === 'penjualan' || e.sumber === 'backfill')
    );
    if (exists) continue;
    kas.unshift({
      id: `kb-backfill-${Date.now()}-${added}`,
      tanggal: g.tanggal,
      jumlah: g.jumlah,
      sumber: 'penjualan',
      keterangan: `Penjualan transfer - ${g.items.length} item (backfill)`,
    });
    added++;
  }

  fs.writeFileSync(KAS_FILE, JSON.stringify(kas));
  console.log(`✅ Backfill Kas Besar: ${added} entry baru (dari ${groups.size} transaksi transfer). Total entry sekarang: ${kas.length}`);
}

run();
