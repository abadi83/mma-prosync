'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BellIcon } from '@/app/components/BellIcon';
import { useUser } from '@/app/hooks/useUser';
import { DEVICE_ID_KEY, type SyncDevice } from '@/app/lib/deviceIdentity';
import Link from 'next/link';

/* Waktu relatif singkat: "baru saja", "2 mnt lalu", "3 jam lalu" */
function relTime(ts: number, now: number): string {
  if (!ts) return '—';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 10) return 'baru saja';
  if (s < 60) return `${s} dtk lalu`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

/* mma_kas_kecil → "Kas kecil" */
function keyLabel(k: string | null): string {
  if (!k) return 'data';
  const clean = k.replace(/^mma_/, '').replace(/_/g, ' ');
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function AppHeader() {
  const [logo, setLogo] = useState('');
  const [namaToko, setNamaToko] = useState('');
  const [unread, setUnread] = useState(0);
  const { nama } = useUser();
  // Status sinkron & pemakaian penyimpanan browser (per perangkat)
  const [syncStatus, setSyncStatus] = useState<{ at: number; ok: boolean } | null>(null);
  const [storagePct, setStoragePct] = useState<number | null>(null);
  // Panel perangkat: siapa update terakhir & siapa sudah sinkron
  const [devices, setDevices] = useState<SyncDevice[]>([]);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const devicesRef = useRef<HTMLDivElement>(null);

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

  // Daftar perangkat dari server (siapa update terakhir & siapa sudah sinkron)
  useEffect(() => {
    const refresh = (e?: Event) => {
      try {
        const detail = (e as CustomEvent)?.detail;
        if (detail && Array.isArray(detail.devices)) {
          setDevices(detail.devices as SyncDevice[]);
          setNow(Date.now());
          return;
        }
        const raw = localStorage.getItem('mma_sync_devices');
        if (raw) { setDevices(JSON.parse(raw)); setNow(Date.now()); }
      } catch {}
    };
    refresh();
    window.addEventListener('sync-devices-updated', refresh);
    const timer = setInterval(() => refresh(), 10000);
    const clock = setInterval(() => setNow(Date.now()), 15000); // biar "x mnt lalu" tetap segar
    return () => {
      window.removeEventListener('sync-devices-updated', refresh);
      clearInterval(timer);
      clearInterval(clock);
    };
  }, []);

  // Tutup panel saat klik di luar
  useEffect(() => {
    if (!devicesOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (devicesRef.current && !devicesRef.current.contains(e.target as Node)) setDevicesOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [devicesOpen]);

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

  // ── Panel perangkat: siapa update terakhir & siapa sudah sinkron ──
  const lastPushAt = devices.reduce((m, d) => Math.max(m, d.lastPushAt || 0), 0);
  const lastUpdater = lastPushAt ? devices.find(d => d.lastPushAt === lastPushAt) : undefined;
  const syncedCount = devices.filter(d => (d.lastSyncAt || 0) >= lastPushAt).length;
  const myDeviceId = (() => { try { return localStorage.getItem(DEVICE_ID_KEY) || ''; } catch { return ''; } })();
  const devicesBadgeClass = devices.length === 0
    ? 'bg-slate-100 text-slate-400'
    : syncedCount >= devices.length
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-amber-100 text-amber-700';

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
        {/* Perangkat tersinkron: klik untuk lihat siapa update terakhir */}
        {devices.length > 0 && (
          <div className="relative" ref={devicesRef}>
            <button
              onClick={() => setDevicesOpen(v => !v)}
              title="Status sinkron antar komputer"
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${devicesBadgeClass} shadow-sm transition hover:brightness-95`}
            >
              💻 <span className="hidden sm:inline">{syncedCount}/{devices.length} sinkron</span>
              <span className="sm:hidden">{syncedCount}/{devices.length}</span>
            </button>
            {devicesOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl">
                <p className="text-[11px] font-bold text-slate-700">💻 Sinkron Antar Komputer</p>
                <div className="mb-2 mt-1 border-b border-slate-100 pb-2">
                  {lastUpdater ? (
                    <p className="text-[11px] leading-4 text-slate-500">
                      Update terakhir: <span className="font-semibold text-slate-700">{lastUpdater.name}</span>
                      {' '}· {keyLabel(lastUpdater.lastKey)} · {relTime(lastUpdater.lastPushAt, now)}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400">Belum ada update data.</p>
                  )}
                </div>
                <ul className="space-y-1.5">
                  {devices.map(d => {
                    const synced = (d.lastSyncAt || 0) >= lastPushAt;
                    const online = now - (d.lastSyncAt || 0) < 60000;
                    const status = !online ? 'Offline' : synced ? 'Sinkron' : 'Belum sinkron';
                    return (
                      <li key={d.id} className="flex items-center gap-2 text-[11px]">
                        <span
                          className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                            !online ? 'bg-slate-300' : synced ? 'bg-emerald-500' : 'bg-amber-400'
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-slate-700">
                            {d.name}
                            {d.id === myDeviceId && <span className="text-slate-400"> (kamu)</span>}
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            {!online
                              ? `Terakhir online ${relTime(d.lastSyncAt, now)}`
                              : synced
                                ? `Sinkron · ${relTime(d.lastSyncAt, now)}`
                                : `Online · belum narik ${keyLabel(d.lastKey || lastUpdater?.lastKey || null)}`}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                            !online ? 'bg-slate-100 text-slate-500' : synced ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                          }`}
                        >
                          {status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
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
