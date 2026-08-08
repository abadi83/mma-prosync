'use client';

import React, { useState } from 'react';

interface StokItem {
  nama: string;
  stok: number;
  nilai: number;
  kategori: string;
}

export interface LaporanStokData {
  totalItem: number;
  totalNilai: number;
  items: StokItem[];
}

interface Props {
  data: LaporanStokData;
  periode: string;
}

export function LaporanStokReport({ data, periode }: Props) {
  const [sortBy, setSortBy] = useState<'nama' | 'stok' | 'nilai'>('nama');
  const [search, setSearch] = useState('');

  const filtered = data.items
    .filter(
      (item) =>
        item.nama.toLowerCase().includes(search.toLowerCase()) ||
        item.kategori.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      if (sortBy === 'nama') return a.nama.localeCompare(b.nama);
      if (sortBy === 'stok') return a.stok - b.stok;
      return a.nilai - b.nilai;
    });

  const maxNilai = Math.max(...data.items.map((i) => i.nilai), 1);

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">
        📦 Laporan Stok — {periode}
      </h2>

      {/* Ringkasan */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 p-4 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Total Item</p>
          <p className="mt-1 text-2xl font-bold text-brand-700">{data.totalItem}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Total Nilai Inventaris</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">Rp {data.totalNilai.toLocaleString('id-ID')}</p>
        </div>
      </div>

      {/* Filter + Sort */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Cari produk..."
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none sm:max-w-xs"
        />
        <span className="text-xs text-slate-400">Urut:</span>
        {(['nama', 'stok', 'nilai'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
              sortBy === s ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-brand-50'
            }`}
          >
            {s === 'nama' ? 'Nama' : s === 'stok' ? 'Stok' : 'Nilai'}
          </button>
        ))}
      </div>

      {/* Tabel */}
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-brand-50 text-xs uppercase text-brand-500">
              <th className="px-3 py-3 font-semibold">Produk</th>
              <th className="px-3 py-3 font-semibold">Kategori</th>
              <th className="px-3 py-3 font-semibold">Stok</th>
              <th className="px-3 py-3 font-semibold">Nilai (Rp)</th>
              <th className="px-3 py-3 font-semibold">Proporsi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  Tidak ada produk ditemukan.
                </td>
              </tr>
            ) : (
              filtered.map((item, i) => {
                const barPct = Math.min((item.nilai / maxNilai) * 100, 100);
                return (
                  <tr key={i} className={`transition hover:bg-brand-50/50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="px-3 py-3 font-medium text-slate-800">{item.nama}</td>
                    <td className="px-3 py-3 text-slate-600">{item.kategori}</td>
                    <td className="px-3 py-3 font-semibold text-slate-700">{item.stok}</td>
                    <td className="px-3 py-3 font-semibold text-brand-700">Rp {item.nilai.toLocaleString('id-ID')}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-brand-400 transition-all"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400">{barPct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
