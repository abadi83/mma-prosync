// Investigasi lanjutan (temp, read-only): detail PO bermasalah + devices
const fs = require('fs');
const read = (f) => { try { return JSON.parse(fs.readFileSync(`data/${f}`, 'utf8')); } catch { return null; } };
const stat = (f) => { try { return fs.statSync(`data/${f}`); } catch { return null; } };

const hpp = read('mma_hpp_purchases.json') || [];
const devices = read('mma_sync_devices.json') || [];
const tomb = read('mma_hpp_purchases.deleted.json') || null;

console.log('=== devices (yang terakhir push apa) ===');
for (const d of (Array.isArray(devices) ? devices : [])) {
  console.log(`${d.name || d.id} | lastKey=${d.lastKey} | lastPush=${d.lastPushAt ? new Date(d.lastPushAt).toISOString() : '-'} | lastSync=${d.lastSyncAt ? new Date(d.lastSyncAt).toISOString() : '-'}`);
}

console.log('\n=== tombstone hpp ===');
console.log(JSON.stringify(tomb).slice(0, 300));

console.log('\n=== detail PO bermasalah (server) ===');
for (const po of ['01/07/2026', 'PO-260918-001', '02/07/2026', 'PO-260919-001']) {
  const items = hpp.filter(x => x.noPO === po);
  console.log(`\n${po}: ${items.length} item`);
  for (const it of items.slice(0, 3)) {
    console.log(`  id=${it.id} sku=${it.sku} total=${it.total} dibayar=${it.dibayar} sisa=${it.sisaTagihan} lunas=${it.lunas}`);
  }
  if (items.length > 3) console.log(`  ... +${items.length - 3} item lain`);
}

// Cek id duplikat di seluruh hpp (pemicu merge kacau)
const idCount = new Map();
for (const it of hpp) idCount.set(it.id, (idCount.get(it.id) || 0) + 1);
const dups = [...idCount.entries()].filter(([, n]) => n > 1);
console.log(`\n=== id duplikat di hpp: ${dups.length} ===`);
console.log(dups.slice(0, 5).map(([id, n]) => `${id} x${n}`).join('\n'));
