import React from 'react';
import Link from 'next/link';
import { mockDashboardData } from '@/app/mockData';
import type { Shortcut } from '@/app/types';

interface Props {
  data?: Shortcut[];
}

export function ShortcutModule({ data }: Props) {
  const shortcuts = data ?? mockDashboardData.shortcuts;

  return (
    <section className="card-blue">
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-500 sm:text-sm">Pintasan Modul</p>
      <h2 className="text-xl font-bold text-slate-800 sm:text-2xl">Akses cepat ke fitur utama</h2>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shortcuts.map((shortcut, idx) => {
          const icons = ['📦', '💰', '📋', '💳', '📊', '🗂️', '🏭', '⚙️', '📝', '🔧'];
          return (
            <Link
              key={shortcut.title}
              href={shortcut.href}
              target="_blank"
              rel="noopener noreferrer"
              className="card-blue-inner block cursor-pointer border-l-4 border-l-brand-500 no-underline"
            >
              <div className="mb-2 text-2xl">{icons[idx]}</div>
              <p className="text-xs font-semibold text-brand-500">{shortcut.category}</p>
              <h3 className="mt-1 text-base font-bold text-slate-800 sm:text-lg">{shortcut.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">{shortcut.description}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
