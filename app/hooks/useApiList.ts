'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiListOptions<T> {
  endpoint: string;
  initial?: T[];
}

/* Rekam aktivitas user (audit trail → KPI). Modul diambil dari endpoint API. */
function recordApiActivity(endpoint: string, aksi: string, refLabel: string, detail: any) {
  if (typeof window === 'undefined') return;
  const modul = endpoint.replace(/^\/api\//, '').replace(/\//g, '-');
  try {
    fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: [{ modul, aksi, refLabel, detail }] }),
    });
  } catch {}
}

export function useApiList<T extends { id: string }>(opts: UseApiListOptions<T>) {
  const [items, setItems] = useState<T[]>(opts.initial || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ref untuk baca item terbaru di dalam callback (buat label aktivitas)
  const itemsRef = useRef<T[]>(opts.initial || []);
  itemsRef.current = items;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${opts.endpoint}?t=${Date.now()}`);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [opts.endpoint]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const create = useCallback(async (payload: Omit<T, 'id'>): Promise<T | null> => {
    const res = await fetch(opts.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    await fetchItems();
    const json = await res.json();
    const item = json.item || null;
    if (item) {
      const label = (item as any)?.nama || (payload as any)?.nama || '';
      recordApiActivity(opts.endpoint, 'tambah', label, { ...payload });
    }
    return item;
  }, [opts.endpoint, fetchItems]);

  const update = useCallback(async (id: string, payload: Partial<T>): Promise<T | null> => {
    const res = await fetch(opts.endpoint, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...payload }),
    });
    if (!res.ok) return null;
    await fetchItems();
    const json = await res.json();
    const item = json.item || null;
    if (item) {
      const label = (item as any)?.nama || (payload as any)?.nama || '';
      recordApiActivity(opts.endpoint, 'ubah', label, { ...payload });
    }
    return item;
  }, [opts.endpoint, fetchItems]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    const before = itemsRef.current.find((x: any) => x.id === id);
    const res = await fetch(`${opts.endpoint}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) return false;
    await fetchItems();
    recordApiActivity(opts.endpoint, 'hapus', (before as any)?.nama || id, { id });
    return true;
  }, [opts.endpoint, fetchItems]);

  return { items, setItems, loading, error, refresh: fetchItems, create, update, remove };
}
