'use client';

import React, { useEffect, useState } from 'react';
import { useApiList } from '@/app/hooks/useApiList';
import { PelangganItem } from '@/app/services/pelangganService';
import { ModalForm, ModalConfirm } from './modals';

interface RiwayatRow { id: string; produk: string; jumlah: number; hargaSatuan: number; total: number; pelanggan: string; tanggal: string; }

export function PelangganTab() {
  const { items: list, create, update, remove } = useApiList<PelangganItem>({ endpoint: '/api/pelanggan' });
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [riwayatOf, setRiwayatOf] = useState<PelangganItem | null>(null);
  const [riwayat, setRiwayat] = useState<RiwayatRow[]>([]);
  const [riwayatLoading, setRiwayatLoading] = useState(false);
  const [f, setF] = useState({ nama: '', kontak: '', alamat: '', telepon: '', marketplace: '', totalTransaksi: '' });
  const [err, setErr] = useState('');

  const reset = () => { setF({ nama: '', kontak: '', alamat: '', telepon: '', marketplace: '', totalTransaksi: '' }); setErr(''); setEditId(null); };
  const openAdd = () => { reset(); setShow(true); };
  const openEdit = (p: PelangganItem) => {
    setF({
      nama: p.nama,
      kontak: p.kontak,
      alamat: p.alamat || '',
      telepon: p.telepon || '',
      marketplace: p.marketplace || '',
      totalTransaksi: String(p.totalTransaksi || 0),
    });
    setEditId(p.id);
    setShow(true);
  };

  const save = async () => {
    if (!f.nama.trim()) { setErr('Nama wajib.'); return; }
    const payload = { ...f, totalTransaksi: +f.totalTransaksi || 0 };
    if (editId) await update(editId, payload);
    else await create(payload);
    setShow(false); reset();
  };

  // Riwayat transaksi pelanggan (tabel transaksi via pelanggan_id)
  useEffect(() => {
    if (!riwayatOf) { setRiwayat([]); return; }
    let active = true;
    setRiwayatLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/transaksi?pelanggan_id=${encodeURIComponent(riwayatOf.id)}`);
        if (res.ok && active) {
          const data = await res.json();
          setRiwayat(Array.isArray(data) ? data : []);
        }
      } catch {} finally { if (active) setRiwayatLoading(false); }
    })();
    return () => { active = false; };
  }, [riwayatOf]);

  const totalRiwayat = riwayat.reduce((s, r) => s + r.total, 0);

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-bold text-slate-800 sm:text-xl">👥 Pelanggan</h2><p className="text-sm text-slate-500">{list.length} pelanggan</p></div>
        <button onClick={openAdd} className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">+ Tambah</button>
      </div>
      {show && <ModalForm title={editId ? '✏️ Ubah Pelanggan' : '➕ Tambah Pelanggan'} error={err} onCancel={() => setShow(false)} onSave={save}>
        <input value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} placeholder="Nama *" className="w-full rounded-xl border px-3 py-2 text-sm mb-2" />
        <input value={f.telepon} onChange={e => setF({ ...f, telepon: e.target.value })} placeholder="No. telepon" className="w-full rounded-xl border px-3 py-2 text-sm mb-2" />
        <input value={f.alamat} onChange={e => setF({ ...f, alamat: e.target.value })} placeholder="Alamat" className="w-full rounded-xl border px-3 py-2 text-sm mb-2" />
        <input value={f.kontak} onChange={e => setF({ ...f, kontak: e.target.value })} placeholder="Kontak lain" className="w-full rounded-xl border px-3 py-2 text-sm mb-2" />
        <input value={f.marketplace} onChange={e => setF({ ...f, marketplace: e.target.value })} placeholder="Marketplace (opsional)" className="w-full rounded-xl border px-3 py-2 text-sm mb-2" />
        <input value={f.totalTransaksi} onChange={e => setF({ ...f, totalTransaksi: e.target.value })} placeholder="Total transaksi" type="number" className="w-full rounded-xl border px-3 py-2 text-sm" />
      </ModalForm>}
      {delId && <ModalConfirm title="🗑️ Hapus Pelanggan" msg="Yakin hapus pelanggan ini?" onCancel={() => setDelId(null)} onConfirm={async () => { await remove(delId); setDelId(null); }} />}

      {/* Modal riwayat transaksi */}
      {riwayatOf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-slate-800">🕓 Riwayat Transaksi</p>
                <p className="text-sm text-slate-500">{riwayatOf.nama}</p>
              </div>
              <button onClick={() => setRiwayatOf(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            {riwayatLoading ? (
              <p className="mt-4 text-sm text-slate-400">Memuat riwayat…</p>
            ) : riwayat.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">Belum ada transaksi untuk pelanggan ini.</p>
            ) : (
              <>
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
                  <table className="w-full text-left text-sm">
                    <thead><tr className="bg-brand-50 text-xs uppercase text-brand-500">{['Tanggal','Produk','Jml','Harga','Total'].map(c => <th key={c} className="px-3 py-2 font-semibold">{c}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-50 bg-white">
                      {riwayat.map((r, i) => (
                        <tr key={r.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                          <td className="px-3 py-2 text-slate-600">{r.tanggal}</td>
                          <td className="px-3 py-2 font-medium text-slate-800">{r.produk}</td>
                          <td className="px-3 py-2 text-slate-600">{r.jumlah}</td>
                          <td className="px-3 py-2 text-slate-600">{r.hargaSatuan.toLocaleString('id-ID')}</td>
                          <td className="px-3 py-2 font-semibold text-slate-800">{r.total.toLocaleString('id-ID')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-2 text-sm">
                  <span className="text-emerald-700">{riwayat.length} baris transaksi</span>
                  <span className="font-bold text-emerald-700">Total Rp {totalRiwayat.toLocaleString('id-ID')}</span>
                </div>
              </>
            )}
            <div className="mt-4 flex justify-end">
              <button onClick={() => setRiwayatOf(null)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Tutup</button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead><tr className="bg-brand-50 text-xs uppercase text-brand-500">{['Nama','Telepon','Alamat','Total Transaksi','Aksi'].map(c => <th key={c} className="px-3 py-3 font-semibold">{c}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {list.map((p, i) => (
              <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                <td className="px-3 py-3 font-medium text-slate-800">{p.nama}</td>
                <td className="px-3 py-3 text-slate-600">{p.telepon || p.kontak || '-'}</td>
                <td className="px-3 py-3 text-slate-600">{p.alamat || '-'}</td>
                <td className="px-3 py-3 text-slate-600">{p.totalTransaksi}</td>
                <td className="px-3 py-3"><div className="flex gap-1">
                  <button onClick={() => setRiwayatOf(p)} title="Riwayat transaksi" className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200">🕓</button>
                  <button onClick={() => openEdit(p)} className="rounded-lg bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-200">✏️</button>
                  <button onClick={() => setDelId(p.id)} className="rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-200">🗑️</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
