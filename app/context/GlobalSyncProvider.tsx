'use client';

import React, { useEffect, useRef } from 'react';

/**
 * GlobalSyncProvider — sync dua arah untuk SEMUA data yang masih di localStorage.
 * Data yang sudah di PostgreSQL tetap via API; ini mencakup sisanya.
 *
 * Strategi merge:
 * - Array  → union per-kunci unik (id / noPesanan / sku)
 * - Object → shallow merge (lokal menang per key)
 * - Scalar → last-write-wins (lokal menang kalau berubah)
 */

const SYNC_KEYS = [
  // Data Entry & operasional
  'mma_keuangan_manual',
  'mma_ops_entries',
  'mma_riwayat_entry',
  'mma_agregasi_rows',
  'mma_sku_data',
  'mma_toko_master',
  // Keuangan & Pembelian
  'mma_payment_history',
  'mma_biaya_operasional',
  'mma_opex_purchases',
  'mma_hpp_purchases',
  'mma_modal',
  'mma_kas_kecil',
  'mma_pencairan',
  'mma_koreksi_po',
  'mma_koreksi_refund',
  'mma_bukti_bayar',
  // Penjualan
  'mma_penjualan_transaksi',
  // Kepegawaian — TIDAK di-sync via /api/data lagi.
  // Sumber kebenaran pegawai = PostgreSQL (app/api/pegawai).
  // localStorage hanya cache lokal; sync dilakukan di halaman kepegawaian.
  // (sebelumnya disini: 'mma_pegawai_data', 'mma_pegawai_passwords')
  'mma_izin_records',
  'mma_gaji_records',
  'mma_face_data',
  // Akuntansi
  'mma_coa',
  'mma_jurnal_umum',
  'mma_aset_tetap',
  // Operasional Gudang
  'mma_fleet_master',
  'mma_ho_archive',
  'mma_pengantaran_offline',
  'mma_po_inventory_check',
  'mma_opname_saved',
  // Task Harga
  'mma_price_tasks',
  'mma_price_history',
  'mma_taskharga_settings',
  // Profil & Info Toko
  'mma_profil_nama',
  'mma_profil_email',
  'mma_profil_telp',
  'mma_profil_avatar',
  'mma_nama_toko',
  'mma_alamat_toko',
  'mma_telepon_toko',
  'mma_logo_toko',
];

const SYNC_INTERVAL = 5000; // 5 detik

function mergeUnion<T>(key: string, a: T[], b: T[], excluded?: Set<string>): T[] {
  const map = new Map<string, T>();
  for (const item of [...b, ...a]) {
    const k = itemKey(key, item);
    if (excluded && excluded.has(k)) continue; // item dihapus lokal → jangan dihidupkan lagi
    map.set(k, item);
  }
  return Array.from(map.values());
}

/** Kunci unik per item, berdasarkan tipe data (biar update status tidak dobel) */
function itemKey(key: string, item: any): string {
  if (item == null || typeof item !== 'object') return String(item);
  if (key === 'mma_agregasi_rows') return `${item.noPesanan || ''}||${item.noResi || ''}||${item.sku || ''}`;
  if (key === 'mma_marketplace_orders') return `${item.noPesanan || item.id || ''}||${item.id || ''}`;
  if (key === 'mma_sku_data') return `${item.sku || item.id || ''}`;
  if (item.id !== undefined) return String(item.id);
  return JSON.stringify(item);
}

/** Merge generik: array → union, object → shallow merge, scalar → last-write-wins */
function mergeAny(key: string, local: any, server: any, excluded?: Set<string>): any {
  if (Array.isArray(local) || Array.isArray(server)) {
    return mergeUnion(key, Array.isArray(local) ? local : [], Array.isArray(server) ? server : [], excluded);
  }
  if (local && server && typeof local === 'object' && typeof server === 'object') {
    return { ...server, ...local };
  }
  return local !== null && local !== undefined ? local : server;
}

function readLocal(key: string): any | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function writeLocal(key: string, value: any) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

