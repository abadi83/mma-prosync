'use client';

import React from 'react';

interface CashItem {
  sumber: string;
  jumlah: number;
}

export interface ArusKasData {
  saldoAwal: number;
  pemasukan: CashItem[];
  pengeluaran: CashItem[];
}

interface Props {
  data: ArusKasData;
  periode: string;
}

export function ArusKasReport({ data, periode }: Props) {
  const totalMasuk = data.pemasukan.reduce((s, i) => s + i.jumlah, 0);
  const totalKeluar = data.pengeluaran.reduce((s, i) => s + i.jumlah, 0);
  const saldoAkhir = data.saldoAwal + totalMasuk - totalKeluar;
  const netCash = saldoAkhir - data.saldoAwal;

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">
        💵 Laporan Arus Kas — {periode}
      </h2>

      {/* Ringkasan */}
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <SummaryCard label="Saldo Awal" value={data.saldoAwal} color="slate" />
        <SummaryCard label="Pemasukan" value={totalMasuk} color="emerald" />
        <SummaryCard label="Pengeluaran" value={totalKeluar} color="red" />
        <SummaryCard label="Saldo Akhir" value={saldoAkhir} color="brand" highlight />
      </div>

      {/* Waterfall */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
        <div className="bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-brand-500">
          Aliran Kas
        </div>

        {/* Saldo Awal */}
        <div className="flex items-center justify-between bg-white px-4 py-3">
          <span className="text-sm font-medium text-slate-700">🏁 Saldo Awal</span>
          <span className="text-sm font-bold text-slate-700">Rp {data.saldoAwal.toLocaleString('id-ID')}</span>
        </div>

        {/* Pemasukan */}
        {data.pemasukan.map((item, i) => (
          <div key={i} className="flex items-center justify-between bg-emerald-50/40 px-4 py-2.5">
            <span className="pl-4 text-sm text-slate-600">{item.sumber}</span>
            <span className="text-sm font-semibold text-emerald-600">+ Rp {item.jumlah.toLocaleString('id-ID')}</span>
          </div>
        ))}

        {/* Pengeluaran */}
        {data.pengeluaran.map((item, i) => (
          <div key={i} className="flex items-center justify-between bg-red-50/30 px-4 py-2.5">
            <span className="pl-4 text-sm text-slate-600">{item.sumber}</span>
            <span className="text-sm font-semibold text-red-500">- Rp {item.jumlah.toLocaleString('id-ID')}</span>
          </div>
        ))}

        {/* Saldo Akhir */}
        <div className="flex items-center justify-between bg-brand-100/70 px-4 py-4">
          <span className="text-sm font-bold text-brand-700">🏁 Saldo Akhir</span>
          <span className="text-base font-bold text-brand-700">Rp {saldoAkhir.toLocaleString('id-ID')}</span>
        </div>
      </div>

      {/* Net Cash Flow */}
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-4">
        <span className="text-sm font-semibold text-slate-600">Arus Kas Bersih</span>
        <span className={`text-lg font-bold ${netCash >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {netCash >= 0 ? '+' : ''}Rp {netCash.toLocaleString('id-ID')}
        </span>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  highlight,
}: {
  label: string;
  value: number;
  color: 'brand' | 'emerald' | 'red' | 'slate';
  highlight?: boolean;
}) {
  const c = {
    brand: { bg: 'from-brand-50 to-brand-100', text: 'text-brand-700', sub: 'text-brand-500' },
    emerald: { bg: 'from-emerald-50 to-emerald-100', text: 'text-emerald-700', sub: 'text-emerald-500' },
    red: { bg: 'from-red-50 to-red-100', text: 'text-red-600', sub: 'text-red-400' },
    slate: { bg: 'from-slate-50 to-slate-100', text: 'text-slate-700', sub: 'text-slate-500' },
  }[color];

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${c.bg} p-3 text-center shadow-sm sm:p-4 ${highlight ? 'ring-2 ring-brand-300' : ''}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${c.sub}`}>{label}</p>
      <p className={`mt-1 text-base font-bold sm:text-xl ${c.text}`}>
        Rp {value.toLocaleString('id-ID')}
      </p>
    </div>
  );
}
