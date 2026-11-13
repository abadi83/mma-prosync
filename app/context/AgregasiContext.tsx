'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { isStatusAktif } from '@/app/lib/kurir';

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
  kurirKategoriManual?: 'instant' | 'sameday' | 'prioritas' | ''; // override manual dari Picking
  statusPesanan: string;
  dibuat: string;
  sla: string;
  statusProses?: 'Perlu Dikirim' | 'Dipicking' | 'DiQC' | 'Dipacking' | 'DiScanRunner' | 'Dikirim' | 'PendingPickup' | 'Dibatalkan'; // workflow gudang
  updatedAt?: number;                          // timestamp perubahan terakhir (untuk merge sync agar tidak ditimpa data lama)
  jenisPaket?: 'Reguler' | 'Besar';          // ditentukan saat QC
  packingVideoDone?: boolean;                 // wajib utk paket besar: sudah didokumentasikan video saat packing
  handoverId?: string;                        // ID serah terima dari Runner Scanner
  handoverAt?: string;                        // timestamp serah terima
  statusKeuangan?: 'Masuk Saldo';             // ditandai otomatis saat resi yang sama terupload di Input Keuangan
  tanggalSaldo?: string;                      // tanggal masuk saldo (dari laporan keuangan)
  qcChecklist?: {                             // checklist QC per pesanan (pertanggungjawaban QC)
    checklist: boolean;
    spesifikasi: boolean;
    jumlah: boolean;
    kualitas: boolean;
    fungsi: boolean;
    petugas?: string;
    pada?: string;
  };
}

interface AgregasiContextType {
  allRows: AgregasiRow[];
  setAllRows: React.Dispatch<React.SetStateAction<AgregasiRow[]>>;
  addRows: (rows: AgregasiRow[]) => void;
  updateStatusPicking: (matches: { noPesanan: string; noResi: string }[]) => { updated: number; notFound: number };
  updateStatusToQC: (keys: string[]) => number;
  resetStatusWorkflow: () => number;
  forceResetServer: () => Promise<boolean>;
  clearRows: () => void;
}

