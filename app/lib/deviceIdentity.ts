'use client';

/* Identitas perangkat untuk fitur "siapa update terakhir & siapa sudah sinkron".
   Dipakai GlobalSyncProvider (semua request sync) dan halaman yang POST/DELETE
   langsung ke /api/data biar setiap perubahan tercatat atas nama perangkat/user-nya. */

export interface SyncDevice {
  id: string;
  name: string;
  lastSyncAt: number;
  lastPushAt: number;
  lastKey: string | null;
  lastAction: 'push' | 'delete' | null;
}

export const DEVICE_ID_KEY = 'mma_device_id';        // id unik per browser/komputer
export const DEVICES_CACHE_KEY = 'mma_sync_devices'; // daftar perangkat terakhir dari server (buat UI)

let cachedDeviceId = '';

export function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    cachedDeviceId = localStorage.getItem(DEVICE_ID_KEY) || '';
    if (!cachedDeviceId) {
      cachedDeviceId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      try { localStorage.setItem(DEVICE_ID_KEY, cachedDeviceId); } catch {}
    }
  } catch { cachedDeviceId = `dev-${Date.now().toString(36)}`; }
  return cachedDeviceId;
}

/** Nama perangkat = nama user yang login (cookie), fallback nama profil toko / id singkat. */
export function getDeviceName(): string {
  try {
    const m = typeof document !== 'undefined' ? document.cookie.match(/(?:^|; )user_name=([^;]*)/) : null;
    if (m && m[1]) return decodeURIComponent(m[1]);
    const profil = localStorage.getItem('mma_profil_nama');
    if (profil) return profil;
  } catch {}
  return `Perangkat ${getDeviceId().slice(-6)}`;
}

export function deviceQuery(): string {
  return `device=${encodeURIComponent(getDeviceId())}&name=${encodeURIComponent(getDeviceName())}`;
}
