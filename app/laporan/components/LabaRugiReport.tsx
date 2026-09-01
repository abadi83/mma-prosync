'use client';

import React from 'react';

export interface LabaRugiData {
  pendapatan: number;
  hargaPokok: number;
  biayaOperasional: number;
  biayaLain: number;
  labaKotor: number;
  labaBersih: number;
  pendapatanLain?: number;
}

export interface LabaRugiExtra {
  feeMarketplace: number;
  hppMarketplace: number;
  breakdownPerToko: {
    tokoNama: string;
    marketplace: string;
    pendapatanKotor: number;
    fee: number;
    pendapatanBersih: number;
    hpp: number;
    labaKotor: number;
    orderCount: number;
  }[];
  filterToko: string;
  kasirTotal: number;
  kasirBreakdown: {
    tanggal: string;
    jam: string;
    produk: string;
    sku: string;
    qty: number;
    diskon: number;
    total: number;
    pelanggan: string;
    metode: string;
  }[];
  penjualanLainBreakdown: {
    tanggal: string;
    kategori: string;
    keterangan: string;
    jumlah: number;
    kas: string;
  }[];
  biayaBreakdown: { kategori: string; jumlah: number }[];
  opexBreakdown: { kategori: string; jumlah: number }[];
}

interface Props {
  data: LabaRugiData;
  periode: string;
  extra?: LabaRugiExtra;
}

