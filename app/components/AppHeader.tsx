'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BellIcon } from '@/app/components/BellIcon';
import { useUser } from '@/app/hooks/useUser';
import Link from 'next/link';

const UNREAD = 2;

export function AppHeader() {
  const [logo, setLogo] = useState('');
  const [namaToko, setNamaToko] = useState('');
  const { nama } = useUser();

  useEffect(() => {
    setLogo(localStorage.getItem('mma_logo_toko') || '');
    setNamaToko(localStorage.getItem('mma_nama_toko') || '');
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
        <BellIcon count={UNREAD} onClick={() => window.location.href = '/notifikasi'} />
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
