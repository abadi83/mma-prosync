'use client';

import { useState, useEffect } from 'react';
import { getJSON } from '@/app/lib/idbStorage';

/**
 * Cache Master SKU (mma_sku_data) dari IndexedDB/localStorage dengan live update.
 * Dipakai komponen yang sebelumnya baca localStorage.getItem('mma_sku_data') langsung.
 */
export function useSkuDataCache(): any[] {
  const [skus, setSkus] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await getJSON<any[]>('mma_sku_data');
      if (!cancelled) setSkus(Array.isArray(data) ? data : []);
    };
    void load();
    const onShared = (e: Event) => {
      const detail = (e as CustomEvent).detail as { key?: string } | undefined;
      if (detail && detail.key && detail.key !== 'mma_sku_data') return;
      void load();
    };
    window.addEventListener('shared-data-updated', onShared);
    window.addEventListener('storage', load);
    return () => {
      cancelled = true;
      window.removeEventListener('shared-data-updated', onShared);
      window.removeEventListener('storage', load);
    };
  }, []);

  return skus;
}
