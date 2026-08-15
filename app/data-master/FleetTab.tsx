'use client';

import React, { useState } from 'react';
import { useApiList } from '@/app/hooks/useApiList';
import { FleetItem } from '@/app/services/fleetService';
import { ModalForm, ModalConfirm } from './modals';

const STATUS_FLEET: Record<string, string> = { Tersedia: 'bg-emerald-100 text-emerald-700', Digunakan: 'bg-blue-100 text-blue-700', Servis: 'bg-amber-100 text-amber-700', Nonaktif: 'bg-slate-100 text-slate-600' };
const TIPE_COLORS: Record<string, string> = { 'Pick-up': 'bg-emerald-100 text-emerald-700', Box: 'bg-blue-100 text-blue-700', Truk: 'bg-amber-100 text-amber-700', Motor: 'bg-slate-100 text-slate-600' };

export function FleetTab() {
  const { items: list, create, update, remove } = useApiList<FleetItem>({ endpoint: '/api/fleet' });
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [f, setF] = useState({ nama: '', platNomor: '', tipe: 'Pick-up', kapasitas: '', driver: '', tahun: '', status: 'Tersedia' });
  const [err, setErr] = useState('');

  const reset = () => { setF({ nama: '', platNomor: '', tipe: 'Pick-up', kapasitas: '', driver: '', tahun: '', status: 'Tersedia' }); setErr(''); setEditId(null); };
  const openAdd = () => { reset(); setShow(true); };
  const openEdit = (x: FleetItem) => { setF({ nama: x.nama, platNomor: x.platNomor, tipe: x.tipe, kapasitas: x.kapasitas, driver: x.driver, tahun: x.tahun, status: x.status }); setEditId(x.id); setShow(true); };

  const save = async () => {
    if (!f.nama.trim() || !f.platNomor.trim()) { setErr('Nama dan plat nomor wajib.'); return; }
    if (editId) await update(editId, f);
    else await create(f);
    setShow(false); reset();
  };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-bold text-slate-800 sm:text-xl">🚛 Armada Kendaraan</h2><p className="text-sm text-slate-500">{list.length} kendaraan</p></div>
        <button onClick={openAdd} className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">+ Tambah</button>
      </div>
      {show && <ModalForm title={editId ? '✏️ Ubah Kendaraan' : '➕ Tambah Kendaraan'} error={err} onCancel={() => setShow(false)} onSave={save}>
        <input value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} placeholder="Nama kendaraan" className="w-full rounded-xl border px-3 py-2 text-sm mb-2" />
        <input value={f.platNomor} onChange={e => setF({ ...f, platNomor: e.target.value })} placeholder="Plat nomor" className="w-full rounded-xl border px-3 py-2 text-sm mb-2" />
        <select value={f.tipe} onChange={e => setF({ ...f, tipe: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-sm mb-2 bg-white"><option>Pick-up</option><option>Box</option><option>Truk</option><option>Motor</option></select>
        <input value={f.kapasitas} onChange={e => setF({ ...f, kapasitas: e.target.value })} placeholder="Kapasitas" className="w-full rounded-xl border px-3 py-2 text-sm mb-2" />
        <input value={f.driver} onChange={e => setF({ ...f, driver: e.target.value })} placeholder="Driver" className="w-full rounded-xl border px-3 py-2 text-sm mb-2" />
        <input value={f.tahun} onChange={e => setF({ ...f, tahun: e.target.value })} placeholder="Tahun" className="w-full rounded-xl border px-3 py-2 text-sm mb-2" />
        <select value={f.status} onChange={e => setF({ ...f, status: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-sm bg-white"><option>Tersedia</option><option>Digunakan</option><option>Servis</option><option>Nonaktif</option></select>
      </ModalForm>}
      {delId && <ModalConfirm title="🗑️ Hapus Kendaraan" msg="Yakin hapus kendaraan ini?" onCancel={() => setDelId(null)} onConfirm={async () => { await remove(delId); setDelId(null); }} />}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead><tr className="bg-brand-50 text-xs uppercase text-brand-500">{['Nama','Plat Nomor','Tipe','Kapasitas','Driver','Tahun','Status','Aksi'].map(c => <th key={c} className="px-3 py-3 font-semibold whitespace-nowrap">{c}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {list.map((x, i) => (
              <tr key={x.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                <td className="px-3 py-3 font-medium text-slate-800">{x.nama}</td>
                <td className="px-3 py-3 font-mono text-xs text-slate-600">{x.platNomor}</td>
                <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TIPE_COLORS[x.tipe] || 'bg-slate-100 text-slate-600'}`}>{x.tipe}</span></td>
                <td className="px-3 py-3 text-slate-600">{x.kapasitas || '-'}</td>
                <td className="px-3 py-3 text-slate-600">{x.driver || '-'}</td>
                <td className="px-3 py-3 text-slate-500">{x.tahun || '-'}</td>
                <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_FLEET[x.status] || 'bg-slate-100 text-slate-600'}`}>{x.status}</span></td>
                <td className="px-3 py-3"><div className="flex gap-1"><button onClick={() => openEdit(x)} className="rounded-lg bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-200">✏️</button><button onClick={() => setDelId(x.id)} className="rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-200">🗑️</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
