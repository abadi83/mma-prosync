'use client';

import { NewsMmaTab } from '@/app/data-entry/components/NewsMmaTab';

export default function NewsMmaPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-500 to-brand-300 p-5 text-white shadow-lg sm:p-7">
        <div className="absolute right-4 top-4 text-5xl opacity-20 sm:text-7xl">📰</div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-100 sm:text-sm">Komunikasi Internal</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">News MMA</h1>
        <p className="mt-1 max-w-xl text-sm text-brand-100 sm:text-base">Buat & kelola berita internal: Morning Briefing, Operational News & Klaim News — otomatis tampil di dashboard.</p>
      </header>

      <section className="card-blue">
        <NewsMmaTab />
      </section>
    </main>
  );
}
