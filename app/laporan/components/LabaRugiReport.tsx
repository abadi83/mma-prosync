'use client';

import React from 'react';

export interface LabaRugiData {
  pendapatan: number;
  hargaPokok: number;
  biayaOperasional: number;
  biayaLain: number;
  labaKotor: number;
  labaBersih: number;
}

interface Props {
  data: LabaRugiData;
  periode: string;
}

export function LabaRugiReport({ data, periode }: Props) {
  const pendapatanBersih = data.labaKotor; // setelah HPP
  const totalBiaya = data.biayaOperasional + data.biayaLain;
  const labaBersih = data.labaBersih;
  const marginKotor = data.pendapatan > 0 ? ((pendapatanBersih / data.pendapatan) * 100).toFixed(1) : '0';
  const marginBersih = data.pendapatan > 0 ? ((labaBersih / data.pendapatan) * 100).toFixed(1) : '0';

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">
        📈 Laporan Laba Rugi — {periode}
      </h2>

      {/* Ringkasan Utama */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Pendapatan Kotor" value={data.pendapatan} color="slate" />
        <SummaryCard label="Pendapatan Bersih" value={pendapatanBersih} sub={`Setelah HPP · Margin ${marginKotor}%`} color="emerald" highlight />
        <SummaryCard label="Laba/Rugi" value={labaBersih} sub={`Margin ${marginBersih}%`} color={labaBersih >= 0 ? 'brand' : 'red'} highlight />
      </div>

      {/* Rincian P&L */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
        <div className="bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-brand-500">
          Rincian Laba Rugi
        </div>

        {/* Pendapatan Kotor */}
        <div className="flex items-center justify-between bg-white px-4 py-3">
          <span className="text-sm font-medium text-slate-700">➕ Pendapatan Kotor (Penjualan)</span>
          <span className="text-sm font-bold text-slate-700">Rp {data.pendapatan.toLocaleString('id-ID')}</span>
        </div>

        {/* HPP */}
        <div className="flex items-center justify-between bg-red-50/50 px-4 py-3">
          <span className="text-sm text-slate-600 pl-4">➖ Harga Pokok Penjualan (Pembelian)</span>
          <span className="text-sm font-semibold text-red-600">- Rp {data.hargaPokok.toLocaleString('id-ID')}</span>
        </div>

        {/* Pendapatan Bersih */}
        <div className="flex items-center justify-between border-y-2 border-emerald-200 bg-emerald-50/70 px-4 py-3">
          <span className="text-sm font-bold text-emerald-700">= Pendapatan Bersih</span>
          <span className="text-base font-bold text-emerald-700">Rp {pendapatanBersih.toLocaleString('id-ID')}</span>
        </div>

        {/* Biaya Operasional */}
        <div className="flex items-center justify-between bg-white px-4 py-3">
          <span className="text-sm text-slate-600 pl-4">➖ Biaya Operasional</span>
          <span className="text-sm font-semibold text-red-500">- Rp {data.biayaOperasional.toLocaleString('id-ID')}</span>
        </div>

        {/* Biaya Lain */}
        <div className="flex items-center justify-between bg-slate-50/50 px-4 py-3">
          <span className="text-sm text-slate-600 pl-4">➖ Biaya Lain-lain (OPEX)</span>
          <span className="text-sm font-semibold text-red-500">- Rp {data.biayaLain.toLocaleString('id-ID')}</span>
        </div>

        {/* Laba Bersih */}
        <div className={`flex items-center justify-between px-4 py-4 ${labaBersih >= 0 ? 'bg-brand-100/70' : 'bg-red-100/70'}`}>
          <span className={`text-sm font-bold ${labaBersih >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
            = {labaBersih >= 0 ? 'Laba' : 'Rugi'} Bersih
          </span>
          <span className={`text-base font-bold ${labaBersih >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
            Rp {Math.abs(labaBersih).toLocaleString('id-ID')}
          </span>
        </div>
      </div>

      {/* Visual batang */}
      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Visualisasi Margin</p>
        <div className="space-y-2">
          <BarRow label="Margin Kotor" value={parseFloat(marginKotor)} max={100} color="bg-brand-500" />
          <BarRow label="Margin Bersih" value={parseFloat(marginBersih)} max={100} color="bg-emerald-500" />
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  color,
  highlight,
}: {
  label: string;
  value: number;
  sub?: string;
  color: 'brand' | 'emerald' | 'slate' | 'red';
  highlight?: boolean;
}) {
  const c = {
    brand: { bg: 'from-brand-50 to-brand-100', text: 'text-brand-700', sub: 'text-brand-500' },
    emerald: { bg: 'from-emerald-50 to-emerald-100', text: 'text-emerald-700', sub: 'text-emerald-500' },
    slate: { bg: 'from-slate-50 to-slate-100', text: 'text-slate-700', sub: 'text-slate-500' },
    red: { bg: 'from-red-50 to-red-100', text: 'text-red-700', sub: 'text-red-500' },
  }[color];

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${c.bg} p-4 text-center shadow-sm ${highlight ? 'ring-2 ring-brand-300' : ''}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${c.sub}`}>{label}</p>
      <p className={`mt-1 text-xl font-bold sm:text-2xl ${c.text}`}>Rp {value.toLocaleString('id-ID')}</p>
      {sub && <p className={`mt-0.5 text-xs ${c.sub}`}>{sub}</p>}
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 text-slate-600">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right font-semibold text-slate-700">{value}%</span>
    </div>
  );
}
