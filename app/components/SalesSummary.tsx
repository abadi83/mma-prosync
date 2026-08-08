import React from 'react';
import { mockDashboardData } from '@/app/mockData';
import type { SalesSummaryData } from '@/app/types';

interface Props {
  data?: SalesSummaryData;
}

export function SalesSummary({ data }: Props) {
  const salesSummary = data ?? mockDashboardData.salesSummary;

  return (
    <div className="card-blue flex flex-col">
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-500 sm:text-sm">Ringkasan Penjualan</p>
      <h2 className="mt-2 text-2xl font-bold text-slate-800 sm:text-3xl">Rp {salesSummary.today.toLocaleString('id-ID')}</h2>
      <p className="mt-1 text-sm text-slate-500">{salesSummary.transactions} transaksi hari ini</p>
      <div className={`mt-4 inline-flex items-center gap-1 self-start rounded-full px-3 py-1 text-xs font-semibold sm:text-sm ${salesSummary.trend === 'up' ? 'bg-brand-100 text-brand-700' : 'bg-amber-100 text-amber-600'}`}>
        <span>{salesSummary.trend === 'up' ? '📈' : '📉'}</span>
        {salesSummary.trend === 'up' ? 'Naik 8% dari kemarin' : 'Turun 4% dari kemarin'}
      </div>
    </div>
  );
}
