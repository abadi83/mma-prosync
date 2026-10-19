import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Increase body size limit for large SKU data (4700+ items = ~2MB)
export const maxDuration = 60;

const DATA_DIR = path.join(process.cwd(), 'data');

// Pastikan folder data ada
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* ── Registri perangkat (siapa update terakhir & siapa sudah sinkron) ──
   Setiap perangkat "titip" identitasnya di request sync (batch GET / POST / DELETE):
   - sync   → catat kapan terakhir menarik data (lastSyncAt)
   - push/delete → catat siapa & kapan terakhir mengubah data (lastPushAt, lastKey)
   Dengan itu klien bisa menampilkan "Update terakhir oleh X, perangkat Y belum sinkron". */
type DeviceAction = 'push' | 'delete';
type SyncDevice = {
  id: string;
  name: string;
  lastSyncAt: number;
  lastPushAt: number;
  lastKey: string | null;
  lastAction: DeviceAction | null;
};
const devices = new Map<string, SyncDevice>();
const DEVICES_FILE = path.join(DATA_DIR, 'mma_sync_devices.json');
const DEVICE_TTL_MS = 24 * 60 * 60 * 1000; // lupakan perangkat yang >24 jam tidak muncul
const MAX_DEVICES = 20;
const DEVICES_FLUSH_MS = 5000; // simpan ke disk paling cepat tiap 5 detik
let devicesLoaded = false;
let devicesDirty = false;
let lastDevicesFlush = 0;

