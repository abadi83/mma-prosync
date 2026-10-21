'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { KATEGORI_BERITA, BeritaInternalItem } from '@/app/lib/beritaInternal';

function fmtWaktu(w: string): string {
  if (!w) return '—';
  const d = new Date(w.includes('T') ? w : w.replace(' ', 'T'));
  if (isNaN(d.getTime())) return w;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** 3 slide kolase berita internal — satu berita TERBARU per kategori. */
export function BeritaInternalSection() {
  const [items, setItems] = useState<BeritaInternalItem[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/berita-internal?latest=1', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch {}
  }, []);

  useEffect(() => { void load(); const t = setInterval(() => { void load(); }, 60000); return () => clearInterval(t); }, [load]);

  const byKategori = (key: string) => items.find(b => b.kategori === key) || null;

  return (
    <section className="card-blue">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-500 sm:text-sm">Pengumuman Internal</p>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📣 Kabar Toko</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">diperbarui tiap menit</span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {KATEGORI_BERITA.map(def => {
          const b = byKategori(def.key);
          if (!b) {
            return (
              <div key={def.key} className={`relative flex min-h-44 flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br ${def.gradien} p-4 text-white opacity-90`}>
                <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-bold">{def.icon} {def.label}</span>
                <div>
                  <p className="text-sm font-bold">Belum ada berita</p>
                  <a href="/news-mma" className="mt-1 inline-block text-xs text-white/70 underline hover:text-white">Isi di News MMA →</a>
                </div>
              </div>
            );
          }
          return (
            <div key={def.key} className="relative flex min-h-44 flex-col justify-between overflow-hidden rounded-2xl shadow-md">
              {b.gambarBg ? (
                <img src={b.gambarBg} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : null}
              <div className={`absolute inset-0 bg-gradient-to-br ${def.gradien} opacity-90`} />
              {b.gambarBg && <div className="absolute inset-0 bg-black/35" />}
              <div className="relative flex h-full flex-col justify-between p-4 text-white">
                <span className="self-start rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-bold">{def.icon} {def.label}</span>
                <div>
                  <p className="line-clamp-2 text-sm font-bold leading-snug drop-shadow">{b.judul}</p>
                  {b.isi && <p className="mt-1 line-clamp-2 text-xs text-white/85">{b.isi}</p>}
                  <p className="mt-2 text-[10px] text-white/75">
                    ✍️ {b.penulisNama || '—'} · {fmtWaktu(b.waktu)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
