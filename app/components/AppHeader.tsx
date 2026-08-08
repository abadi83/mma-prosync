'use client';

import React, { useState, useEffect } from 'react';
import { BellIcon } from '@/app/components/BellIcon';
import Link from 'next/link';

const UNREAD = 2;

export function AppHeader() {
  const [logo, setLogo] = useState('');
  const [nama, setNama] = useState('');

  useEffect(() => {
    setLogo(localStorage.getItem('mma_logo_toko') || '');
    setNama(localStorage.getItem('mma_nama_toko') || '');
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
        {nama && <span className="hidden sm:block text-sm font-bold text-slate-700">{nama}</span>}
      </Link>

      {/* Kanan: Notifikasi */}
      <BellIcon count={UNREAD} onClick={() => window.location.href = '/notifikasi'} />
    </header>
  );
}
