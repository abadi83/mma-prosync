'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

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

const DEFAULT_SKU: SkuItem[] = [
  { id:'p-1',sku:'BTJ-001',nama:'Besi AS SENTAL ST-41 5mm x 6meter',grade:'A',kodeSupplierVarian:'',statusEditGambar:'UNEDITED',statusUploadToko:'Shopee — MITRA MULIA ABADI | Lazada — MITRA MULIA ABADI',supplier:'',kategori:'Material',satuan:'pcs',hargaModalLama:14100,hargaBaru:14100,hargaJual:25690,stok:12,minStok:5,aktif:1,perubahanHargaBeli:'+100.00%'},
  { id:'p-2',sku:'BB-8-D',nama:'Amplas Duco Grit 1500',grade:'A',kodeSupplierVarian:'',statusEditGambar:'UNEDITED',statusUploadToko:'Shopee — MITRA MULIA ABADI',supplier:'',kategori:'TOOLS',satuan:'pcs',hargaModalLama:1200,hargaBaru:1200,hargaJual:1500,stok:120,minStok:20,aktif:1,perubahanHargaBeli:'0.00%'},
  { id:'p-3',sku:'200825',nama:'Downlight Endora 6W Putih',grade:'A',kodeSupplierVarian:'',statusEditGambar:'UNEDITED',statusUploadToko:'Shopee — MITRA MULIA ABADI | Tokopedia — Berkah Abadi',supplier:'',kategori:'ELECTRICT',satuan:'pcs',hargaModalLama:11750,hargaBaru:11750,hargaJual:20899,stok:45,minStok:10,aktif:1,perubahanHargaBeli:'0.00%'},
  { id:'p-4',sku:'AU-5-A',nama:'Gagang Gergaji Triplek',grade:'A',kodeSupplierVarian:'',statusEditGambar:'UNEDITED',statusUploadToko:'Shopee — MITRA MULIA ABADI',supplier:'',kategori:'TOOLS',satuan:'pcs',hargaModalLama:13750,hargaBaru:13750,hargaJual:15950,stok:30,minStok:5,aktif:1,perubahanHargaBeli:'+8.20%'},
  { id:'p-5',sku:'200115-2pcs',nama:'Grendel Selot Pintu PVC 2pcs',grade:'A',kodeSupplierVarian:'',statusEditGambar:'UNEDITED',statusUploadToko:'Shopee — MITRA MULIA ABADI | Lazada — MITRA MULIA ABADI',supplier:'',kategori:'Pintu',satuan:'set',hargaModalLama:3000,hargaBaru:3000,hargaJual:6776,stok:3,minStok:15,aktif:1,perubahanHargaBeli:'+100.00%'},
  { id:'p-6',sku:'200959',nama:'Kran Angsa 8005 Tongkat',grade:'A',kodeSupplierVarian:'',statusEditGambar:'UNEDITED',statusUploadToko:'Shopee — MITRA MULIA ABADI',supplier:'',kategori:'WATERING',satuan:'pcs',hargaModalLama:50000,hargaBaru:50000,hargaJual:95402,stok:18,minStok:5,aktif:1,perubahanHargaBeli:'+5.26%'},
  { id:'p-7',sku:'200946',nama:'Kunci Pintu Besar HPP 01',grade:'A',kodeSupplierVarian:'',statusEditGambar:'UNEDITED',statusUploadToko:'Shopee — MITRA MULIA ABADI',supplier:'',kategori:'DOORING',satuan:'pcs',hargaModalLama:47500,hargaBaru:47500,hargaJual:74000,stok:22,minStok:5,aktif:1,perubahanHargaBeli:'0.00%'},
  { id:'p-8',sku:'200046-1PCS',nama:'Paku Seng 3 Inch',grade:'A',kodeSupplierVarian:'',statusEditGambar:'UNEDITED',statusUploadToko:'Shopee — MITRA MULIA ABADI',supplier:'',kategori:'TOOLS',satuan:'pcs',hargaModalLama:172,hargaBaru:172,hargaJual:415,stok:500,minStok:100,aktif:1,perubahanHargaBeli:'0.00%'},
  { id:'p-9',sku:'BC-1-C',nama:'Skrup Roofing 12x50',grade:'A',kodeSupplierVarian:'',statusEditGambar:'UNEDITED',statusUploadToko:'Shopee — MITRA MULIA ABADI',supplier:'',kategori:'TOOLS',satuan:'pcs',hargaModalLama:150,hargaBaru:150,hargaJual:240,stok:1000,minStok:200,aktif:1,perubahanHargaBeli:'0.00%'},
  { id:'p-10',sku:'STOP-1INCH',nama:'Stop Kran PVC Jumbo 1"',grade:'A',kodeSupplierVarian:'',statusEditGambar:'UNEDITED',statusUploadToko:'Shopee — MITRA MULIA ABADI',supplier:'',kategori:'PLUMBING',satuan:'pcs',hargaModalLama:11500,hargaBaru:11500,hargaJual:22434,stok:35,minStok:10,aktif:1,perubahanHargaBeli:'+100.00%'},
  { id:'p-11',sku:'IT-211-GP',nama:'Tarikan Laci IGM 4" CP/GP',grade:'A',kodeSupplierVarian:'',statusEditGambar:'UNEDITED',statusUploadToko:'Shopee — MITRA MULIA ABADI',supplier:'',kategori:'',satuan:'pcs',hargaModalLama:3500,hargaBaru:3500,hargaJual:7697,stok:60,minStok:10,aktif:1,perubahanHargaBeli:'+100.00%'},
  { id:'p-12',sku:'200010',nama:'Stop Kran Kuningan 3/4" Ball Valve',grade:'A',kodeSupplierVarian:'',statusEditGambar:'UNEDITED',statusUploadToko:'Lazada — MITRA MULIA ABADI',supplier:'',kategori:'PLUMBING',satuan:'pcs',hargaModalLama:36455,hargaBaru:36455,hargaJual:65000,stok:25,minStok:5,aktif:1,perubahanHargaBeli:'0.00%'},
];

