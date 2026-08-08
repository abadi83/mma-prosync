'use client';

import React, { useMemo } from 'react';
import { useAgregasi } from '@/app/context/AgregasiContext';
import Link from 'next/link';

/* ── Helpers ── */
const MP_COLORS: Record<string, string> = {
  Shopee: 'from-orange-400 to-orange-500',
  'TikTok Shop': 'from-slate-600 to-slate-700',
  Lazada: 'from-blue-400 to-blue-600',
  Tokopedia: 'from-emerald-400 to-emerald-600',
};

const MP_BAR_COLORS: Record<string, string> = {
  Shopee: 'bg-orange-400',
  'TikTok Shop': 'bg-slate-600',
  Lazada: 'bg-blue-500',
  Tokopedia: 'bg-emerald-500',
};

const MP_DOT_COLORS: Record<string, string> = {
  Shopee: 'bg-orange-500',
  'TikTok Shop': 'bg-slate-500',
  Lazada: 'bg-blue-500',
  Tokopedia: 'bg-emerald-500',
};

const STATUS_COLORS: Record<string, string> = {
  'Perlu Dikirim': 'bg-amber-400',
  Dipicking: 'bg-blue-400',
  DiQC: 'bg-purple-400',
  Dipacking: 'bg-indigo-400',
  Dikirim: 'bg-emerald-400',
  DiScanRunner: 'bg-cyan-400',
  PendingPickup: 'bg-orange-400',
  Batal: 'bg-red-400',
  Dibatalkan: 'bg-red-400',
  cancelled: 'bg-red-400',
  Selesai: 'bg-green-500',
  delivered: 'bg-green-500',
};

const STATUS_LABEL: Record<string, string> = {
  'Perlu Dikirim': 'Perlu Dikirim',
  Dipicking: 'Picking',
  DiQC: 'QC',
  Dipacking: 'Packing',
  Dikirim: 'Dikirim',
  DiScanRunner: 'Runner',
  PendingPickup: 'Pending',
  Batal: 'Batal',
  Dibatalkan: 'Batal',
  cancelled: 'Batal',
  Selesai: 'Selesai',
  delivered: 'Selesai',
};

