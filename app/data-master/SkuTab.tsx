'use client';

import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useSkus, type SkuItem } from '@/app/context/SkuContext';
import { ModalConfirm } from './modals';

/* ── helper: ekstrak marketplace dari status upload ── */
function extractMarketplaces(status: string): { name: string; color: string }[] {
  if (!status || status === 'nan') return [];
  const mp: { name: string; color: string }[] = [];
  const parts = status.split('|');
  for (const p of parts) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    const name = trimmed.split('—')[0]?.trim() || trimmed;
    const colors: Record<string, string> = { Shopee: 'bg-orange-100 text-orange-700', Tokopedia: 'bg-green-100 text-green-700', Lazada: 'bg-purple-100 text-purple-700', 'TikTok Shop': 'bg-slate-100 text-slate-700', Bukalapak: 'bg-red-100 text-red-700', Blibli: 'bg-blue-100 text-blue-700' };
    mp.push({ name, color: colors[name] || 'bg-slate-100 text-slate-600' });
  }
  return mp;
}

/* ── warna persentase perubahan harga ── */
function perubahanColor(p: string): string {
  if (!p || p.startsWith('??')) return 'text-slate-400';
  const num = parseFloat(p.replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return 'text-slate-400';
  if (num > 0) return 'text-red-500';
  if (num < 0) return 'text-emerald-500';
  return 'text-slate-400';
}

/* ── Rekam aktivitas user ke server (audit trail → KPI kinerja) ──
   Identitas user diambil server dari cookie login, klien cuma kirim aksinya. */
function recordAktivitas(entries: { aksi: string; sku?: string; nama?: string; detail: any }[]) {
  if (typeof window === 'undefined') return;
  try {
    fetch('/api/sku-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    });
  } catch {}
}

export function SkuTab() {
  const { skus, setSkus } = useSkus();
  const [search, setSearch] = useState('');
  const [hppFilter, setHppFilter] = useState<'semua' | 'tanpa-hpp' | 'tanpa-hj'>('semua');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [f, setF] = useState({ sku: '', nama: '', grade: '', kodeSupplierVarian: '', statusEditGambar: '', statusUploadToko: '', supplier: '', kategori: '', satuan: 'pcs', hargaModalLama: '', hargaBaru: '', hargaJual: '', minStok: '', aktif: 1 });
  const [ferr, setFerr] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const hargaBaruManual = useRef(false);

  interface PurchaseHistory {
    id: string; sku: string; supplier: string; hargaLama: number; hargaBaru: number;
    persentase: string; tanggal: string;
  }
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory[]>([]);

  const calcPersentase = (lama: number, baru: number): string => {
    if (!lama || lama === 0) return baru > 0 ? '+100.00%' : '0.00%';
    const pct = ((baru - lama) / lama) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
  };

  const setHargaModalLama = (val: string) => {
    setF(p => {
      const newVal = { ...p, hargaModalLama: val };
      if (!hargaBaruManual.current && val && (+val > 0)) newVal.hargaBaru = val;
      return newVal;
    });
  };
  const setHargaBaru = (val: string) => {
    hargaBaruManual.current = true;
    setF(p => ({ ...p, hargaBaru: val }));
  };

  const [calc, setCalc] = useState({ potonganMarketplace: '', biayaTetap: '1250', ekspetasiKeuntungan: '' });
  const [showCalc, setShowCalc] = useState(false);

  const hitungHargaJual = () => {
    const hb = +f.hargaBaru || 0; const pm = +calc.potonganMarketplace || 0; const bt = +calc.biayaTetap || 0; const ek = +calc.ekspetasiKeuntungan || 0;
    if (!hb || !pm || !ek) { setFerr('Isi Harga Baru, Potongan Marketplace %, dan Ekspetasi Keuntungan % terlebih dahulu.'); return; }
    if (pm >= 100) { setFerr('Potongan Marketplace tidak boleh ≥ 100%.'); return; }
    const hj = Math.round((hb * (1 + ek / 100) + bt) / (1 - pm / 100));
    setF(p => ({ ...p, hargaJual: String(hj) })); setFerr('');
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = skus;
    if (q) list = list.filter(i => i.nama.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
    if (hppFilter === 'tanpa-hpp') list = list.filter(i => !i.hargaBaru || i.hargaBaru <= 0);
    if (hppFilter === 'tanpa-hj') list = list.filter(i => !i.hargaJual || i.hargaJual <= 0);
    return list;
  }, [skus, search, hppFilter]);

  // ⚠️ Jumlah SKU yang belum punya HPP (Harga Beli/Baru) — biar user/pegawai tahu harus ngelengkapi apa
  const tanpaHppCount = useMemo(() => skus.filter(s => !s.hargaBaru || s.hargaBaru <= 0).length, [skus]);

  // ⚡ Pagination: jangan render 4700+ baris sekaligus (penyebab lambat)
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filtered, safePage]);

  // ⚡ Cache hasil parse marketplace per SKU (hindari split string berulang)
  const mpCache = useMemo(() => {
    const map = new Map<string, { name: string; color: string }[]>();
    for (const item of paginated) {
      map.set(item.id, extractMarketplaces(item.statusUploadToko));
    }
    return map;
  }, [paginated]);

  const goPage = (p: number) => setPage(Math.max(1, Math.min(totalPages, p)));

  const blank = () => ({ sku: '', nama: '', grade: '', kodeSupplierVarian: '', statusEditGambar: '', statusUploadToko: '', supplier: '', kategori: '', satuan: 'pcs', hargaModalLama: '', hargaBaru: '', hargaJual: '', minStok: '', aktif: 1 });
  const openAdd = () => { setF(blank()); setFerr(''); setShowForm(true); setEditId(null); hargaBaruManual.current = false; };
  const openEdit = (i: SkuItem) => {
    setF({ sku: i.sku, nama: i.nama, grade: i.grade, kodeSupplierVarian: i.kodeSupplierVarian, statusEditGambar: i.statusEditGambar, statusUploadToko: i.statusUploadToko, supplier: i.supplier, kategori: i.kategori, satuan: i.satuan, hargaModalLama: i.hargaModalLama ? String(i.hargaModalLama) : '', hargaBaru: String(i.hargaBaru), hargaJual: String(i.hargaJual), minStok: String(i.minStok), aktif: i.aktif });
    setFerr(''); setEditId(i.id); setShowForm(true);
  };

  const save = async () => {
    if (!f.sku || !f.nama) { setFerr('SKU dan Nama wajib diisi.'); return; }
    const hargaBaruFinal = +f.hargaBaru || +f.hargaModalLama || 0;
    const hargaModalFinal = +f.hargaModalLama || 0;
    const oldItem = editId ? skus.find(x => x.id === editId) : null;
    const pct = calcPersentase(oldItem?.hargaBaru ?? hargaModalFinal, hargaBaruFinal);

    if (f.supplier && hargaBaruFinal > 0 && (!oldItem || oldItem.hargaBaru !== hargaBaruFinal)) {
      setPurchaseHistory(prev => [{
        id: `ph-${Date.now()}`, sku: f.sku, supplier: f.supplier,
        hargaLama: oldItem?.hargaBaru || hargaModalFinal, hargaBaru: hargaBaruFinal,
        persentase: pct, tanggal: new Date().toISOString().slice(0, 10),
      }, ...prev]);
    }

    const oldHargaJual = oldItem ? oldItem.hargaJual : 0;

    const item: Omit<SkuItem, 'id'> = {
      sku: f.sku, nama: f.nama, grade: f.grade, kodeSupplierVarian: f.kodeSupplierVarian, statusEditGambar: f.statusEditGambar, statusUploadToko: f.statusUploadToko,
      supplier: f.supplier, kategori: f.kategori, satuan: f.satuan || 'pcs', hargaModalLama: hargaModalFinal, hargaBaru: hargaBaruFinal, hargaJual: +f.hargaJual || 0,
      stok: oldItem?.stok ?? 0, minStok: +f.minStok || 0, aktif: f.aktif, perubahanHargaBeli: pct,
    };

    try {
      if (editId) {
        await fetch('/api/sku-master', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...item }) });
        setSkus(prev => prev.map(x => x.id === editId ? { ...item, id: editId } : x));
      } else {
        const res = await fetch('/api/sku-master', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
        const json = await res.json();
        if (!res.ok || json.error) { setFerr(json.error || 'Gagal menyimpan ke server.'); return; }
        const newItem = json.item || { ...item, id: `tmp-${Date.now()}` };
        setSkus(prev => [newItem, ...prev.filter(x => x.sku !== newItem.sku)]);
      }
    } catch (err: any) {
      setFerr('Gagal menyimpan ke server: ' + (err?.message || 'koneksi gagal'));
      return;
    }

    setShowForm(false);

    // ── Rekam aktivitas user (untuk KPI) ──
    recordAktivitas([{
      aksi: editId ? 'ubah' : 'tambah',
      sku: f.sku, nama: f.nama,
      detail: editId ? {
        sebelum: { hargaModalLama: oldItem?.hargaModalLama ?? 0, hargaBaru: oldItem?.hargaBaru ?? 0, hargaJual: oldItem?.hargaJual ?? 0 },
        sesudah: { hargaModalLama: hargaModalFinal, hargaBaru: hargaBaruFinal, hargaJual: +f.hargaJual || 0 },
      } : { hargaBaru: hargaBaruFinal, hargaJual: +f.hargaJual || 0 },
    }]);

    if (typeof window !== 'undefined') {
      const newHargaJual = +f.hargaJual || 0;
      window.dispatchEvent(new CustomEvent('sku-saved', { detail: { sku: f.sku, oldHargaJual, newHargaJual } }));
      try {
        const queue = JSON.parse(localStorage.getItem('mma_pending_task_skus') || '[]');
        const existingIdx = queue.findIndex((q: any) => (typeof q === 'string' ? q : q.sku) === f.sku);
        if (existingIdx >= 0) queue[existingIdx] = { sku: f.sku, oldHargaJual, newHargaJual };
        else queue.push({ sku: f.sku, oldHargaJual, newHargaJual });
        localStorage.setItem('mma_pending_task_skus', JSON.stringify(queue));
      } catch {}
    }
  };

  const del = async () => {
    if (!deleteId) return;
    const item = skus.find(x => x.id === deleteId);
    try { await fetch(`/api/sku-master?id=${encodeURIComponent(deleteId)}`, { method: 'DELETE' }); } catch {}
    setSkus(prev => prev.filter(x => x.id !== deleteId));
    setDeleteId(null);

    // ── Rekam aktivitas hapus (untuk KPI) ──
    recordAktivitas([{ aksi: 'hapus', sku: item?.sku, nama: item?.nama, detail: { hargaBaru: item?.hargaBaru ?? 0, hargaJual: item?.hargaJual ?? 0 } }]);
  };

  const [upsertMode, setUpsertMode] = useState<'insert' | 'upsert'>('upsert');

  const uploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true); setFerr('');
    const ext = file.name.split('.').pop()?.toLowerCase();

    const parseRow = (row: string[]): Omit<SkuItem, 'id'> | null => {
      if (row.length < 12) return null;
      const sku = String(row[0] ?? '').trim(); if (!sku) return null;
      return {
        sku,
        nama: String(row[1] ?? '').trim(),
        grade: String(row[2] ?? '').trim(),
        kodeSupplierVarian: String(row[3] ?? '').trim(),
        statusEditGambar: String(row[4] ?? '').trim(),
        statusUploadToko: String(row[5] ?? '').trim(),
        supplier: String(row[6] ?? '').trim(),
        kategori: String(row[7] ?? '').trim(),
        satuan: String(row[8] ?? '').trim() || 'pcs',
        hargaModalLama: +String(row[9] ?? '').replace(/[^0-9.-]/g, '') || 0,
        hargaBaru: +String(row[10] ?? '').replace(/[^0-9.-]/g, '') || 0,
        hargaJual: +String(row[11] ?? '').replace(/[^0-9.-]/g, '') || 0,
        stok: +String(row[12] ?? '').replace(/[^0-9.-]/g, '') || 0,
        minStok: +String(row[13] ?? '').replace(/[^0-9.-]/g, '') || 0,
        aktif: +String(row[14] ?? '1').replace(/[^0-9]/g, '') || 1,
        perubahanHargaBeli: String(row[15] ?? '').trim(),
      };
    };

    const processRows = async (rows: string[][]) => {
      if (rows.length < 2) { setFerr('File butuh minimal 1 header + 1 data.'); setUploading(false); return; }
      const incoming: Omit<SkuItem, 'id'>[] = [];
      for (let i = 1; i < rows.length; i++) {
        const item = parseRow(rows[i]); if (item) incoming.push(item);
      }
      if (incoming.length === 0) { setFerr('Tidak ada data valid di file.'); setUploading(false); return; }

      let inserted = 0, updated = 0, skipped = 0;

      if (upsertMode === 'insert') {
        const existingSkus = new Set(skus.map(p => p.sku));
        const newOnly = incoming.filter(it => !existingSkus.has(it.sku));
        if (newOnly.length > 0) {
          try {
            const res = await fetch('/api/sku-master', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newOnly) });
            const json = await res.json();
            if (!res.ok || json.error) { setFerr('Upload gagal: ' + (json.error || 'error server')); setUploading(false); return; }
            if (json.items) setSkus(prev => [...json.items, ...prev]);
          } catch (err: any) {
            setFerr('Upload gagal: ' + (err?.message || 'koneksi gagal')); setUploading(false); return;
          }
        }
        inserted = newOnly.length;
        skipped = incoming.length - newOnly.length;
      } else {
        try {
          const res = await fetch('/api/sku-master', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(incoming) });
          const json = await res.json();
          if (!res.ok || json.error) { setFerr('Upload gagal: ' + (json.error || 'error server')); setUploading(false); return; }
          if (json.items) {
            const map = new Map(skus.map(p => [p.sku, p]));
            for (const it of json.items) map.set(it.sku, it);
            setSkus(Array.from(map.values()));
          }
        } catch (err: any) {
          setFerr('Upload gagal: ' + (err?.message || 'koneksi gagal')); setUploading(false); return;
        }
        const existingSkus = new Set(skus.map(p => p.sku));
        inserted = incoming.filter(it => !existingSkus.has(it.sku)).length;
        updated = incoming.filter(it => existingSkus.has(it.sku)).length;
      }

      // ── Rekam aktivitas upload (untuk KPI) ──
      recordAktivitas([{ aksi: 'upload', sku: '', nama: '', detail: { fileName: file.name, mode: upsertMode, inserted, updated, skipped } }]);

      if (typeof window !== 'undefined') {
        try {
          const queue = JSON.parse(localStorage.getItem('mma_pending_task_skus') || '[]');
          for (const item of incoming) {
            window.dispatchEvent(new CustomEvent('sku-saved', { detail: { sku: item.sku, oldHargaJual: 0, newHargaJual: item.hargaJual } }));
            const existingIdx = queue.findIndex((q: any) => (typeof q === 'string' ? q : q.sku) === item.sku);
            if (existingIdx >= 0) queue[existingIdx] = { sku: item.sku, oldHargaJual: 0, newHargaJual: item.hargaJual };
            else queue.push({ sku: item.sku, oldHargaJual: 0, newHargaJual: item.hargaJual });
          }
          localStorage.setItem('mma_pending_task_skus', JSON.stringify(queue));
        } catch {}
      }

      const parts: string[] = [];
      if (updated > 0) parts.push(`${updated} diupdate`);
      if (inserted > 0) parts.push(`${inserted} baru`);
      if (skipped > 0) parts.push(`${skipped} dilewati (sudah ada)`);
      setFerr('');
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
      alert(`✅ Upload selesai: ${parts.join(', ')}. Total ${incoming.length} baris diproses.`);
    };

    if (ext === 'csv') {
      const r = new FileReader();
      r.onload = ev => {
        const txt = ev.target?.result as string;
        const rows = txt.split('\n').filter(l => l.trim()).map(l => l.split(',').map(c => c.trim().replace(/"/g, '')));
        processRows(rows);
      };
      r.onerror = () => { setFerr('Gagal membaca file CSV.'); setUploading(false); };
      r.readAsText(file);
    } else {
      const r = new FileReader();
      r.onload = ev => {
        try {
          const data = new Uint8Array(ev.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
          processRows(rows.map(row => row.map(c => String(c ?? ''))));
        } catch { setFerr('Gagal membaca file Excel. Pastikan format .xlsx atau .xls.'); setUploading(false); }
      };
      r.onerror = () => { setFerr('Gagal membaca file.'); setUploading(false); };
      r.readAsArrayBuffer(file);
    }
  };

  const detailItem = detailId ? skus.find(x => x.id === detailId) : null;

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold text-slate-800 sm:text-xl">📦 Master SKU</h2><p className="text-sm text-slate-500">{filtered.length} dari {skus.length} SKU{tanpaHppCount > 0 && <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">⚠️ {tanpaHppCount} tanpa HPP</span>}</p></div>
        <div className="flex gap-2 flex-wrap">
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="🔍 Cari SKU / Nama..." className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none sm:max-w-[180px]" />
          <select value={hppFilter} onChange={e => { setHppFilter(e.target.value as 'semua' | 'tanpa-hpp' | 'tanpa-hj'); setPage(1); }} className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 focus:border-brand-500 focus:outline-none" title="Filter Harga">
            <option value="semua">Semua Harga</option>
            <option value="tanpa-hpp">⚠️ Tanpa HPP (Harga Beli)</option>
            <option value="tanpa-hj">💰 Tanpa Harga Jual</option>
          </select>
          <button onClick={openAdd} className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">+ Tambah</button>
          <select value={upsertMode} onChange={e => setUpsertMode(e.target.value as 'insert' | 'upsert')} className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 focus:border-brand-500 focus:outline-none" title="Mode Upload">
            <option value="upsert">🔄 Upsert</option>
            <option value="insert">➕ Insert Only</option>
          </select>
          <label className={`cursor-pointer rounded-xl px-3 py-1.5 text-sm font-semibold text-white transition ${uploading ? 'bg-slate-400' : 'bg-emerald-500 hover:bg-emerald-600'}`}>{uploading ? '⏳ Memproses...' : '📥 Upload Excel'}<input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={uploadFile} className="hidden" disabled={uploading} /></label>
        </div>
      </div>
      {ferr && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{ferr}</p>}

      {/* ── Form modal ── */}
      {showForm && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 overflow-y-auto py-8"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl mx-4">
        <p className="text-lg font-bold text-slate-800">{editId ? '✏️ Ubah SKU' : '➕ Tambah SKU'}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">SKU *</span><input value={f.sku} onChange={e => setF({ ...f, sku: e.target.value })} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Grade</span><input value={f.grade} onChange={e => setF({ ...f, grade: e.target.value })} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1 col-span-2"><span className="text-xs font-semibold text-slate-600">Nama *</span><input value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Kategori</span><input value={f.kategori} onChange={e => setF({ ...f, kategori: e.target.value })} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Satuan</span><input value={f.satuan} onChange={e => setF({ ...f, satuan: e.target.value })} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Supplier</span><input value={f.supplier} onChange={e => setF({ ...f, supplier: e.target.value })} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Kode Supplier Varian</span><input value={f.kodeSupplierVarian} onChange={e => setF({ ...f, kodeSupplierVarian: e.target.value })} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Harga Modal Lama</span><input type="number" value={f.hargaModalLama} onChange={e => setHargaModalLama(e.target.value)} placeholder="Kosong = belum upload" className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Harga Baru (Beli) {!hargaBaruManual.current && f.hargaModalLama && f.hargaBaru === f.hargaModalLama && <span className="text-amber-500 text-[10px]">↳ auto dari Modal</span>}{f.hargaModalLama && f.hargaBaru && +f.hargaModalLama > 0 && +f.hargaBaru !== +f.hargaModalLama && <span className={`text-[10px] ml-1 font-bold ${+f.hargaBaru > +f.hargaModalLama ? 'text-red-500' : 'text-emerald-500'}`}>Δ {calcPersentase(+f.hargaModalLama, +f.hargaBaru)}</span>}</span><input type="number" value={f.hargaBaru} onChange={e => setHargaBaru(e.target.value)} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>

          {/* ── Kalkulator Harga Jual ── */}
          <div className="col-span-2 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-3">
            <button type="button" onClick={() => setShowCalc(!showCalc)} className="flex w-full items-center justify-between text-left">
              <span className="text-xs font-bold text-amber-700">🧮 Kalkulator Harga Jual</span>
              <span className="text-xs text-amber-500">{showCalc ? '▲ Sembunyikan' : '▼ Buka'}</span>
            </button>
            {showCalc && <div className="mt-3 grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Potongan Marketplace (%)</span><input type="number" step="0.1" value={calc.potonganMarketplace} onChange={e => setCalc({ ...calc, potonganMarketplace: e.target.value })} placeholder="cth: 10" className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none" /></label>
              <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Biaya Tetap (Rp)</span><input type="number" value={calc.biayaTetap} onChange={e => setCalc({ ...calc, biayaTetap: e.target.value })} className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none" /></label>
              <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Keuntungan Bersih (%)</span><input type="number" step="0.1" value={calc.ekspetasiKeuntungan} onChange={e => setCalc({ ...calc, ekspetasiKeuntungan: e.target.value })} placeholder="cth: 20" className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none" /></label>
              <div className="col-span-3 flex items-end gap-2">
                <button type="button" onClick={hitungHargaJual} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600">🪄 Hitung Harga Jual</button>
                {f.hargaJual && <span className="text-xs text-slate-400">Hasil: <strong className="text-brand-600">Rp {(+f.hargaJual).toLocaleString('id-ID')}</strong></span>}
              </div>
              <div className="col-span-3 text-[10px] text-slate-400 leading-relaxed">Rumus: HJ = (Harga Baru × (1 + Keuntungan%) + Biaya Tetap) ÷ (1 − Potongan Marketplace%)</div>
            </div>}
          </div>

          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Harga Jual {f.hargaJual && <span className="text-emerald-500">✓ Auto</span>}</span><input type="number" value={f.hargaJual} onChange={e => setF({ ...f, hargaJual: e.target.value })} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Min Stok</span><input type="number" value={f.minStok} onChange={e => setF({ ...f, minStok: e.target.value })} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Status Edit Gambar</span><input value={f.statusEditGambar} onChange={e => setF({ ...f, statusEditGambar: e.target.value })} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1 col-span-2"><span className="text-xs font-semibold text-slate-600">Status Upload Toko</span><input value={f.statusUploadToko} onChange={e => setF({ ...f, statusUploadToko: e.target.value })} placeholder="Shopee — Nama Toko | Lazada — Nama Toko" className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.aktif === 1} onChange={e => setF({ ...f, aktif: e.target.checked ? 1 : 0 })} className="rounded" /><span className="text-xs font-semibold text-slate-600">Aktif</span></label>
        </div>
        <div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowForm(false)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button><button onClick={save} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white">{editId ? 'Update' : 'Simpan'}</button></div>
      </div></div>)}

      {/* ── Detail modal ── */}
      {detailItem && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 overflow-y-auto py-8"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl mx-4">
        <div className="flex items-center justify-between"><p className="text-lg font-bold text-slate-800">📋 Detail SKU</p><button onClick={() => setDetailId(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button></div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {[['SKU', detailItem.sku], ['Nama', detailItem.nama], ['Grade', detailItem.grade], ['Kategori', detailItem.kategori], ['Satuan', detailItem.satuan], ['Supplier', detailItem.supplier || '-'], ['Kode Supplier Varian', detailItem.kodeSupplierVarian || '-'], ['Status Edit Gambar', detailItem.statusEditGambar || '-'], ['Harga Modal Lama', detailItem.hargaModalLama ? `Rp ${detailItem.hargaModalLama.toLocaleString('id-ID')}` : '⚠ Belum ada'], ['Harga Baru', `Rp ${detailItem.hargaBaru.toLocaleString('id-ID')}`], ['Harga Jual', `Rp ${detailItem.hargaJual.toLocaleString('id-ID')}`], ['Stok', String(detailItem.stok)], ['Min Stok', String(detailItem.minStok)], ['Aktif', detailItem.aktif === 1 ? '✅ Ya' : '❌ Tidak'], ['Perubahan Harga Beli', detailItem.perubahanHargaBeli || '-']].map(([label, val]) => (<div key={label} className="flex flex-col"><span className="text-xs text-slate-400">{label}</span><span className="font-medium text-slate-800">{val}</span></div>))}
        </div>
        <div className="mt-3"><span className="text-xs text-slate-400">Status Upload Toko</span><div className="mt-1 flex flex-wrap gap-1">{extractMarketplaces(detailItem.statusUploadToko).length > 0 ? extractMarketplaces(detailItem.statusUploadToko).map((mp, i) => <span key={i} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${mp.color}`}>{mp.name}</span>) : <span className="text-sm text-slate-400">-</span>}</div></div>

        {purchaseHistory.filter(h => h.sku === detailItem.sku).length > 0 && (
          <div className="mt-4 border-t pt-3">
            <p className="text-sm font-bold text-slate-700">📜 Riwayat Perubahan Harga Beli</p>
            <div className="mt-2 max-h-[200px] overflow-y-auto space-y-1">
              {purchaseHistory.filter(h => h.sku === detailItem.sku).map(h => (
                <div key={h.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-700">{h.supplier || 'Supplier'}</span>
                    <span className="text-slate-400 mx-1">•</span>
                    <span className="text-slate-500">{h.tanggal}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Rp {h.hargaLama.toLocaleString('id-ID')} →</span>
                    <span className="font-bold text-slate-800">Rp {h.hargaBaru.toLocaleString('id-ID')}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${h.persentase.startsWith('+') ? 'bg-red-100 text-red-600' : h.persentase === '0.00%' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-600'}`}>{h.persentase}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end"><button onClick={() => setDetailId(null)} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white">Tutup</button></div>
      </div></div>)}

      {/* ── Tabel utama ── */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full table-fixed text-left text-xs" style={{ minWidth: '800px' }}>
          <thead><tr className="bg-brand-50 text-[11px] uppercase text-brand-500">
            <th className="px-1.5 py-2 font-semibold w-[80px]">SKU</th>
            <th className="px-1.5 py-2 font-semibold w-[180px]">Nama</th>
            <th className="px-1.5 py-2 font-semibold w-[44px]">Gr.</th>
            <th className="px-1.5 py-2 font-semibold w-[70px]">Kategori</th>
            <th className="px-1.5 py-2 font-semibold w-[80px]">Harga Baru</th>
            <th className="px-1.5 py-2 font-semibold w-[80px]">Harga Jual</th>
            <th className="px-1.5 py-2 font-semibold w-[50px]">Stok</th>
            <th className="px-1.5 py-2 font-semibold w-[110px]">Upload Toko</th>
            <th className="px-1.5 py-2 font-semibold w-[56px]">Δ Harga</th>
            <th className="px-1.5 py-2 font-semibold w-[56px]">Aksi</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {paginated.length === 0 ? <tr><td colSpan={10} className="py-10 text-center text-slate-400">{hppFilter !== 'semua' ? 'Tidak ada SKU yang cocok dengan filter ini. 🎉' : 'Tidak ada SKU. Upload file Excel atau tambah manual.'}</td></tr>
              : paginated.map((item, i) => (<tr key={item.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} ${item.stok < item.minStok ? 'border-l-4 border-l-red-400' : ''} cursor-pointer hover:bg-brand-50/50`} onClick={() => setDetailId(item.id)}>
                <td className="px-1.5 py-1.5 font-mono text-[11px] text-brand-700 truncate" title={item.sku}>{item.sku}</td>
                <td className="px-1.5 py-1.5 truncate text-[11px] font-medium text-slate-800" title={item.nama}>{item.nama}</td>
                <td className="px-1.5 py-1.5"><span className={`rounded-full px-1 py-0.5 text-[10px] font-semibold ${item.grade === 'A' ? 'bg-emerald-100 text-emerald-700' : item.grade === 'B' ? 'bg-amber-100 text-amber-700' : item.grade === 'C' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{item.grade || '-'}</span></td>
                <td className="px-1.5 py-1.5 text-[10px] text-slate-600 truncate" title={item.kategori}>{item.kategori || '-'}</td>
                <td className="px-1.5 py-1.5 text-[11px] whitespace-nowrap">{item.hargaBaru > 0 ? `Rp ${item.hargaBaru.toLocaleString('id-ID')}` : <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">⚠ 0</span>}</td>
                <td className="px-1.5 py-1.5 text-[11px] font-semibold text-brand-700 whitespace-nowrap">Rp {item.hargaJual.toLocaleString('id-ID')}</td>
                <td className="px-1.5 py-1.5"><span className={`text-[11px] font-semibold ${item.stok < item.minStok ? 'text-red-500' : item.stok === 0 ? 'text-slate-400' : 'text-slate-700'}`}>{item.stok}{item.stok < item.minStok && ' ⚠'}</span></td>
                <td className="px-1.5 py-1.5"><div className="flex flex-wrap gap-0.5">{(() => { const mps = mpCache.get(item.id) || []; return <>{mps.slice(0, 2).map((mp, j) => <span key={j} className={`rounded-full px-1 py-0.5 text-[10px] font-semibold leading-none ${mp.color}`}>{mp.name}</span>)}{mps.length > 2 && <span className="text-[10px] text-slate-400">+{mps.length - 2}</span>}</>; })()}</div></td>
                <td className={`px-1.5 py-1.5 text-[10px] font-semibold whitespace-nowrap ${perubahanColor(item.perubahanHargaBeli)}`}>{item.perubahanHargaBeli || '-'}</td>
                <td className="px-1.5 py-1.5" onClick={e => e.stopPropagation()}><div className="flex gap-0.5"><button onClick={() => openEdit(item)} className="rounded-md bg-brand-100 px-1.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-200">✏️</button><button onClick={() => setDeleteId(item.id)} className="rounded-md bg-red-100 px-1.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-200">🗑️</button></div></td>
              </tr>))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {filtered.length > PAGE_SIZE && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            Menampilkan <strong>{((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}</strong> dari <strong>{filtered.length}</strong> SKU
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => goPage(1)} disabled={safePage === 1} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-brand-50 disabled:opacity-40">«</button>
            <button onClick={() => goPage(safePage - 1)} disabled={safePage === 1} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-brand-50 disabled:opacity-40">‹</button>
            <span className="px-2 py-1 text-xs font-bold text-slate-700">Hal {safePage} / {totalPages}</span>
            <button onClick={() => goPage(safePage + 1)} disabled={safePage === totalPages} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-brand-50 disabled:opacity-40">›</button>
            <button onClick={() => goPage(totalPages)} disabled={safePage === totalPages} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-brand-50 disabled:opacity-40">»</button>
          </div>
        </div>
      )}
      {deleteId && <ModalConfirm title="Konfirmasi Hapus" msg="Yakin hapus SKU ini?" onCancel={() => setDeleteId(null)} onConfirm={del} />}
    </div>
  );
}
