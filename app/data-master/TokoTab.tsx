'use client';

import React, { useState } from 'react';
import { useApiList } from '@/app/hooks/useApiList';
import { TokoItem } from '@/app/services/marketplaceTokoService';
import { ModalForm, ModalConfirm } from './modals';

const MARKETPLACES = ['Shopee', 'Tokopedia', 'Lazada', 'TikTok Shop'];

export function TokoTab() {
  const { items: list, create, update, remove } = useApiList<TokoItem>({ endpoint: '/api/marketplace-toko' });
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [f, setF] = useState({ nama: '', marketplace: '', link: '', persenFee: '' });
  const [err, setErr] = useState('');

  const reset = () => { setF({ nama: '', marketplace: '', link: '', persenFee: '' }); setErr(''); setEditId(null); };
  const openAdd = () => { reset(); setShow(true); };
  const openEdit = (t: TokoItem) => { setF({ nama: t.nama, marketplace: t.marketplace, link: t.link, persenFee: String(t.persenFee) }); setEditId(t.id); setShow(true); };

  const save = async () => {
    if (!f.nama.trim() || !f.marketplace.trim()) { setErr('Nama dan marketplace wajib.'); return; }
    const payload = { ...f, persenFee: +f.persenFee || 0 };
    if (editId) await update(editId, payload);
    else await create(payload);
    setShow(false); reset();
  };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-bold text-slate-800 sm:text-xl">🏬 Toko Marketplace</h2><p className="text-sm text-slate-500">{list.length} toko</p></div>
        <button onClick={openAdd} className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">+ Tambah</button>
      </div>
      {show && <ModalForm title={editId ? '✏️ Ubah Toko' : '➕ Tambah Toko'} error={err} onCancel={() => setShow(false)} onSave={save}>
        <input value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} placeholder="Nama toko" className="w-full rounded-xl border px-3 py-2 text-sm mb-2" />
        <select value={f.marketplace} onChange={e => setF({ ...f, marketplace: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-sm mb-2 bg-white">
          <option value="">Pilih Marketplace</option>
          {MARKETPLACES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input value={f.link} onChange={e => setF({ ...f, link: e.target.value })} placeholder="Link toko" className="w-full rounded-xl border px-3 py-2 text-sm mb-2" />
        <input value={f.persenFee} onChange={e => setF({ ...f, persenFee: e.target.value })} placeholder="Fee %" type="number" className="w-full rounded-xl border px-3 py-2 text-sm" />
      </ModalForm>}
      {delId && <ModalConfirm title="🗑️ Hapus Toko" msg="Yakin hapus toko ini?" onCancel={() => setDelId(null)} onConfirm={async () => { await remove(delId); setDelId(null); }} />}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead><tr className="bg-brand-50 text-xs uppercase text-brand-500">{['Nama','Marketplace','Link','Fee %','Aksi'].map(c => <th key={c} className="px-3 py-3 font-semibold">{c}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {list.map((t, i) => (
              <tr key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                <td className="px-3 py-3 font-medium text-slate-800">{t.nama}</td>
                <td className="px-3 py-3 text-slate-600">{t.marketplace}</td>
                <td className="px-3 py-3 text-slate-600">{t.link ? <a href={t.link} target="_blank" rel="noreferrer" className="text-brand-600 underline text-xs">Buka</a> : '-'}</td>
                <td className="px-3 py-3 text-slate-600">{t.persenFee}%</td>
                <td className="px-3 py-3"><div className="flex gap-1"><button onClick={() => openEdit(t)} className="rounded-lg bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-200">✏️</button><button onClick={() => setDelId(t.id)} className="rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-200">🗑️</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
