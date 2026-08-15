'use client';

import React, { useState } from 'react';
import { useSkus, type SkuItem } from '@/app/context/SkuContext';
import { ModalForm } from './modals';
import { SkuTable } from './SkuTable';

export function SkuTab() {
  const { skus, setSkus, syncStatus } = useSkus();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState({ sku: '', nama: '', grade: '', supplier: '', kategori: '', satuan: 'pcs', hargaModalLama: '', hargaBaru: '', hargaJual: '', minStok: '', aktif: 1 });
  const [ferr, setFerr] = useState('');

  const filtered = skus.filter(i => i.nama.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase()));

  const blank = () => ({ sku: '', nama: '', grade: '', supplier: '', kategori: '', satuan: 'pcs', hargaModalLama: '', hargaBaru: '', hargaJual: '', minStok: '', aktif: 1 });
  const openAdd = () => { setF(blank()); setFerr(''); setShowForm(true); setEditId(null); };
  const openEdit = (i: SkuItem) => {
    setF({ sku: i.sku, nama: i.nama, grade: i.grade, supplier: i.supplier, kategori: i.kategori, satuan: i.satuan,
      hargaModalLama: i.hargaModalLama ? String(i.hargaModalLama) : '', hargaBaru: String(i.hargaBaru), hargaJual: String(i.hargaJual),
      minStok: String(i.minStok), aktif: i.aktif });
    setFerr(''); setEditId(i.id); setShowForm(true);
  };

  const save = async () => {
    if (!f.sku || !f.nama) { setFerr('SKU dan Nama wajib diisi.'); return; }
    const payload: Omit<SkuItem, 'id'> = {
      sku: f.sku, nama: f.nama, grade: f.grade, kodeSupplierVarian: '', statusEditGambar: '', statusUploadToko: '',
      supplier: f.supplier, kategori: f.kategori, satuan: f.satuan || 'pcs',
      hargaModalLama: +f.hargaModalLama || 0, hargaBaru: +f.hargaBaru || 0, hargaJual: +f.hargaJual || 0,
      stok: editId ? (skus.find(x => x.id === editId)?.stok ?? 0) : 0, minStok: +f.minStok || 0, aktif: f.aktif, perubahanHargaBeli: ''
    };
    const method = editId ? 'PUT' : 'POST';
    const body = editId ? { id: editId, ...payload } : payload;
    await fetch('/api/sku-master', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setSkus(prev => editId ? prev.map(x => x.id === editId ? { ...payload, id: editId } : x) : [...prev, { ...payload, id: `tmp-${Date.now()}` }]);
    setShowForm(false);
  };

  const del = async (id: string) => {
    await fetch(`/api/sku-master?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    setSkus(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-lg font-bold text-slate-800 sm:text-xl">📦 Daftar SKU</h2><p className="text-sm text-slate-500">{skus.length} SKU • status: {syncStatus}</p></div>
        <button onClick={openAdd} className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">+ Tambah</button>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari SKU / nama..." className="mt-3 w-full rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
      {showForm && <ModalForm title={editId ? '✏️ Ubah SKU' : '➕ Tambah SKU'} error={ferr} onCancel={() => setShowForm(false)} onSave={save}>
        <div className="grid gap-2">
          <input value={f.sku} onChange={e => setF({ ...f, sku: e.target.value })} placeholder="SKU *" className="rounded-xl border px-3 py-2 text-sm" />
          <input value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} placeholder="Nama *" className="rounded-xl border px-3 py-2 text-sm" />
          <input value={f.grade} onChange={e => setF({ ...f, grade: e.target.value })} placeholder="Grade" className="rounded-xl border px-3 py-2 text-sm" />
          <input value={f.supplier} onChange={e => setF({ ...f, supplier: e.target.value })} placeholder="Supplier" className="rounded-xl border px-3 py-2 text-sm" />
          <input value={f.kategori} onChange={e => setF({ ...f, kategori: e.target.value })} placeholder="Kategori" className="rounded-xl border px-3 py-2 text-sm" />
          <input value={f.satuan} onChange={e => setF({ ...f, satuan: e.target.value })} placeholder="Satuan" className="rounded-xl border px-3 py-2 text-sm" />
          <input value={f.hargaModalLama} onChange={e => setF({ ...f, hargaModalLama: e.target.value })} placeholder="Harga Modal Lama" type="number" className="rounded-xl border px-3 py-2 text-sm" />
          <input value={f.hargaBaru} onChange={e => setF({ ...f, hargaBaru: e.target.value })} placeholder="Harga Beli Baru" type="number" className="rounded-xl border px-3 py-2 text-sm" />
          <input value={f.hargaJual} onChange={e => setF({ ...f, hargaJual: e.target.value })} placeholder="Harga Jual" type="number" className="rounded-xl border px-3 py-2 text-sm" />
          <input value={f.minStok} onChange={e => setF({ ...f, minStok: e.target.value })} placeholder="Min Stok" type="number" className="rounded-xl border px-3 py-2 text-sm" />
        </div>
      </ModalForm>}
      <SkuTable data={filtered} onEdit={openEdit} onDelete={del} />
    </div>
  );
}
