#!/usr/bin/env node
/** Analisis file data/mma_agregasi_rows.json: distribusi statusProses & statusPesanan. */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'mma_agregasi_rows.json');
if (!fs.existsSync(file)) { console.log('File tidak ada:', file); process.exit(0); }

const raw = fs.readFileSync(file, 'utf-8');
let data;
try { data = JSON.parse(raw); } catch (e) { console.log('Gagal parse:', e.message); process.exit(1); }
const arr = Array.isArray(data) ? data : (data && Array.isArray(data.rows) ? data.rows : []);
console.log('total baris:', arr.length);

const sp = new Map();
for (const it of arr) {
  const k = String(it.statusProses ?? '(kosong)');
  sp.set(k, (sp.get(k) || 0) + 1);
}
console.log('\n== statusProses ==');
for (const [k, v] of [...sp.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${v.toString().padStart(4)}  ${JSON.stringify(k)}`);

const st = new Map();
for (const it of arr) {
  const k = String(it.statusPesanan ?? '(kosong)');
  st.set(k, (st.get(k) || 0) + 1);
}
console.log('\n== statusPesanan ==');
for (const [k, v] of [...st.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${v.toString().padStart(4)}  ${JSON.stringify(k)}`);

// Contoh baris yang masih QC/Packing
console.log('\n== contoh baris QC/Packing ==');
const contoh = arr.filter(it => /qc|packing/i.test(String(it.statusProses || ''))).slice(0, 12);
for (const it of contoh) {
  console.log(`  ${it.noPesanan} | ${it.noResi} | statusProses=${JSON.stringify(it.statusProses)} | statusPesanan=${JSON.stringify(it.statusPesanan)} | updatedAt=${it.updatedAt}`);
}
