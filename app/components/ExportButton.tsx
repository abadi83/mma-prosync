'use client';

import React, { useState } from 'react';

interface Props {
  filename: string;
  headers: string[];
  rows: string[][];
}

export function ExportButton({ filename, headers, rows }: Props) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');

  const handleExportCSV = async () => {
    const { exportToCSV } = await import('@/app/lib/exportCsv');
    exportToCSV(filename, headers, rows);
    setMsg('✅ CSV terunduh');
    setOpen(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleExportPDF = () => {
    setMsg('📄 Simulasi PDF — fitur lengkap tersedia setelah integrasi backend');
    setOpen(false);
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-700 active:scale-95"
      >
        📥 Ekspor
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <button
            onClick={handleExportCSV}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-brand-50"
          >
            📊 CSV (Excel)
          </button>
          <button
            onClick={handleExportPDF}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-brand-50"
          >
            📄 PDF
          </button>
        </div>
      )}

      {msg && (
        <span className="ml-2 text-xs font-medium text-emerald-600">{msg}</span>
      )}
    </div>
  );
}
