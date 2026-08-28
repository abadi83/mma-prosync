'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAkuntansi } from '@/app/context/AkuntansiContext';
import { recordActivity } from '@/app/lib/recordActivity';

/* ═══════════════════════════════════════════════════════════════════ */
/* HAPUS DATA (per tanggal & supplier) — Pembelian SKU + Pembayaran PO */
/* ═══════════════════════════════════════════════════════════════════ */

const HPP_STORAGE = 'mma_hpp_purchases';
const PAYMENT_STORAGE = 'mma_payment_history';
const BUKTI_STORAGE = 'mma_bukti_bayar';
const HARGA_HISTORY = 'mma_harga_modal_history';

interface HppPurchase {
  id: string; noPO: string; sku: string; namaSku: string;
  supplierId: string; supplierNama: string; qty: number; hargaBeli: number;
  total: number; dibayar: number; sisaTagihan: number; tanggal: string; lunas: boolean;
}
interface PaymentRecord {
  id: string; poId: string; noPO: string; supplierNama: string;
  jumlahDibayar: number; sisaSebelum: number; sisaSesudah: number;
  metode: string; nomorRef: string; catatan: string; tanggalBayar: string; dibayarOleh: string;
}
interface BuktiBayar {
  id: string; paymentId: string; noPO: string; supplierNama: string; jumlah: number;
}

function useLocalStorage<T>(key: string, fallback: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [val, setVal] = useState<T>(fallback);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try { const raw = localStorage.getItem(key); if (raw) setVal(JSON.parse(raw)); } catch {}
    setHydrated(true);
  }, [key]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [val, key, hydrated]);
  return [val, setVal];
}

const fmtRp = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

