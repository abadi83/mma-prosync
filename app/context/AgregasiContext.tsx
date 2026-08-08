'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'mma_agregasi_rows';

export interface AgregasiRow {
  id: string;
  marketplace: string;
  namaToko: string;
  noPesanan: string;
  noResi: string;
  sku: string;
  namaProduk: string;
  hargaJual: number;
  kuantity: number;
  kurir: string;
  statusPesanan: string;
  dibuat: string;
  sla: string;
  statusProses?: 'Perlu Dikirim' | 'Dipicking' | 'DiQC' | 'Dipacking' | 'DiScanRunner' | 'Dikirim' | 'PendingPickup' | 'Dibatalkan'; // workflow gudang
  jenisPaket?: 'Reguler' | 'Besar';          // ditentukan saat QC
  handoverId?: string;                        // ID serah terima dari Runner Scanner
  handoverAt?: string;                        // timestamp serah terima
}

interface AgregasiContextType {
  allRows: AgregasiRow[];
  setAllRows: React.Dispatch<React.SetStateAction<AgregasiRow[]>>;
  addRows: (rows: AgregasiRow[]) => void;
  updateStatusPicking: (matches: { noPesanan: string; noResi: string }[]) => { updated: number; notFound: number };
  updateStatusToQC: (keys: string[]) => number;
  clearRows: () => void;
}

const AgregasiContext = createContext<AgregasiContextType>({
  allRows: [],
  setAllRows: () => {},
  addRows: () => {},
  updateStatusPicking: () => ({ updated: 0, notFound: 0 }),
  updateStatusToQC: () => 0,
  clearRows: () => {},
});

function loadFromStorage(): AgregasiRow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Validasi ringan: pastikan setiap item punya noPesanan
    return parsed.filter((r: unknown) => r && typeof r === 'object' && 'noPesanan' in (r as Record<string, unknown>));
  } catch {
    return [];
  }
}

function saveToStorage(rows: AgregasiRow[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch { /* storage full atau tidak tersedia */ }
}

export function AgregasiProvider({ children }: { children: React.ReactNode }) {
  const [allRows, setAllRows] = useState<AgregasiRow[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const hasAddedRef = React.useRef(false);

  // Hydrate dari localStorage setelah mount (merge, jangan overwrite)
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored.length > 0) {
      setAllRows(prev => {
        // Merge: stored + prev (prev bisa sudah ada dari upload sebelum hydrate)
        if (prev.length === 0) return stored;
        const map = new Map<string, AgregasiRow>();
        for (const r of stored) map.set(`${r.noPesanan}||${r.noResi}||${r.sku}`, r);
        for (const r of prev) map.set(`${r.noPesanan}||${r.noResi}||${r.sku}`, r);
        return Array.from(map.values());
      });
    }
    setIsHydrated(true);
  }, []);

  // Simpan ke localStorage setiap kali allRows berubah
  useEffect(() => {
    saveToStorage(allRows);
  }, [allRows]);

  const addRows = useCallback((rows: AgregasiRow[]) => {
    setAllRows(prev => {
      const existing = new Map<string, AgregasiRow>();
      for (const r of prev) existing.set(`${r.noPesanan}||${r.noResi}||${r.sku}`, r);
      for (const r of rows) {
        // Pertahankan statusProses yang sudah ada, default "Perlu Dikirim"
        const key = `${r.noPesanan}||${r.noResi}||${r.sku}`;
        const old = existing.get(key);
        existing.set(key, { ...r, statusProses: old?.statusProses || r.statusProses || 'Perlu Dikirim' });
      }
      return Array.from(existing.values());
    });
  }, []);

  /** Dipanggil saat picking team upload file → update status ke "Dipicking" */
  const updateStatusPicking = useCallback((matches: { noPesanan: string; noResi: string }[]) => {
    let updated = 0;
    // Build lookup: exact key (noPesanan||noResi) + fallback by noPesanan saja
    const exactSet = new Set(matches.map(m => `${m.noPesanan}||${m.noResi}`));
    // Map untuk lookup noResi dari picking file (by noPesanan)
    const resiByOrder = new Map<string, string>();
    for (const m of matches) {
      if (m.noResi) resiByOrder.set(m.noPesanan, m.noResi);
    }
    // Set noPesanan dari picking file (untuk fallback matching)
    const orderSet = new Set(matches.map(m => m.noPesanan));

    setAllRows(prev => prev.map(r => {
      const key = `${r.noPesanan}||${r.noResi}`;
      // 1. Exact match by noPesanan + noResi
      const isExactMatch = exactSet.has(key);
      // 2. Fallback: match by noPesanan saja (jika row belum punya noResi)
      const isOrderMatch = !isExactMatch && !r.noResi && orderSet.has(r.noPesanan);

      if ((isExactMatch || isOrderMatch) && (!r.statusProses || r.statusProses === 'Perlu Dikirim')) {
        updated++;
        // Update noResi jika picking file menyediakannya dan row belum punya
        const newResi = (!r.noResi && resiByOrder.get(r.noPesanan)) || r.noResi;
        return { ...r, statusProses: 'Dipicking' as const, noResi: newResi };
      }
      return r;
    }));
    return { updated, notFound: matches.length - updated };
  }, []);

  /** Picking selesai → pindah ke QC */
  const updateStatusToQC = useCallback((keys: string[]) => {
    const keySet = new Set(keys);
    let count = 0;
    setAllRows(prev => prev.map(r => {
      const k = `${r.noPesanan}||${r.noResi}`;
      if (keySet.has(k) && r.statusProses === 'Dipicking') { count++; return { ...r, statusProses: 'DiQC' as const }; }
      return r;
    }));
    return count;
  }, []);

  const clearRows = useCallback(() => {
    setAllRows([]);
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
  }, []);

  return (
    <AgregasiContext.Provider value={{ allRows, setAllRows, addRows, updateStatusPicking, updateStatusToQC, clearRows }}>
      {children}
    </AgregasiContext.Provider>
  );
}

export function useAgregasi() {
  return useContext(AgregasiContext);
}
