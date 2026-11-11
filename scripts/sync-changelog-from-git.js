#!/usr/bin/env node
/**
 * sync-changelog-from-git.js — catat otomatis commit baru ke app_update_history.
 * Dipanggil di VPS setelah git pull. Membaca git log sejak marker terakhir,
 * mengklasifikasikan tipe dari prefix commit (feat:/fix:/lain), dan insert
 * entri changelog dengan `otomatis = true` + `commit_hash` (anti-duplikat).
 *
 * Usage: node scripts/sync-changelog-from-git.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Pool } = require('pg');

const MARKER = path.join(__dirname, '..', '.changelog-marker');

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

function readMarker() {
  try { return fs.readFileSync(MARKER, 'utf-8').trim(); } catch { return ''; }
}
function writeMarker(hash) {
  fs.writeFileSync(MARKER, hash + '\n');
}

function classify(msg) {
  const m = msg.toLowerCase();
  if (m.startsWith('feat:') || m.startsWith('feat(') || m.includes('fitur')) return 'fitur';
  if (m.startsWith('fix:') || m.startsWith('fix(') || m.includes('perbaikan') || m.includes('bug')) return 'perbaikan';
  return 'update';
}

function stripPrefix(msg) {
  return msg
    .replace(/^(feat|fix|chore|refactor|perf|docs|style|test)(\([^)]*\))?:\s*/i, '')
    .trim();
}

async function main() {
  const repo = path.join(__dirname, '..');
  const marker = readMarker();

  // Ambil log terbaru (max 50) dengan format: hash<NUL>subject<NUL>body
  const fmt = '%H%x00%s%x00%b';
  const args = marker
    ? ['log', `${marker}..HEAD`, `--pretty=format:${fmt}`, '--no-merges']
    : ['log', '-50', `--pretty=format:${fmt}`, '--no-merges'];

  let out = '';
  try {
    out = execFileSync('git', args, { cwd: repo, encoding: 'utf-8' });
  } catch {
    console.log('Tidak ada commit baru untuk dicatat.');
    return;
  }

  const commits = out.split('\n').filter(Boolean).map(line => {
    const [hash, subject, ...bodyParts] = line.split('\x00');
    return {
      hash: (hash || '').trim(),
      subject: (subject || '').trim(),
      body: (bodyParts.join('\x00') || '').trim(),
    };
  }).filter(c => c.hash && c.subject);

  if (commits.length === 0) {
    console.log('Tidak ada commit baru untuk dicatat.');
    return;
  }

  const tokoId = process.env.DEFAULT_TOKO_ID || 'a0a0a0a0-0000-0000-0000-000000000001';
  let versi = '';
  try { versi = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf-8')).version || ''; } catch {}

  const pool = createPool();
  let added = 0;
  for (const c of commits.reverse()) { // urutkan lama → baru agar tampil rapi
    const judul = stripPrefix(c.subject).slice(0, 255) || c.subject;
    const tipe = classify(c.subject);
    const deskripsi = (c.body || '').trim().slice(0, 1000);
    try {
      const { rowCount } = await pool.query(
        `INSERT INTO app_update_history (toko_id, versi, tipe, judul, deskripsi, oleh, otomatis, commit_hash)
         VALUES ($1, $2, $3, $4, $5, 'Sistem (otomatis)', TRUE, $6)
         ON CONFLICT (commit_hash) DO NOTHING`,
        [tokoId, versi, tipe, judul, deskripsi, c.hash]
      );
      if ((rowCount || 0) > 0) added++;
    } catch (e) {
      console.error(`Gagal catat ${c.hash}:`, e.message);
    }
  }

  // Tulis marker = hash commit terbaru yang sudah diproses
  const latest = commits[commits.length - 1].hash;
  writeMarker(latest);
  console.log(`✅ Changelog otomatis: ${added} commit baru dicatat (marker → ${latest.slice(0, 7)})`);
  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
