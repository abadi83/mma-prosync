'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BellIcon } from '@/app/components/BellIcon';
import { useUser } from '@/app/hooks/useUser';
import Link from 'next/link';

export function AppHeader() {
  const [logo, setLogo] = useState('');
  const [namaToko, setNamaToko] = useState('');
  const [unread, setUnread] = useState(0);
  const { nama } = useUser();
  // Status sinkron & pemakaian penyimpanan browser (per perangkat)
  const [syncStatus, setSyncStatus] = useState<{ at: number; ok: boolean } | null>(null);
  const [storagePct, setStoragePct] = useState<number | null>(null);

  useEffect(() => {
    const refreshSync = async () => {
      try {
        const raw = localStorage.getItem('mma_sync_status');
        setSyncStatus(raw ? JSON.parse(raw) : null);
        if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
          const est = await navigator.storage.estimate();
          if (est && est.quota) setStoragePct(Math.round(((est.usage || 0) / est.quota) * 100));
        }
      } catch {}
    };
    refreshSync();
    window.addEventListener('sync-status-updated', refreshSync);
    window.addEventListener('sync-storage-error', refreshSync);
    window.addEventListener('storage', refreshSync);
    const timer = setInterval(refreshSync, 10000);
    return () => {
      window.removeEventListener('sync-status-updated', refreshSync);
      window.removeEventListener('sync-storage-error', refreshSync);
      window.removeEventListener('storage', refreshSync);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const refresh = () => {
      setLogo(localStorage.getItem('mma_logo_toko') || '');
      setNamaToko(localStorage.getItem('mma_nama_toko') || '');
    };
    refresh();
    // Live update: kalau admin simpan info toko di tab/user lain,
    // sync provider broadcast event → header langsung ikut berubah
    window.addEventListener('shared-data-updated', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('refresh-toko-info', refresh);
    return () => {
      window.removeEventListener('shared-data-updated', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('refresh-toko-info', refresh);
    };
  }, []);

  // Badge notifikasi live dari server (unread count), refresh tiap 20 detik
  useEffect(() => {
    const refreshUnread = () => {
      fetch('/api/notifikasi?count=1', { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => setUnread(typeof data.jumlah === 'number' ? data.jumlah : 0))
        .catch(() => {});
    };
    refreshUnread();
    const timer = setInterval(refreshUnread, 20000);
    window.addEventListener('notifikasi-updated', refreshUnread);
    return () => {
      clearInterval(timer);
      window.removeEventListener('notifikasi-updated', refreshUnread);
    };
  }, []);

  const handleLogout = useCallback(() => {
    // Hapus cookies
    document.cookie = 'auth_token=;path=/;max-age=0';
    document.cookie = 'user_name=;path=/;max-age=0';
    document.cookie = 'user_role=;path=/;max-age=0';
    document.cookie = 'user_roles=;path=/;max-age=0';
    document.cookie = 'user_pegawai_id=;path=/;max-age=0';
    // Hapus session localStorage
    try { localStorage.removeItem('mma_user_session'); } catch {}
    // Redirect ke login
    window.location.href = '/login';
  }, []);

  // Badge status sinkron (per perangkat) — biar tahu kenapa data belum muncul
  const syncAge = syncStatus ? Math.round((Date.now() - syncStatus.at) / 1000) : null;
  let syncBadge = null;
  if (storagePct !== null && storagePct >= 95) {
    syncBadge = (
      <span title={`Penyimpanan browser perangkat ini hampir penuh (${storagePct}%) — data baru TIDAK bisa tersimpan. Hapus PO/foto lama di Arsip Invoice.`}
        className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold text-red-600">
        ⚠️ Penyimpanan Penuh
      </span>
    );
  } else if (syncStatus && !syncStatus.ok) {
    syncBadge = (
      <span title="Tidak bisa terhubung ke server — cek internet lalu buka ulang halaman ini."
        className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold text-red-600">
        🔴 Sinkron Gagal
      </span>
    );
  } else if (syncStatus && syncStatus.ok && syncAge !== null && syncAge > 20) {
    syncBadge = (
      <span title={`Sinkron terakhir ${syncAge} detik lalu — buka/fokus halaman ini untuk menyinkronkan.`}
        className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-600">
        🟡 Sinkron…
      </span>
    );
  } else if (syncStatus && syncStatus.ok) {
    syncBadge = (
      <span title={`Tersinkron ${syncAge} detik lalu.`}
        className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-600">
        🟢 Sinkron
      </span>
    );
  }

  return (
    <header className="fixed left-4 right-4 top-0 z-40 flex items-center justify-between px-2 py-2">
      {/* Kiri: Logo + Nama Toko */}
      <Link href="/" className="flex items-center gap-2 no-underline">
        {logo ? (
          <img src={logo} alt="Logo" className="h-8 w-8 rounded-lg object-cover shadow-sm" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white shadow-sm">
            🏪
          </div>
        )}
        {namaToko && <span className="hidden sm:block text-sm font-bold text-slate-700">{namaToko}</span>}
      </Link>

      {/* Kanan: User + Notifikasi + Logout */}
      <div className="flex items-center gap-3">
        {nama && (
          <span className="hidden sm:block text-xs font-medium text-slate-500 max-w-[120px] truncate">
            👤 {nama}
          </span>
        )}
        {syncBadge}
        <BellIcon count={unread} onClick={() => window.location.href = '/notifikasi'} />
        <button
          onClick={handleLogout}
          className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-red-600"
          title="Keluar"
        >
          🚪 Keluar
        </button>
      </div>
    </header>
  );
}
