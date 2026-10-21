'use client';

import React, { useState } from 'react';

/** Wrapper collapsible — saat dikecilkan hanya satu baris ringkas yang tampil. */
export function CollapsibleCard({ storageKey, title, icon, summary, children }: {
  storageKey: string;
  title: string;
  icon?: string;
  summary?: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
  });

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch {}
      return next;
    });
  };

  if (collapsed) {
    return (
      <button onClick={toggle}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-brand-50">
        <span className="flex min-w-0 items-center gap-2">
          {icon && <span className="text-lg">{icon}</span>}
          <span className="font-bold text-slate-700">{title}</span>
          {summary && <span className="truncate text-xs text-slate-400">— {summary}</span>}
        </span>
        <span className="shrink-0 rounded-lg bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-700">▸ Buka</span>
      </button>
    );
  }

  return (
    <div>
      <div className="mb-1 flex justify-end">
        <button onClick={toggle}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 transition hover:bg-brand-50 hover:text-brand-700">
          ▾ Kecilkan
        </button>
      </div>
      {children}
    </div>
  );
}
