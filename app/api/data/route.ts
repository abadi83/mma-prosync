import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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

function writeData(key: string, data: any): void {
  const filePath = getFilePath(key);
  // Tulis atomik: temp dulu, lalu rename
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data), 'utf-8');
  fs.renameSync(tmpPath, filePath);
  // Data baru masuk → hapus tombstone kalau ada
  clearTombstone(key);
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
    return NextResponse.json({ key, data: data || [], deletedAt: deletedAt || undefined });
  } catch {
    return NextResponse.json({ error: 'Gagal membaca data.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, data, device, name } = body;
    if (!key) {
      return NextResponse.json({ error: 'Field key wajib.' }, { status: 400 });
    }
    if (data === undefined || data === null) {
      return NextResponse.json({ error: 'Field data wajib.' }, { status: 400 });
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
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    // Tulis tombstone agar device lain tahu data ini dihapus global
    writeTombstone(key);
    const device = searchParams.get('device') || '';
    if (device) touchDevice(device, searchParams.get('name') || '', 'delete', key);
    return NextResponse.json({ success: true, key, deleted: true, sig: getFileSig(key) });
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus data.' }, { status: 500 });
  }
}
