'use client';

import { getDeviceId, getDeviceName } from '@/app/lib/deviceIdentity';

/**
 * Push langsung ke /api/data (di luar GlobalSyncProvider) dengan protokol CAS:
 * ambil sig server terkini dulu, lalu POST. Server menolak push buta (tanpa sig)
 * untuk key yang sudah punya state — mencegah klien lama menimpa hapusan global.
 */
export async function pushToDataServer(key: string, data: unknown): Promise<boolean> {
  try {
    let sig = '';
    const g = await fetch(`/api/data?key=${encodeURIComponent(key)}&t=${Date.now()}`);
    if (g.ok) {
      const j = await g.json().catch(() => null);
      if (j && typeof j.sig === 'string') sig = j.sig;
    }
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, data, device: getDeviceId(), name: getDeviceName(), sig }),
    });
    if (res.status === 409) {
      // Konflik: data berubah sejak kita baca → serahkan ke GlobalSyncProvider
      // (klien akan tarik ulang, merge, lalu push ulang dengan sig baru).
      return false;
    }
    return res.ok;
  } catch {
    return false;
  }
}
