'use client';

import React, { useState } from 'react';

const MOCK_NOTIFIKASI = [
  { id: 'n-1', tipe: 'stok', pesan: '⚠ Stok Minyak Goreng tinggal 8 (min. 10). Segera restock!', dibaca: false, tanggal: '2026-08-02 10:00' },
  { id: 'n-2', tipe: 'stok', pesan: '⚠ Stok Beras Premium tinggal 6 (min. 10). Segera restock!', dibaca: false, tanggal: '2026-08-02 09:30' },
  { id: 'n-3', tipe: 'penjualan', pesan: '📊 Ringkasan penjualan hari ini: Rp 1.845.000 (14 transaksi)', dibaca: true, tanggal: '2026-08-02 08:00' },
  { id: 'n-4', tipe: 'penjualan', pesan: '📊 Ringkasan penjualan kemarin: Rp 2.100.000 (18 transaksi)', dibaca: true, tanggal: '2026-08-01 20:00' },
  { id: 'n-5', tipe: 'stok', pesan: '⚠ Stok Sabun Cuci menipis! Tersisa 5 (min. 10).', dibaca: true, tanggal: '2026-08-01 15:00' },
  { id: 'n-6', tipe: 'sistem', pesan: 'ℹ️ Backup data berhasil dilakukan.', dibaca: true, tanggal: '2026-08-01 03:00' },
];

export default function NotifikasiPage() {
  const [list, setList] = useState(MOCK_NOTIFIKASI);
  const [filter, setFilter] = useState<'semua' | 'stok' | 'penjualan' | 'sistem'>('semua');

  const filtered = filter === 'semua' ? list : list.filter((n) => n.tipe === filter);
  const unread = list.filter((n) => !n.dibaca).length;

  const markAllRead = () => setList((prev) => prev.map((n) => ({ ...n, dibaca: true })));

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="rounded-3xl bg-gradient-to-br from-brand-700 via-brand-500 to-brand-300 p-5 text-white shadow-lg sm:p-7">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-100 sm:text-sm">Notifikasi</p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Notifikasi</h1>
          </div>
          {unread > 0 && (
            <button onClick={markAllRead} className="rounded-xl bg-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/30">
              ✅ Tandai Semua Dibaca
            </button>
          )}
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm">
        {(['semua', 'stok', 'penjualan', 'sistem'] as const).map((t) => (
          <button key={t} onClick={() => setFilter(t)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${filter === t ? 'bg-brand-500 text-white shadow' : 'text-slate-600 hover:bg-brand-50'}`}>
            {t === 'semua' ? `📋 Semua (${unread})` : t === 'stok' ? '⚠ Stok' : t === 'penjualan' ? '📊 Penjualan' : 'ℹ️ Sistem'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((n) => (
          <div key={n.id} className={`rounded-2xl border p-4 transition ${n.dibaca ? 'border-slate-100 bg-white' : 'border-brand-200 bg-brand-50/50'}`}>
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm ${n.dibaca ? 'text-slate-600' : 'font-semibold text-slate-800'}`}>{n.pesan}</p>
              {!n.dibaca && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500 mt-1.5" />}
            </div>
            <p className="mt-2 text-xs text-slate-400">{n.tanggal}</p>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-8 text-center text-slate-400">Tidak ada notifikasi.</p>}
      </div>
    </main>
  );
}