function loadDevicesOnce(): void {
  if (devicesLoaded) return;
  devicesLoaded = true;
  try {
    if (!fs.existsSync(DEVICES_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf-8'));
    if (Array.isArray(raw)) {
      for (const d of raw) {
        if (d && typeof d.id === 'string') devices.set(d.id, d as SyncDevice);
      }
    }
  } catch {}
}

function getDevicesSnapshot(): SyncDevice[] {
  const now = Date.now();
  const list = Array.from(devices.values())
    .filter(d => now - Math.max(d.lastSyncAt || 0, d.lastPushAt || 0) < DEVICE_TTL_MS)
    .sort((a, b) => (b.lastSyncAt || 0) - (a.lastSyncAt || 0))
    .slice(0, MAX_DEVICES);
  // Bersihkan dari memori juga biar tidak numpuk
  for (const d of Array.from(devices.values())) {
    if (now - Math.max(d.lastSyncAt || 0, d.lastPushAt || 0) >= DEVICE_TTL_MS) devices.delete(d.id);
  }
  return list;
}

function flushDevicesIfNeeded(): void {
  if (!devicesDirty) return;
  const now = Date.now();
  if (now - lastDevicesFlush < DEVICES_FLUSH_MS) return;
  lastDevicesFlush = now;
  devicesDirty = false;
  try {
    const tmp = DEVICES_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(getDevicesSnapshot()), 'utf-8');
    fs.renameSync(tmp, DEVICES_FILE);
  } catch {}
}

function touchDevice(id: string, name: string, action: 'sync' | DeviceAction, key?: string | null): void {
  loadDevicesOnce();
  if (!id) return;
  const now = Date.now();
  let entry = devices.get(id);
  if (!entry) {
    entry = { id, name: name || `Perangkat ${id.slice(-6)}`, lastSyncAt: 0, lastPushAt: 0, lastKey: null, lastAction: null };
    devices.set(id, entry);
    devicesDirty = true;
  }
  if (name && name !== entry.name) {
    entry.name = name;
    devicesDirty = true;
  }
  if (action === 'sync') {
    entry.lastSyncAt = now;
    devicesDirty = true;
  } else {
    // Yang baru push otomatis dianggap sudah punya data terbaru
    entry.lastPushAt = now;
    entry.lastSyncAt = now;
    entry.lastKey = key || null;
    entry.lastAction = action;
    devicesDirty = true;
  }
  flushDevicesIfNeeded();
}

function getFilePath(key: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(DATA_DIR, `${safeKey}.json`);
}

function readData(key: string): any {
  try {
    const filePath = getFilePath(key);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeData(key: string, data: any, opts?: { keepTombstone?: boolean }): void {
  const filePath = getFilePath(key);
  // Tulis atomik: temp dulu, lalu rename
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data), 'utf-8');
  fs.renameSync(tmpPath, filePath);
  // Data baru masuk → hapus tombstone kalau ada (kecuali push kosong saat
  // proteksi anti-resurrect aktif — tombstone dipertahankan).
  if (!opts?.keepTombstone) {
    clearTombstone(key);
  }
  bumpVersion(key);
}

/* ── Deteksi perubahan ringan: versi per key + mtime + size + tombstone ──
   Dipakai batch GET biar klien hanya menerima data yang BENAR-BENAR berubah
   (sebelumnya ±5MB ditarik tiap 2 detik per komputer — lambat di internet kantor). */
const keyVersions = new Map<string, number>();
function bumpVersion(key: string): void {
  keyVersions.set(key, (keyVersions.get(key) || 0) + 1);
}

function getFileSig(key: string): string {
  let m = 0, s = 0;
  try { const st = fs.statSync(getFilePath(key)); m = st.mtimeMs; s = st.size; } catch {}
  let t = 0;
  try { const tp = getTombstonePath(key); if (fs.existsSync(tp)) t = fs.statSync(tp).mtimeMs; } catch {}
  return `${keyVersions.get(key) || 0}|${m}|${s}|${t}`;
}

/* ── Proteksi "resurrect": sidik jari data yang baru saja dihapus global ──
   Klien dengan kode lama bisa memulihkan data yang dihapus dari salinan
   lokalnya lalu push balik dengan sig valid. Aturan:
   - Push dengan isi KANONIK identik dengan data terhapus → 409 permanen.
   - Push dengan isi berbeda tapi ≥80% id item-nya berasal dari data terhapus
     (varian salinan lama) → 409 permanen.
   - Push kosong ([]/null) → diterima TAPI proteksi TETAP aktif (tidak
     membatalkan tombstone) — push kosong bukan aktivitas baru.
   - Hanya push dengan isi benar-benar baru yang boleh menimpa penghapusan.
   Proteksi dipersisten ke disk supaya tahan restart proses. */
const deletedRecords = new Map<string, { hash: string; ids: string[]; count: number }>();
const MAX_DELETED_RECORDS = 200;
const DELETED_HASHES_FILE = path.join(DATA_DIR, '.deleted_hashes.json');
const STALE_OVERLAP_THRESHOLD = 0.8;

/** JSON dengan urutan key dinormalisasi (rekursif) → hash stabil antar klien. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = canonicalize((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

function hashData(data: unknown): string {
  try {
    return crypto.createHash('sha256').update(JSON.stringify(canonicalize(data))).digest('hex');
  } catch {
    return '';
  }
}

function idsOf(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  const out: string[] = [];
  for (const item of data) {
    if (item && typeof item === 'object' && typeof (item as any).id === 'string' && (item as any).id) {
      out.push((item as any).id);
    }
  }
  return out;
}

function isEmptyData(data: unknown): boolean {
  return data === null || data === undefined || (Array.isArray(data) && data.length === 0);
}

function loadDeletedRecords(): void {
  try {
    if (!fs.existsSync(DELETED_HASHES_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(DELETED_HASHES_FILE, 'utf-8'));
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') {
          // format lama: hanya hash
          deletedRecords.set(k, { hash: v, ids: [], count: 0 });
        } else if (v && typeof v === 'object' && typeof (v as any).hash === 'string') {
          deletedRecords.set(k, {
            hash: (v as any).hash,
            ids: Array.isArray((v as any).ids) ? (v as any).ids : [],
            count: Number((v as any).count) || 0,
          });
        }
      }
    }
  } catch {}
}

function persistDeletedRecords(): void {
  try {
    const tmp = DELETED_HASHES_FILE + '.tmp';
    const out: Record<string, { hash: string; ids: string[]; count: number }> = {};
    for (const [k, v] of deletedRecords) out[k] = v;
    fs.writeFileSync(tmp, JSON.stringify(out), 'utf-8');
    fs.renameSync(tmp, DELETED_HASHES_FILE);
  } catch {}
}

loadDeletedRecords();

function rememberDeletedHash(key: string, rawContent: string | null): void {
  if (rawContent === null || rawContent === undefined) {
    // File sudah tidak ada (mis. DELETE kedua kali) — JANGAN timpa proteksi
    // yang sudah terekam; proteksi lama tetap berlaku.
    return;
  }
  let hash = '';
  let ids: string[] = [];
  try {
    const parsed = JSON.parse(rawContent);
    hash = hashData(parsed);
    ids = idsOf(parsed);
  } catch {
    hash = '';
  }
  if (!hash) return;
  deletedRecords.set(key, { hash, ids, count: ids.length });
  if (deletedRecords.size > MAX_DELETED_RECORDS) {
    const oldest = deletedRecords.keys().next().value;
    if (oldest !== undefined) deletedRecords.delete(oldest);
  }
  persistDeletedRecords();
}

function getTombstonePath(key: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(DATA_DIR, `${safeKey}.deleted`);
}

function readTombstone(key: string): number | null {
  try {
    const p = getTombstonePath(key);
    if (!fs.existsSync(p)) return null;
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return typeof parsed.deletedAt === 'number' ? parsed.deletedAt : null;
  } catch { return null; }
}

function writeTombstone(key: string): void {
  fs.writeFileSync(getTombstonePath(key), JSON.stringify({ deletedAt: Date.now() }), 'utf-8');
  bumpVersion(key);
}

function clearTombstone(key: string): void {
  const p = getTombstonePath(key);
  if (fs.existsSync(p)) { fs.unlinkSync(p); bumpVersion(key); }
}

/**
 * GET /api/data?key=mma_sku_data
 * POST /api/data { key, data }
 * DELETE /api/data?key=...  — hapus global
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // Identitas perangkat (siapa yang lagi sync) — dipakai untuk panel "update terakhir & sudah sinkron"
    const device = searchParams.get('device') || '';
    const name = searchParams.get('name') || '';
    if (device) touchDevice(device, name, 'sync');
    // ── BATCH: /api/data?keys=a,b,c → semua key sekaligus (realtime sync hemat request) ──
    const keysParam = searchParams.get('keys');
    if (keysParam) {
      const keys = keysParam.split(',').map(k => k.trim()).filter(Boolean).slice(0, 60);
      // sigs: signature terakhir yang dimiliki klien per key (urutan sama dengan keys)
      const sigsParam = searchParams.get('sigs');
      const sigs = sigsParam ? sigsParam.split(',').map(s => s.trim()).slice(0, 60) : null;
      const out: Record<string, any> = {};
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const sig = getFileSig(k);
        if (sigs && sigs[i] && sigs[i] === sig) {
          // Tidak berubah → kirim penanda ringan saja, HEMAT bandwidth
          out[k] = { same: true, sig };
          continue;
        }
        out[k] = { data: readData(k) || [], sig, deletedAt: readTombstone(k) || undefined };
      }
      return NextResponse.json({ batch: true, keys: out, devices: getDevicesSnapshot() });
    }
    const key = searchParams.get('key');
    if (!key) {
      return NextResponse.json({ error: 'Parameter key wajib.' }, { status: 400 });
    }
    const data = readData(key);
    const deletedAt = readTombstone(key);
    return NextResponse.json({ key, data: data || [], deletedAt: deletedAt || undefined, sig: getFileSig(key) });
  } catch {
    return NextResponse.json({ error: 'Gagal membaca data.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, data, device, name, sig } = body;
    if (!key) {
      return NextResponse.json({ error: 'Field key wajib.' }, { status: 400 });
    }
    if (data === undefined || data === null) {
      return NextResponse.json({ error: 'Field data wajib.' }, { status: 400 });
    }
    // Optimistic concurrency: klien kirim sig (signature) versi data yang dia merge.
    // Kalau server sudah berubah sejak itu, tolak push → klien tarik ulang & merge lagi
    // (mencegah dua komputer menimpa perubahan satu sama lain).
    //
    // Kalau key ini SUDAH punya state (file data atau tombstone), sig WAJIB — klien
    // kode-lama yang push buta (tanpa sig) bisa menimpa hapusan global & membatalkan
    // tombstone. Klien baru selalu mengirim sig setelah menarik data.
    const hasState = fs.existsSync(getFilePath(key)) || fs.existsSync(getTombstonePath(key));
    if (hasState && (typeof sig !== 'string' || sig.length === 0)) {
      return NextResponse.json(
        { success: false, conflict: true, key, sig: getFileSig(key), error: 'sig wajib untuk push key yang sudah ada' },
        { status: 409 }
      );
    }
    if (typeof sig === 'string' && sig.length > 0 && sig !== getFileSig(key)) {
      return NextResponse.json(
        { success: false, conflict: true, key, sig: getFileSig(key) },
        { status: 409 }
      );
    }
    // ── Anti-resurrect ──
    const rec = deletedRecords.get(key);
    if (rec) {
      const currentHash = hashData(data);
      if (currentHash && currentHash === rec.hash) {
        return NextResponse.json(
          { success: false, conflict: true, identicalToDeleted: true, key, sig: getFileSig(key), error: 'Data identik dengan data yang baru saja dihapus global.' },
          { status: 409 }
        );
      }
      if (isEmptyData(data)) {
        // Push kosong = klien menyetujui penghapusan → simpan (tanpa membatalkan
        // tombstone) dan TETAP jaga proteksi dari salinan lama perangkat lain.
        writeData(key, data, { keepTombstone: true });
        if (typeof device === 'string' && device) touchDevice(device, typeof name === 'string' ? name : '', 'push', key);
        return NextResponse.json({ success: true, key, count: 0, sig: getFileSig(key) });
      }
      // Isi berbeda: cek tumpang-tindih id item — ≥80% dari data terhapus
      // berarti salinan lama (varian), bukan aktivitas baru.
      const pushedIds = idsOf(data);
      const idSet = new Set(rec.ids);
      if (pushedIds.length > 0 && idSet.size > 0) {
        const overlap = pushedIds.filter((id) => idSet.has(id)).length / pushedIds.length;
        if (overlap >= STALE_OVERLAP_THRESHOLD) {
          return NextResponse.json(
            { success: false, conflict: true, identicalToDeleted: true, key, sig: getFileSig(key), error: 'Data merupakan salinan lama dari data yang dihapus global.' },
            { status: 409 }
          );
        }
      }
      // Benar-benar aktivitas baru — catat siapa yang memulihkan key ini
      try {
        console.log(`[data-revive] key=${key} device=${typeof device === 'string' ? device.slice(0, 12) : '?'} name=${typeof name === 'string' ? name.slice(0, 40) : '?'} pushedIds=${pushedIds.length} overlapIds=${pushedIds.filter((id) => idSet.has(id)).length}`);
      } catch {}
      deletedRecords.delete(key);
      persistDeletedRecords();
    }
    writeData(key, data);
    if (typeof device === 'string' && device) touchDevice(device, typeof name === 'string' ? name : '', 'push', key);
    // Sertakan sig terbaru → klien yang baru push tidak perlu menarik ulang data itu
    return NextResponse.json({ success: true, key, count: Array.isArray(data) ? data.length : 1, sig: getFileSig(key) });
  } catch (err: any) {
    console.error('POST /api/data error:', err?.message);
    return NextResponse.json({ error: 'Gagal menyimpan data.' }, { status: 500 });
  }
}

/**
 * DELETE /api/data?key=...  — hapus global (propagasi ke semua user)
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    if (!key) {
      return NextResponse.json({ error: 'Parameter key wajib.' }, { status: 400 });
    }
    const filePath = getFilePath(key);
    // Ingat hash isi data yang dihapus → push data identik akan ditolak (anti-resurrect)
    let rawContent: string | null = null;
    try { rawContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : null; } catch {}
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    // Tulis tombstone agar device lain tahu data ini dihapus global
    writeTombstone(key);
    rememberDeletedHash(key, rawContent);
    const device = searchParams.get('device') || '';
    if (device) touchDevice(device, searchParams.get('name') || '', 'delete', key);
    return NextResponse.json({ success: true, key, deleted: true, sig: getFileSig(key) });
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus data.' }, { status: 500 });
  }
}
