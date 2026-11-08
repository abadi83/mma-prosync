'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useUser } from '@/app/hooks/useUser';
import { RndItem, RndProgressItem, RndStatus, RndPrioritas } from '@/app/services/rndService';
import { compressImageFile } from '@/app/lib/imageUtils';

const STATUS_LABEL: Record<RndStatus, string> = { todo: 'Todo', proses: 'Proses', review: 'Review', selesai: 'Selesai' };
const STATUS_BADGE: Record<RndStatus, string> = {
  todo: 'bg-slate-100 text-slate-600',
  proses: 'bg-blue-100 text-blue-700',
  review: 'bg-amber-100 text-amber-700',
  selesai: 'bg-emerald-100 text-emerald-700',
};
const PRIORITAS_BADGE: Record<RndPrioritas, string> = {
  rendah: 'bg-slate-100 text-slate-500',
  normal: 'bg-sky-100 text-sky-700',
  tinggi: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

interface PegawaiDb { id: string; nama: string; jabatan?: string; status?: string; roles?: string[]; }

function fmtDate(s: string | null): string {
  if (!s) return '—';
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return s;
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function rupiah(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

async function fetchDetail(id: string): Promise<{ item: RndItem; riwayat: RndProgressItem[] } | null> {
  try {
    const res = await fetch(`/api/rnd?id=${encodeURIComponent(id)}`);
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

/* ================================================================ */
export default function RndTab() {
  const { nama, roles } = useUser();
  const canKelola = roles.includes('admin') || roles.includes('pengawas');
  const [items, setItems] = useState<RndItem[]>([]);
  const [pegawai, setPegawai] = useState<PegawaiDb[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<RndItem | null>(null);
  const [detail, setDetail] = useState<{ item: RndItem; riwayat: RndProgressItem[] } | null>(null);
  const [hapusItem, setHapusItem] = useState<RndItem | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/rnd');
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); const t = setInterval(refresh, 30000); return () => clearInterval(t); }, [refresh]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/pegawai');
        if (res.ok && active) {
          const data = await res.json();
          setPegawai(Array.isArray(data) ? data.filter((p: PegawaiDb) => p.status === 'Aktif') : []);
        }
      } catch {}
    })();
    return () => { active = false; };
  }, []);

  const openDetail = async (id: string) => {
    const d = await fetchDetail(id);
    if (d) setDetail(d);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter(t => {
      if (fStatus && t.status !== fStatus) return false;
      if (q && !(`${t.namaBarang} ${t.kategori} ${t.supplier} ${t.petugas.map(p => p.nama).join(' ')}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [items, search, fStatus]);

  const stat = (s: string) => items.filter(t => t.status === s).length;

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🧪 Research Produk Baru (R&D)</h2>
          <p className="text-sm text-slate-500">{items.length} research • {stat('selesai')} selesai</p>
        </div>
        {canKelola && (
          <button onClick={() => { setEditItem(null); setShowForm(true); }} className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">+ Research Baru</button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['todo', 'proses', 'review', 'selesai'] as RndStatus[]).map(s => (
          <div key={s} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
            <p className={`text-xs font-semibold ${STATUS_BADGE[s].split(' ')[1]}`}>{STATUS_LABEL[s]}</p>
            <p className="text-xl font-bold text-slate-800">{stat(s)}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama barang, kategori, supplier…" className="min-w-[200px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
          <option value="">Semua status</option>
          <option value="todo">Todo</option>
          <option value="proses">Proses</option>
          <option value="review">Review</option>
          <option value="selesai">Selesai</option>
        </select>
      </div>

      {loading ? (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">Memuat…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">Belum ada research produk. Klik "+ Research Baru" untuk mulai.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map(t => (
            <div key={t.id} className="rounded-xl border border-slate-100 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-slate-800">{t.namaBarang}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PRIORITAS_BADGE[t.prioritas]}`}>{t.prioritas}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t.kategori && <span className="mr-2">🏷️ {t.kategori}</span>}
                    {t.supplier && <span className="mr-2">🚚 {t.supplier}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Target modal: <span className="font-semibold text-slate-700">{rupiah(t.hargaModalTarget)}</span>
                    {t.hargaModalFinal !== null && t.hargaModalFinal !== undefined && (
                      <> • Hasil: <span className="font-semibold text-emerald-700">{rupiah(t.hargaModalFinal)}</span></>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Petugas: {t.petugas.length ? t.petugas.map(p => p.nama).join(', ') : '—'} • diberikan {t.pemberiNama || '—'}
                    {t.tenggat && <> • tenggat {fmtDate(t.tenggat)}</>}
                  </p>
                  {t.linkWeb && <a href={t.linkWeb} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block max-w-full truncate text-xs font-semibold text-brand-600 hover:underline">🔗 {t.linkWeb}</a>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openDetail(t.id)} title="Detail & update hasil" className="rounded-lg bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-200">📄</button>
                  {canKelola && <button onClick={() => { setEditItem(t); setShowForm(true); }} title="Edit / assign ulang" className="rounded-lg bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-200">✏️</button>}
                  {canKelola && <button onClick={() => setHapusItem(t)} title="Hapus" className="rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-200">🗑️</button>}
                </div>
              </div>
              {t.hasilResearch && (
                <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm text-slate-700">
                  <p className="text-[10px] font-bold uppercase text-emerald-600">🧪 Hasil Research</p>
                  <p className="mt-0.5 whitespace-pre-wrap">{t.hasilResearch}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && <FormRnd pegawai={pegawai} edit={editItem} pemberiNama={nama} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refresh(); }} />}
      {detail && <DetailRnd item={detail.item} riwayat={detail.riwayat} pegawai={pegawai} canKelola={canKelola} onClose={() => setDetail(null)} onSaved={async () => { await refresh(); const d = await fetchDetail(detail.item.id); setDetail(d); }} />}
      {hapusItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-80 rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-lg font-bold text-slate-800">🗑️ Hapus Research</p>
            <p className="mt-2 text-sm text-slate-600">Yakin hapus "{hapusItem.namaBarang}"? Seluruh riwayat progress ikut terhapus.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setHapusItem(null)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button>
              <button onClick={async () => { await fetch(`/api/rnd?id=${encodeURIComponent(hapusItem.id)}`, { method: 'DELETE' }); setHapusItem(null); refresh(); }} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================ */
function FormRnd({ pegawai, edit, pemberiNama, onClose, onSaved }: {
  pegawai: PegawaiDb[]; edit: RndItem | null; pemberiNama: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [fotoLoading, setFotoLoading] = useState(false);
  const [f, setF] = useState({
    namaBarang: edit?.namaBarang || '',
    kategori: edit?.kategori || '',
    supplier: edit?.supplier || '',
    linkWeb: edit?.linkWeb || '',
    fotoContoh: edit?.fotoContoh || '',
    hargaModalTarget: edit?.hargaModalTarget ? String(edit.hargaModalTarget) : '',
    catatan: edit?.catatan || '',
    tenggat: edit?.tenggat || '',
    prioritas: edit?.prioritas || ('normal' as RndPrioritas),
    petugasIds: edit?.petugas.map(p => p.id) || ([] as string[]),
  });
  const fileRef = React.useRef<HTMLInputElement>(null);

  const togglePetugas = (id: string) => {
    setF(prev => ({
      ...prev,
      petugasIds: prev.petugasIds.includes(id)
        ? prev.petugasIds.filter(x => x !== id)
        : [...prev.petugasIds, id],
    }));
  };

  const handleFotoPicked = async (file: File) => {
    setFotoLoading(true);
    try {
      const compressed = await compressImageFile(file, 1000, 1000, 0.7);
      setF(prev => ({ ...prev, fotoContoh: compressed }));
    } catch { setErr('Gagal membaca foto.'); }
    finally { setFotoLoading(false); }
  };

  const save = async () => {
    if (!f.namaBarang.trim()) { setErr('Nama barang wajib diisi.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/rnd', {
        method: edit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(edit ? { id: edit.id } : {}),
          namaBarang: f.namaBarang,
          kategori: f.kategori,
          supplier: f.supplier,
          linkWeb: f.linkWeb,
          fotoContoh: f.fotoContoh,
          hargaModalTarget: f.hargaModalTarget ? Number(f.hargaModalTarget) : 0,
          catatan: f.catatan,
          tenggat: f.tenggat,
          prioritas: f.prioritas,
          petugasIds: f.petugasIds,
        }),
      });
      if (res.ok) onSaved();
      else setErr((await res.json())?.error || 'Gagal menyimpan.');
    } catch { setErr('Gagal terhubung ke server.'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <p className="text-lg font-bold text-slate-800">{edit ? '✏️ Edit Research' : '🧪 Research Produk Baru'}</p>
        <div className="mt-3 space-y-2">
          <input value={f.namaBarang} onChange={e => setF({ ...f, namaBarang: e.target.value })} placeholder="Nama barang *" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          <div className="grid grid-cols-2 gap-2">
            <input value={f.kategori} onChange={e => setF({ ...f, kategori: e.target.value })} placeholder="Kategori" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            <input value={f.supplier} onChange={e => setF({ ...f, supplier: e.target.value })} placeholder="Supplier" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
          <input value={f.linkWeb} onChange={e => setF({ ...f, linkWeb: e.target.value })} placeholder="Link web tempat cari barang" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          <div>
            <label className="text-xs font-semibold text-slate-500">Contoh Foto</label>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (file) handleFotoPicked(file); }} className="hidden" />
              <button type="button" onClick={() => fileRef.current?.click()} className="shrink-0 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200">📤 Upload foto</button>
              <input value={f.fotoContoh.startsWith('data:') ? '' : f.fotoContoh} onChange={e => setF({ ...f, fotoContoh: e.target.value })} placeholder="atau tempel URL foto" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            {fotoLoading && <span className="mt-1 text-xs text-slate-400">Mengompresi foto…</span>}
            {f.fotoContoh && (
              <div className="relative mt-2 inline-block">
                <img src={f.fotoContoh} alt="foto contoh" className="h-24 rounded-xl border object-cover" />
                <button type="button" onClick={() => setF({ ...f, fotoContoh: '' })} className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-red-500 text-xs text-white">✕</button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-500">Harga Modal Target</label>
              <input type="number" value={f.hargaModalTarget} onChange={e => setF({ ...f, hargaModalTarget: e.target.value })} placeholder="0" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Prioritas</label>
              <select value={f.prioritas} onChange={e => setF({ ...f, prioritas: e.target.value as RndPrioritas })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                <option value="rendah">Rendah</option>
                <option value="normal">Normal</option>
                <option value="tinggi">Tinggi</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Tenggat</label>
            <input type="date" value={f.tenggat} onChange={e => setF({ ...f, tenggat: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
          <textarea value={f.catatan} onChange={e => setF({ ...f, catatan: e.target.value })} placeholder="Instruksi / catatan tambahan…" rows={2} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />


          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500">Petugas (bisa lebih dari 1) — klik untuk pilih</span>
            <div className="flex flex-wrap gap-1.5">
              {pegawai.length === 0 && <span className="text-xs text-slate-400">Tidak ada pegawai aktif.</span>}
              {pegawai.map(p => {
                const on = f.petugasIds.includes(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => togglePetugas(p.id)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${on ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-brand-100'}`}>
                    {p.nama}
                  </button>
                );
              })}
            </div>
          </label>
          {err && <p className="text-xs font-semibold text-red-600">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button>
            <button onClick={save} disabled={busy} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{busy ? 'Menyimpan…' : 'Simpan'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================ */
function DetailRnd({ item, riwayat, pegawai, canKelola, onClose, onSaved }: {
  item: RndItem; riwayat: RndProgressItem[]; pegawai: PegawaiDb[];
  canKelola: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [promoteBusy, setPromoteBusy] = useState(false);
  const [promoteMsg, setPromoteMsg] = useState('');
  const [hasil, setHasil] = useState(item.hasilResearch || '');
  const [hargaFinal, setHargaFinal] = useState(item.hargaModalFinal !== null && item.hargaModalFinal !== undefined ? String(item.hargaModalFinal) : '');
  const [catatan, setCatatan] = useState('');
  const [status, setStatus] = useState<RndStatus>(item.status);

  const promoteKeSku = async () => {
    setPromoteBusy(true);
    setPromoteMsg('');
    try {
      const res = await fetch('/api/rnd/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setPromoteMsg(`✅ Berhasil masuk Master Data SKU (${data.sku}).`);
        onSaved();
      } else {
        setPromoteMsg(data?.error || 'Gagal memasukkan ke SKU.');
      }
    } catch { setPromoteMsg('Gagal terhubung ke server.'); }
    finally { setPromoteBusy(false); }
  };

  const simpanProgress = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/rnd', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          hasilResearch: hasil,
          hargaModalFinal: hargaFinal === '' ? null : Number(hargaFinal),
          catatan: catatan,
          status,
        }),
      });
      if (res.ok) { setCatatan(''); onSaved(); }
    } catch {} finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-lg font-bold text-slate-800">🧪 {item.namaBarang}</p>
            <p className="text-xs text-slate-500">
              {item.kategori && <span className="mr-2">🏷️ {item.kategori}</span>}
              {item.supplier && <span className="mr-2">🚚 {item.supplier}</span>}
            </p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[item.status]}`}>{STATUS_LABEL[item.status]}</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold text-slate-500">Target Modal</p>
            <p className="font-bold text-slate-800">{rupiah(item.hargaModalTarget)}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold text-slate-500">Hasil Modal</p>
            <p className="font-bold text-emerald-700">{rupiah(item.hargaModalFinal)}</p>
          </div>
        </div>

        <p className="mt-2 text-xs text-slate-500">Petugas: {item.petugas.length ? item.petugas.map(p => p.nama).join(', ') : '—'} • diberikan {item.pemberiNama || '—'}</p>
        {item.linkWeb && <a href={item.linkWeb} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block max-w-full truncate text-xs font-semibold text-brand-600 hover:underline">🔗 {item.linkWeb}</a>}
        {item.fotoContoh && (
          <a href={item.fotoContoh} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block">
            <img src={item.fotoContoh} alt="foto contoh" className="max-h-40 rounded-xl border object-cover" />
          </a>
        )}
        {item.catatan && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{item.catatan}</p>}

        {/* Masukkan ke Master Data SKU */}
        <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
          {item.skuId ? (
            <p className="text-xs font-semibold text-indigo-600">📦 Sudah masuk Master Data SKU.</p>
          ) : (
            <div>
              <p className="text-xs font-semibold text-indigo-600">📦 Research selesai? Masukkan ke Master Data SKU.</p>
              <button onClick={promoteKeSku} disabled={promoteBusy || !canKelola} className="mt-2 rounded-xl bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-50">{promoteBusy ? 'Memproses…' : 'Masukkan ke SKU'}</button>
            </div>
          )}
          {promoteMsg && <p className="mt-1.5 text-xs font-semibold text-slate-600">{promoteMsg}</p>}
        </div>



        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
          <p className="text-xs font-bold uppercase text-slate-500">Update Hasil Research</p>
          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-500">Harga Modal Final</label>
                <input type="number" value={hargaFinal} onChange={e => setHargaFinal(e.target.value)} placeholder="0" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value as RndStatus)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                  <option value="todo">Todo</option>
                  <option value="proses">Proses</option>
                  <option value="review">Review</option>
                  <option value="selesai">Selesai</option>
                </select>
              </div>
            </div>
            <textarea value={hasil} onChange={e => setHasil(e.target.value)} placeholder="Laporan hasil research (supplier ketemu, link, harga, dll)…" rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            <input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan progress singkat…" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            <div className="flex justify-end">
              <button onClick={simpanProgress} disabled={busy} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{busy ? 'Menyimpan…' : 'Simpan Progress'}</button>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-bold uppercase text-slate-500">Riwayat</p>
          {riwayat.length === 0 ? (
            <p className="mt-1 text-xs text-slate-400">Belum ada riwayat.</p>
          ) : (
            <div className="mt-1 space-y-1">
              {riwayat.map(r => (
                <div key={r.id} className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                  <span className="font-semibold">{r.userNama}</span> • {r.tanggal}
                  {r.status && <span className="ml-2 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{r.status}</span>}
                  {r.catatan && <p className="mt-0.5 whitespace-pre-wrap text-slate-600">{r.catatan}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Tutup</button>
        </div>
      </div>
    </div>
  );
}

