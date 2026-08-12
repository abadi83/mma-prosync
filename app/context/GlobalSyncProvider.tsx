'use client';

import { useEffect, useRef } from 'react';

/**
 * Provider yang auto-sync SEMUA localStorage data ke server.
 * Ini memastikan Supplier, Toko, Pelanggan, Fleet, Kas Kecil, dll
 * dishare antar semua user secara otomatis.
 * 
 * Sync keys:
 * - mma_supplier_master
 * - mma_toko_master
 * - mma_pelanggan_master
 * - mma_fleet_master
 * - mma_kas_kecil
 * - mma_pegawai_data
 * - mma_pegawai_passwords
 * - mma_penjualan_transaksi
 */

const SYNC_KEYS = [
  'mma_supplier_master',
  'mma_toko_master',
  'mma_pelanggan_master',
  'mma_fleet_master',
  'mma_kas_kecil',
  'mma_pegawai_data',
  'mma_pegawai_passwords',
  'mma_penjualan_transaksi',
];

const SYNC_INTERVAL = 5000; // 5 detik

async function pullFromServer(key: string): Promise<any[] | null> {
  try {
    const res = await fetch(`/api/data?key=${key}&t=${Date.now()}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch { return null; }
}

async function pushToServer(key: string, data: any): Promise<boolean> {
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, data }),
    });
    return res.ok;
  } catch { return false; }
}

export function GlobalSyncProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);
  const lastSync = useRef<Record<string, number>>({});
  const localSnapshots = useRef<Record<string, string>>({});

  // Initial pull: ambil data dari server untuk populate localStorage kosong
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      for (const key of SYNC_KEYS) {
        // Cek apakah localStorage sudah punya data
        const local = localStorage.getItem(key);
        if (local) {
          // Push ke server kalau server belum punya
          try {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) {
              await pushToServer(key, parsed);
            }
          } catch {}
          localSnapshots.current[key] = local;
          lastSync.current[key] = Date.now();
          continue;
        }

        // localStorage kosong → pull dari server
        const serverData = await pullFromServer(key);
        if (serverData && serverData.length > 0) {
          try {
            localStorage.setItem(key, JSON.stringify(serverData));
            localSnapshots.current[key] = JSON.stringify(serverData);
            lastSync.current[key] = Date.now();
            // Trigger event biar komponen re-render
            window.dispatchEvent(new CustomEvent('shared-data-updated', { detail: { key } }));
          } catch {}
        }
      }
    }
    init();
  }, []);

  // Polling: cek localStorage setiap 5 detik, push kalau berubah
  // Juga pull dari server untuk dapat perubahan dari user lain
  useEffect(() => {
    const timer = setInterval(async () => {
      for (const key of SYNC_KEYS) {
        try {
          // 1. PULL: cek server untuk perubahan dari user lain
          const serverData = await pullFromServer(key);
          if (serverData && Array.isArray(serverData) && serverData.length > 0) {
            const serverStr = JSON.stringify(serverData);
            const localStr = localStorage.getItem(key);
            
            if (serverStr !== localStr) {
              // Server berbeda → update localStorage
              localStorage.setItem(key, serverStr);
              localSnapshots.current[key] = serverStr;
              lastSync.current[key] = Date.now();
              window.dispatchEvent(new CustomEvent('shared-data-updated', { detail: { key } }));
            }
            continue;
          }

          // 2. PUSH: cek localStorage, push kalau berubah
          const local = localStorage.getItem(key);
          if (local && local !== localSnapshots.current[key]) {
            try {
              const parsed = JSON.parse(local);
              if (Array.isArray(parsed) && parsed.length > 0) {
                await pushToServer(key, parsed);
                localSnapshots.current[key] = local;
                lastSync.current[key] = Date.now();
              }
            } catch {}
          }
        } catch {}
      }
    }, SYNC_INTERVAL);

    return () => clearInterval(timer);
  }, []);

  return <>{children}</>;
}
