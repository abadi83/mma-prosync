'use client';

import React, { useState } from 'react';
import { SkuTab } from './SkuTab';
import { SupplierTab } from './SupplierTab';
import { TokoTab } from './TokoTab';
import { PelangganTab } from './PelangganTab';
import { FleetTab } from './FleetTab';
import { TaskHargaTab } from './TaskHargaTab';

type Tab = 'sku' | 'supplier' | 'toko' | 'taskharga' | 'pelanggan' | 'fleet';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'sku', label: 'SKU', icon: '📦' },
  { key: 'supplier', label: 'Supplier', icon: '🏭' },
  { key: 'toko', label: 'Toko Marketplace', icon: '🏬' },
  { key: 'taskharga', label: 'Task Harga', icon: '💲' },
  { key: 'pelanggan', label: 'Pelanggan', icon: '👥' },
  { key: 'fleet', label: 'Fleet', icon: '🚛' },
];

export default function DataMasterPage() {
  const [tab, setTab] = useState<Tab>('sku');

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-3xl bg-gradient-to-br from-brand-700 via-brand-500 to-brand-300 p-5 text-white shadow-lg sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-100 sm:text-sm">Master Data</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Data Master</h1>
        <p className="mt-1 text-sm text-brand-100 sm:text-base">Kelola SKU, supplier, toko marketplace, pelanggan, dan armada kendaraan.</p>
      </header>
      <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm" role="tablist">
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:px-5 sm:text-sm ${tab === t.key ? 'bg-brand-500 text-white shadow' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'}`}>
            <span className="text-base sm:text-lg">{t.icon}</span><span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </nav>
      <section className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50/70 to-white p-5 shadow-sm sm:p-6">
        {tab === 'sku' && <SkuTab />}
        {tab === 'supplier' && <SupplierTab />}
        {tab === 'toko' && <TokoTab />}
        {tab === 'taskharga' && <TaskHargaTab />}
        {tab === 'pelanggan' && <PelangganTab />}
        {tab === 'fleet' && <FleetTab />}
      </section>
    </main>
  );
}
