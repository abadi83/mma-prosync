'use client';

import React, { useMemo, useState } from 'react';
import { useSkus, type SkuItem } from '@/app/context/SkuContext';
import { recordActivity } from '@/app/lib/recordActivity';

export function PaketBesarTab() {
  const { skus, setSkus } = useSkus();
  const [search, setSearch] = useState('');

  const paketBesar = useMemo(() => skus.filter(s => s.paketBesar), [skus]);
  const belum = useMemo(() => skus.filter(s => !s.paketBesar), [skus]);

  const q = search.trim().toLowerCase();
  const hasilBesar = q ? paketBesar.filter(s => (s.sku + ' ' + s.nama).toLowerCase().includes(q)) : paketBesar;

  const togglePaketBesar = async (item: SkuItem) => {
    const newVal = !item.paketBesar;
    try {
      await fetch('/api/sku-master', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, paketBesar: newVal }),
      });
    } catch {}
    setSkus(prev => prev.map(x => x.id === item.id ? { ...x, paketBesar: newVal } : x));
    recordActivity([{ modul: 'sku', aksi: newVal ? 'paket-besar' : 'batal-paket-besar', refLabel: item.sku, detail: { nama: item.nama } }]);
  };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div>
        <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🚛 Paket Besar</h2>
        <p className="text-sm text-slate-500">Kelompok SKU yang dianggap paket besar. Otomatis terbaca di QC & wajib video saat packing.</p>
      </div>

      {/* Ringkasan */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-center">
          <p className="text-2xl font-bold text-orange-700">{paketBesar.length}</p>
          <p className="text-xs text-orange-600">SKU Paket Besar</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-2xl font-bold text-slate-600">{belum.length}</p>
          <p className="text-xs text-slate-500">Belum Ditandai</p>
        </div>
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-center">
          <p className="text-2xl font-bold text-brand-700">{skus.length}</p>
          <p className="text-xs text-brand-600">Total SKU</p>
        </div>
      </div>

      {/* Cari */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Cari SKU / nama pada daftar paket besar…"
        className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      />

      {/* Daftar SKU yang sudah ditandai paket besar */}
      <div className="mt-4">
        <p className="text-xs font-bold uppercase text-slate-500">Sudah Ditandai Paket Besar ({hasilBesar.length})</p>
        {hasilBesar.length === 0 ? (
          <p className="mt-2 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
            {q ? 'Tidak ada SKU paket besar yang cocok dengan pencarian.' : 'Belum ada SKU yang ditandai paket besar.'}
          </p>
        ) : (
          <div className="mt-2 overflow-hidden rounded-xl border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-orange-50 text-xs uppercase text-orange-600">
                {['SKU', 'Nama Produk', 'Kategori', 'Aksi'].map(c => <th key={c} className="px-3 py-2 font-semibold whitespace-nowrap">{c}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-50 bg-white">
                {hasilBesar.map(item => (
                  <tr key={item.id} className="hover:bg-orange-50/40">
                    <td className="px-3 py-2 font-mono text-xs text-brand-700">{item.sku}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{item.nama}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{item.kategori || '-'}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => togglePaketBesar(item)} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100">🗑 Batalkan</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SKU belum ditandai (ringkas, untuk penandaan cepat) */}
      <div className="mt-6">
        <p className="text-xs font-bold uppercase text-slate-500">Belum Ditandai ({belum.length})</p>
        <p className="mt-1 text-xs text-slate-400">Tandai cepat dari daftar ini, atau buka tab SKU untuk menandai per SKU.</p>
        <div className="mt-2 flex max-h-72 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-white p-3">
          {belum.length === 0 ? (
            <p className="text-sm text-slate-400">Semua SKU sudah ditandai paket besar.</p>
          ) : (
            belum.map(item => (
              <button
                key={item.id}
                onClick={() => togglePaketBesar(item)}
                title={`${item.nama}${item.kategori ? ` — ${item.kategori}` : ''}`}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-orange-300 hover:text-orange-700"
              >
                {item.sku}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
