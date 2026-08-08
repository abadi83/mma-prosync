import React from 'react';
import { mockDashboardData } from '@/app/mockData';
import type { StockSummaryData } from '@/app/types';

interface Props {
  data?: StockSummaryData;
}

export function StockSummary({ data }: Props) {
  const stockSummary = data ?? mockDashboardData.stockSummary;

  return (
    <div className="card-blue">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-500 sm:text-sm">Ringkasan Stok</p>
          <h2 className="text-xl font-bold text-slate-800 sm:text-2xl">{stockSummary.totalItems} item terpantau</h2>
        </div>
        <span className="shrink-0 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-600 sm:text-sm">
          {stockSummary.lowStockCount} menipis
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {stockSummary.items.map((item) => (
          <div key={item.name} className={`card-blue-inner border-l-4 ${item.stock < item.minStock ? 'border-l-red-400' : 'border-l-brand-500'}`}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-800">{item.name}</p>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.stock < item.minStock ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-700'}`}>
                {item.stock} tersisa
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500 sm:text-sm">Min. {item.minStock} • {item.category}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
