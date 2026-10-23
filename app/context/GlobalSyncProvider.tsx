'use client';

import React, { useEffect, useRef } from 'react';
import { downscaleDataUrl } from '@/app/lib/imageUtils';
import { TOMBSTONE_KEY, readTombstones, applyTombstones } from '@/app/lib/tombstones';
import {
  getDeviceId, getDeviceName, deviceQuery, DEVICES_CACHE_KEY,
  type SyncDevice,
} from '@/app/lib/deviceIdentity';
import { storageGetRaw, storageSetRaw, storageRemove, DIRTY_PREFIX, storageBroadcast } from '@/app/lib/idbStorage';

/**
 * GlobalSyncProvider — sync dua arah untuk SEMUA data yang masih di localStorage.
 * Data yang sudah di PostgreSQL tetap via API; ini mencakup sisanya.
 *
 * Strategi merge:
 * - Array  → union per-kunci unik (id / noPesanan / sku)
 * - Object → shallow merge (lokal menang per key)
 * - Scalar → last-write-wins (lokal menang kalau berubah)
 */

const SYNC_KEYS = [
  // Data Entry & operasional
  'mma_keuangan_manual',
  'mma_ops_entries',
  'mma_riwayat_entry',
  'mma_agregasi_rows',
  'mma_sku_data',
  'mma_toko_master',
  // Keuangan & Pembelian
  'mma_payment_history',
  'mma_biaya_operasional',
  'mma_opex_purchases',
  'mma_hpp_purchases',
  TOMBSTONE_KEY,
  'mma_modal',
  'mma_kas_kecil',
  'mma_kas_besar_masuk',
  'mma_kas_besar_keluar',
  'mma_pencairan',
  'mma_koreksi_po',
  'mma_koreksi_refund',
  'mma_bukti_bayar',
  // Penjualan
  'mma_penjualan_transaksi',
  'mma_penjualan_lain',
  // Absensi face: lokasi kantor (dibuat admin → berlaku semua perangkat)
  'mma_office_location',
  // Kepegawaian — TIDAK di-sync via /api/data lagi.
  // Sumber kebenaran pegawai = PostgreSQL (app/api/pegawai).
  // localStorage hanya cache lokal; sync dilakukan di halaman kepegawaian.
  // (sebelumnya disini: 'mma_pegawai_data', 'mma_pegawai_passwords')
  'mma_izin_records',
  'mma_gaji_records',
  'mma_face_data',
  // Riwayat face absensi — biar rekap terlihat di semua perangkat (HP → komputer admin)
  'mma_absensi_face',
  'mma_absensi_reset_at', // tanggal mulai rekap baru (hari sebelumnya tidak dihitung Alfa)
  // Akuntansi
  'mma_coa',
  'mma_jurnal_umum',
  'mma_aset_tetap',
  // Operasional Gudang
  'mma_fleet_master',
  'mma_ho_archive',
  'mma_pengantaran_offline',
  'mma_po_inventory_check',
  'mma_opname_saved',
  // Task Harga
  'mma_price_tasks',
  'mma_price_history',
  'mma_taskharga_settings',
  // Profil & Info Toko
  'mma_profil_nama',
  'mma_profil_email',
  'mma_profil_telp',
  'mma_profil_avatar',
  'mma_nama_toko',
  'mma_alamat_toko',
  'mma_telepon_toko',
  'mma_logo_toko',
];

// Siklus polling jadi ringan (hanya key yang berubah yang diproses) → aman dipercepat.
const SYNC_INTERVAL = 1000; // 1 detik — realtime antar komputer
const PUSH_DEBOUNCE = 300;   // perubahan lokal langsung dikirim, tidak nunggu polling

export type { SyncDevice };

let lastDevicesEmit = 0;
let lastDevicesText: string | null = null;
const DEVICES_EVENT_COOLDOWN = 3000; // kalau isinya tidak berubah, event paling sering 1x per 3 detik