export default function HapusDataTab() {
  const [hppData, setHppData] = useLocalStorage<HppPurchase[]>(HPP_STORAGE, []);
  const [payments, setPayments] = useLocalStorage<PaymentRecord[]>(PAYMENT_STORAGE, []);
  const [bukti, setBukti] = useLocalStorage<BuktiBayar[]>(BUKTI_STORAGE, []);
  const { jurnal, deleteJurnal } = useAkuntansi();

  // Live reload kalau Pembelian update PO
  useEffect(() => {
    const reload = () => {
      try { const raw = localStorage.getItem(HPP_STORAGE); if (raw) setHppData(JSON.parse(raw)); } catch {}
    };
    window.addEventListener('storage', reload);
    window.addEventListener('pembelian-updated', reload);
    return () => {
      window.removeEventListener('storage', reload);
      window.removeEventListener('pembelian-updated', reload);
    };
  }, [setHppData]);

  const [mode, setMode] = useState<'po' | 'bayar'>('po');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [dari, setDari] = useState('');
  const [sampai, setSampai] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  /* ── Group PO (Pembelian SKU) ── */
  const poGroups = useMemo(() => {
    const map = new Map<string, { noPO: string; supplierId: string; supplierNama: string; tanggal: string; total: number; dibayar: number; sisa: number; jumlahSku: number }>();
    for (const p of hppData) {
      const g = map.get(p.noPO) || { noPO: p.noPO, supplierId: p.supplierId, supplierNama: p.supplierNama, tanggal: p.tanggal || '', total: 0, dibayar: 0, sisa: 0, jumlahSku: 0 };
      g.total += p.total; g.dibayar += p.dibayar; g.sisa += p.sisaTagihan; g.jumlahSku += 1;
      if (p.tanggal && (!g.tanggal || p.tanggal < g.tanggal)) g.tanggal = p.tanggal;
      map.set(p.noPO, g);
    }
    return Array.from(map.values()).sort((a, b) => b.noPO.localeCompare(a.noPO));
  }, [hppData]);

  const poFiltered = useMemo(() => poGroups.filter(g => {
    if (filterSupplier && g.supplierId !== filterSupplier) return false;
    if (dari && g.tanggal < dari) return false;
    if (sampai && g.tanggal > sampai) return false;
    if (search && !g.noPO.toLowerCase().includes(search.toLowerCase()) && !g.supplierNama.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [poGroups, filterSupplier, dari, sampai, search]);

  const payFiltered = useMemo(() => payments.filter(p => {
    if (filterSupplier && p.supplierNama !== filterSupplier) return false;
    if (dari && p.tanggalBayar < dari) return false;
    if (sampai && p.tanggalBayar > sampai) return false;
    if (search && !p.noPO.toLowerCase().includes(search.toLowerCase()) && !(p.nomorRef || '').toLowerCase().includes(search.toLowerCase()) && !p.supplierNama.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [payments, filterSupplier, dari, sampai, search]);

  const suppliers = useMemo(() => {
    if (mode === 'po') {
      const seen = new Set<string>();
      return poGroups.filter(g => { if (seen.has(g.supplierId)) return false; seen.add(g.supplierId); return true; })
        .map(g => [g.supplierId, g.supplierNama] as [string, string]);
    }
    const seen = new Set<string>();
    return payments.filter(p => { if (seen.has(p.supplierNama)) return false; seen.add(p.supplierNama); return true; })
      .map(p => [p.supplierNama, p.supplierNama] as [string, string]);
  }, [mode, poGroups, payments]);

  const toggleOne = (key: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const toggleAll = () => {
    const keys = mode === 'po' ? poFiltered.map(g => g.noPO) : payFiltered.map(p => p.id);
    if (keys.length > 0 && keys.every(k => selected.has(k))) setSelected(new Set());
    else setSelected(new Set(keys));
  };

  const resetFilter = () => { setFilterSupplier(''); setDari(''); setSampai(''); setSearch(''); setSelected(new Set()); };

  /* ── Hapus Pembelian SKU (PO) + data terkait ── */
  const doDeletePO = () => {
    setBusy(true);
    const sel = Array.from(selected);
    const noPOs = new Set(sel);
    setHppData(prev => prev.filter(p => !noPOs.has(p.noPO)));
    setPayments(prev => prev.filter(p => !noPOs.has(p.noPO)));
    setBukti(prev => prev.filter(b => !noPOs.has(b.noPO)));
    // Riwayat harga modal dengan noPO yang sama
    try {
      const hist = JSON.parse(localStorage.getItem(HARGA_HISTORY) || '[]');
      const newHist = hist.filter((h: any) => !noPOs.has(h.noPO));
      if (newHist.length !== hist.length) localStorage.setItem(HARGA_HISTORY, JSON.stringify(newHist));
    } catch {}
    // Jurnal yang referensinya = noPO
    for (const j of jurnal.filter(j => noPOs.has(j.referensi || ''))) deleteJurnal(j.id);
    recordActivity([{ modul: 'keuangan', aksi: 'hapus-po', refLabel: sel.join(', '), detail: { jumlahPO: sel.length } }]);
    try {
      window.dispatchEvent(new Event('pembelian-updated'));
      window.dispatchEvent(new Event('bukti-bayar-updated'));
      window.dispatchEvent(new Event('shared-data-updated'));
    } catch {}
    setSelected(new Set()); setConfirmOpen(false); setBusy(false);
    alert(`✅ ${sel.length} PO dihapus.\nPayment, bukti bayar, riwayat harga modal & jurnal yang terkait ikut terhapus.\n\n⚠️ Stok SKU tidak diubah otomatis.`);
  };

  /* ── Hapus Pembayaran PO + data terkait ── */
  const doDeleteBayar = () => {
    setBusy(true);
    const toDelete = payments.filter(p => selected.has(p.id));
    // Total dihapus per noPO (untuk restore dibayar/sisa di PO)
    const byPo = new Map<string, number>();
    for (const p of toDelete) {
      if (!p.noPO.startsWith('OPEX-') && !p.noPO.startsWith('BIAYA-')) {
        byPo.set(p.noPO, (byPo.get(p.noPO) || 0) + p.jumlahDibayar);
      }
    }
    setPayments(prev => prev.filter(p => !selected.has(p.id)));
    setBukti(prev => prev.filter(b => !selected.has(b.paymentId)));
    // Restore status PO: kurangi dibayar, kembalikan sisa tagihan
    if (byPo.size > 0) {
      setHppData(prev => {
        const groupTotal = new Map<string, number>();
        prev.forEach(p => groupTotal.set(p.noPO, (groupTotal.get(p.noPO) || 0) + p.total));
        return prev.map(p => {
          const del = byPo.get(p.noPO);
          if (!del) return p;
          const gt = groupTotal.get(p.noPO) || 1;
          const alokasi = Math.round(del * (p.total / gt));
          const newDibayar = Math.max(0, (p.dibayar || 0) - alokasi);
          return { ...p, dibayar: newDibayar, sisaTagihan: Math.max(0, p.total - newDibayar), lunas: newDibayar >= p.total };
        });
      });
    }
    // Jurnal pembayaran yang cocok (noPO + nominal + tanggal)
    for (const p of toDelete) {
      for (const j of jurnal.filter(j => (j.referensi || '') === p.noPO && j.nominal === p.jumlahDibayar && j.tanggal === p.tanggalBayar)) {
        deleteJurnal(j.id);
      }
    }
    recordActivity([{ modul: 'keuangan', aksi: 'hapus-bayar', refLabel: toDelete.map(t => t.noPO).join(', '), detail: { jumlah: toDelete.length, total: toDelete.reduce((s, t) => s + t.jumlahDibayar, 0) } }]);
    try {
      window.dispatchEvent(new Event('pembelian-updated'));
      window.dispatchEvent(new Event('bukti-bayar-updated'));
      window.dispatchEvent(new Event('shared-data-updated'));
    } catch {}
    setSelected(new Set()); setConfirmOpen(false); setBusy(false);
    alert(`✅ ${toDelete.length} pembayaran dihapus.\nStatus dibayar PO terkait sudah dikembalikan, bukti bayar & jurnal ikut terhapus.`);
  };

  const confirmDelete = () => {
    if (selected.size === 0) { alert('Pilih dulu data yang mau dihapus (centang kotaknya).'); return; }
    setConfirmOpen(true);
  };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-red-500 to-red-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🗑️ Hapus Data</h2>
      <p className="mt-1 text-sm text-slate-500">Hapus Pembelian SKU (PO) atau Pembayaran PO per tanggal &amp; supplier — tanpa reset semua. Data terkait (payment, bukti bayar, riwayat harga modal, jurnal) ikut terhapus.</p>

      {/* Mode */}
      <div className="mt-4 flex gap-2">
        <button onClick={() => { setMode('po'); setSelected(new Set()); setFilterSupplier(''); }}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${mode === 'po' ? 'bg-red-500 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:bg-red-50'}`}>
          📦 Pembelian SKU (PO)
        </button>
        <button onClick={() => { setMode('bayar'); setSelected(new Set()); setFilterSupplier(''); }}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${mode === 'bayar' ? 'bg-red-500 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:bg-red-50'}`}>
          💳 Pembayaran PO
        </button>
      </div>

      {/* Filter */}
      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <div>
          <label className="block text-[10px] font-semibold text-slate-500">Supplier</label>
          <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 focus:border-red-400 focus:outline-none">
            <option value="">Semua Supplier</option>
            {suppliers.map(([id, nama]) => <option key={id} value={id}>{nama}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-slate-500">Dari Tanggal</label>
          <input type="date" value={dari} onChange={e => setDari(e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 focus:border-red-400 focus:outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-slate-500">Sampai Tanggal</label>
          <input type="date" value={sampai} onChange={e => setSampai(e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 focus:border-red-400 focus:outline-none" />
        </div>
        <div className="min-w-[160px] flex-1">
          <label className="block text-[10px] font-semibold text-slate-500">Cari {mode === 'po' ? 'No PO / Supplier' : 'No PO / Ref / Supplier'}</label>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ketik…" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 focus:border-red-400 focus:outline-none" />
        </div>
        <button onClick={resetFilter} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-200">✕ Reset Filter</button>
      </div>

      {/* List */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        {mode === 'po' ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-red-50 text-xs uppercase text-red-600">
                <th className="px-3 py-3">
                  <input type="checkbox" checked={poFiltered.length > 0 && poFiltered.every(g => selected.has(g.noPO))} onChange={toggleAll} className="h-4 w-4 accent-red-500" />
                </th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">No PO</th>
                <th className="px-3 py-3 font-semibold">Supplier</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Tanggal</th>
                <th className="px-3 py-3 text-center font-semibold">SKU</th>
                <th className="px-3 py-3 text-right font-semibold">Total</th>
                <th className="px-3 py-3 text-right font-semibold">Dibayar</th>
                <th className="px-3 py-3 text-right font-semibold">Sisa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {poFiltered.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-400">Tidak ada PO yang cocok dengan filter.</td></tr>
              ) : poFiltered.map(g => (
                <tr key={g.noPO} className={`transition ${selected.has(g.noPO) ? 'bg-red-50/60' : 'hover:bg-slate-50'}`}>
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={selected.has(g.noPO)} onChange={() => toggleOne(g.noPO)} className="h-4 w-4 accent-red-500" />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs font-bold text-red-700">{g.noPO}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-700">{g.supplierNama}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{g.tanggal}</td>
                  <td className="px-3 py-2.5 text-center text-xs text-slate-600">{g.jumlahSku}</td>
                  <td className="px-3 py-2.5 text-right text-xs font-bold text-slate-800">{fmtRp(g.total)}</td>
                  <td className="px-3 py-2.5 text-right text-xs text-emerald-600">{fmtRp(g.dibayar)}</td>
                  <td className="px-3 py-2.5 text-right text-xs font-semibold text-red-600">{fmtRp(g.sisa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-red-50 text-xs uppercase text-red-600">
                <th className="px-3 py-3">
                  <input type="checkbox" checked={payFiltered.length > 0 && payFiltered.every(p => selected.has(p.id))} onChange={toggleAll} className="h-4 w-4 accent-red-500" />
                </th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Tgl Bayar</th>
                <th className="px-3 py-3 font-semibold">No PO</th>
                <th className="px-3 py-3 font-semibold">Supplier</th>
                <th className="px-3 py-3 text-right font-semibold">Jumlah</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Metode</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">No. Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {payFiltered.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">Tidak ada pembayaran yang cocok dengan filter.</td></tr>
              ) : payFiltered.map(p => (
                <tr key={p.id} className={`transition ${selected.has(p.id) ? 'bg-red-50/60' : 'hover:bg-slate-50'}`}>
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} className="h-4 w-4 accent-red-500" />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{p.tanggalBayar}</td>
                  <td className="px-3 py-2.5 font-mono text-xs font-bold text-indigo-700">{p.noPO}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-700">{p.supplierNama}</td>
                  <td className="px-3 py-2.5 text-right text-xs font-bold text-red-600">-{fmtRp(p.jumlahDibayar)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{p.metode}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{p.nomorRef || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer aksi */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {selected.size} dipilih · {mode === 'po' ? poFiltered.length : payFiltered.length} tampil
        </p>
        <button onClick={confirmDelete} disabled={busy}
          className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white transition ${selected.size > 0 ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-300 cursor-not-allowed'}`}>
          {busy ? '⏳ Menghapus…' : `🗑️ Hapus ${selected.size} Terpilih`}
        </button>
      </div>

      {/* Konfirmasi */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="text-lg font-bold text-slate-800">⚠️ Konfirmasi Hapus {selected.size} {mode === 'po' ? 'PO' : 'Pembayaran'}?</p>
            <p className="mt-2 text-sm text-slate-600">
              {mode === 'po'
                ? 'PO beserta pembayarannya, bukti bayar, riwayat harga modal & jurnal terkait akan dihapus permanen. Stok SKU tidak diubah otomatis.'
                : 'Pembayaran akan dihapus, status dibayar PO dikembalikan, bukti bayar & jurnal terkait ikut terhapus.'}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmOpen(false)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200">Batal</button>
              <button onClick={mode === 'po' ? doDeletePO : doDeleteBayar} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600">🗑️ Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
