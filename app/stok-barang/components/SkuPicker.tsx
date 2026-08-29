'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { SkuItem } from '@/app/context/SkuContext';

/**
 * Picker SKU ringan — search input + dropdown max 50 hasil.
 * Pengganti <select> dengan ribuan opsi yang bikin UI berat.
 */
interface Props {
  skus: SkuItem[];
  value: string; // kode SKU terpilih ('' = belum pilih)
  onChange: (sku: string) => void;
  placeholder?: string;
}

export function SkuPicker({ skus, value, onChange, placeholder = '🔍 Cari nama produk atau SKU...' }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = skus.find(s => s.sku === value);

  const options = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = query
      ? skus.filter(s => s.nama.toLowerCase().includes(query) || s.sku.toLowerCase().includes(query))
      : skus;
    return list.slice(0, 50);
  }, [skus, q]);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const select = (sku: string) => {
    onChange(sku);
    setQ('');
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
          <span className="truncate text-slate-800">{selected.nama} <span className="font-mono text-xs text-indigo-500">({selected.sku})</span></span>
          <button type="button" onClick={() => onChange('')} className="shrink-0 text-xs text-slate-300 hover:text-red-400" title="Hapus pilihan">✕</button>
        </div>
      ) : (
        <input
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      )}

      {open && !selected && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">Tidak ada SKU cocok dengan "{q}".</p>
          ) : (
            options.map(s => (
              <button
                key={s.sku}
                type="button"
                onClick={() => select(s.sku)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50"
              >
                <span className="truncate text-slate-700">{s.nama}</span>
                <span className="shrink-0 font-mono text-xs text-indigo-500">{s.sku}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
