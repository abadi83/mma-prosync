// Cari jejak marketplace 'GMT' di semua file JSON data
const fs = require('fs');
const path = require('path');
const dir = path.join(process.cwd(), 'data');
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.json')) continue;
  const s = fs.readFileSync(path.join(dir, f), 'utf-8');
  if (!s.includes('GMT')) continue;
  console.log('== ' + f);
  try {
    const j = JSON.parse(s);
    const hits = [];
    const walk = (v, key) => {
      if (v == null) return;
      if (typeof v === 'string') {
        if (v === 'GMT' || v.includes('GMT/Aeer')) hits.push({ key, v: v.slice(0, 100) });
      } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, key + '[' + i + ']'));
      else if (typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, key + '.' + k));
    };
    walk(j, '$');
    for (const h of hits.slice(0, 25)) console.log('  ' + h.key + ' => "' + h.v + '"');
    if (hits.length > 25) console.log('  ... dan ' + (hits.length - 25) + ' lainnya');
  } catch (e) {
    console.log('  (parse error)');
  }
}
