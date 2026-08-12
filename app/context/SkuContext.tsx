'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

export interface SkuItem {
  id: string;
  sku: string;
  nama: string;
  grade: string;
  kodeSupplierVarian: string;
  statusEditGambar: string;
  statusUploadToko: string;
  supplier: string;
  kategori: string;
  satuan: string;
  hargaModalLama: number;
  hargaBaru: number;
  hargaJual: number;
  stok: number;
  minStok: number;
  aktif: number;
  perubahanHargaBeli: string;
}

const SKU_STORAGE = 'mma_sku_data';
const SKU_TIMESTAMP = 'mma_sku_timestamp';
const SYNC_INTERVAL = 30000; // 30 detik auto-sync

const DEFAULT_SKU: SkuItem[] = [];

/* ── Helper: baca localStorage ── */
function loadLocal(): { data: SkuItem[] | null; ts: number } {
  if (typeof window === 'undefined') return { data: null, ts: 0 };
  try {
    const raw = localStorage.getItem(SKU_STORAGE);
    const ts = parseInt(localStorage.getItem(SKU_TIMESTAMP) || '0', 10);
    return { data: raw ? JSON.parse(raw) : null, ts };
  } catch { return { data: null, ts: 0 }; }
}

/* ── Helper: simpan ke localStorage ── */
function saveLocal(data: SkuItem[]) {
  try {
    localStorage.setItem(SKU_STORAGE, JSON.stringify(data));
    localStorage.setItem(SKU_TIMESTAMP, String(Date.now()));
  } catch {}
}

interface SkuContextType {
  skus: SkuItem[];
  setSkus: React.Dispatch<React.SetStateAction<SkuItem[]>>;
  getSku: (skuCode: string) => SkuItem | undefined;
  updateStok: (skuCode: string, delta: number) => void;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSync: Date | null;
  forceSync: () => Promise<void>;
}

const SkuContext = createContext<SkuContextType>({
  skus: [],
  setSkus: () => {},
  getSku: () => undefined,
  updateStok: () => {},
  syncStatus: 'idle',
  lastSync: null,
  forceSync: async () => {},
});

export function SkuProvider({ children }: { children: React.ReactNode }) {
  const [skus, setSkus] = useState<SkuItem[]>(DEFAULT_SKU);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const isHydrated = useRef(false);
  const localVersion = useRef(0);
  const serverVersion = useRef(0);
  const syncTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Fungsi: tarik data dari server ── */
  const pullFromServer = useCallback(async (): Promise<SkuItem[] | null> => {
    try {
      const res = await fetch('/api/data?key=mma_sku_data&t=' + Date.now());
      if (!res.ok) return null;
      const json = await res.json();
      if (json.data && Array.isArray(json.data) && json.data.length > 0) {
        return json.data;
      }
      return null;
    } catch { return null; }
  }, []);

  /* ── Fungsi: push data ke server ── */
  const pushToServer = useCallback(async (data: SkuItem[]) => {
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'mma_sku_data', data }),
      });
      return res.ok;
    } catch { return false; }
  }, []);

  /* ── Fungsi: sync dua arah ── */
  const syncBothWays = useCallback(async (currentSkus: SkuItem[]) => {
    setSyncStatus('syncing');
    try {
      // 1. PULL: ambil data terbaru dari server
      const serverData = await pullFromServer();

      // 2. Bandingkan: pakai data yg lebih banyak (proxy kasar)
      if (serverData && serverData.length >= currentSkus.length) {
        // Server lebih baru/lengkap → pakai server
        if (JSON.stringify(serverData) !== JSON.stringify(currentSkus)) {
          setSkus(serverData);
          saveLocal(serverData);
          localVersion.current = Date.now();
        }
      } else if (currentSkus.length > 0) {
        // Lokal lebih banyak → push ke server
        await pushToServer(currentSkus);
      }

      serverVersion.current = Date.now();
      setLastSync(new Date());
      setSyncStatus('idle');
    } catch {
      setSyncStatus('error');
    }
  }, [pullFromServer, pushToServer]);

  /* ── Initial load: server dulu, fallback ke localStorage ── */
  useEffect(() => {
    async function init() {
      setSyncStatus('syncing');

      // 1. AMBIL DARI SERVER DULU (source of truth)
      const serverData = await pullFromServer();

      if (serverData && serverData.length > 0) {
        setSkus(serverData);
        saveLocal(serverData);
        localVersion.current = Date.now();
        serverVersion.current = Date.now();
        setLastSync(new Date());
        setSyncStatus('idle');
        isHydrated.current = true;
        return;
      }

      // 2. Fallback: localStorage
      const local = loadLocal();
      if (local.data && local.data.length > 0) {
        setSkus(local.data);
        // Push ke server karena server kosong
        await pushToServer(local.data);
        serverVersion.current = Date.now();
        setLastSync(new Date());
      }

      setSyncStatus('idle');
      isHydrated.current = true;
    }
    init();
  }, [pullFromServer, pushToServer]);

  /* ── Auto-sync setiap 30 detik ── */
  useEffect(() => {
    syncTimer.current = setInterval(() => {
      setSkus(prev => {
        syncBothWays(prev);
        return prev;
      });
    }, SYNC_INTERVAL);
    return () => { if (syncTimer.current) clearInterval(syncTimer.current); };
  }, [syncBothWays]);

  /* ── Setiap perubahan data: save local + push server ── */
  useEffect(() => {
    if (!isHydrated.current) return;
    saveLocal(skus);
    // Debounce push ke server
    const timer = setTimeout(() => {
      pushToServer(skus);
      setLastSync(new Date());
    }, 1000);
    return () => clearTimeout(timer);
  }, [skus, pushToServer]);

  const getSku = useCallback((skuCode: string) => skus.find(s => s.sku === skuCode), [skus]);

  const updateStok = useCallback((skuCode: string, delta: number) => {
    setSkus(prev => prev.map(s => s.sku === skuCode ? { ...s, stok: Math.max(0, s.stok + delta) } : s));
  }, []);

  const forceSync = useCallback(async () => {
    await syncBothWays(skus);
  }, [skus, syncBothWays]);

  return (
    <SkuContext.Provider value={{ skus, setSkus, getSku, updateStok, syncStatus, lastSync, forceSync }}>
      {children}
    </SkuContext.Provider>
  );
}

export function useSkus() { return useContext(SkuContext); }
