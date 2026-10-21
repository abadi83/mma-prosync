'use client';

import { useState, useEffect, useRef } from 'react';
import { storageGetRaw, storageSetRaw } from '@/app/lib/idbStorage';

/**
 * useSyncedStorage — pengganti useLocalStorage yang aman kuota.
 * Key besar (lihat idbStorage.BIG_KEYS) disimpan di IndexedDB, sisanya localStorage.
 * Live update: mendengarkan 'shared-data-updated' & 'storage' seperti sebelumnya.
 */
export function useSyncedStorage<T>(key: string, fallback: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [val, setVal] = useState<T>(fallback);
  const [hydrated, setHydrated] = useState(false);
  const mounted = useRef(true);

  // Hydrate dari penyimpanan (async untuk IndexedDB)
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    (async () => {
      const raw = await storageGetRaw(key);
      if (!cancelled && raw !== null) {
        try { setVal(JSON.parse(raw)); } catch {}
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => { cancelled = true; mounted.current = false; };
  }, [key]);

  // Write-through saat nilai berubah (setelah hydrate).
  // Key besar bisa gagal (koneksi IndexedDB terblokir) → coba ulang sekali,
  // lalu beri sinyal "penyimpanan bermasalah" supaya user tahu data belum aman.
  useEffect(() => {
    if (!hydrated || !mounted.current) return;
    let cancelled = false;
    const write = async () => {
      const raw = JSON.stringify(val);
      let ok = await storageSetRaw(key, raw);
      if (!ok) {
        await new Promise(r => setTimeout(r, 600));
        if (cancelled) return;
        ok = await storageSetRaw(key, raw);
      }
      if (!ok && typeof window !== 'undefined') {
        try { window.dispatchEvent(new CustomEvent('sync-storage-error', { detail: { key } })); } catch {}
      }
    };
    void write();
    return () => { cancelled = true; };
  }, [val, key, hydrated]);

  // LIVE UPDATE: komputer lain nge-sync data baru → baca ulang penyimpanan
  useEffect(() => {
    const refresh = async () => {
      const raw = await storageGetRaw(key);
      if (!mounted.current) return;
      try { setVal(raw !== null ? JSON.parse(raw) : fallback); } catch {}
    };
    const onShared = (e: Event) => {
      const detail = (e as CustomEvent).detail as { key?: string } | undefined;
      if (detail && detail.key && detail.key !== key) return; // perubahan key lain → skip
      void refresh();
    };
    const onStorage = (e: StorageEvent) => { if (e.key === key) void refresh(); };
    window.addEventListener('shared-data-updated', onShared);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('shared-data-updated', onShared);
      window.removeEventListener('storage', onStorage);
    };
  }, [key, fallback]);

  // LIVE UPDATE lintas tab: key IndexedDB tidak memicu event 'storage',
  // jadi perubahan di tab lain dikirim lewat BroadcastChannel.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const bc = new BroadcastChannel('mma-storage-changes');
    bc.onmessage = (e: MessageEvent) => {
      const k = (e.data as { key?: string } | null)?.key;
      if (k && k !== key) return;
      void (async () => {
        const raw = await storageGetRaw(key);
        if (!mounted.current) return;
        try { setVal(raw !== null ? JSON.parse(raw) : fallback); } catch {}
      })();
    };
    return () => bc.close();
  }, [key, fallback]);

  return [val, setVal];
}

/** Helper async baca JSON mentah (untuk logika non-React). */
export async function readSyncedJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await storageGetRaw(key);
    return raw !== null ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