function loadFromStorage(): SkuItem[] {
  if (typeof window === 'undefined') return DEFAULT_SKU;
  try { const raw = localStorage.getItem(SKU_STORAGE); return raw ? JSON.parse(raw) : DEFAULT_SKU; }
  catch { return DEFAULT_SKU; }
}

interface SkuContextType {
  skus: SkuItem[];
  setSkus: React.Dispatch<React.SetStateAction<SkuItem[]>>;
  getSku: (skuCode: string) => SkuItem | undefined;
  updateStok: (skuCode: string, delta: number) => void;
}

const SkuContext = createContext<SkuContextType>({
  skus: [],
  setSkus: () => {},
  getSku: () => undefined,
  updateStok: () => {},
});

export function SkuProvider({ children }: { children: React.ReactNode }) {
  const [skus, setSkus] = useState<SkuItem[]>(DEFAULT_SKU);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load data: server API → localStorage → DEFAULT
  useEffect(() => {
    async function load() {
      try {
        // 1. Coba dari server API (shared data)
        const res = await fetch('/api/data?key=mma_sku_data');
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            setSkus(json.data);
            // Update localStorage cache
            try { localStorage.setItem(SKU_STORAGE, JSON.stringify(json.data)); } catch {}
            setIsHydrated(true);
            return;
          }
        }
      } catch {}

      // 2. Fallback ke localStorage
      const stored = loadFromStorage();
      if (stored && stored.length > 0) {
        setSkus(stored);
      }
      setIsHydrated(true);
    }
    load();
  }, []);

  // Save: localStorage (cache) + server API (shared)
  useEffect(() => {
    if (!isHydrated) return;
    const data = skus.slice(0, 5000);
    // Cache lokal
    try { localStorage.setItem(SKU_STORAGE, JSON.stringify(data)); } catch {}
    // Sync ke server (shared)
    try {
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'mma_sku_data', data }),
      }).catch(() => {});
    } catch {}
  }, [skus, isHydrated]);

  const getSku = useCallback((skuCode: string) => skus.find(s => s.sku === skuCode), [skus]);

  const updateStok = useCallback((skuCode: string, delta: number) => {
    setSkus(prev => prev.map(s => s.sku === skuCode ? { ...s, stok: Math.max(0, s.stok + delta) } : s));
  }, []);

  return (
    <SkuContext.Provider value={{ skus, setSkus, getSku, updateStok }}>
      {children}
    </SkuContext.Provider>
  );
}

export function useSkus() { return useContext(SkuContext); }
