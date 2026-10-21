'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { BeritaItem } from '@/app/services/beritaService';

/* Waktu relatif singkat, sama gaya header aplikasi */
function relTime(raw: string | undefined, now: number): string {
  if (!raw) return '—';
  const ts = Date.parse(raw);
  if (isNaN(ts)) return '—';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return 'baru saja';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

export function BeritaSection() {
  const [items, setItems] = useState<BeritaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/berita', { cache: 'no-store' });
      const j = await res.json().catch(() => null);
      if (res.ok && Array.isArray(j?.items)) {
        setItems(j.items);
        setNow(Date.now());
      } else {
        setError(j?.error || 'Gagal memuat berita.');
      }
    } catch {
      setError('Tidak bisa terhubung ke server berita.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);

  return (
    <section className="card-blue">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-500 sm:text-sm">Berita</p>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📰 Marketplace & E-Commerce</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">via Google News · gratis</span>
          <button onClick={() => void load()} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-brand-50 hover:text-brand-700">
            🔄 {loading ? 'Memuat…' : 'Segarkan'}
          </button>
        </div>
      </div>

      {loading && items.length === 0 && (
        <p className="mt-3 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">Memuat berita…</p>
      )}
      {!loading && error && items.length === 0 && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-6 text-center text-sm text-red-600">⚠️ {error}</p>
      )}
      {items.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {items.map((it, i) => (
            <li key={it.link || i}>
              <a href={it.link} target="_blank" rel="noopener noreferrer"
                className="block h-full rounded-xl border border-slate-100 bg-white p-3 transition hover:border-brand-300 hover:bg-brand-50/40">
                <p className="text-sm font-semibold leading-snug text-slate-800">{it.title}</p>
                <p className="mt-1 text-[10px] font-semibold text-brand-500">
                  {it.source || 'Google News'} · {relTime(it.pubDate, now)}
                </p>
                {it.snippet && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{it.snippet}</p>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