async function pullFromServer(key: string): Promise<{ data: any; deletedAt: number | null } | null> {
  try {
    const res = await fetch(`/api/data?key=${key}&t=${Date.now()}`);
    if (!res.ok) return null;
    const json = await res.json();
    const d = json.data;
    const deletedAt = typeof json.deletedAt === 'number' ? json.deletedAt : null;
    // Array kosong dianggap "tidak ada data"
    const data = Array.isArray(d) && d.length === 0 ? null : (d ?? null);
    return { data, deletedAt };
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

async function deleteOnServer(key: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/data?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
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
  // Key yang pernah kita lihat tombstone-nya (buat bedain data baru vs data lama)
  const tombstoneSeen = useRef<Set<string>>(new Set());

  const syncKey = async (key: string) => {
    try {
      const local = readLocal(key);
      const remote = await pullFromServer(key);
      const server = remote ? remote.data : null;
      const deletedAt = remote ? remote.deletedAt : null;

      // ── Hapus global: tombstone dari user lain ──
      if (deletedAt !== null) {
        const localStr = local === null ? null : JSON.stringify(local);
        const prevStr = localSnapshots.current[key];
        // Data lokal yang BARU (muncul/berubah SETELAH tombstone diproses)
        // = aktivitas baru user → jangan dihapus, push balik ke server
        // (POST /api/data otomatis membersihkan tombstone).
        const localIsNew = local !== null && (
          tombstoneSeen.current.has(key) ||
          (prevStr !== undefined && localStr !== prevStr)
        );
        if (localIsNew) {
          tombstoneSeen.current.delete(key);
          localSnapshots.current[key] = localStr as string;
          await pushToServer(key, local);
          notifyListeners(key);
          return;
        }
        tombstoneSeen.current.add(key);
        if (local !== null) {
          try { localStorage.removeItem(key); } catch {}
          delete localSnapshots.current[key];
          notifyListeners(key);
        }
        return; // jangan push balik data yang sengaja dihapus
      }

      // Jalur normal: tombstone sudah tidak berlaku untuk key ini
      tombstoneSeen.current.delete(key);

      if (local === null && server === null) return;

      if (local === null) {
        // Hanya server punya data → terapkan ke lokal
        writeLocal(key, server);
        localSnapshots.current[key] = JSON.stringify(server);
        notifyListeners(key);
        return;
      }

      if (server === null) {
        // Hanya lokal punya data → push
        const localStr = JSON.stringify(local);
        if (localSnapshots.current[key] !== localStr) {
          await pushToServer(key, local);
          localSnapshots.current[key] = localStr;
        }
        return;
      }

      // Keduanya punya data → merge (lokal menang per item)
      // Deteksi item yang dihapus lokal: ada di snapshot lama, hilang di lokal sekarang
      let excluded: Set<string> | undefined;
      if (Array.isArray(local) && localSnapshots.current[key]) {
        try {
          const prevArr = JSON.parse(localSnapshots.current[key]);
          if (Array.isArray(prevArr)) {
            const prevKeys = new Set(prevArr.map((i: any) => itemKey(key, i)));
            const curKeys = new Set(local.map((i: any) => itemKey(key, i)));
            const deleted = new Set<string>();
            prevKeys.forEach(k => { if (!curKeys.has(k)) deleted.add(k); });
            if (deleted.size > 0) excluded = deleted;
          }
        } catch {}
      }

      const merged = mergeAny(key, local, server, excluded);
      const localStr = JSON.stringify(local);
      const mergedStr = JSON.stringify(merged);

      if (mergedStr !== localStr) {
        writeLocal(key, merged);
        localSnapshots.current[key] = mergedStr;
        notifyListeners(key);
      } else {
        localSnapshots.current[key] = localStr;
      }

      if (JSON.stringify(server) !== mergedStr) {
        await pushToServer(key, merged);
      }
    } catch {}
  };

  // Initial sync
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      for (const key of SYNC_KEYS) await syncKey(key);
      notifyListeners('init');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling 5 detik: tarik perubahan user lain + dorong perubahan lokal
  useEffect(() => {
    const timer = setInterval(async () => {
      for (const key of SYNC_KEYS) await syncKey(key);
    }, SYNC_INTERVAL);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Event hapus global: komponen dispatch 'global-data-reset' { key } ──
  useEffect(() => {
    const onReset = async (e: Event) => {
      const detail = (e as CustomEvent).detail as { key?: string } | undefined;
      const keys = detail?.key ? [detail.key] : SYNC_KEYS;
      for (const key of keys) {
        try { localStorage.removeItem(key); } catch {}
        delete localSnapshots.current[key];
        await deleteOnServer(key);
        notifyListeners(key);
      }
    };
    window.addEventListener('global-data-reset', onReset);
    return () => window.removeEventListener('global-data-reset', onReset);
  }, []);

  return <>{children}</>;
}