/** Simpan daftar perangkat dari server + beri tahu UI (header). Isi berubah → langsung emit. */
function cacheDevices(list: unknown): void {
  if (!Array.isArray(list)) return;
  const text = JSON.stringify(list);
  try {
    if (localStorage.getItem(DEVICES_CACHE_KEY) !== text) localStorage.setItem(DEVICES_CACHE_KEY, text);
  } catch {}
  const now = Date.now();
  if (lastDevicesText !== null && text === lastDevicesText && now - lastDevicesEmit < DEVICES_EVENT_COOLDOWN) return;
  lastDevicesText = text;
  lastDevicesEmit = now;
  try {
    window.dispatchEvent(new CustomEvent('sync-devices-updated', { detail: { devices: list as SyncDevice[] } }));
  } catch {}
}

/* ── Pelacak perubahan lokal ──────────────────────────────────────────
   Siklus sync dulu memproses ULANG semua key (40+ key, bisa beberapa MB)
   tiap 2 detik walau tidak ada yang berubah: parse JSON, filter tombstone,
   merge, lalu sering menulis ulang + mengirim ulang data ke server. Main
   thread penuh, siklus berikutnya keteteran, dan komputer lain jadi lambat
   menerima perubahan. Sekarang key ditandai "kotor" begitu localStorage-nya
   berubah, jadi siklus hanya mengerjakan key yang benar-benar berubah. ── */
const SYNC_KEY_SET = new Set(SYNC_KEYS);
const dirtyKeys = new Set<string>();
// Key yang sedang di-reset global (DELETE /api/data) — sync/push ditahan sampai selesai
const resettingKeys = new Set<string>();
// Guard pasca-reset: sig state server SETELAH delete + kapan reset selesai.
// Batch/pull yang terlanjur diambil SEBELUM reset selesai membawa sig lama →
// harus dibuang, jangan sampai menulis balik data yang baru dihapus.
const postResetSig = new Map<string, string>();
const postResetAt = new Map<string, number>();
const POST_RESET_GUARD_MS = 10000; // guard kedaluwarsa supaya tidak memblokir selamanya
let onLocalChange: (() => void) | null = null;
let dirtyTrackerInstalled = false;
let suppressDirty = false;

function markDirty(key: string | null | undefined): void {
  if (!key || suppressDirty || !SYNC_KEY_SET.has(key)) return;
  dirtyKeys.add(key);
  try { onLocalChange?.(); } catch {}
}

/** Pantau semua penulisan localStorage (tidak hanya lewat provider) supaya tahu key mana yang berubah. */
function installDirtyTracker(): void {
  if (dirtyTrackerInstalled || typeof window === 'undefined') return;
  try {
    const proto = Object.getPrototypeOf(window.localStorage) as Storage;
    const setItem = proto.setItem;
    const removeItem = proto.removeItem;
    const clear = proto.clear;
    proto.setItem = function (k: string, v: string) {
      setItem.call(this, k, v);
      // Penanda "__dirty_<key>" dari lapisan IndexedDB → tandai key aslinya
      markDirty(k.startsWith(DIRTY_PREFIX) ? k.slice(DIRTY_PREFIX.length) : k);
    };
    proto.removeItem = function (k: string) { removeItem.call(this, k); markDirty(k); };
    proto.clear = function () { clear.call(this); SYNC_KEYS.forEach(k => markDirty(k)); };
    dirtyTrackerInstalled = true;
  } catch {}
}

import { mergeUnion, itemKey } from '@/app/lib/syncMerge';

export { mergeUnion };

/** Merge generik: array → union, object → shallow merge, scalar → last-write-wins */
function mergeAny(key: string, local: any, server: any, excluded?: Set<string>): any {
  if (Array.isArray(local) || Array.isArray(server)) {
    return mergeUnion(key, Array.isArray(local) ? local : [], Array.isArray(server) ? server : [], excluded);
  }
  if (local && server && typeof local === 'object' && typeof server === 'object') {
    return { ...server, ...local };
  }
  return local !== null && local !== undefined ? local : server;
}

const isEmptyData = (v: any) => v === null || v === undefined || (Array.isArray(v) && v.length === 0);

/** JSON dengan urutan field stabil → isi yang sama selalu jadi string yang sama. */
function stableStringify(v: any): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
}

