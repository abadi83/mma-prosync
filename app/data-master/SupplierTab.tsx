'use client';

import React, { useState, useMemo } from 'react';
import { useApiList } from '@/app/hooks/useApiList';
import { SupplierItem } from '@/app/services/supplierService';
import { ModalForm, ModalConfirm } from './modals';

export function SupplierTab() {
  const { items: list, create, update, remove } = useApiList<SupplierItem>({ endpoint: '/api/supplier' });
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [f, setF] = useState({ nama: '', kontak: '', alamat: '' });
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // ⚡ Pagination + pencarian (biar cepat kalau supplier banyak)
  const PAGE_SIZE = 50;
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return list;
    return list.filter(s => s.nama.toLowerCase().includes(q) || s.kontak.toLowerCase().includes(q) || (s.alamat || '').toLowerCase().includes(q));
  }, [list, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const reset = () => { setF({ nama: '', kontak: '', alamat: '' }); setErr(''); setEditId(null); };
  const openAdd = () => { reset(); setShow(true); };
  const openEdit = (s: SupplierItem) => { setF({ nama: s.nama, kontak: s.kontak, alamat: s.alamat }); setEditId(s.id); setShow(true); };

  const save = async () => {
    if (!f.nama.trim()) { setErr('Nama wajib.'); return; }
    if (editId) await update(editId, { ...f, kontak: f.kontak || '-', alamat: f.alamat || '' });
    else await create({ ...f, kontak: f.kontak || '-', alamat: f.alamat || '' });
    setShow(false); reset();
  };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-lg font-bold text-slate-800 sm:text-xl">🏭 Daftar Supplier</h2><p className="text-sm text-slate-500">{list.length} supplier</p></div>
        <div className="flex gap-2">
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="🔍 Cari supplier..." className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none sm:max-w-[180px]" />
          <button onClick={openAdd} className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">+ Tambah</button>
        </div>
      </div>
      {show && <ModalForm title={editId ? '✏️ Ubah Supplier' : '➕ Tambah Supplier'} error={err} onCancel={() => setShow(false)} onSave={save}>
        <input value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} placeholder="Nama supplier" className="w-full rounded-xl border px-3 py-2 text-sm mb-2" />
        <input value={f.kontak} onChange={e => setF({ ...f, kontak: e.target.value })} placeholder="Kontak" className="w-full rounded-xl border px-3 py-2 text-sm mb-2" />
        <input value={f.alamat} onChange={e => setF({ ...f, alamat: e.target.value })} placeholder="Alamat" className="w-full rounded-xl border px-3 py-2 text-sm" />
      </ModalForm>}
      {delId && <ModalConfirm title="🗑️ Hapus Supplier" msg="Yakin hapus supplier ini?" onCancel={() => setDelId(null)} onConfirm={async () => { await remove(delId); setDelId(null); }} />}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead><tr className="bg-brand-50 text-xs uppercase text-brand-500">{['Nama','Kontak','Alamat','Aksi'].map(c => <th key={c} className="px-3 py-3 font-semibold">{c}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {paginated.length === 0 ? (
              <tr><td colSpan={4} className="py-8 text-center text-sm text-slate-400">Tidak ada supplier.</td></tr>
            ) : paginated.map((s, i) => (
              <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                <td className="px-3 py-3 font-medium text-slate-800">{s.nama}</td>
                <td className="px-3 py-3 text-slate-600">{s.kontak}</td>
                <td className="px-3 py-3 text-slate-600">{s.alamat || '-'}</td>
                <td className="px-3 py-3"><div className="flex gap-1"><button onClick={() => openEdit(s)} className="rounded-lg bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-200">✏️</button><button onClick={() => setDelId(s.id)} className="rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-200">🗑️</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">Menampilkan <strong>{((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}</strong> dari <strong>{filtered.length}</strong> supplier</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={safePage === 1} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-brand-50 disabled:opacity-40">«</button>
            <button onClick={() => setPage(safePage - 1)} disabled={safePage === 1} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-brand-50 disabled:opacity-40">‹</button>
            <span className="px-2 py-1 text-xs font-bold text-slate-700">Hal {safePage} / {totalPages}</span>
            <button onClick={() => setPage(safePage + 1)} disabled={safePage === totalPages} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-brand-50 disabled:opacity-40">›</button>
            <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-brand-50 disabled:opacity-40">»</button>
          </div>
        </div>
      )}
    </div>
  );
}
