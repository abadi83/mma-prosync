#!/usr/bin/env node
/**
 * bump-version.js — naikkan versi semver di package.json.
 * Usage:
 *   node scripts/bump-version.js patch      # 0.1.0 -> 0.1.1
 *   node scripts/bump-version.js minor      # 0.1.1 -> 0.2.0
 *   node scripts/bump-version.js major      # 0.2.0 -> 1.0.0
 *   node scripts/bump-version.js            # default: patch
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const level = (process.argv[2] || 'patch').toLowerCase();
const valid = ['patch', 'minor', 'major'];
if (!valid.includes(level)) {
  console.error(`Level tidak dikenal: ${level}. Gunakan ${valid.join(' | ')}.`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
let [major, minor, patch] = String(pkg.version || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);

if (level === 'major') { major += 1; minor = 0; patch = 0; }
else if (level === 'minor') { minor += 1; patch = 0; }
else { patch += 1; }

const next = `${major}.${minor}.${patch}`;
pkg.version = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`⬆️  Versi naik: ${next}`);
