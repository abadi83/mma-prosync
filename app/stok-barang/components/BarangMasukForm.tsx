'use client';

import React, { useState, useMemo } from 'react';
import { useSkus } from '@/app/context/SkuContext';
import { SkuPicker } from './SkuPicker';

export interface BarangMasukEntry {
  id: string;
  sku: string;
  produk: string;
  jumlah: number;
  supplier: string;
  tanggal: string;
}

interface Props {
  onAdd: (entry: BarangMasukEntry) => void;
}

export function BarangMasukForm({ onAdd }: Props) {
  const { skus } = useSkus();
  const [sku, setSku] = useState('');
  const [jumlah, setJumlah] = useState('');
  const [supplier, setSupplier] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Dropdown produk dari Master SKU asli (bukan data demo)
  const katalog = useMemo(() => [...skus].sort((a, b) => a.nama.localeCompare(b.nama)), [skus]);

  const resetForm = () => {
    setSku('');
    setJumlah('');
    setSupplier('');
    setTanggal(new Date().toISOString().slice(0, 10));
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    const jml = parseInt(jumlah, 10);
    if (!sku) { setError('Pilih produk terlebih dahulu.'); return; }
    if (!jumlah || jml <= 0) { setError('Jumlah harus lebih dari 0.'); return; }
    if (!supplier.trim()) { setError('Nama supplier wajib diisi.'); return; }
    if (!tanggal) { setError('Tanggal wajib diisi.'); return; }

    const selected = skus.find(s => s.sku === sku);
    onAdd({
      id: `in-${Date.now()}`,
      sku,
      produk: selected?.nama || sku,
      jumlah: jml,
      supplier: supplier.trim(),
      tanggal,
    });

    setSuccess(true);
    resetForm();
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4 sm:p-5">
      <h3 className="text-base font-bold text-brand-700 sm:text-lg">📥 Catat Barang Masuk</h3>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-600" role="status">
          ✅ Barang masuk berhasil dicatat!
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-600">Produk</span>
          <SkuPicker skus={katalog} value={sku} onChange={setSku} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-600">Jumlah</span>
          <input
            type="number"
            min="1"
            value={jumlah}
            onChange={(e) => setJumlah(e.target.value)}
            placeholder="0"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-600">Supplier</span>
          <input
            type="text"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="Nama supplier"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-600">Tanggal</span>
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>

      <button
        type="submit"
        className="mt-4 rounded-xl bg-brand-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-95"
      >
        + Tambah Barang Masuk
      </button>
    </form>
  );
}