export function LabaRugiReport({ data, periode, extra }: Props) {
  const pendapatanBersih = data.labaKotor;
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

        {/* Sub-rincian sumber pendapatan */}
        {extra && (extra.kasirTotal > 0 || (data.pendapatan - extra.kasirTotal) > 0) && (
          <div className="bg-white px-4 pb-2">
            <div className="flex items-center justify-between px-4 py-1">
              <span className="text-xs text-slate-500 pl-4">· Penjualan Kasir</span>
              <span className="text-xs font-semibold text-slate-600">Rp {extra.kasirTotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-1">
              <span className="text-xs text-slate-500 pl-4">· Marketplace</span>
              <span className="text-xs font-semibold text-slate-600">Rp {(data.pendapatan - extra.kasirTotal).toLocaleString('id-ID')}</span>
            </div>
          </div>
        )}

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

        {/* Pendapatan Lain-lain (di luar kasir & marketplace) */}
        {(data.pendapatanLain || 0) > 0 && (
          <div className="flex items-center justify-between bg-white px-4 py-3">
            <span className="text-sm text-slate-600 pl-4">➕ Pendapatan Lain-lain (Kardus, Barang Afkir, dsb.)</span>
            <span className="text-sm font-semibold text-emerald-600">+ Rp {data.pendapatanLain!.toLocaleString('id-ID')}</span>
          </div>
        )}

        {/* Biaya Operasional */}
        <div className="flex items-center justify-between bg-white px-4 py-3">
          <span className="text-sm text-slate-600 pl-4">➖ Biaya Operasional</span>
          <span className="text-sm font-semibold text-red-500">- Rp {data.biayaOperasional.toLocaleString('id-ID')}</span>
        </div>

        {/* Fee Marketplace (dipisah dari OPEX) */}
        {(extra?.feeMarketplace || 0) > 0 && (
          <div className="flex items-center justify-between bg-slate-50/50 px-4 py-3">
            <span className="text-sm text-slate-600 pl-4">➖ Fee Marketplace</span>
            <span className="text-sm font-semibold text-red-500">- Rp {extra!.feeMarketplace.toLocaleString('id-ID')}</span>
          </div>
        )}

        {/* Biaya Lain-lain (OPEX murni — tanpa fee marketplace) */}
        {(data.biayaLain - (extra?.feeMarketplace || 0)) > 0 && (
          <div className="flex items-center justify-between bg-slate-50/50 px-4 py-3">
            <span className="text-sm text-slate-600 pl-4">➖ Biaya Lain-lain (OPEX)</span>
            <span className="text-sm font-semibold text-red-500">- Rp {(data.biayaLain - (extra?.feeMarketplace || 0)).toLocaleString('id-ID')}</span>
          </div>
        )}

        {/* Laba Bersih */}
        <div className={`flex items-center justify-between px-4 py-4 ${labaBersih >= 0 ? 'bg-brand-100/70' : 'bg-red-100/70'}`}>
          <span className={`text-sm font-bold ${labaBersih >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
            = {labaBersih >= 0 ? 'Laba' : 'Rugi'} Bersih
          </span>
          <span className={`text-base font-bold ${labaBersih >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
            Rp {Math.abs(labaBersih).toLocaleString('id-ID')}
          </span>
        </div>

        {/* ── Persentase ── */}
        <div className="flex flex-wrap gap-2 px-4 py-3 bg-slate-50/50">
          <span className="rounded-full bg-red-100 px-3 py-1 text-[10px] font-semibold text-red-700">
            🛒 Fee/Omset: {data.pendapatan > 0 ? ((data.biayaOperasional + data.biayaLain) / data.pendapatan * 100).toFixed(1) : '0'}%
          </span>
          <span className="rounded-full bg-purple-100 px-3 py-1 text-[10px] font-semibold text-purple-700">
            📦 HPP/Omset: {data.pendapatan > 0 ? (data.hargaPokok / data.pendapatan * 100).toFixed(1) : '0'}%
          </span>
          <span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${labaBersih >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            📈 Margin: {data.pendapatan > 0 ? (labaBersih / data.pendapatan * 100).toFixed(1) : '0'}%
          </span>
        </div>
      </div>

      {/* ── Breakdown Biaya Operasional & OPEX per kategori ── */}
      {extra && (extra.biayaBreakdown.length > 0 || extra.opexBreakdown.length > 0) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {extra.biayaBreakdown.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <div className="bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                💸 Breakdown Biaya Operasional
              </div>
              <div className="divide-y divide-slate-50 bg-white">
                {extra.biayaBreakdown.map((k, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2 text-xs">
                    <span className="text-slate-600">{k.kategori}</span>
                    <span className="font-semibold text-red-500">Rp {k.jumlah.toLocaleString('id-ID')}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-red-50/50 px-4 py-2 text-xs font-bold">
                  <span className="text-red-600">Total</span>
                  <span className="text-red-600">Rp {extra.biayaBreakdown.reduce((s, k) => s + k.jumlah, 0).toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>
          )}
          {extra.opexBreakdown.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <div className="bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                🛒 Breakdown OPEX (Biaya Lain-lain)
              </div>
              <div className="divide-y divide-slate-50 bg-white">
                {extra.opexBreakdown.map((k, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2 text-xs">
                    <span className="text-slate-600">{k.kategori}</span>
                    <span className="font-semibold text-red-500">Rp {k.jumlah.toLocaleString('id-ID')}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-red-50/50 px-4 py-2 text-xs font-bold">
                  <span className="text-red-600">Total</span>
                  <span className="text-red-600">Rp {extra.opexBreakdown.reduce((s, k) => s + k.jumlah, 0).toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Marketplace Fee & HPP Breakdown ── */}
      {extra && (extra.feeMarketplace > 0 || extra.hppMarketplace > 0) && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-purple-100">
          <div className="bg-purple-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-purple-600">
            🛒 Rincian Marketplace {extra.filterToko !== 'semua' ? `— ${extra.filterToko}` : ''}
          </div>
          <div className="divide-y divide-slate-50 bg-white">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-slate-600 pl-4">Total Fee Marketplace</span>
              <span className="text-xs font-semibold text-red-500">− Rp {extra.feeMarketplace.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-slate-600 pl-4">Total HPP Marketplace</span>
              <span className="text-xs font-semibold text-red-500">− Rp {extra.hppMarketplace.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Breakdown per Toko ── */}
      {extra && extra.breakdownPerToko.length > 0 && extra.filterToko === 'semua' && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
          <div className="bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            🏪 Breakdown per Toko
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[10px]">
              <thead><tr className="bg-slate-50 text-slate-500">
                <th className="px-2 py-2 font-semibold">Toko</th>
                <th className="px-2 py-2 font-semibold">MP</th>
                <th className="px-2 py-2 font-semibold text-right">Kotor</th>
                <th className="px-2 py-2 font-semibold text-right">Fee</th>
                <th className="px-2 py-2 font-semibold text-right">Bersih</th>
                <th className="px-2 py-2 font-semibold text-right">HPP</th>
                <th className="px-2 py-2 font-semibold text-right">Laba</th>
                <th className="px-2 py-2 font-semibold text-center">Order</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50 bg-white">
                {extra.breakdownPerToko.sort((a,b) => b.labaKotor - a.labaKotor).map((t, i) => (
                  <tr key={i} className="hover:bg-purple-50/30">
                    <td className="px-2 py-1.5 font-medium text-slate-700 max-w-[100px] truncate">{t.tokoNama}</td>
                    <td className="px-2 py-1.5 text-slate-400">{t.marketplace}</td>
                    <td className="px-2 py-1.5 text-right">Rp {t.pendapatanKotor.toLocaleString('id-ID')}</td>
                    <td className="px-2 py-1.5 text-right text-red-500">−{t.fee.toLocaleString('id-ID')}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-emerald-600">Rp {t.pendapatanBersih.toLocaleString('id-ID')}</td>
                    <td className="px-2 py-1.5 text-right text-purple-600">−{t.hpp.toLocaleString('id-ID')}</td>
                    <td className={`px-2 py-1.5 text-right font-bold ${t.labaKotor >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      Rp {t.labaKotor.toLocaleString('id-ID')}
                    </td>
                    <td className="px-2 py-1.5 text-center text-slate-400">{t.orderCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Breakdown Penjualan Kasir ── */}
      {extra && extra.kasirBreakdown.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
          <div className="bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            🧾 Breakdown Penjualan Kasir ({extra.kasirBreakdown.length} transaksi)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[10px]">
              <thead><tr className="bg-slate-50 text-slate-500">
                <th className="px-2 py-2 font-semibold">Tanggal</th>
                <th className="px-2 py-2 font-semibold">Produk</th>
                <th className="px-2 py-2 font-semibold text-center">Qty</th>
                <th className="px-2 py-2 font-semibold text-right">Diskon</th>
                <th className="px-2 py-2 font-semibold text-right">Total</th>
                <th className="px-2 py-2 font-semibold">Pelanggan</th>
                <th className="px-2 py-2 font-semibold text-center">Metode</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50 bg-white">
                {[...extra.kasirBreakdown].sort((a, b) => b.tanggal.localeCompare(a.tanggal)).map((t, i) => (
                  <tr key={`${t.tanggal}-${t.sku}-${i}`} className="hover:bg-brand-50/30">
                    <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">{t.tanggal}{t.jam ? ` ${t.jam}` : ''}</td>
                    <td className="px-2 py-1.5 font-medium text-slate-700 max-w-[180px] truncate" title={`${t.produk} (${t.sku})`}>{t.produk}</td>
                    <td className="px-2 py-1.5 text-center text-slate-600">{t.qty}</td>
                    <td className="px-2 py-1.5 text-right text-red-400">{t.diskon > 0 ? `−${t.diskon.toLocaleString('id-ID')}` : '—'}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-brand-700">Rp {t.total.toLocaleString('id-ID')}</td>
                    <td className="px-2 py-1.5 text-slate-600 max-w-[100px] truncate">{t.pelanggan}</td>
                    <td className="px-2 py-1.5 text-center">{t.metode === 'cash' ? '💵' : t.metode === 'transfer' ? '🏦' : '—'}</td>
                  </tr>
                ))}
                <tr className="bg-brand-50/60">
                  <td colSpan={4} className="px-2 py-2 font-bold text-slate-700">Total Penjualan Kasir</td>
                  <td className="px-2 py-2 text-right font-bold text-brand-700">Rp {extra.kasirTotal.toLocaleString('id-ID')}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Breakdown Pendapatan Lain-lain ── */}
      {extra && extra.penjualanLainBreakdown.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
          <div className="bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            🧾 Breakdown Pendapatan Lain-lain ({extra.penjualanLainBreakdown.length} catatan)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[10px]">
              <thead><tr className="bg-slate-50 text-slate-500">
                <th className="px-2 py-2 font-semibold">Tanggal</th>
                <th className="px-2 py-2 font-semibold">Kategori</th>
                <th className="px-2 py-2 font-semibold">Keterangan</th>
                <th className="px-2 py-2 font-semibold text-center">Kas</th>
                <th className="px-2 py-2 font-semibold text-right">Jumlah</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50 bg-white">
                {[...extra.penjualanLainBreakdown].sort((a, b) => b.tanggal.localeCompare(a.tanggal)).map((x, i) => (
                  <tr key={`${x.tanggal}-${i}`} className="hover:bg-indigo-50/30">
                    <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">{x.tanggal}</td>
                    <td className="px-2 py-1.5 font-medium text-slate-700">{x.kategori}</td>
                    <td className="px-2 py-1.5 text-slate-600 max-w-[200px] truncate" title={x.keterangan}>{x.keterangan || '-'}</td>
                    <td className="px-2 py-1.5 text-center">{x.kas === 'besar' ? '🏦 Besar' : x.kas === 'kecil' ? '🟡 Kecil' : '—'}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-emerald-600">Rp {x.jumlah.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
                <tr className="bg-indigo-50/50">
                  <td colSpan={4} className="px-2 py-2 font-bold text-slate-700">Total Pendapatan Lain-lain</td>
                  <td className="px-2 py-2 text-right font-bold text-emerald-700">Rp {(data.pendapatanLain || 0).toLocaleString('id-ID')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

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
