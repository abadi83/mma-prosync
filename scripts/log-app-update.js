#!/usr/bin/env node
/**
 * log-app-update.js — catat entri changelog OTOMATIS ke app_update_history.
 * Dipanggil saat deploy/rilis. Versi dibaca dari package.json; tipe/judul/deskripsi
 * bisa diisi lewat argumen CLI.
 *
 * Usage:
 *   node scripts/log-app-update.js "fitur" "Judul update" "Deskripsi singkat"
 *   node scripts/log-app-update.js "perbaikan" "Fix bug X" "Detail"
 *   node scripts/log-app-update.js "update" "Update kecil" ""
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
  const [, , tipeRaw, judulRaw, deskripsiRaw] = process.argv;
  const tipe = ['fitur', 'perbaikan', 'update'].includes(tipeRaw) ? tipeRaw : 'update';
  const judul = (judulRaw || '').trim();
  const deskripsi = (deskripsiRaw || '').trim();

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