/**
 * Bandingkan ISI data, bukan urutannya.
 * Merge union menaruh item mengikuti urutan server, jadi hasil merge sering "kelihatan beda"
 * padahal isinya sama. Dulu perbedaan urutan itu bikin data besar ditulis ulang + dikirim
 * ulang ke server tiap siklus; server ganti versi → komputer lain ikut menarik semua data
 * → trafik numpuk terus dan sinkronisasi jadi lambat.
 */
function contentEqual(key: string, a: any, b: any): boolean {
  if (a === b) return true;
  if (isEmptyData(a) && isEmptyData(b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const norm = (arr: any[]) => arr.map(i => `${itemKey(key, i)}\u0001${stableStringify(i)}`).sort();
    const na = norm(a);
    const nb = norm(b);
    for (let i = 0; i < na.length; i++) if (na[i] !== nb[i]) return false;
    return true;
  }
  return stableStringify(a) === stableStringify(b);
}

async function readLocal(key: string): Promise<any | null> {
  try {
    const raw = await storageGetRaw(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

async function writeLocal(key: string, value: any): Promise<boolean> {
  // Penulisan internal (hasil merge dari server) — bukan perubahan user,
  // jadi jangan ditandai "kotor" (bisa memicu push balik yang tidak perlu).
  suppressDirty = true;
  try {
    return await storageSetRaw(key, JSON.stringify(value));
  } catch { return false; } finally { suppressDirty = false; }
}

/** Hapus local TANPA menandai "kotor" (dipakai saat server bilang data dihapus global). */
async function removeLocal(key: string): Promise<void> {
  suppressDirty = true;
  try { await storageRemove(key); } catch {} finally { suppressDirty = false; }
}

async function pullFromServer(key: string): Promise<{ data: any; deletedAt: number | null; sig?: string } | null> {
  try {
    const res = await fetch(`/api/data?key=${key}&t=${Date.now()}&${deviceQuery()}`);
    if (!res.ok) return null;
    const json = await res.json();
    const d = json.data;
    const deletedAt = typeof json.deletedAt === 'number' ? json.deletedAt : null;
    // Array kosong dianggap "tidak ada data"
    const data = Array.isArray(d) && d.length === 0 ? null : (d ?? null);
    return { data, deletedAt, sig: typeof json.sig === 'string' ? json.sig : undefined };
  } catch { return null; }
}

/** BATCH: tarik SEMUA key dalam satu request — hemat round-trip biar realtime antar komputer.
 *  Dengan sig: server hanya kirim data yang berubah (respon ringan ±2KB kalau tidak ada perubahan). */
type PullEntry = { data: any; deletedAt: number | null; same?: boolean; sig?: string } | null;

const SIGS_KEY = 'mma_sync_sigs_v1';

function readSigs(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SIGS_KEY);
    if (raw) { const p = JSON.parse(raw); return p && typeof p === 'object' ? p : {}; }
  } catch {}
  return {};
}

async function pullAllFromServer(keys: string[], sigs: Record<string, string>): Promise<Record<string, PullEntry>> {
  const out: Record<string, PullEntry> = {};
  try {
    const sigArr = keys.map(k => sigs[k] || '');
    const res = await fetch(`/api/data?keys=${encodeURIComponent(keys.join(','))}&sigs=${encodeURIComponent(sigArr.join(','))}&t=${Date.now()}&${deviceQuery()}`);
    if (!res.ok) return out;
    const json = await res.json();
    cacheDevices(json.devices);
    const raw = json.keys || {};
    for (const k of keys) {
      const entry = raw[k];
      if (!entry) { out[k] = null; continue; }
      if (entry.same) { out[k] = { data: null, deletedAt: null, same: true, sig: entry.sig }; continue; }
      const d = entry.data;
      const data = Array.isArray(d) && d.length === 0 ? null : (d ?? null);
      out[k] = { data, deletedAt: typeof entry.deletedAt === 'number' ? entry.deletedAt : null, sig: typeof entry.sig === 'string' ? entry.sig : undefined };
    }
  } catch {}
  return out;
}

/** Server balikin sig data yang baru saja kita kirim → siklus berikutnya tidak usah
 *  menarik ulang data yang kita sendiri baru push (server bilang "same"). */
async function readResponseSig(res: Response): Promise<string | null> {
  try {
    const j = await res.json();
    return typeof j?.sig === 'string' ? j.sig : null;
  } catch { return null; }
}

async function pushToServer(key: string, data: any, expectedSig?: string): Promise<{ ok: boolean; sig: string | null; conflict: boolean; identicalToDeleted: boolean }> {
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, data, device: getDeviceId(), name: getDeviceName(), sig: expectedSig || undefined }),
    });
    if (res.status === 409) {
      // Server sudah berubah sejak kita merge → jangan timpa; balikin sig terbaru biar klien tarik ulang
      const j = await res.json().catch(() => null);
      return {
        ok: false,
        sig: typeof j?.sig === 'string' ? j.sig : null,
        conflict: true,
        identicalToDeleted: !!j?.identicalToDeleted,
      };
    }
    if (!res.ok) return { ok: false, sig: null, conflict: false, identicalToDeleted: false };
    return { ok: true, sig: await readResponseSig(res), conflict: false, identicalToDeleted: false };
  } catch { return { ok: false, sig: null, conflict: false, identicalToDeleted: false }; }
}

