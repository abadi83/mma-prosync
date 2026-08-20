'use client';

import { useEffect, useState } from 'react';
import type { SupplierItem } from '@/app/services/supplierService';

/** Key localStorage — dipakai sebagai cache offline / fallback, BUKAN sumber utama */
export const SUPPLIER_STORAGE = 'mma_supplier_master';

/* Fallback default kalau DB belum bisa dijangkau (mis. dev tanpa migrasi).
   ID 5 pertama di-align dengan seed migrations/009_seed_master_data.sql. */
const DEFAULT_SUPPLIERS: SupplierItem[] = [
  { id: 'e1e1e1e1-4001-4000-8000-000000000001', nama: 'PT Sinar Jaya Steel', kontak: '021-5555-1234', alamat: 'Jl. Industri Raya No. 45, Cikarang, Bekasi' },
  { id: 'e1e1e1e1-4001-4000-8000-000000000002', nama: 'UD Sumber Bangunan', kontak: '0813-9876-5432', alamat: 'Jl. Raya Bogor KM 12, Cibinong' },
  { id: 'e1e1e1e1-4001-4000-8000-000000000003', nama: 'CV Teknik Makmur', kontak: '0811-2233-4455', alamat: 'Jl. Pangeran Jayakarta No. 88, Jakarta Pusat' },
  { id: 'e1e1e1e1-4001-4000-8000-000000000004', nama: 'PT Plasma Pack Indonesia', kontak: '021-8888-7777', alamat: 'Kawasan Industri Pulogadung Blok C-12, Jakarta Timur' },
  { id: 'e1e1e1e1-4001-4000-8000-000000000005', nama: 'Toko Listrik Jaya', kontak: '0856-1111-2222', alamat: 'Jl. Kenari No. 25, Pasar Baru, Jakarta Pusat' },
  { id: 's-6', nama: 'PT Cat Maju Jaya', kontak: '021-6666-9999', alamat: 'Jl. Daan Mogot KM 8, Jakarta Barat' },
  { id: 's-7', nama: 'UD Aluminium Sejahtera', kontak: '0815-4444-8888', alamat: 'Jl. Raya Serpong No. 120, Tangerang Selatan' },
  { id: 's-8', nama: 'CV Baut Nusantara', kontak: '0812-7777-3333', alamat: 'Jl. Kramat Jaya No. 56, Senen, Jakarta Pusat' },
  { id: 's-9', nama: 'Toko ATK & Packing', kontak: '0857-2222-1111', alamat: 'Jl. Mangga Dua Raya No. 30, Jakarta Utara' },
  { id: 's-10', nama: 'PT Sanitary Utama', kontak: '021-3333-5555', alamat: 'Jl. Taman Sari No. 15, Jakarta Barat' },
];

/* In-memory cache + listener biar beberapa komponen yang mount barengan tetap kebagian update */
let cache: SupplierItem[] | null = null;
let inFlight: Promise<SupplierItem[] | null> | null = null;
const listeners = new Set<(list: SupplierItem[]) => void>();

function readLocal(): SupplierItem[] {
  try {
    const raw = localStorage.getItem(SUPPLIER_STORAGE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_SUPPLIERS;
}

/** Ambil dari DB (/api/supplier) — SATU SUMBER DATA. Dedup request antar instance. */
function fetchFromApi(): Promise<SupplierItem[] | null> {
  if (!inFlight) {
    inFlight = fetch(`/api/supplier?t=${Date.now()}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const list = Array.isArray(data) && data.length > 0 ? (data as SupplierItem[]) : null;
        if (list) {
          cache = list;
          try { localStorage.setItem(SUPPLIER_STORAGE, JSON.stringify(list)); } catch {}
          listeners.forEach(l => l(list));
        }
        return list;
      })
      .catch(() => null)
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

/**
 * Hook supplier dengan satu sumber data (DB via /api/supplier).
 * Alur: cache in-memory → localStorage (cache offline) → fetch DB → update semua pendengar.
 * Perubahan dari tab lain (Master Data) masuk lewat event 'storage'.
 */
export function useSuppliers(): SupplierItem[] {
  const [suppliers, setSuppliers] = useState<SupplierItem[]>(() => {
    if (typeof window === 'undefined') return cache ?? DEFAULT_SUPPLIERS;
    return cache ?? readLocal();
  });

  useEffect(() => {
    const l = (list: SupplierItem[]) => setSuppliers(list);
    listeners.add(l);
    fetchFromApi();

    /* Sinkron live: Master Data nge-mirror ke localStorage → tab lain langsung update */
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SUPPLIER_STORAGE || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cache = parsed;
          setSuppliers(parsed);
        }
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return suppliers;
}
