'use client';

import React, { useState, useEffect } from 'react';

interface Notif { id: string; tipe: string; pesan: string; dibaca: boolean; tanggal: string; }

export default function NotifikasiPage() {
  const [list, setList] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'semua' | 'aktivitas' | 'stok' | 'penjualan' | 'sistem'>('semua');

  // ── Muat dari API + auto-refresh tiap 20 detik (notifikasi ikut aktivitas modul) ──
  const load = async () => {
    try {
      const res = await fetch(`/api/notifikasi?t=${Date.now()}`);
      if (res.ok) setList(await res.json());
    } catch {}
    setLoading(false);
  };
  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, []);

  const filtered = filter === 'semua' ? list : list.filter((n) => n.tipe === filter);
  const unread = list.filter((n) => !n.dibaca).length;

  const markAllRead = async () => {
    setList((prev) => prev.map((n) => ({ ...n, dibaca: true })));
    try { await fetch('/api/notifikasi', { method: 'PUT' }); } catch {}
  };

  const markOne = async (id: string) => {
    setList((prev) => prev.map((n) => (n.id === id ? { ...n, dibaca: true } : n)));
    try { await fetch(`/api/notifikasi?id=${encodeURIComponent(id)}`, { method: 'PUT' }); } catch {}
  };

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
        {(['semua', 'aktivitas', 'stok', 'penjualan', 'sistem'] as const).map((t) => (
          <button key={t} onClick={() => setFilter(t)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${filter === t ? 'bg-brand-500 text-white shadow' : 'text-slate-600 hover:bg-brand-50'}`}>
            {t === 'semua' ? `📋 Semua (${unread})` : t === 'aktivitas' ? '👤 Aktivitas' : t === 'stok' ? '⚠ Stok' : t === 'penjualan' ? '📊 Penjualan' : 'ℹ️ Sistem'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? (
          <p className="py-8 text-center text-slate-400">⏳ Memuat notifikasi...</p>
        ) : filtered.map((n) => (
          <div
            key={n.id}
            onClick={() => !n.dibaca && markOne(n.id)}
            className={`rounded-2xl border p-4 transition ${n.dibaca ? 'border-slate-100 bg-white' : 'cursor-pointer border-brand-200 bg-brand-50/50 hover:bg-brand-50'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm ${n.dibaca ? 'text-slate-600' : 'font-semibold text-slate-800'}`}>{n.pesan}</p>
              {!n.dibaca && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500 mt-1.5" />}
            </div>
            <p className="mt-2 text-xs text-slate-400">{n.tanggal}</p>
          </div>
        ))}
        {!loading && filtered.length === 0 && <p className="py-8 text-center text-slate-400">Tidak ada notifikasi.</p>}
      </div>
    </main>
  );
}
