'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

export interface SkuItem {
  id: string; sku: string; nama: string; grade: string; kodeSupplierVarian: string;
  statusEditGambar: string; statusUploadToko: string; supplier: string; kategori: string;
  satuan: string; hargaModalLama: number; hargaBaru: number; hargaJual: number;
  stok: number; minStok: number; aktif: number; perubahanHargaBeli: string;
  videoKonten: boolean; gambarToko: string;
}

const SYNC_INTERVAL = 60000; // 60 detik (sebelumnya 30s — hemat bandwidth 4700 SKU)
const API = '/api/sku-master';

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
  skus: [], setSkus: () => {}, getSku: () => undefined, updateStok: () => {},
  syncStatus: 'idle', lastSync: null, forceSync: async () => {},
});

export function SkuProvider({ children }: { children: React.ReactNode }) {
  const [skus, setSkus] = useState<SkuItem[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const isHydrated = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSku = useCallback(async () => {
    const res = await fetch(`${API}?t=${Date.now()}`);
    if (!res.ok) throw new Error('fetch failed');
    return (await res.json()) as SkuItem[];
  }, []);

  const load = useCallback(async () => {
    setSyncStatus('syncing');
    try {
      const data = await fetchSku();
      setSkus(data);
      setLastSync(new Date());
      setSyncStatus('idle');
    } catch {
      setSyncStatus('error');
    } finally {
      isHydrated.current = true;
    }
  }, [fetchSku]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    syncTimer.current = setInterval(() => {
      // Skip polling saat tab tersembunyi (hemat bandwidth + CPU)
      if (typeof document !== 'undefined' && document.hidden) return;
      load();
    }, SYNC_INTERVAL);
    return () => { if (syncTimer.current) clearInterval(syncTimer.current); };
  }, [load]);

  const wrappedSetSkus: typeof setSkus = useCallback((updater) => {
    setSkus(prev => {
      const next = typeof updater === 'function' ? (updater as (p: SkuItem[]) => SkuItem[])(prev) : updater;
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      pendingTimer.current = setTimeout(() => {
        fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).catch(() => {});
      }, 800);
      return next;
    });
  }, []);

  const getSku = useCallback((skuCode: string) => skus.find(s => s.sku === skuCode), [skus]);

  const updateStok = useCallback(async (skuCode: string, delta: number) => {
    const item = skus.find(s => s.sku === skuCode);
    if (!item) return;
    const updated = { ...item, stok: Math.max(0, item.stok + delta) };
    setSkus(prev => prev.map(s => s.sku === skuCode ? updated : s));
    try {
      await fetch(API, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
      await load();
    } catch {}
  }, [skus, load]);

  const forceSync = useCallback(async () => { await load(); }, [load]);

  return (
    <SkuContext.Provider value={{ skus, setSkus: wrappedSetSkus, getSku, updateStok, syncStatus, lastSync, forceSync }}>
      {children}
    </SkuContext.Provider>
  );
}

export function useSkus() { return useContext(SkuContext); }