const AgregasiContext = createContext<AgregasiContextType>({
  allRows: [],
  setAllRows: () => {},
  addRows: () => {},
  updateStatusPicking: () => ({ updated: 0, notFound: 0 }),
  updateStatusToQC: () => 0,
  resetStatusWorkflow: () => 0,
  forceResetServer: async () => false,
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

/* Merge dua sumber baris agregasi: versi dengan status workflow lebih maju /
   updatedAt lebih baru yang menang, agar scan picking/QC tidak ditimpa copy lama. */
const AGREGASI_RANK: Record<string, number> = {
  'Perlu Dikirim': 0, 'Dipicking': 1, 'DiQC': 2, 'Dipacking': 3,
  'DiScanRunner': 4, 'PendingPickup': 4, 'Dikirim': 5, 'Dibatalkan': 6,
};
function rowMenang(incoming: AgregasiRow, existing: AgregasiRow): boolean {
  const rIn = AGREGASI_RANK[incoming.statusProses || ''] ?? -1;
  const rEx = AGREGASI_RANK[existing.statusProses || ''] ?? -1;
  if (rIn !== rEx) return rIn > rEx;
  if (!!incoming.handoverId !== !!existing.handoverId) return !!incoming.handoverId;
  const tsIn = incoming.updatedAt ?? 0;
  const tsEx = existing.updatedAt ?? 0;
  if (tsIn || tsEx) return tsIn >= tsEx;
  return true; // default: sumber terakhir (incoming) menang
}
function mergeRows(a: AgregasiRow[], b: AgregasiRow[]): AgregasiRow[] {
  const map = new Map<string, AgregasiRow>();
  for (const r of b) map.set(`${r.noPesanan}||${r.noResi}||${r.sku}`, r);
  for (const r of a) {
    const k = `${r.noPesanan}||${r.noResi}||${r.sku}`;
    const ex = map.get(k);
    if (!ex || rowMenang(r, ex)) map.set(k, r);
  }
  return Array.from(map.values());
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
        // Merge: stored + prev — versi workflow lebih maju / updatedAt lebih baru menang
        if (prev.length === 0) return stored;
        return mergeRows(prev, stored);
      });
    }
    setIsHydrated(true);
  }, []);

  // Simpan ke localStorage setiap kali allRows berubah
  useEffect(() => {
    saveToStorage(allRows);
  }, [allRows]);

  // Re-hydrate saat GlobalSyncProvider menarik data dari server (user lain)
  useEffect(() => {
    const onSync = () => {
      const stored = loadFromStorage();
      if (stored.length > 0) {
        setAllRows(prev => mergeRows(prev, stored));
      }
    };
    window.addEventListener('storage', onSync);
    window.addEventListener('shared-data-updated', onSync);
    return () => {
      window.removeEventListener('storage', onSync);
      window.removeEventListener('shared-data-updated', onSync);
    };
  }, []);

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

  /** Dipanggil saat picking (upload file / manual input) → update status ke "Dipicking"
   *  Menerima minimal salah satu: noPesanan atau noResi.
   *  Hindari double input: skip row yang sudah Dipicking/DiQC/lebih. */
  const updateStatusPicking = useCallback((matches: { noPesanan: string; noResi: string }[]) => {
    let updated = 0;
    // Set lookup: noPesanan, noResi, dan combination
    const orderSet = new Set<string>();
    const resiSet = new Set<string>();
    const exactSet = new Set<string>();
    const resiByOrder = new Map<string, string>();
    for (const m of matches) {
      const op = m.noPesanan.trim();
      const or = m.noResi.trim();
      if (op) orderSet.add(op);
      if (or) resiSet.add(or);
      if (op || or) exactSet.add(`${op}||${or}`);
      if (or && op) resiByOrder.set(op, or);
    }

    setAllRows(prev => prev.map(r => {
      // Skip jika sudah di-picking atau lebih lanjut (hindari double)
      if (r.statusProses && r.statusProses !== 'Perlu Dikirim') return r;

      const key = `${r.noPesanan}||${r.noResi}`;
      let matched = false;
      let newResi = r.noResi;

      // 1. Exact match: noPesanan||noResi
      if (exactSet.has(key)) matched = true;
      // 2. Match by noPesanan saja
      else if (r.noPesanan && orderSet.has(r.noPesanan)) matched = true;
      // 3. Match by noResi saja
      else if (r.noResi && resiSet.has(r.noResi)) matched = true;

      if (matched) {
        updated++;
        if (!r.noResi && resiByOrder.get(r.noPesanan)) newResi = resiByOrder.get(r.noPesanan)!;
        return { ...r, statusProses: 'Dipicking' as const, noResi: newResi, updatedAt: Date.now() };
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
      if (keySet.has(k) && r.statusProses === 'Dipicking') { count++; return { ...r, statusProses: 'DiQC' as const, updatedAt: Date.now() }; }
      return r;
    }));
    return count;
  }, []);

  /** Reset status workflow: kembalikan pesanan yang BELUM selesai (bukan dikirim/
   *  selesai/retur/batal/diterima) ke "belum diproses", supaya sisa status
   *  QC/Packing/Runner lama tidak menempel. Status marketplace kosong pun ikut direset. */
  const resetStatusWorkflow = useCallback(() => {
    let count = 0;
    const TAHAP_WORKFLOW = new Set(['dipicking', 'diqc', 'dipacking', 'discanrunner', 'pendingpickup']);
    setAllRows(prev => prev.map(r => {
      const sp = (r.statusProses || '').trim().toLowerCase();
      // Hanya proses baris yang memang sedang di workflow
      if (!TAHAP_WORKFLOW.has(sp)) return r;
      // Jangan reset yang sudah selesai/dikirim/batal/retur/diterima
      if (!isStatusAktif(r)) return r;
      count++;
      return { ...r, statusProses: undefined, handoverId: undefined, handoverAt: undefined, updatedAt: Date.now() };
    }));
    return count;
  }, []);

  /** Reset PAKSA: hapus data agregasi di SERVER + lokal, lalu sebarkan tombstone
   *  ke semua perangkat/tab. Dipakai saat status lama "nyangkut" karena banyak
   *  tab/komputer masih memegang salinan lama. */
  const forceResetServer = useCallback(async (): Promise<boolean> => {
    try {
      await fetch(`/api/data?key=${encodeURIComponent(STORAGE_KEY)}`, { method: 'DELETE' });
    } catch { /* lanjut bersihkan lokal */ }
    setAllRows([]);
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      try { window.dispatchEvent(new CustomEvent('global-data-reset', { detail: { key: STORAGE_KEY } })); } catch { /* ignore */ }
    }
    return true;
  }, []);

  const clearRows = useCallback(() => {
    setAllRows([]);
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      // Hapus juga di server (GlobalSyncProvider) supaya data tidak balik lagi
      try { window.dispatchEvent(new CustomEvent('global-data-reset', { detail: { key: STORAGE_KEY } })); } catch { /* ignore */ }
    }
  }, []);

  return (
    <AgregasiContext.Provider value={{ allRows, setAllRows, addRows, updateStatusPicking, updateStatusToQC, resetStatusWorkflow, forceResetServer, clearRows }}>
      {children}
    </AgregasiContext.Provider>
  );
}

export function useAgregasi() {
  return useContext(AgregasiContext);
}
