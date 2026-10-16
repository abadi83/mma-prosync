'use client';

/**
 * Lapisan penyimpanan sync yang aman kuota:
 * - Key BESAR (mma_hpp_purchases, mma_sku_data) → IndexedDB (kuota jauh lebih besar)
 * - Key kecil → localStorage seperti biasa
 *
 * Migrasi otomatis: saat key besar pertama kali dibaca, nilai lama di localStorage
 * dipindah ke IndexedDB lalu DIHAPUS dari localStorage (melepaskan kuota).
 * Penulisan key besar menulis penanda "__dirty_<key>" ke localStorage supaya
 * dirty-tracker GlobalSyncProvider tetap tahu key itu berubah.
 */

export const BIG_KEYS = new Set(['mma_hpp_purchases', 'mma_sku_data']);

const IDB_NAME = 'mma-prosync-idb';
const IDB_STORE = 'kv';
export const DIRTY_PREFIX = '__dirty_';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        // Bila DB dihapus/diupgrade tempat lain, tutup & buka ulang koneksi baru
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => { console.error('[idbStorage] open failed:', req.error); resolve(null); };
    } catch (e) {
      console.error('[idbStorage] open error:', e);
      resolve(null);
    }
  });
  return dbPromise;
}

function idbGet(key: string): Promise<string | null> {
  return openDb().then(
    (db) =>
      new Promise<string | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const tx = db.transaction(IDB_STORE, 'readonly');
          const req = tx.objectStore(IDB_STORE).get(key);
          req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
          req.onerror = () => resolve(null);
        } catch { resolve(null); }
      })
  );
}

function idbSet(key: string, value: string): Promise<boolean> {
  return openDb().then(
    (db) =>
      new Promise<boolean>((resolve) => {
        if (!db) return resolve(false);
        try {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).put(value, key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch { resolve(false); }
      })
  );
}

function idbRemove(key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve) => {
        if (!db) return resolve();
        try {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).delete(key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch { resolve(); }
      })
  );
}

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function lsSet(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

function lsRemove(key: string): void {
  try { localStorage.removeItem(key); } catch {}
}

export function isBigKey(key: string): boolean {
  return BIG_KEYS.has(key);
}

/** Baca nilai mentah (string). Key besar via IndexedDB (+migrasi dari localStorage). */
export async function storageGetRaw(key: string): Promise<string | null> {
  if (!isBigKey(key)) return lsGet(key);
  const fromIdb = await idbGet(key);
  if (fromIdb !== null) return fromIdb;
  // Migrasi satu kali: pindahkan salinan lama dari localStorage → IndexedDB
  const legacy = lsGet(key);
  if (legacy !== null) {
    const ok = await idbSet(key, legacy);
    if (ok) lsRemove(key); // bebaskan kuota localStorage
    return legacy;
  }
  return null;
}

/** Tulis nilai mentah. Return false kalau gagal (kuota localStorage untuk key kecil). */
export async function storageSetRaw(key: string, value: string): Promise<boolean> {
  if (!isBigKey(key)) {
    const ok = lsSet(key, value);
    if (!ok && typeof window !== 'undefined') {
      try { window.dispatchEvent(new CustomEvent('sync-storage-error', { detail: { key } })); } catch {}
    }
    return ok;
  }
  const ok = await idbSet(key, value);
  if (ok) {
    lsRemove(key); // salinan lama di localStorage tidak lagi dipakai
    // Penanda dirty → GlobalSyncProvider menandai key ini berubah
    lsSet(DIRTY_PREFIX + key, '1');
    return true;
  }
  // IndexedDB tidak tersedia (mis. environment terbatas) → fallback localStorage
  return lsSet(key, value);
}

export async function storageRemove(key: string): Promise<void> {
  if (isBigKey(key)) {
    await idbRemove(key);
    lsRemove(key);
  } else {
    lsRemove(key);
  }
}

/** Reset koneksi & hapus database — untuk keperluan test. */
export async function resetIdbForTests(): Promise<void> {
  const db = dbPromise ? await dbPromise : null;
  try { db?.close(); } catch {}
  dbPromise = null;
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(IDB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch { resolve(); }
  });
}

export async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await storageGetRaw(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch { return null; }
}

export async function setJSON(key: string, value: unknown): Promise<boolean> {
  try {
    return await storageSetRaw(key, JSON.stringify(value));
  } catch { return false; }
}
