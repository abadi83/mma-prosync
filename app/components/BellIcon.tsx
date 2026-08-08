'use client';

import React from 'react';

interface Props {
  count: number;
  onClick?: () => void;
}

export function BellIcon({ count, onClick }: Props) {
  return (
    <button onClick={onClick} className="relative inline-flex items-center" aria-label={`Notifikasi: ${count} belum dibaca`}>
      <span className="text-2xl">🔔</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