/* ── Format Rupiah ── */
function fmtRp(n: number): string {
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}k`;
  return `Rp ${n.toLocaleString('id-ID')}`;
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function AgregasiDashboard() {
  const { allRows } = useAgregasi();

  const stats = useMemo(() => {
    if (allRows.length === 0) return null;

    // Group by noPesanan||noResi (satu "order" bisa multi SKU)
    const orderMap = new Map<string, {
      noPesanan: string;
      noResi: string;
      marketplace: string;
      namaToko: string;
      statusPesanan: string;
      statusProses?: string;
      total: number;
      itemCount: number;
    }>();

    for (const r of allRows) {
      const key = `${r.noPesanan}||${r.noResi}`;
      const exist = orderMap.get(key);
      const itemTotal = (r.hargaJual * r.kuantity) || r.hargaJual;
      if (exist) {
        exist.total += itemTotal;
        exist.itemCount += r.kuantity;
      } else {
        orderMap.set(key, {
          noPesanan: r.noPesanan,
          noResi: r.noResi,
          marketplace: r.marketplace,
          namaToko: r.namaToko,
          statusPesanan: r.statusPesanan,
          statusProses: r.statusProses,
          total: itemTotal,
          itemCount: r.kuantity,
        });
      }
    }

    const orders = Array.from(orderMap.values());

    // Totals
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
    const totalItems = allRows.reduce((s, r) => s + r.kuantity, 0);

    // Picking progress — full workflow sync dengan operasional
    const picked = orders.filter(o =>
      o.statusProses === 'Dipicking' || o.statusProses === 'DiQC' ||
      o.statusProses === 'Dipacking'
    ).length;
    const done = orders.filter(o => o.statusProses === 'Dikirim').length;
    // Pending = belum handover / gagal pickup / masih di runner
    const pending = orders.filter(o =>
      o.statusProses === 'DiScanRunner' || o.statusProses === 'PendingPickup'
    ).length;
    const dibatalkan = orders.filter(o => o.statusProses === 'Dibatalkan').length;

    // Batal / tidak dikirim
    const batalStatuses = ['Batal', 'Dibatalkan', 'cancelled'];
    const batal = orders.filter(o => batalStatuses.includes(o.statusPesanan)).length;
    const revenueBatal = orders
      .filter(o => batalStatuses.includes(o.statusPesanan))
      .reduce((s, o) => s + o.total, 0);
    const revenueAktif = totalRevenue - revenueBatal;

    // Marketplace breakdown
    const mpMap = new Map<string, { orders: number; revenue: number; items: number; toko: Set<string> }>();
    for (const o of orders) {
      const mp = o.marketplace || 'Belum Diketahui';
      const e = mpMap.get(mp) || { orders: 0, revenue: 0, items: 0, toko: new Set<string>() };
      e.orders++;
      e.revenue += o.total;
      e.items += o.itemCount;
      if (o.namaToko) e.toko.add(o.namaToko);
      mpMap.set(mp, e);
    }

    // Max revenue for bar scaling
    const maxRevenue = Math.max(...Array.from(mpMap.values()).map(e => e.revenue), 1);

    // Status breakdown (order status, not gudang status)
    const statusMap = new Map<string, number>();
    for (const o of orders) {
      const s = o.statusPesanan || 'Belum Diketahui';
      statusMap.set(s, (statusMap.get(s) || 0) + 1);
    }

    // Gudang progress (workflow) — hitung per unique order
    const gudangStages = [
      { key: 'Perlu Dikirim', label: 'Perlu', icon: '📋' },
      { key: 'Dipicking', label: 'Picking', icon: '📦' },
      { key: 'DiQC', label: 'QC', icon: '🔍' },
      { key: 'Dipacking', label: 'Pack', icon: '📦' },
      { key: 'DiScanRunner', label: 'Runner', icon: '📱' },
      { key: 'Dikirim', label: 'Kirim', icon: '🚚' },
      { key: 'PendingPickup', label: 'Pending', icon: '⚠️' },
      { key: 'Dibatalkan', label: 'Batal', icon: '❌' },
    ];
    const gudangCounts = gudangStages.map(stage => {
      if (stage.key === 'Perlu Dikirim') {
        // Perlu Dikirim = orders yang belum masuk workflow manapun
        const count = orders.filter(o => !o.statusProses || o.statusProses === 'Perlu Dikirim').length;
        return { ...stage, count };
      }
      const count = orders.filter(o => o.statusProses === stage.key).length;
      return { ...stage, count };
    });
    const maxGudang = Math.max(...gudangCounts.map(g => g.count), 1);
    // Diproses = sudah lewat Perlu Dikirim, exclude pending & batal
    const totalDiproses = orders.filter(o =>
      o.statusProses && o.statusProses !== 'Perlu Dikirim' &&
      o.statusProses !== 'PendingPickup' && o.statusProses !== 'Dibatalkan'
    ).length;
    const totalPending = pending + dibatalkan;

    return {
      totalOrders, totalRevenue, totalItems,
      picked, done, pending, dibatalkan, totalPending, batal, revenueBatal, revenueAktif,
      orders, mpMap, maxRevenue, statusMap,
      gudangCounts, maxGudang, totalDiproses,
    };
  }, [allRows]);

  if (!stats) {
    return (
      <section className="card-blue text-center py-10">
        <p className="text-4xl mb-3">📊</p>
        <p className="font-semibold text-slate-500">Belum ada data pesanan.</p>
        <p className="text-sm text-slate-400 mt-1">
          Upload pesanan dari{' '}
          <Link href="/data-entry" className="text-brand-500 underline">Data Entry</Link>
          {' '}untuk melihat ringkasan di sini.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      {/* ── Judul Section ── */}
      <div>
        <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
        <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📊 Ringkasan Pesanan</h2>
        <p className="mt-1 text-sm text-slate-500">
          {stats.totalOrders} pesanan • {stats.totalItems} item •实时 dari Data Entry & Operasional Gudang
        </p>
      </div>

      {/* ═══════════ STATS CARDS ═══════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 p-4 text-white shadow-sm">
          <p className="text-3xl font-bold">{stats.totalOrders}</p>
          <p className="text-xs mt-1 opacity-80">Total Pesanan</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white shadow-sm">
          <p className="text-xl font-bold">{fmtRp(stats.revenueAktif)}</p>
          <p className="text-xs mt-1 opacity-80">Pendapatan Aktif</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white shadow-sm">
          <p className="text-3xl font-bold">{stats.done}</p>
          <p className="text-xs mt-1 opacity-80">Berhasil Dikirim</p>
        </div>
        <div className={`rounded-2xl p-4 shadow-sm ${stats.totalPending > 0 ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white' : 'bg-white border border-slate-200'}`}>
          <p className={`text-3xl font-bold ${stats.totalPending === 0 ? 'text-slate-300' : ''}`}>{stats.totalPending}</p>
          <p className={`text-xs mt-1 ${stats.totalPending > 0 ? 'opacity-80' : 'text-slate-400'}`}>
            ⏳ Pending
            {stats.pending > 0 && <span className="block text-[10px] opacity-70">🏃 Runner: {stats.pending}</span>}
            {stats.dibatalkan > 0 && <span className="block text-[10px] opacity-70">❌ Batal: {stats.dibatalkan}</span>}
          </p>
        </div>
        <div className={`rounded-2xl p-4 shadow-sm ${stats.batal > 0 ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' : 'bg-white border border-slate-200'}`}>
          <p className={`text-3xl font-bold ${stats.batal === 0 ? 'text-slate-300' : ''}`}>{stats.batal}</p>
          <p className={`text-xs mt-1 ${stats.batal > 0 ? 'opacity-80' : 'text-slate-400'}`}>
            Batal / Tidak Dikirim
            {stats.batal > 0 && <span className="block text-[10px] opacity-70">{fmtRp(stats.revenueBatal)}</span>}
          </p>
        </div>
      </div>

      {/* ═══════════ MARKETPLACE BREAKDOWN ═══════════ */}
      <div className="card-blue">
        <h3 className="text-sm font-bold text-slate-700 mb-4">🛒 Per Marketplace & Toko</h3>
        <div className="space-y-4">
          {Array.from(stats.mpMap.entries())
            .sort(([, a], [, b]) => b.revenue - a.revenue)
            .map(([mp, data]) => {
              const pct = stats.maxRevenue > 0 ? (data.revenue / stats.maxRevenue) * 100 : 0;
              const barColor = MP_BAR_COLORS[mp] || 'bg-slate-400';
              const dotColor = MP_DOT_COLORS[mp] || 'bg-slate-400';
              return (
                <div key={mp}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${dotColor} inline-block`} />
                      <span className="text-sm font-semibold text-slate-700">{mp}</span>
                      {data.toko.size > 0 && (
                        <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={Array.from(data.toko).join(', ')}>
                          {Array.from(data.toko).join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-slate-500">{data.orders} orders</span>
                      <span className="font-semibold text-slate-700">{fmtRp(data.revenue)}</span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${barColor} transition-all duration-500`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* ═══════════ GUDANG WORKFLOW PROGRESS ═══════════ */}
      <div className="card-blue">
        <h3 className="text-sm font-bold text-slate-700 mb-1">🏭 Progress Gudang</h3>
        <p className="text-[10px] text-slate-400 mb-3">🔄 Sync real-time dengan Operasional Warehouse</p>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${stats.totalOrders > 0 ? ((stats.totalDiproses) / stats.totalOrders) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
            {stats.totalDiproses}/{stats.totalOrders} diproses
          </span>
        </div>
        {/* Pending alert */}
        {stats.totalPending > 0 && (
          <div className="mb-3 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 flex items-center gap-2 text-xs">
            <span>⏳</span>
            <span className="text-orange-700"><strong>{stats.totalPending} paket pending</strong> — menunggu handover atau pickup oleh runner</span>
          </div>
        )}
        <div className="grid grid-cols-8 gap-1.5">
          {stats.gudangCounts.map(stage => {
            const barPct = stats.maxGudang > 0 ? (stage.count / stats.maxGudang) * 100 : 0;
            return (
              <div key={stage.key} className="text-center">
                <p className="text-base mb-1">{stage.icon}</p>
                <p className="text-lg font-bold text-slate-700">{stage.count}</p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 mt-1">
                  <div
                    className={`h-full rounded-full ${stage.key === 'Perlu Dikirim' ? 'bg-amber-400' : stage.key === 'Dipicking' ? 'bg-blue-400' : stage.key === 'DiQC' ? 'bg-purple-400' : stage.key === 'Dipacking' ? 'bg-indigo-400' : stage.key === 'DiScanRunner' ? 'bg-cyan-400' : stage.key === 'Dikirim' ? 'bg-emerald-400' : stage.key === 'PendingPickup' ? 'bg-orange-400' : 'bg-red-400'}`}
                    style={{ width: `${Math.max(barPct, 4)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{stage.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════ STATUS BREAKDOWN ═══════════ */}
      <div className="card-blue">
        <h3 className="text-sm font-bold text-slate-700 mb-3">📋 Status Pesanan</h3>
        <div className="flex flex-wrap gap-2">
          {Array.from(stats.statusMap.entries())
            .sort(([, a], [, b]) => b - a)
            .map(([status, count]) => {
              const colorClass = STATUS_COLORS[status] || 'bg-slate-300';
              const isBatal = ['Batal', 'Dibatalkan', 'cancelled'].includes(status);
              return (
                <div
                  key={status}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    isBatal ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-50 text-slate-600 border border-slate-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${colorClass}`} />
                  {STATUS_LABEL[status] || status}
                  <span className={`ml-0.5 ${isBatal ? 'text-red-400' : 'text-slate-400'}`}>{count}</span>
                </div>
              );
            })}
        </div>
      </div>

      {/* ── Link ke detail ── */}
      <div className="text-center">
        <Link
          href="/operasional-gudang"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-100 transition"
        >
          ⚙️ Lihat Detail di Operasional Gudang →
        </Link>
      </div>
    </section>
  );
}
