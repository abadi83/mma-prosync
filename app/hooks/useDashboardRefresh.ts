'use client';

import { useState, useEffect, useCallback } from 'react';
import { mockDashboardData } from '@/app/mockData';
import type { DashboardData } from '@/app/types';

function varyNumber(value: number, pct = 0.1): number {
  const delta = Math.round(value * pct * (Math.random() * 2 - 1));
  return Math.max(0, value + delta);
}

function refreshData(prev: DashboardData): DashboardData {
  const stockItems = prev.stockSummary.items.map((item) => ({
    ...item,
    stock: Math.max(0, varyNumber(item.stock, 0.15)),
  }));

  const lowStockCount = stockItems.filter((i) => i.stock < i.minStock).length;

  return {
    stockSummary: {
      totalItems: prev.stockSummary.totalItems,
      lowStockCount,
      items: stockItems,
    },
    salesSummary: {
      today: varyNumber(prev.salesSummary.today, 0.05),
      transactions: Math.max(0, varyNumber(prev.salesSummary.transactions, 0.2)),
      trend: Math.random() > 0.3 ? 'up' : 'down',
    },
    shortcuts: prev.shortcuts,
  };
}

export function useDashboardRefresh(intervalMs = 8000) {
  const [data, setData] = useState<DashboardData>(mockDashboardData);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const refresh = useCallback(() => {
    setData((prev) => refreshData(prev));
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { data, lastUpdated, refresh };
}
