'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSharedDataOptions {
  /** Kunci data di server (contoh: 'mma_supplier_data') */
  key: string;
  /** Data default kalau server & localStorage kosong */
  fallback?: any[];
  /** Interval sync (ms), default 5000 (5 detik) */
  syncInterval?: number;
}

interface UseSharedDataReturn<T> {
  data: T[];
  setData: React.Dispatch<React.SetStateAction<T[]>>;
  loading: boolean;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSync: Date | null;
  forceSync: () => Promise<void>;
}

/**
 * Hook universal untuk data yang dishare antar user via server.
 * 
 * Alur:
 * 1. Load dari SERVER dulu (source of truth)
 * 2. Fallback ke localStorage (cache)
 * 3. Fallback ke data default
 * 4. Setiap perubahan: save localStorage + push server
 * 5. Auto-pull dari server tiap N detik
 */
export function useSharedData<T extends { id: string }>(options: UseSharedDataOptions): UseSharedDataReturn<T> {
  const { key, fallback = [], syncInterval = 5000 } = options;
  const [data, setData] = useState<T[]>(fallback);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const isHydrated = useRef(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Pull dari server ── */
  const pullFromServer = useCallback(async (): Promise<T[] | null> => {
    try {
      const res = await fetch(`/api/data?key=${key}&t=${Date.now()}`);
      if (!res.ok) return null;
      const json = await res.json();
      if (json.data && Array.isArray(json.data) && json.data.length > 0) {
        return json.data;
      }
      return null;
    } catch { return null; }
  }, [key]);

  /* ── Push ke server ── */
  const pushToServer = useCallback(async (items: T[]) => {
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, data: items }),
      });
      return true;
    } catch { return false; }
  }, [key]);

  /* ── Force sync sekarang ── */
  const forceSync = useCallback(async () => {
    setSyncStatus('syncing');
    try {
      const serverData = await pullFromServer();
      if (serverData && serverData.length > 0) {
        setData(serverData);
        try { localStorage.setItem(key, JSON.stringify(serverData)); } catch {}
      } else if (data.length > 0) {
        await pushToServer(data);
      }
      setLastSync(new Date());
      setSyncStatus('idle');
    } catch {
      setSyncStatus('error');
    }
  }, [pullFromServer, pushToServer, data, key]);

  /* ── Initial load: server → localStorage → fallback ── */
  useEffect(() => {
    async function init() {
      setSyncStatus('syncing');
      
      // 1. Server dulu
      const serverData = await pullFromServer();
      if (serverData && serverData.length > 0) {
        setData(serverData);
        try { localStorage.setItem(key, JSON.stringify(serverData)); } catch {}
        setLastSync(new Date());
        setLoading(false);
        setSyncStatus('idle');
        isHydrated.current = true;
        return;
      }

      // 2. localStorage
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const local = JSON.parse(raw);
          if (Array.isArray(local) && local.length > 0) {
            setData(local);
            await pushToServer(local);
            setLastSync(new Date());
            setLoading(false);
            setSyncStatus('idle');
            isHydrated.current = true;
            return;
          }
        }
      } catch {}

      // 3. Fallback
      setLoading(false);
      setSyncStatus('idle');
      isHydrated.current = true;
    }
    init();
  }, [key, pullFromServer, pushToServer]);

  /* ── Auto-pull tiap syncInterval ── */
  useEffect(() => {
    const timer = setInterval(async () => {
      const serverData = await pullFromServer();
      if (serverData && serverData.length > 0) {
        setData(prev => {
          // Cek apakah server beda
          if (JSON.stringify(serverData) !== JSON.stringify(prev)) {
            try { localStorage.setItem(key, JSON.stringify(serverData)); } catch {}
            return serverData;
          }
          return prev;
        });
        setLastSync(new Date());
      }
    }, syncInterval);
    return () => clearInterval(timer);
  }, [key, pullFromServer, syncInterval]);

  /* ── Setiap perubahan: save local + push server (debounce 1s) ── */
  useEffect(() => {
    if (!isHydrated.current) return;
    try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
    
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      pushToServer(data);
      setLastSync(new Date());
    }, 1000);
    
    return () => { if (pushTimer.current) clearTimeout(pushTimer.current); };
  }, [data, key, pushToServer]);

  return { data, setData, loading, syncStatus, lastSync, forceSync };
}