async function deleteOnServer(key: string): Promise<{ ok: boolean; sig: string | null }> {
  try {
    const res = await fetch(`/api/data?key=${encodeURIComponent(key)}&${deviceQuery()}`, { method: 'DELETE' });
    if (!res.ok) return { ok: false, sig: null };
    return { ok: true, sig: await readResponseSig(res) };
  } catch { return { ok: false, sig: null }; }
}

function notifyListeners(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('shared-data-updated', { detail: { key } }));
    // Trigger listener yang sudah ada di komponen lain
    window.dispatchEvent(new Event('refresh-upload-history'));
    window.dispatchEvent(new Event('refresh-laporan'));
    window.dispatchEvent(new Event('storage'));
    // Siaran ke TAB LAIN (key IndexedDB tidak memicu event 'storage' lintas tab)
    storageBroadcast(key);
  } catch {}
}

// ── Migrasi satu kali: kompres foto bukti bayar lama yang tersimpan ukuran penuh ──
// (sebelum fitur kompres ada, bukti disimpan 3-8MB per foto → localStorage & sync berat)
const IMG_MIGRATE_FLAG = 'mma_img_migrate_v1';
async function compressOldBuktiOnce() {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(IMG_MIGRATE_FLAG)) return;
    const raw = localStorage.getItem('mma_bukti_bayar');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        let changed = false;
        const out: any[] = [];
        for (const b of list) {
          if (b && typeof b.imageBase64 === 'string' && b.imageBase64.length > 300000) {
            const small = await downscaleDataUrl(b.imageBase64, 1600, 1600, 0.75);
            if (small) { out.push({ ...b, imageBase64: small }); changed = true; continue; }
          }
          out.push(b);
        }
        if (changed) { try { localStorage.setItem('mma_bukti_bayar', JSON.stringify(out)); } catch {} }
      }
    }
    localStorage.setItem(IMG_MIGRATE_FLAG, '1');
  } catch {}
}

