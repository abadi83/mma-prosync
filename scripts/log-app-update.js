#!/usr/bin/env node
/**
 * log-app-update.js — catat entri changelog OTOMATIS ke app_update_history.
 * Dipanggil saat deploy/rilis. Versi dibaca dari package.json.
 *
 * Usage (mode CLI, judul = gabungan argumen setelah tipe):
 *   node scripts/log-app-update.js fitur Judul update yang panjang
 * Usage (mode env, aman untuk judul/deskripsi dengan karakter khusus):
 *   UPDATE_JUDUL="Judul update" UPDATE_DESKRIPSI="Detail" node scripts/log-app-update.js fitur
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    return new Pool({ connectionString, ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined });
  }
  return new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'mma_prosync',
    user: process.env.DB_USER || 'mma_admin',
    password: process.env.DB_PASSWORD || 'mma_prosync_2024!',
  });
}

async function main() {
  const [, , tipeRaw, ...rest] = process.argv;
  const tipe = ['fitur', 'perbaikan', 'update'].includes(tipeRaw) ? tipeRaw : 'update';
  // Dukungan dua mode: argumen CLI, atau lewat env UPDATE_* (untuk judul/deskripsi yang mengandung spasi).
  let judul = (process.env.UPDATE_JUDUL || '').trim();
  let deskripsi = (process.env.UPDATE_DESKRIPSI || '').trim();
  if (!judul && rest.length > 0) {
    // Mode CLI: semua argumen setelah tipe digabung jadi judul (deskripsi boleh lewat env).
    judul = rest.join(' ').trim();
  }

  if (!judul) {
    console.error('Judul update wajib diisi. Contoh: node scripts/log-app-update.js "fitur" "Judul update" "Deskripsi"');
    process.exit(1);
  }

  // Versi dari package.json
  let versi = '';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
    versi = pkg.version || '';
  } catch {}

  const tokoId = process.env.DEFAULT_TOKO_ID || 'a0a0a0a0-0000-0000-0000-000000000001';
  const pool = createPool();

  try {
    const { rows } = await pool.query(
      `INSERT INTO app_update_history (toko_id, versi, tipe, judul, deskripsi, oleh, otomatis)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id`,
      [tokoId, versi, tipe, judul, deskripsi, 'Sistem (otomatis)']
    );
    console.log(`✅ Changelog otomatis tercatat: [${tipe}] ${judul}${versi ? ` (${versi})` : ''}`);
    console.log(`   id=${rows[0].id}`);
  } catch (err) {
    console.error('❌ Gagal mencatat changelog:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
