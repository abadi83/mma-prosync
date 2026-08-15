'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseApiListOptions<T> {
  endpoint: string;
  initial?: T[];
}

export function useApiList<T extends { id: string }>(opts: UseApiListOptions<T>) {
  const [items, setItems] = useState<T[]>(opts.initial || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    return json.item || null;
  }, [opts.endpoint, fetchItems]);

  const update = useCallback(async (id: string, payload: Partial<T>): Promise<T | null> => {
    const res = await fetch(opts.endpoint, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...payload }),
    });
    if (!res.ok) return null;
    await fetchItems();
    const json = await res.json();
    return json.item || null;
  }, [opts.endpoint, fetchItems]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    const res = await fetch(`${opts.endpoint}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) return false;
    await fetchItems();
    return true;
  }, [opts.endpoint, fetchItems]);

  return { items, setItems, loading, error, refresh: fetchItems, create, update, remove };
}
