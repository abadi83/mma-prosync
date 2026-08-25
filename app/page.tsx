'use client';

import React, { useEffect } from 'react';
import { SalesSummary } from '@/app/components/SalesSummary';
import { ShortcutModule } from '@/app/components/ShortcutModule';
import { StockSummary } from '@/app/components/StockSummary';
import AgregasiDashboard from '@/app/components/AgregasiDashboard';
import { useDashboardRefresh } from '@/app/hooks/useDashboardRefresh';
import { useUser } from '@/app/hooks/useUser';
import { canAccessPath } from '@/app/lib/accessControl';

export default function HomePage() {
  const { data, lastUpdated, refresh } = useDashboardRefresh(8000);
  const { nama, roles } = useUser();

  // Peringatan kalau ditolak akses oleh middleware
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const d = p.get('denied');
      if (d) alert(`⛔ Akses ditolak: role kamu tidak punya izin membuka modul ${d}.`);
    } catch {}
  }, []);

  // Filter pintasan modul sesuai role (role ketat)
  const visibleShortcuts = data.shortcuts.filter(s => canAccessPath(roles, s.href));

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-500 to-brand-300 p-5 text-white shadow-lg sm:p-8">
        <div className="absolute right-4 top-4 text-5xl opacity-20 sm:text-7xl">📊</div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-100 sm:text-sm sm:tracking-[0.3em]">
              Grow Forever, Manage Smarter
            </p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Halo, {nama}</h1>
            <p className="mt-2 max-w-2xl text-sm text-brand-100 sm:text-base">
              Pantau stok, penjualan, dan modul utama toko Anda dari satu dashboard yang cepat dan ringkas.
            </p>
          </div>
          <button
            onClick={refresh}
            className="shrink-0 rounded-full bg-white/20 px-3 py-1.5 text-xs text-white backdrop-blur transition hover:bg-white/30 sm:px-4 sm:text-sm"
            title="Refresh data"
          >
            🔄 Segarkan
          </button>
        </div>
        <p className="mt-3 text-xs text-brand-200" suppressHydrationWarning>
          Terakhir diperbarui: {lastUpdated.toLocaleTimeString('id-ID')}
        </p>
      </header>

      <section className="grid gap-5 md:grid-cols-[1.3fr_0.7fr]">
        <StockSummary data={data.stockSummary} />

        <SalesSummary data={data.salesSummary} />
      </section>

      {/* ── Agregasi Pesanan dari Data Entry & Operasional Gudang ── */}
      <AgregasiDashboard />

      <ShortcutModule data={visibleShortcuts} />
    </main>
  );
}