export function GlobalSyncProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);
  const localSnapshots = useRef<Record<string, string>>({});
  // Key yang pernah kita lihat tombstone-nya (buat bedain data baru vs data lama)
  const tombstoneSeen = useRef<Set<string>>(new Set());
  // Signature data server terakhir per key → polling ringan (server kirim data HANYA saat berubah)
  const sigsRef = useRef<Record<string, string>>(readSigs());
  // Cache data server terakhir per key — saat server "same", merge/push lokal tetap jalan pakai cache ini
  const serverCache = useRef<Record<string, { data: any; deletedAt: number | null } | null>>({});

  const persistSigs = () => {
    try { localStorage.setItem(SIGS_KEY, JSON.stringify(sigsRef.current)); } catch {}
  };

  /* Hasil push kita sendiri disimpan (sig + isinya) → siklus berikutnya server
     bilang "same" dan data itu tidak perlu ditarik ulang. */
  const recordPushed = (key: string, data: any, sig: string | null) => {
    serverCache.current[key] = { data, deletedAt: null };
    if (sig) { sigsRef.current[key] = sig; persistSigs(); }
  };

  /* Push bentrok (server berubah sejak kita merge) → buang sig & cache baseline,
     tandai kotor. Siklus berikutnya tarik ulang data terbaru, merge, lalu push lagi. */
  const handlePushConflict = (key: string) => {
    delete sigsRef.current[key];
    delete serverCache.current[key];
    persistSigs();
    dirtyKeys.add(key);
  };

  /* Tangani hasil push: ok → true. Conflict karena data IDENTIK dengan yang baru
     dihapus global → terima state terhapus (bersihkan lokal, jangan push lagi).
     Conflict biasa → bersihkan baseline & tarik ulang. Gagal → tandai kotor. */
  const applyPushConflict = async (
    key: string,
    res: { ok: boolean; sig: string | null; conflict: boolean; identicalToDeleted: boolean },
  ): Promise<void> => {
    if (res.conflict && res.identicalToDeleted) {
      await removeLocal(key);
      delete localSnapshots.current[key];
      serverCache.current[key] = { data: null, deletedAt: null };
      if (res.sig) { sigsRef.current[key] = res.sig; persistSigs(); }
      notifyListeners(key);
      return;
    }
    if (res.conflict) { handlePushConflict(key); return; }
    dirtyKeys.add(key);
  };

  /* Satu siklus sinkron: tarik batch, lalu merge/push HANYA key yang berubah.
     forceFull=true (saat halaman dibuka) → semua key diproses; ini juga jadi jaring
     pengaman kalau ada perubahan lokal yang belum sempat terkirim ke server.
     Balikan: ok = server terjangkau. */
  const syncOnce = async (forceFull: boolean): Promise<boolean> => {
    const sigs = forceFull ? {} : sigsRef.current;
    const all = await pullAllFromServer(SYNC_KEYS, sigs);
    if (Object.keys(all).length === 0) return false; // server tidak terjangkau / gagal
    let sigChanged = false;
    for (const key of SYNC_KEYS) {
      if (resettingKeys.has(key)) continue; // sedang di-reset global → jangan diproses
      const entry = all[key];
      // ── Guard pasca-reset: buang entry basi yang diambil sebelum reset selesai ──
      const rSig = postResetSig.get(key);
      const rAt = postResetAt.get(key);
      if (rSig !== undefined && rAt !== undefined) {
        if (Date.now() - rAt > POST_RESET_GUARD_MS) {
          postResetSig.delete(key);
          postResetAt.delete(key);
        } else if (!entry || (!entry.same && entry.sig !== rSig)) {
          continue; // data basi dari sebelum reset — jangan diproses
        } else if (entry.same) {
          postResetSig.delete(key); // sudah selaras dengan state post-reset
          postResetAt.delete(key);
        }
      }
      const same = !!(entry && entry.same);
      const dirty = dirtyKeys.has(key);

      // Server & lokal sama-sama tidak berubah → tidak ada yang perlu dikerjakan.
      if (same && !dirty && !forceFull) continue;

      // Isi salinan server: dari cache kalau server "same", atau dari respons batch.
      let remote: { data: any; deletedAt: number | null } | null | undefined = entry;
      if (same) {
        const cached = serverCache.current[key];
        if (cached !== undefined) remote = cached;
        else {
          remote = await pullFromServer(key); // isi server belum diketahui → tarik dulu, jangan menebak
          if (remote === null) continue;
          serverCache.current[key] = remote;
        }
      }

      const pushed = await syncKey(key, remote);
      dirtyKeys.delete(key);
      if (!same && entry && !pushed) {
        serverCache.current[key] = { data: entry.data, deletedAt: entry.deletedAt };
        if (entry.sig && sigsRef.current[key] !== entry.sig) {
          sigsRef.current[key] = entry.sig;
          sigChanged = true;
        }
      }
    }
    if (sigChanged) persistSigs();
    return true;
  };

  /* Status sinkron untuk badge di header: kapan terakhir berhasil & apakah server terjangkau */
  const markSyncStatus = (ok: boolean) => {
    try {
      localStorage.setItem('mma_sync_status', JSON.stringify({ at: Date.now(), ok }));
      window.dispatchEvent(new CustomEvent('sync-status-updated'));
    } catch {}
  };

  /* Sinkron satu key. Balikan true = hasil merge sudah terkirim ke server (sig & cache ikut
     diperbarui). Perubahan data lokalnya sendiri sudah diberitahukan ke UI lewat notifyListeners. */
  const syncKey = async (key: string, remoteOverride?: { data: any; deletedAt: number | null; sig?: string | null } | null): Promise<boolean> => {
    try {
      let local = await readLocal(key);
      let remote: { data: any; deletedAt: number | null; sig?: string | null } | null;
      if (remoteOverride !== undefined) {
        remote = remoteOverride ?? null;
      } else {
        remote = await pullFromServer(key);
        // null = server tidak terjangkau (bukan berarti server kosong) → jangan menebak
        if (remote === null) { dirtyKeys.add(key); return false; }
      }
      // Server memberitahu signature state-nya → catat sebagai baseline merge
      // ── Guard pasca-reset: pull basi (sebelum reset selesai) harus dibuang ──
      if (remote && typeof remote.sig === 'string') {
        const rSig = postResetSig.get(key);
        const rAt = postResetAt.get(key);
        if (rSig !== undefined && rAt !== undefined) {
          if (Date.now() - rAt > POST_RESET_GUARD_MS) {
            postResetSig.delete(key);
            postResetAt.delete(key);
          } else if (remote.sig !== rSig) {
            return false; // basi — jangan timpa state post-reset
          } else {
            postResetSig.delete(key); // sudah selaras
            postResetAt.delete(key);
          }
        }
      }
      if (remote && typeof remote.sig === 'string' && sigsRef.current[key] !== remote.sig) {
        sigsRef.current[key] = remote.sig;
        persistSigs();
      }
      let server = remote ? remote.data : null;
      const deletedAt = remote ? remote.deletedAt : null;
      // Isi server ASLI (sebelum difilter tombstone) — untuk deteksi perubahan yang perlu dipush balik
      const serverOrig = remote ? remote.data ?? null : null;

      // ── Partial-delete tombstone: item yang dihapus permanen tidak boleh
      //    hidup lagi dari copy server / perangkat lain ──
      if (key !== TOMBSTONE_KEY) {
        const tombs = readTombstones();
        if (tombs.length > 0) {
          const localF = applyTombstones(key, local, tombs);
          const serverF = applyTombstones(key, server, tombs);
          if (JSON.stringify(localF) !== JSON.stringify(local)) {
            local = localF;
            if (local !== null) { await writeLocal(key, local); notifyListeners(key); }
          }
          if (JSON.stringify(serverF) !== JSON.stringify(server)) server = serverF;
        }
      }

      // ── Hapus global: tombstone dari user lain ──
      if (deletedAt !== null) {
        const localStr = local === null ? null : JSON.stringify(local);
        const prevStr = localSnapshots.current[key];
        // Data lokal yang BARU (muncul/berubah SETELAH tombstone diproses)
        // = aktivitas baru user → jangan dihapus, push balik ke server
        // (POST /api/data otomatis membersihkan tombstone).
        const localIsNew = local !== null && (
          tombstoneSeen.current.has(key) ||
          (prevStr !== undefined && localStr !== prevStr)
        );
        if (localIsNew) {
          tombstoneSeen.current.delete(key);
          localSnapshots.current[key] = localStr as string;
          const res = await pushToServer(key, local, sigsRef.current[key]);
          if (res.ok) recordPushed(key, local, res.sig);
          else await applyPushConflict(key, res);
          notifyListeners(key);
          return res.ok;
        }
        tombstoneSeen.current.add(key);
        if (local !== null) {
          await removeLocal(key);
          delete localSnapshots.current[key];
          notifyListeners(key);
        }
        return false; // jangan push balik data yang sengaja dihapus
      }

      // Jalur normal: tombstone sudah tidak berlaku untuk key ini
      tombstoneSeen.current.delete(key);

      if (local === null && server === null) return false;

      if (local === null) {
        // Hanya server punya data → terapkan ke lokal
        await writeLocal(key, server);
        localSnapshots.current[key] = JSON.stringify(server);
        let pushed = false;
        // Kalau tombstone memfilter data server, bersihkan juga copy server-nya
        if (!contentEqual(key, serverOrig, server)) {
          const res = await pushToServer(key, server, sigsRef.current[key]);
          if (res.ok) { recordPushed(key, server, res.sig); pushed = true; }
          else await applyPushConflict(key, res);
        }
        notifyListeners(key);
        return pushed;
      }

      if (server === null) {
        // Hanya lokal punya data → push. Data yang isinya sudah pernah disinkron
        // (snapshot sama) atau memang kosong tidak perlu dikirim ulang.
        const localStr = JSON.stringify(local);
        if (isEmptyData(local) || localSnapshots.current[key] === localStr) {
          localSnapshots.current[key] = localStr;
          return false;
        }
        const res = await pushToServer(key, local, sigsRef.current[key]);
        if (!res.ok) { await applyPushConflict(key, res); return false; }
        localSnapshots.current[key] = localStr;
        recordPushed(key, local, res.sig);
        return true;
      }

      // Keduanya punya data → merge (lokal menang per item)
      // Deteksi item yang dihapus lokal: ada di snapshot lama, hilang di lokal sekarang
      let excluded: Set<string> | undefined;
      if (Array.isArray(local) && localSnapshots.current[key]) {
        try {
          const prevArr = JSON.parse(localSnapshots.current[key]);
          if (Array.isArray(prevArr)) {
            const prevKeys = new Set(prevArr.map((i: any) => itemKey(key, i)));
            const curKeys = new Set(local.map((i: any) => itemKey(key, i)));
            const deleted = new Set<string>();
            prevKeys.forEach(k => { if (!curKeys.has(k)) deleted.add(k); });
            if (deleted.size > 0) excluded = deleted;
          }
        } catch {}
      }

      const merged = mergeAny(key, local, server, excluded);

      // Tulis ke lokal HANYA kalau isinya beda. Beda urutan item saja tidak dihitung beda —
      // dulu inilah yang membuat data besar ditulis ulang tiap siklus tanpa alasan.
      if (!contentEqual(key, local, merged)) {
        await writeLocal(key, merged);
        localSnapshots.current[key] = JSON.stringify(merged);
        notifyListeners(key);
      } else {
        localSnapshots.current[key] = JSON.stringify(local);
      }

      // Push ke server HANYA kalau ISI server beda dari hasil merge (bukan sekadar beda urutan).
      // Ini yang menghentikan data besar bolak-balik antar komputer tiap siklus.
      if (!contentEqual(key, serverOrig, merged)) {
        const res = await pushToServer(key, merged, sigsRef.current[key]);
        if (res.ok) { recordPushed(key, merged, res.sig); return true; }
        await applyPushConflict(key, res);
      }
      return false;
    } catch { return false; }
  };

  // Initial sync
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      await compressOldBuktiOnce();
      // SATU request batch (forceFull) — sebelumnya 40 request satu-satu (lambat di HP)
      const ok = await syncOnce(true);
      markSyncStatus(ok);
      notifyListeners('init');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling: tarik perubahan komputer lain + dorong perubahan lokal (SATU request batch).
  // Key yang tidak berubah tidak dikerjakan, dan event ke UI hanya dikirim kalau memang
  // ada data yang berubah — dulu dikirim tiap 2 detik tanpa syarat, jadi semua halaman
  // ikut memuat ulang data besar terus-menerus (bagian besar dari rasa "lambat").
  useEffect(() => {
    let busy = false;
    const run = async () => {
      if (busy) return;
      if (typeof document !== 'undefined' && document.hidden) return; // hemat saat tab tersembunyi
      busy = true;
      try {
        markSyncStatus(await syncOnce(false));
      } catch {}
      busy = false;
    };
    const timer = setInterval(run, SYNC_INTERVAL);
    // Langsung sync saat user pindah/buka tab → update seketika tanpa nunggu interval
    const onFocus = () => run();
    const onVisible = () => { if (typeof document !== 'undefined' && !document.hidden) run(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Kirim cepat: begitu data lokal berubah, langsung dorong ke server ──
  // Dulu perubahan baru terkirim saat siklus polling berikutnya (terasa lambat di
  // komputer lain). Sekarang: tarik copy server key itu → merge → push (300ms debounce).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = async () => {
      timer = null;
      const keys = Array.from(dirtyKeys).filter(k => !resettingKeys.has(k));
      if (keys.length === 0) return;
      keys.forEach(k => dirtyKeys.delete(k));
      let ok = true;
      for (const key of keys) {
        // Cek lagi: reset global bisa mulai di tengah flush → skip (state post-reset
        // sudah dikunci lewat sigsRef & serverCache oleh handler reset).
        if (resettingKeys.has(key)) continue;
        // Tarik dulu isi server: kalau lokal langsung dikirim mentah, item yang baru
        // ditambah komputer lain bisa ikut hilang.
        const remote = await pullFromServer(key);
        if (remote === null) { ok = false; dirtyKeys.add(key); continue; }
        if (resettingKeys.has(key)) continue; // DELETE reset sudah selesai? pakai state baru
        await syncKey(key, remote);
      }
      if (ok) markSyncStatus(true);
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, PUSH_DEBOUNCE);
    };
    onLocalChange = schedule;
    installDirtyTracker();
    // Perubahan dari tab lain di browser yang sama
    const onStorage = (e: StorageEvent) => markDirty(e.key);
    window.addEventListener('storage', onStorage);
    return () => {
      onLocalChange = null;
      window.removeEventListener('storage', onStorage);
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Event hapus global: komponen dispatch 'global-data-reset' { key } ──
  useEffect(() => {
    const onReset = async (e: Event) => {
      const detail = (e as CustomEvent).detail as { key?: string } | undefined;
      const keys = detail?.key ? [detail.key] : SYNC_KEYS;
      for (const key of keys) {
        // Tahan semua proses sync key ini selama reset: flush/poll yang berjalan
        // bersamaan bisa menarik data LAMA dari server (sebelum DELETE selesai)
        // lalu menulisnya balik ke lokal & server → data "hidup lagi" setelah refresh.
        resettingKeys.add(key);
        try {
          await removeLocal(key);
          delete localSnapshots.current[key];
          dirtyKeys.delete(key);
          const res = await deleteOnServer(key);
          // Tandai key sudah melihat tombstone → data BARU yang muncul berikutnya
          // dianggap aktivitas baru user (dipush balik), bukan dihapus.
          if (res.ok) {
            tombstoneSeen.current.add(key);
            serverCache.current[key] = { data: null, deletedAt: null };
            if (res.sig) {
              sigsRef.current[key] = res.sig;
              persistSigs();
              // Pasang guard post-reset: entry/pull dengan sig LAMA (diambil sebelum
              // reset selesai) akan dibuang beberapa siklus — ini yang selama ini
              // membuat data yang dihapus "hidup lagi" seketika.
              postResetSig.set(key, res.sig);
              postResetAt.set(key, Date.now());
            }
          } else {
            // Gagal hapus di server → tandai kotor supaya dicoba lagi siklus berikutnya
            dirtyKeys.add(key);
          }
        } finally {
          resettingKeys.delete(key);
        }
        // Bersihkan lagi lokal & snapshot — kalau ada flush yang lolos di tengah reset
        // dan sempat mengembalikan data lama, jangan biarkan ikut terbaca / dipush balik.
        await removeLocal(key);
        delete localSnapshots.current[key];
        notifyListeners(key);
      }
    };
    window.addEventListener('global-data-reset', onReset);
    return () => window.removeEventListener('global-data-reset', onReset);
  }, []);

  return <>{children}</>;
}
