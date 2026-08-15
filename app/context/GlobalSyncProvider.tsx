'use client';

import { useEffect, useRef } from 'react';

/**
 * GlobalSyncProvider — sync dua arah untuk data yang MASIH di localStorage
 * (Data Entry & operasional). Data lain sudah di PostgreSQL via API.
 *
 * Strategi merge: UNION by stringify per item, jadi appends dari 2 user
 * digabung, bukan saling menimpa.
 */

const SYNC_KEYS = [
  'mma_marketplace_orders',   // Data Entry: pesanan marketplace
  'mma_marketplace_income',   // Data Entry: ringkasan income marketplace
  'mma_keuangan_manual',      // Data Entry: entry keuangan manual
  'mma_agregasi_rows',        // Agregasi pesanan gudang
  'mma_sku_data',             // SKU master (dibaca Data Entry)
  'mma_toko_master',          // Toko marketplace legacy
];

const SYNC_INTERVAL = 5000; // 5 detik

function mergeUnion<T>(key: string, a: T[], b: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of [...b, ...a]) {
    map.set(itemKey(key, item), item);
  }
  return Array.from(map.values());
}

/** Kunci unik per item, berdasarkan tipe data (biar update status tidak dobel) */
function itemKey(key: string, item: any): string {
  if (item == null || typeof item !== 'object') return String(item);
  if (key === 'mma_agregasi_rows') return `${item.noPesanan || ''}||${item.noResi || ''}||${item.sku || ''}`;
  if (key === 'mma_marketplace_orders') return `${item.noPesanan || item.id || ''}||${item.id || ''}`;
  if (key === 'mma_marketplace_income') return String(item.id ?? JSON.stringify(item));
  if (key === 'mma_keuangan_manual') return String(item.id ?? JSON.stringify(item));
  if (key === 'mma_sku_data') return `${item.sku || item.id || ''}`;
  if (key === 'mma_toko_master') return String(item.id ?? item.nama ?? JSON.stringify(item));
  return JSON.stringify(item);
}

async function pullFromServer(key: string): Promise<any[] | null> {
  try {
    const res = await fetch(`/api/data?key=${key}&t=${Date.now()}`);
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json.data) ? json.data : null;
  } catch { return null; }
}

async function pushToServer(key: string, data: any[]): Promise<boolean> {
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, data }),
    });
    return res.ok;
  } catch { return false; }
}

function notifyListeners(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('shared-data-updated', { detail: { key } }));
    // Trigger listener yang sudah ada di komponen lain
    window.dispatchEvent(new Event('refresh-upload-history'));
    window.dispatchEvent(new Event('refresh-laporan'));
    window.dispatchEvent(new Event('storage'));
  } catch {}
}

export function GlobalSyncProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);
  const localSnapshots = useRef<Record<string, string>>({});

  // Initial sync: merge server + localStorage, ambil union
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      for (const key of SYNC_KEYS) {
        try {
          let local: any[] = [];
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) local = parsed;
            }
          } catch {}

          const server = await pullFromServer(key);

          let merged = local;
          if (server && Array.isArray(server)) {
            merged = mergeUnion(key, local, server);
          }

          if (merged.length > 0) {
            try { localStorage.setItem(key, JSON.stringify(merged)); } catch {}
            localSnapshots.current[key] = JSON.stringify(merged);
            if (JSON.stringify(server || []) !== JSON.stringify(merged)) {
              await pushToServer(key, merged);
            }
          } else if (server && server.length > 0) {
            try { localStorage.setItem(key, JSON.stringify(server)); } catch {}
            localSnapshots.current[key] = JSON.stringify(server);
          }
        } catch {}
      }
      notifyListeners('init');
    }
    init();
  }, []);

  // Polling 5 detik: tarik perubahan user lain + dorong perubahan lokal
  useEffect(() => {
    const timer = setInterval(async () => {
      for (const key of SYNC_KEYS) {
        try {
          const localRaw = localStorage.getItem(key);
          let local: any[] = [];
          try { if (localRaw) { const p = JSON.parse(localRaw); if (Array.isArray(p)) local = p; } } catch {}

          const server = await pullFromServer(key);

          if (server && server.length > 0) {
            // Merge union dengan server
            const merged = mergeUnion(key, local, server);
            if (JSON.stringify(merged) !== JSON.stringify(local)) {
              try { localStorage.setItem(key, JSON.stringify(merged)); } catch {}
              notifyListeners(key);
            }
            localSnapshots.current[key] = JSON.stringify(merged);
            if (JSON.stringify(server) !== JSON.stringify(merged)) {
              await pushToServer(key, merged);
            }
          } else if (local.length > 0 && JSON.stringify(local) !== localSnapshots.current[key]) {
            // Server kosong → push lokal
            await pushToServer(key, local);
            localSnapshots.current[key] = JSON.stringify(local);
          }
        } catch {}
      }
    }, SYNC_INTERVAL);

    return () => clearInterval(timer);
  }, []);

  return <>{children}</>;
}
