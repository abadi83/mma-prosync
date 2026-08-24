'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAkuntansi } from '@/app/context/AkuntansiContext';
import BuktiBayarUpload from '@/app/components/BuktiBayarUpload';
import type { BuktiBayar, OcrResult } from '@/app/types';
import { fetchMarketplaceOrders } from '@/app/lib/marketplaceOrdersClient';
import { loadPencairan, savePencairan, totalPencairan, PENCAIRAN_STORAGE, type PencairanEntry } from '@/app/lib/pencairan';

/* ================================================================ */
/* Types (shared key dengan Purchasing)                              */
/* ================================================================ */
type MetodeBayar = 'cash' | 'transfer' | 'dp' | 'kontrabon';
interface HppPurchase {
  id: string; noPO: string; sku: string; namaSku: string;
  supplierId: string; supplierNama: string; qty: number; hargaBeli: number;
  total: number; metodeBayar: MetodeBayar; dibayar: number; sisaTagihan: number;
  tanggal: string; jatuhTempo: string; lunas: boolean;
  petugasLogistik?: string;  // Nama petugas logistik yang menjemput PO (untuk cash: yg talangi dulu)
  dibayarKePetugas?: boolean; // Finance sudah reimburs ke petugas?
}

const HPP_STORAGE = 'mma_hpp_purchases';

interface BiayaOp {
  id: string; deskripsi: string; kategori: string; jumlah: number; tanggal: string;
}
const BIAYA_STORAGE = 'mma_biaya_operasional';

interface OpexPurchase {
  id: string; namaItem: string; kategori: string; total: number; tanggal: string;
}
const OPEX_STORAGE = 'mma_opex_purchases';

/* ── Payment History Record ── */
interface PaymentRecord {
  id: string;
  poId: string;
  noPO: string;
  supplierNama: string;
  jumlahDibayar: number;
  sisaSebelum: number;
  sisaSesudah: number;
  metode: string;
  nomorRef: string;
  catatan: string;
  tanggalBayar: string;
  dibayarOleh: string;
}
const PAYMENT_STORAGE = 'mma_payment_history';
const BUKTI_STORAGE = 'mma_bukti_bayar';

/* ================================================================ */
/* Helpers                                                           */
/* ================================================================ */
function useLocalStorage<T>(key: string, fallback: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Selalu mulai dengan fallback agar server & client render sama (anti hydration error)
  const [val, setVal] = useState<T>(fallback);
  const [hydrated, setHydrated] = useState(false);

  // Load data dari localStorage setelah mount (client-only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setVal(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, [key]);

  // Simpan ke localStorage setiap kali val berubah (setelah hydrated)
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [val, key, hydrated]);

  return [val, setVal];
}

const METODE_OPTIONS = [
  { value: 'cash', label: 'Cash / Tunai', icon: '💵' },
  { value: 'transfer', label: 'Transfer Bank', icon: '🏦' },
  { value: 'cek', label: 'Cek / Giro', icon: '📝' },
];

/* ================================================================ */
/* Tab type                                                          */
/* ================================================================ */
type Tab = 'pembayaran' | 'aruskas' | 'pencairan' | 'riwayat' | 'arsip' | 'refund';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'pembayaran', label: 'Pembayaran PO', icon: '💳' },
  { key: 'aruskas', label: 'Arus Kas', icon: '📈' },
  { key: 'pencairan', label: 'Pencairan MP', icon: '💸' },
  { key: 'riwayat', label: 'Riwayat Bayar', icon: '📋' },
  { key: 'arsip', label: 'Arsip Bukti', icon: '🗄️' },
  { key: 'refund', label: 'Refund / Koreksi', icon: '↩️' },
];

/* ================================================================ */
/* Main Page                                                         */
/* ================================================================ */
export default function KeuanganPage() {
  const [tab, setTab] = useState<Tab>('pembayaran');

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-500 to-indigo-300 p-5 text-white shadow-lg sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-100 sm:text-sm">Finance</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Keuangan</h1>
        <p className="mt-1 text-sm text-indigo-100 sm:text-base">Pembayaran PO, arus kas, dan riwayat pembayaran supplier.</p>
      </header>

      {/* Saldo Kas */}
      <SaldoKas />

      <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm" role="tablist">
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:px-5 sm:text-sm ${
              tab === t.key ? 'bg-indigo-500 text-white shadow' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
            }`}>
            <span className="text-base sm:text-lg">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </nav>

      <section className="card-blue">
        {tab === 'pembayaran' && <PembayaranTab />}
        {tab === 'aruskas' && <ArusKasTab />}
        {tab === 'pencairan' && <PencairanTab />}
        {tab === 'riwayat' && <RiwayatTab />}
        {tab === 'arsip' && <ArsipBuktiTab />}
        {tab === 'refund' && <RefundTab />}
      </section>
    </main>
  );
}

/* ================================================================ */
/* Saldo Kas — Kas Besar + Kas Kecil                                 */
/* ================================================================ */
const KAS_KECIL_STORAGE = 'mma_kas_kecil';

interface KasKecilEntry {
  id: string;
  tanggal: string;
  jumlah: number;
  jenis: 'masuk' | 'keluar';
  keterangan: string;
  sumber: string; // 'refund', 'penjualan', 'operasional', 'manual'
}

function SaldoKas() {
  const [saldoAwal, setSaldoAwal] = useState(0);
  const [kasKecilList, setKasKecilList] = useState<KasKecilEntry[]>([]);
  const [pencairan, setPencairan] = useState<PencairanEntry[]>([]);
  const [mpOrders, setMpOrders] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);
  const [showTambah, setShowTambah] = useState(false);
  const [formKK, setFormKK] = useState({ jumlah: '', jenis: 'masuk' as 'masuk' | 'keluar', keterangan: '' });

  useEffect(() => {
    try {
      const modalRaw = localStorage.getItem('mma_modal');
      if (modalRaw) {
        const modalList = JSON.parse(modalRaw);
        setSaldoAwal(modalList.reduce((s: number, m: any) => s + (m.jumlah || 0), 0));
      }
      const kk = localStorage.getItem(KAS_KECIL_STORAGE);
      if (kk) setKasKecilList(JSON.parse(kk));
    } catch {}
    setPencairan(loadPencairan());
    fetchMarketplaceOrders().then(setMpOrders).catch(() => {});
    const onUpdate = () => { setPencairan(loadPencairan()); };
    window.addEventListener('pencairan-updated', onUpdate);
    window.addEventListener('storage', onUpdate);
    window.addEventListener('refresh-laporan', onUpdate);
    setMounted(true);
    return () => {
      window.removeEventListener('pencairan-updated', onUpdate);
      window.removeEventListener('storage', onUpdate);
      window.removeEventListener('refresh-laporan', onUpdate);
    };
  }, []);

  // Hitung saldo kas kecil
  const kasKecil = kasKecilList.reduce((s, e) => s + (e.jenis === 'masuk' ? e.jumlah : -e.jumlah), 0);

  // Total pengeluaran dari Kas Besar
  const totalPengeluaran = useMemo(() => {
    try {
      let keluar = 0;
      const payments = JSON.parse(localStorage.getItem('mma_payment_history') || '[]');
      keluar += payments.reduce((s: number, p: any) => s + (p.jumlahDibayar || 0), 0);
      const biaya = JSON.parse(localStorage.getItem('mma_biaya_operasional') || '[]');
      keluar += biaya.reduce((s: number, b: any) => s + (b.jumlah || 0), 0);
      const opex = JSON.parse(localStorage.getItem('mma_opex_purchases') || '[]');
      keluar += opex.reduce((s: number, o: any) => s + (o.total || 0), 0);
      return keluar;
    } catch { return 0; }
  }, []);

  const totalPencairanSum = totalPencairan(pencairan);
  const mpNet = mpOrders.reduce((s: number, o: any) => s + (o.pendapatanBersih || 0), 0);
  const saldoMP = mpNet - totalPencairanSum; // masih di akun marketplace

  const kasBesar = saldoAwal - totalPengeluaran + totalPencairanSum; // pencairan masuk ke Kas Besar
  const totalSaldo = kasBesar + kasKecil + saldoMP;

  const tambahKasKecil = () => {
    const jml = +formKK.jumlah || 0;
    if (jml <= 0) return;
    const entry: KasKecilEntry = {
      id: `kk-${Date.now()}`,
      tanggal: new Date().toISOString().slice(0, 10),
      jumlah: jml,
      jenis: formKK.jenis,
      keterangan: formKK.keterangan.trim() || (formKK.jenis === 'masuk' ? 'Tambah Kas Kecil' : 'Ambil Kas Kecil'),
      sumber: 'manual',
    };
    const updated = [entry, ...kasKecilList];
    setKasKecilList(updated);
    localStorage.setItem(KAS_KECIL_STORAGE, JSON.stringify(updated));
    setShowTambah(false);
    setFormKK({ jumlah: '', jenis: 'masuk', keterangan: '' });
  };

  if (!mounted) return null;

  const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
          <p className="text-[10px] text-emerald-500 uppercase">Kas Besar</p>
          <p className="text-sm font-bold text-emerald-700">{fmt(kasBesar)}</p>
          <p className="text-[9px] text-emerald-400">Bank / Modal + Pencairan</p>
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
          <p className="text-[10px] text-amber-500 uppercase">Kas Kecil</p>
          <p className="text-sm font-bold text-amber-700">{fmt(kasKecil)}</p>
          <button onClick={() => setShowTambah(!showTambah)}
            className="mt-1 text-[9px] text-amber-500 hover:text-amber-700 underline">
            {showTambah ? 'Tutup' : '+ Atur'}
          </button>
        </div>
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-center">
          <p className="text-[10px] text-red-500 uppercase">Pengeluaran</p>
          <p className="text-sm font-bold text-red-600">{fmt(totalPengeluaran)}</p>
          <p className="text-[9px] text-red-400">PO + OPEX + Biaya</p>
        </div>
        <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 text-center">
          <p className="text-[10px] text-sky-500 uppercase">Saldo MP</p>
          <p className="text-sm font-bold text-sky-700">{fmt(saldoMP)}</p>
          <p className="text-[9px] text-sky-400">Belum Dicairkan</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${totalSaldo >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-100 border-red-300'}`}>
          <p className="text-[10px] text-slate-500 uppercase">Total Saldo</p>
          <p className={`text-sm font-bold ${totalSaldo >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmt(totalSaldo)}</p>
          <p className="text-[9px] text-slate-400">Besar + Kecil + Saldo MP</p>
        </div>
      </div>

      {/* Form Tambah/Ambil Kas Kecil */}
      {showTambah && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
          <p className="text-xs font-semibold text-amber-700 mb-2">💰 Atur Kas Kecil</p>
          <div className="flex gap-2 items-end">
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Jumlah</label>
              <input type="number" value={formKK.jumlah} onChange={e => setFormKK(p => ({ ...p, jumlah: e.target.value }))}
                className="w-32 rounded-lg border px-2 py-1 text-xs font-bold" placeholder="0" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Jenis</label>
              <select value={formKK.jenis} onChange={e => setFormKK(p => ({ ...p, jenis: e.target.value as 'masuk' | 'keluar' }))}
                className="rounded-lg border px-2 py-1 text-xs">
                <option value="masuk">📥 Masuk</option>
                <option value="keluar">📤 Keluar</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-slate-500 mb-0.5">Keterangan</label>
              <input type="text" value={formKK.keterangan} onChange={e => setFormKK(p => ({ ...p, keterangan: e.target.value }))}
                className="w-full rounded-lg border px-2 py-1 text-xs" placeholder="contoh: Refund, Penjualan cash..." />
            </div>
            <button onClick={tambahKasKecil} className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-white hover:bg-amber-600">Simpan</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================ */
/* TAB: Pencairan Saldo Marketplace → Kas Besar                     */
/* ================================================================ */
function PencairanTab() {
  const [pencairan, setPencairan] = useState<PencairanEntry[]>([]);
  const [mpOrders, setMpOrders] = useState<any[]>([]);
  const [form, setForm] = useState({ tokoKey: '', jumlah: '', tanggal: new Date().toISOString().slice(0, 10), keterangan: '' });

  const reload = () => { setPencairan(loadPencairan()); };
  useEffect(() => {
    reload();
    fetchMarketplaceOrders().then(setMpOrders).catch(() => {});
    window.addEventListener('pencairan-updated', reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener('pencairan-updated', reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  // Saldo per toko: Σ pendapatanBersih − Σ pencairan
  const tokoMap = new Map<string, { key: string; marketplace: string; tokoNama: string; net: number; cair: number }>();
  for (const o of mpOrders) {
    const key = `${o.marketplace || 'Marketplace'}||${o.tokoNama || 'Tanpa Toko'}`;
    const t = tokoMap.get(key) || { key, marketplace: o.marketplace || 'Marketplace', tokoNama: o.tokoNama || 'Tanpa Toko', net: 0, cair: 0 };
    t.net += o.pendapatanBersih || 0;
    tokoMap.set(key, t);
  }
  for (const p of pencairan) {
    if (!p.tokoId) continue;
    const t = tokoMap.get(p.tokoId);
    if (t) t.cair += p.jumlah;
    else tokoMap.set(p.tokoId, { key: p.tokoId, marketplace: p.marketplace, tokoNama: p.tokoNama, net: 0, cair: p.jumlah });
  }
  const tokos = Array.from(tokoMap.values()).sort((a, b) => (b.net - b.cair) - (a.net - a.cair));
  const totalNet = tokos.reduce((s, t) => s + t.net, 0);
  const totalCair = tokos.reduce((s, t) => s + t.cair, 0);
  const totalSisa = totalNet - totalCair;

  const selected = tokos.find(t => t.key === form.tokoKey);
  const sisaSelected = selected ? selected.net - selected.cair : 0;

  const submit = () => {
    const jml = +form.jumlah || 0;
    if (!form.tokoKey || !selected) { alert('⚠️ Pilih toko dulu.'); return; }
    if (jml <= 0) { alert('⚠️ Jumlah harus lebih dari 0.'); return; }
    if (jml > sisaSelected + 1) { alert(`⚠️ Jumlah melebihi saldo ${selected.tokoNama}. Sisa: Rp ${sisaSelected.toLocaleString('id-ID')}`); return; }
    const entry: PencairanEntry = {
      id: `pc-${Date.now()}`,
      tanggal: form.tanggal,
      marketplace: selected.marketplace,
      tokoId: selected.key,
      tokoNama: selected.tokoNama,
      jumlah: jml,
      keterangan: form.keterangan.trim() || 'Pencairan saldo marketplace',
    };
    const next = [entry, ...pencairan];
    setPencairan(next);
    savePencairan(next);
    setForm(p => ({ ...p, jumlah: '', keterangan: '' }));
    try { window.dispatchEvent(new Event('refresh-laporan')); } catch {}
    alert(`✅ Pencairan Rp ${jml.toLocaleString('id-ID')} dari ${selected.tokoNama} tercatat → masuk Kas Besar.`);
  };

  const hapus = (id: string) => {
    if (!confirm('Hapus catatan pencairan ini?')) return;
    const next = pencairan.filter(p => p.id !== id);
    setPencairan(next);
    savePencairan(next);
    try { window.dispatchEvent(new Event('refresh-laporan')); } catch {}
  };

  const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-sky-500 to-sky-300" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">💸 Pencairan Saldo Marketplace</h2>
          <p className="mt-1 text-sm text-slate-500">Saldo MP = Pendapatan Bersih (Kotor − Fee). Saat dicairkan, uang masuk ke Kas Besar.</p>
        </div>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">{tokos.length} toko terdeteksi</span>
      </div>

      {/* KPI */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 text-center">
          <p className="text-lg font-bold text-sky-700">{fmt(totalNet)}</p>
          <p className="text-[10px] text-sky-500 uppercase">Total Saldo MP</p>
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
          <p className="text-lg font-bold text-emerald-700">{fmt(totalCair)}</p>
          <p className="text-[10px] text-emerald-500 uppercase">Sudah Dicairkan</p>
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
          <p className="text-lg font-bold text-amber-700">{fmt(totalSisa)}</p>
          <p className="text-[10px] text-amber-500 uppercase">Belum Dicairkan</p>
        </div>
      </div>

      {/* Daftar toko */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-xs">
          <thead><tr className="bg-sky-50 text-xs uppercase text-sky-600">
            {['Toko', 'Marketplace', 'Saldo MP', 'Sudah Cair', 'Sisa', 'Aksi'].map(c => <th key={c} className="px-2 py-2.5 font-semibold whitespace-nowrap">{c}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {tokos.map(t => (
              <tr key={t.key} className={form.tokoKey === t.key ? 'bg-sky-50/60' : 'hover:bg-slate-50/50'}>
                <td className="px-2 py-2 font-semibold text-slate-700">{t.tokoNama}</td>
                <td className="px-2 py-2"><span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{t.marketplace}</span></td>
                <td className="px-2 py-2 text-slate-600">{fmt(t.net)}</td>
                <td className="px-2 py-2 text-emerald-600 font-semibold">{fmt(t.cair)}</td>
                <td className="px-2 py-2 font-bold text-sky-700">{fmt(t.net - t.cair)}</td>
                <td className="px-2 py-2">
                  <button onClick={() => setForm(p => ({ ...p, tokoKey: t.key }))}
                    className="rounded-lg bg-sky-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-sky-600 whitespace-nowrap">
                    💸 Cairkan
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tokos.length === 0 && <p className="px-3 py-6 text-center text-xs text-slate-400">Belum ada data keuangan marketplace. Upload di Data Entry → Input Keuangan dulu.</p>}
      </div>

      {/* Form pencairan */}
      {form.tokoKey && (
        <div className="mt-4 rounded-2xl border-2 border-sky-200 bg-sky-50/40 p-4">
          <p className="text-xs font-semibold text-sky-700 mb-2">💸 Catat Pencairan — {selected?.tokoNama} (sisa Rp {sisaSelected.toLocaleString('id-ID')})</p>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Jumlah</label>
              <input type="number" value={form.jumlah} onChange={e => setForm(p => ({ ...p, jumlah: e.target.value }))}
                className="w-40 rounded-lg border px-2 py-1 text-xs font-bold" placeholder="0" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Tanggal</label>
              <input type="date" value={form.tanggal} onChange={e => setForm(p => ({ ...p, tanggal: e.target.value }))}
                className="rounded-lg border px-2 py-1 text-xs" />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] text-slate-500 mb-0.5">Keterangan</label>
              <input type="text" value={form.keterangan} onChange={e => setForm(p => ({ ...p, keterangan: e.target.value }))}
                className="w-full rounded-lg border px-2 py-1 text-xs" placeholder="contoh: penarikan harian ke BCA…" />
            </div>
            <button onClick={submit} className="rounded-lg bg-sky-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-sky-600">✅ Simpan Pencairan</button>
            <button onClick={() => setForm(p => ({ ...p, tokoKey: '' }))} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-200">✕</button>
          </div>
        </div>
      )}

      {/* Riwayat pencairan */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="bg-slate-50 px-3 py-2">
          <p className="text-xs font-bold text-slate-600">🗄️ Riwayat Pencairan ({pencairan.length})</p>
        </div>
        {pencairan.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-slate-400">Belum ada pencairan tercatat.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
            {pencairan.map(p => (
              <div key={p.id} className="px-3 py-2 flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-slate-400 whitespace-nowrap">{p.tanggal}</span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">{p.marketplace}</span>
                <span className="text-[11px] font-semibold text-slate-700">{p.tokoNama}</span>
                <span className="text-[11px] font-bold text-emerald-600">+ {fmt(p.jumlah)}</span>
                {p.keterangan && <span className="text-[10px] text-slate-400">— {p.keterangan}</span>}
                <button onClick={() => hapus(p.id)} className="ml-auto text-[10px] text-red-400 hover:text-red-600">🗑 Hapus</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alur */}
      <div className="mt-4 rounded-xl bg-indigo-50 border border-indigo-200 p-3 text-xs text-indigo-700">
        🔄 <strong>Alur:</strong> Upload Input Keuangan → <strong>Saldo MP</strong> (per toko). Pencairan → uang pindah ke <strong>Kas Besar</strong> (bukan pendapatan baru). Total Saldo = <strong>Kas Besar + Kas Kecil + Saldo MP belum cair</strong>.
      </div>
    </div>
  );
}

/* ================================================================ */
/* TAB 1: Pembayaran PO                                             */
/* ================================================================ */
function PembayaranTab() {
  const [hppData, setHppData] = useLocalStorage<HppPurchase[]>(HPP_STORAGE, []);
  const [payments, setPayments] = useLocalStorage<PaymentRecord[]>(PAYMENT_STORAGE, []);
  const { addJurnal } = useAkuntansi();

  const [filterStatus, setFilterStatus] = useState<'semua' | 'belum' | 'jatuhTempo'>('belum');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [search, setSearch] = useState('');

  // Group by noPO
  interface PoGroup { noPO: string; supplierId: string; supplierNama: string; items: HppPurchase[]; total: number; dibayar: number; sisa: number; lunas: boolean; jatuhTempo: string; metodeBayar: MetodeBayar; petugasLogistik: string; dibayarKePetugas: boolean; }
  const poGroups = useMemo(() => {
    const map = new Map<string, PoGroup>();
    for (const p of hppData) {
      const g = map.get(p.noPO) || { noPO: p.noPO, supplierId: p.supplierId, supplierNama: p.supplierNama, items: [], total: 0, dibayar: 0, sisa: 0, lunas: true, jatuhTempo: p.jatuhTempo || '', metodeBayar: p.metodeBayar, petugasLogistik: p.petugasLogistik || '', dibayarKePetugas: !!p.dibayarKePetugas };
      g.items.push(p);
      g.total += p.total;
      g.dibayar += p.dibayar;
      g.sisa += p.sisaTagihan;
      if (!p.lunas) g.lunas = false;
      if (p.jatuhTempo && (!g.jatuhTempo || p.jatuhTempo < g.jatuhTempo)) g.jatuhTempo = p.jatuhTempo;
      if (p.petugasLogistik) g.petugasLogistik = p.petugasLogistik;
      if (!p.dibayarKePetugas) g.dibayarKePetugas = false;
      map.set(p.noPO, g);
    }
    return Array.from(map.values()).sort((a,b) => b.noPO.localeCompare(a.noPO));
  }, [hppData]);

  const today = new Date().toISOString().slice(0,10);
  const filtered = poGroups.filter(g => {
    if (filterStatus==='belum' && g.lunas) return false;
    if (filterStatus==='jatuhTempo' && (g.lunas || !g.jatuhTempo || g.jatuhTempo>today)) return false;
    if (filterSupplier && g.supplierId!==filterSupplier) return false;
    if (search && !g.noPO.toLowerCase().includes(search.toLowerCase()) && !g.supplierNama.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const suppliers = useMemo(() => {
    const ids = new Set(poGroups.map(g=>g.supplierId));
    return poGroups.filter(g=>ids.has(g.supplierId)).map(g=>[g.supplierId,g.supplierNama] as [string,string]).filter(([id],i,a)=>a.findIndex(x=>x[0]===id)===i);
  },[poGroups]);

  const totalTagihan = filtered.reduce((s,g)=>s+g.sisa,0);
  const totalPO = filtered.length;

  // Modal bayar — per PO, bukan per SKU
  const [bayarPoGroup, setBayarPoGroup] = useState<PoGroup|null>(null);
  const [formBayar, setFormBayar] = useState({ jumlah: '', metode: 'transfer', nomorRef: '', catatan: '', tanggalBayar: new Date().toISOString().slice(0, 10), dibayarOleh: '' });
  const [ferr, setFerr] = useState('');
  const [buktiImage, setBuktiImage] = useState<string>('');
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);

  // Bukti bayar storage
  const [buktiBayarList, setBuktiBayarList] = useLocalStorage<BuktiBayar[]>(BUKTI_STORAGE, []);

  // OPEX & Biaya — tagihan dari Purchasing
  const [opexList] = useLocalStorage<OpexPurchase[]>(OPEX_STORAGE, []);
  const [biayaList] = useLocalStorage<BiayaOp[]>(BIAYA_STORAGE, []);

  // Total OPEX & Biaya yang sudah dibayar (dari payment history)
  const totalOpexDibayar = payments.filter(p => p.noPO.startsWith('OPEX-')).reduce((s, p) => s + p.jumlahDibayar, 0);
  const totalBiayaDibayar = payments.filter(p => p.noPO.startsWith('BIAYA-')).reduce((s, p) => s + p.jumlahDibayar, 0);
  const totalOpexSemua = opexList.reduce((s, o) => s + o.total, 0);
  const totalBiayaSemua = biayaList.reduce((s, b) => s + b.jumlah, 0);
  const sisaOpex = totalOpexSemua - totalOpexDibayar;
  const sisaBiaya = totalBiayaSemua - totalBiayaDibayar;

  // Modal bayar OPEX
  const [bayarOpex, setBayarOpex] = useState(false);
  const [bayarBiaya, setBayarBiaya] = useState(false);
  const [formOpexBiaya, setFormOpexBiaya] = useState({ jumlah: '', metode: 'transfer', nomorRef: '', catatan: '', tanggalBayar: today, dibayarOleh: '' });

  const handleBayarOpexBiaya = (jenis: 'OPEX' | 'BIAYA') => {
    const jml = +formOpexBiaya.jumlah || 0;
    if (jml <= 0) { setFerr('Jumlah > 0.'); return; }
    const max = jenis === 'OPEX' ? sisaOpex : sisaBiaya;
    if (jml > max) { setFerr(`Maks Rp ${max.toLocaleString('id-ID')}.`); return; }

    const record: PaymentRecord = {
      id: `pay-${Date.now()}`,
      poId: `${jenis}-${Date.now()}`,
      noPO: `${jenis}-TOTAL`,
      supplierNama: jenis === 'OPEX' ? 'Pembelian OPEX (Packing, ATK, dll)' : 'Biaya Operasional (Listrik, Internet, dll)',
      jumlahDibayar: jml,
      sisaSebelum: max,
      sisaSesudah: max - jml,
      metode: formOpexBiaya.metode,
      nomorRef: formOpexBiaya.nomorRef.trim() || '-',
      catatan: formOpexBiaya.catatan.trim(),
      tanggalBayar: formOpexBiaya.tanggalBayar || today,
      dibayarOleh: formOpexBiaya.dibayarOleh.trim() || '-',
    };
    setPayments(prev => [record, ...prev]);
    setBayarOpex(false);
    setBayarBiaya(false);
    setFormOpexBiaya({ jumlah: '', metode: 'transfer', nomorRef: '', catatan: '', tanggalBayar: today, dibayarOleh: '' });
  };

  const openBayar = (g: PoGroup) => {
    setBayarPoGroup(g);
    setFormBayar({ jumlah: String(g.sisa), metode:'transfer', nomorRef:'', catatan:'', tanggalBayar:today, dibayarOleh:'' });
    setFerr('');
    setBuktiImage('');
    setOcrResult(null);
  };

  const handleOcrResult = (result: OcrResult) => {
    setOcrResult(result);
    // Auto-fill form dari hasil OCR
    setFormBayar(prev => ({
      ...prev,
      nomorRef: result.nomorRef || prev.nomorRef,
      jumlah: result.jumlah ? String(result.jumlah) : prev.jumlah,
      tanggalBayar: result.tanggal || prev.tanggalBayar,
    }));
  };

  const handleBayar = () => {
    if (!bayarPoGroup) return;
    const jml = +formBayar.jumlah || 0;
    if (jml <= 0) { setFerr('Jumlah > 0.'); return; }
    if (jml > bayarPoGroup.sisa) { setFerr(`Maks Rp ${bayarPoGroup.sisa.toLocaleString('id-ID')}.`); return; }

    const isCash = bayarPoGroup.metodeBayar === 'cash';
    // Distribute payment proportionally across SKU lines
    const ratio = bayarPoGroup.total > 0 ? jml / bayarPoGroup.total : 0;
    setHppData(prev => prev.map(p => {
      if (p.noPO !== bayarPoGroup.noPO) return p;
      const alokasi = Math.round(p.total * ratio);
      const newDibayar = p.dibayar + alokasi;
      const newSisa = p.total - newDibayar;
      return { ...p, dibayar: newDibayar, sisaTagihan: newSisa > 0 ? newSisa : 0, lunas: newDibayar >= p.total, ...(isCash ? { dibayarKePetugas: true } : {}) };
    }));

    const supplierLabel = isCash && bayarPoGroup.petugasLogistik
      ? `${bayarPoGroup.supplierNama} (via ${bayarPoGroup.petugasLogistik})`
      : bayarPoGroup.supplierNama;
    const keterangan = isCash && bayarPoGroup.petugasLogistik
      ? `Reimburse ${bayarPoGroup.petugasLogistik} — PO ${bayarPoGroup.noPO} - ${bayarPoGroup.supplierNama}`
      : `Pembayaran PO ${bayarPoGroup.noPO} - ${bayarPoGroup.supplierNama}`;

    const record: PaymentRecord = {
      id:`pay-${Date.now()}`, poId:bayarPoGroup.noPO, noPO:bayarPoGroup.noPO, supplierNama: supplierLabel,
      jumlahDibayar:jml, sisaSebelum:bayarPoGroup.sisa, sisaSesudah:bayarPoGroup.sisa-jml,
      metode:formBayar.metode, nomorRef:formBayar.nomorRef.trim()||'-', catatan:formBayar.catatan.trim(),
      tanggalBayar:formBayar.tanggalBayar||today, dibayarOleh:formBayar.dibayarOleh.trim()||'-',
    };
    setPayments(prev=>[record,...prev]);

    // Simpan bukti bayar jika ada gambar
    if (buktiImage) {
      const bukti: BuktiBayar = {
        id: `bukti-${Date.now()}`,
        paymentId: record.id,
        noPO: bayarPoGroup.noPO,
        supplierNama: bayarPoGroup.supplierNama,
        jumlah: jml,
        nomorRef: formBayar.nomorRef.trim() || '-',
        tanggalBayar: formBayar.tanggalBayar || today,
        imageBase64: buktiImage,
        ocrRawText: ocrResult?.rawText || '',
        createdAt: new Date().toISOString(),
      };
      setBuktiBayarList(prev => [bukti, ...prev]);
    }

    addJurnal({ tanggal:formBayar.tanggalBayar||today, akunDebitId:'2-1000', akunKreditId:'1-1000', nominal:jml, keterangan, referensi:bayarPoGroup.noPO });

    setBayarPoGroup(null);
    setBuktiImage('');
    setOcrResult(null);
  };

  const fmtRp = (n: number) => n >= 1000000 ? `Rp ${(n/1000000).toFixed(1)}jt` : n >= 1000 ? `Rp ${(n/1000).toFixed(0)}rb` : `Rp ${n}`;

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Pembayaran PO</h2>
      <p className="mt-1 text-sm text-slate-500">Daftar tagihan PO dari Purchasing. PO Cash/Tunai → bayar ke petugas Logistik yang menjemput & menalangi.</p>

      {/* KPI */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-indigo-50 p-3 text-center"><p className="text-2xl font-bold text-indigo-700">{totalPO}</p><p className="text-xs text-indigo-500">Total Tagihan</p></div>
        <div className="rounded-xl bg-red-50 p-3 text-center"><p className="text-2xl font-bold text-red-600">{fmtRp(totalTagihan)}</p><p className="text-xs text-red-500">Total Outstanding</p></div>
        <div className="rounded-xl bg-amber-50 p-3 text-center"><p className="text-2xl font-bold text-amber-600">{filtered.filter(p => !p.lunas && p.jatuhTempo && p.jatuhTempo <= today).length}</p><p className="text-xs text-amber-500">Jatuh Tempo</p></div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center"><p className="text-2xl font-bold text-emerald-600">{payments.length}</p><p className="text-xs text-emerald-500">Total Pembayaran</p></div>
      </div>

      {/* Filter */}
      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
            <option value="semua">Semua Status</option>
            <option value="belum">⚠️ Belum Lunas</option>
            <option value="jatuhTempo">🔴 Jatuh Tempo</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Supplier</label>
          <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
            <option value="">Semua Supplier</option>
            {suppliers.map(([id, nama]) => <option key={id} value={id}>{nama}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-slate-500 mb-1">Cari PO / Supplier</label>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ketik No PO…" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
        </div>
      </div>

      {/* Tabel Tagihan — grouped by PO */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead><tr className="bg-indigo-50 text-xs uppercase text-indigo-600">
            <th className="px-3 py-3 font-semibold">No PO</th>
            <th className="px-3 py-3 font-semibold">Supplier</th>
            <th className="px-3 py-3 text-right font-semibold">Total</th>
            <th className="px-3 py-3 text-right font-semibold">Dibayar</th>
            <th className="px-3 py-3 text-right font-semibold">Sisa</th>
            <th className="px-3 py-3 font-semibold hidden sm:table-cell">Jatuh Tempo</th>
            <th className="px-3 py-3 text-center font-semibold">Aksi</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {filtered.length===0 ? <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">Tidak ada tagihan.</td></tr> :
              filtered.map(g => {
                const urgent = !g.lunas && g.jatuhTempo && g.jatuhTempo<=today;
                return (
                  <React.Fragment key={g.noPO}>
                    <tr className={`hover:bg-slate-50 transition ${urgent?'bg-red-50/50':''}`}>
                      <td className="px-3 py-2.5 font-mono text-xs font-bold text-indigo-700">
                        <details><summary className="cursor-pointer">{g.noPO} ({g.items.length} SKU)</summary>
                          <div className="mt-1 pl-2 border-l-2 border-indigo-200">
                            {g.items.map(item=>(<div key={item.id} className="text-[10px] py-0.5"><span className="font-mono text-indigo-500">{item.sku}</span> <span className="text-slate-500">{item.namaSku}</span> <span className="text-slate-400">×{item.qty}</span> <span className="text-slate-500">Rp {item.total.toLocaleString('id-ID')}</span></div>))}
                          </div>
                        </details>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-700">
                        {g.supplierNama}
                        {g.metodeBayar==='cash' && g.petugasLogistik && (
                          <div className="mt-0.5 flex items-center gap-1">
                            <span className="text-[10px] text-amber-600">🛵 {g.petugasLogistik}</span>
                            {g.dibayarKePetugas
                              ? <span className="rounded bg-emerald-100 px-1 text-[9px] text-emerald-600">Sudah direimburse</span>
                              : <span className="rounded bg-amber-100 px-1 text-[9px] text-amber-600">⚡ Blm reimburse</span>
                            }
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs">Rp {g.total.toLocaleString('id-ID')}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-emerald-600">Rp {g.dibayar.toLocaleString('id-ID')}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold text-red-600">Rp {g.sisa.toLocaleString('id-ID')}</td>
                      <td className="px-3 py-2.5 text-xs hidden sm:table-cell">{g.jatuhTempo?<span className={urgent?'text-red-500 font-semibold':'text-slate-500'}>{g.jatuhTempo}</span>:<span className="text-slate-300">-</span>}</td>
                      <td className="px-3 py-2.5 text-center">{g.lunas?<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">✅ Lunas</span>:<button onClick={()=>openBayar(g)} className="rounded-lg bg-indigo-500 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700">💳 Bayar</button>}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* ── Tagihan OPEX ── */}
      {opexList.length > 0 && (
        <div className="mt-5 rounded-2xl border-2 border-blue-200 bg-blue-50/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-blue-700">📦 Tagihan OPEX (Packing, ATK, dll)</p>
              <p className="text-xs text-slate-500 mt-0.5">{opexList.length} item · Total: Rp {totalOpexSemua.toLocaleString('id-ID')} · Dibayar: Rp {totalOpexDibayar.toLocaleString('id-ID')}</p>
            </div>
            {sisaOpex > 0 && (
              <button
                onClick={() => { setBayarOpex(true); setBayarBiaya(false); setFormOpexBiaya({ jumlah: String(sisaOpex), metode: 'transfer', nomorRef: '', catatan: '', tanggalBayar: today, dibayarOleh: '' }); setFerr(''); }}
                className="rounded-lg bg-blue-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-600"
              >
                💳 Bayar (Sisa Rp {sisaOpex.toLocaleString('id-ID')})
              </button>
            )}
            {sisaOpex <= 0 && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">✅ Lunas</span>}
          </div>
        </div>
      )}

      {/* ── Tagihan Biaya Operasional ── */}
      {biayaList.length > 0 && (
        <div className="mt-3 rounded-2xl border-2 border-amber-200 bg-amber-50/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-amber-700">💸 Tagihan Biaya Operasional</p>
              <p className="text-xs text-slate-500 mt-0.5">{biayaList.length} catatan · Total: Rp {totalBiayaSemua.toLocaleString('id-ID')} · Dibayar: Rp {totalBiayaDibayar.toLocaleString('id-ID')}</p>
            </div>
            {sisaBiaya > 0 && (
              <button
                onClick={() => { setBayarBiaya(true); setBayarOpex(false); setFormOpexBiaya({ jumlah: String(sisaBiaya), metode: 'transfer', nomorRef: '', catatan: '', tanggalBayar: today, dibayarOleh: '' }); setFerr(''); }}
                className="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
              >
                💳 Bayar (Sisa Rp {sisaBiaya.toLocaleString('id-ID')})
              </button>
            )}
            {sisaBiaya <= 0 && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">✅ Lunas</span>}
          </div>
        </div>
      )}

      {/* Modal Bayar OPEX / Biaya */}
      {(bayarOpex || bayarBiaya) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setBayarOpex(false); setBayarBiaya(false); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-sm font-bold text-indigo-700">💳 Bayar {bayarOpex ? 'OPEX' : 'Biaya Operasional'}</p>
              <p className="mt-1 text-xs text-slate-500">{bayarOpex ? 'Packing, ATK, Kebersihan, dll' : 'Listrik, Internet, Transport, dll'}</p>
              <div className="mt-2 text-xs">
                <span className="text-slate-400">Sisa Tagihan: </span>
                <span className="font-bold text-red-600">Rp {(bayarOpex ? sisaOpex : sisaBiaya).toLocaleString('id-ID')}</span>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Jumlah Dibayar *</label><input type="number" value={formOpexBiaya.jumlah} onChange={e => setFormOpexBiaya(p => ({ ...p, jumlah: e.target.value }))} className="w-full rounded-xl border bg-slate-50 px-3 py-2 text-center text-sm font-bold focus:border-indigo-500 focus:outline-none" /></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Metode Bayar</label><select value={formOpexBiaya.metode} onChange={e => setFormOpexBiaya(p => ({ ...p, metode: e.target.value }))} className="w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm">
                <option value="transfer">🏦 Transfer</option><option value="cash">💵 Cash</option><option value="cek">📝 Cek/Giro</option>
              </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-slate-600 mb-1">No. Referensi</label><input type="text" value={formOpexBiaya.nomorRef} onChange={e => setFormOpexBiaya(p => ({ ...p, nomorRef: e.target.value }))} className="w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1">Tgl Bayar</label><input type="date" value={formOpexBiaya.tanggalBayar} onChange={e => setFormOpexBiaya(p => ({ ...p, tanggalBayar: e.target.value }))} className="w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm" /></div>
              </div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Dibayar Oleh</label><input type="text" value={formOpexBiaya.dibayarOleh} onChange={e => setFormOpexBiaya(p => ({ ...p, dibayarOleh: e.target.value }))} className="w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm" /></div>
              {ferr && <p className="text-sm text-red-500">{ferr}</p>}
            </div>
            <div className="flex gap-2 border-t border-slate-200 px-5 py-3">
              <button onClick={() => { setBayarOpex(false); setBayarBiaya(false); }} className="flex-1 rounded-xl bg-slate-100 py-2 text-sm font-semibold text-slate-600">Batal</button>
              <button onClick={() => handleBayarOpexBiaya(bayarOpex ? 'OPEX' : 'BIAYA')} className="flex-1 rounded-xl bg-indigo-500 py-2 text-sm font-bold text-white">✅ Konfirmasi Bayar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Bayar — per PO */}
      {bayarPoGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={()=>setBayarPoGroup(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-sm font-bold text-indigo-700">
                {bayarPoGroup.metodeBayar==='cash' && bayarPoGroup.petugasLogistik ? '💵 Reimburse Petugas' : '💳 Pembayaran PO'}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500">
                {bayarPoGroup.noPO} — {bayarPoGroup.supplierNama}
              </p>
              {bayarPoGroup.metodeBayar==='cash' && bayarPoGroup.petugasLogistik && (
                <p className="mt-1 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
                  🛵 PO ini dijemput & ditalangi oleh <strong>{bayarPoGroup.petugasLogistik}</strong>. Pembayaran ini untuk reimburse ke petugas tsb.
                </p>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-400">Total PO:</span><span className="font-semibold">Rp {bayarPoGroup.total.toLocaleString('id-ID')}</span></div>
                <div><span className="text-slate-400">Sudah Dibayar:</span><span className="font-semibold text-emerald-600">Rp {bayarPoGroup.dibayar.toLocaleString('id-ID')}</span></div>
                <div className="col-span-2"><span className="text-slate-400">Sisa Tagihan:</span><span className="font-bold text-red-600">Rp {bayarPoGroup.sisa.toLocaleString('id-ID')}</span></div>
              </div>
              {/* SKU list */}
              <details className="mt-2"><summary className="cursor-pointer text-xs text-slate-400">{bayarPoGroup.items.length} SKU ▼</summary>
                <div className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">{bayarPoGroup.items.map(item=>(<div key={item.id} className="text-[10px] flex justify-between"><span>{item.sku} {item.namaSku} ×{item.qty}</span><span>Rp {item.total.toLocaleString('id-ID')}</span></div>))}</div>
              </details>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Jumlah Dibayar *</label><input type="number" value={formBayar.jumlah} onChange={e=>setFormBayar(p=>({...p,jumlah:e.target.value}))} className="w-full rounded-xl border bg-slate-50 px-3 py-2 text-center text-sm font-bold focus:border-indigo-500 focus:outline-none" /></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Metode Bayar</label><div className="flex gap-2">{METODE_OPTIONS.map(m=>(<button key={m.value} onClick={()=>setFormBayar(p=>({...p,metode:m.value}))} className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${formBayar.metode===m.value?'bg-indigo-500 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{m.icon} {m.label}</button>))}</div></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-semibold text-slate-600 mb-1">No. Referensi</label><input type="text" value={formBayar.nomorRef} onChange={e=>setFormBayar(p=>({...p,nomorRef:e.target.value}))} placeholder="No. TRX…" className="w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" /></div><div><label className="block text-xs font-semibold text-slate-600 mb-1">Tgl Bayar</label><input type="date" value={formBayar.tanggalBayar} onChange={e=>setFormBayar(p=>({...p,tanggalBayar:e.target.value}))} className="w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" /></div></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Dibayar Oleh</label><input type="text" value={formBayar.dibayarOleh} onChange={e=>setFormBayar(p=>({...p,dibayarOleh:e.target.value}))} placeholder="Nama staff finance…" className="w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" /></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Catatan</label><textarea value={formBayar.catatan} onChange={e=>setFormBayar(p=>({...p,catatan:e.target.value}))} placeholder="Opsional…" rows={2} className="w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" /></div>

              {/* Upload Bukti Bayar + OCR */}
              <div className="border-t border-slate-100 pt-3">
                <BuktiBayarUpload
                  onOcrResult={handleOcrResult}
                  onImageReady={(b64) => setBuktiImage(b64)}
                />
              </div>

              {/* Indikator auto-fill dari OCR */}
              {ocrResult && (ocrResult.nomorRef || ocrResult.jumlah || ocrResult.tanggal) && (
                <div className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-600 flex items-center gap-1.5">
                  <span>🤖</span> Data No. Referensi, jumlah & tanggal diisi otomatis dari bukti transfer. Silakan periksa kembali.
                </div>
              )}

              {ferr&&<p className="text-sm text-red-500">{ferr}</p>}
            </div>
            <div className="flex gap-2 border-t border-slate-200 px-5 py-3"><button onClick={()=>setBayarPoGroup(null)} className="flex-1 rounded-xl bg-slate-100 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200">Batal</button><button onClick={handleBayar} className="flex-1 rounded-xl bg-indigo-500 py-2 text-sm font-bold text-white hover:bg-indigo-700">✅ Konfirmasi Bayar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================ */
/* TAB 2: Arus Kas                                                   */
/* ================================================================ */
function ArusKasTab() {
  const [hppData] = useLocalStorage<HppPurchase[]>(HPP_STORAGE, []);
  const [payments] = useLocalStorage<PaymentRecord[]>(PAYMENT_STORAGE, []);
  const [biayaData] = useLocalStorage<BiayaOp[]>(BIAYA_STORAGE, []);
  const [opexData] = useLocalStorage<OpexPurchase[]>(OPEX_STORAGE, []);
  const [pencairan] = useLocalStorage<PencairanEntry[]>(PENCAIRAN_STORAGE, []);
  const [penjualan] = useLocalStorage<any[]>('mma_penjualan_transaksi', []);

  const [bulan, setBulan] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  });

  const prefix = bulan; // YYYY-MM

  const totalPembayaran = payments.filter(p => p.tanggalBayar.startsWith(prefix)).reduce((s, p) => s + p.jumlahDibayar, 0);
  const totalBiaya = biayaData.filter(b => b.tanggal.startsWith(prefix)).reduce((s, b) => s + b.jumlah, 0);
  const totalOpex = opexData.filter(o => o.tanggal.startsWith(prefix)).reduce((s, o) => s + o.total, 0);
  const totalKeluar = totalPembayaran + totalBiaya + totalOpex;

  // Pemasukan nyata: penjualan kasir + pencairan saldo marketplace
  const totalPenjualan = penjualan.filter(t => t.tanggal && t.tanggal.startsWith(prefix)).reduce((s, t) => s + (t.total || 0), 0);
  const totalPencairanBulan = pencairan.filter(p => p.tanggal && p.tanggal.startsWith(prefix)).reduce((s, p) => s + (p.jumlah || 0), 0);
  const totalMasuk = totalPenjualan + totalPencairanBulan;

  const saldoAkhir = totalMasuk - totalKeluar;

  // Harian dalam bulan ini
  const dailyFlow = useMemo(() => {
    const [y, m] = bulan.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const days: { tgl: string; masuk: number; keluar: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const tgl = `${bulan}-${String(d).padStart(2,'0')}`;
      const bayarHari = payments.filter(p => p.tanggalBayar === tgl).reduce((s, p) => s + p.jumlahDibayar, 0);
      const biayaHari = biayaData.filter(b => b.tanggal === tgl).reduce((s, b) => s + b.jumlah, 0);
      const opexHari = opexData.filter(o => o.tanggal === tgl).reduce((s, o) => s + o.total, 0);
      const jualHari = penjualan.filter(t => t.tanggal === tgl).reduce((s, t) => s + (t.total || 0), 0);
      const cairHari = pencairan.filter(p => p.tanggal === tgl).reduce((s, p) => s + (p.jumlah || 0), 0);
      days.push({
        tgl: String(d),
        masuk: jualHari + cairHari,
        keluar: bayarHari + biayaHari + opexHari,
      });
    }
    return days;
  }, [payments, biayaData, opexData, penjualan, pencairan, bulan]);

  const maxMasuk = Math.max(...dailyFlow.map(d => d.masuk), 1);
  const maxKeluar = Math.max(...dailyFlow.map(d => d.keluar), 1);
  const maxFlow = Math.max(maxMasuk, maxKeluar, 1);

  const fmtRp = (n: number) => n >= 1000000 ? `Rp ${(n/1000000).toFixed(1)}jt` : n >= 1000 ? `Rp ${(n/1000).toFixed(0)}rb` : `Rp ${n}`;

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-300" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Arus Kas</h2>
          <p className="mt-1 text-sm text-slate-500">Ringkasan pemasukan & pengeluaran bulanan.</p>
        </div>
        <input type="month" value={bulan} onChange={e => setBulan(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
      </div>

      {/* KPI */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-emerald-50 p-3 text-center"><p className="text-lg font-bold text-emerald-700">{fmtRp(totalMasuk)}</p><p className="text-xs text-emerald-500">Pemasukan</p></div>
        <div className="rounded-xl bg-red-50 p-3 text-center"><p className="text-lg font-bold text-red-600">{fmtRp(totalKeluar)}</p><p className="text-xs text-red-500">Pengeluaran</p></div>
        <div className={`rounded-xl p-3 text-center ${saldoAkhir >= 0 ? 'bg-blue-50' : 'bg-red-100'}`}><p className={`text-lg font-bold ${saldoAkhir >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmtRp(saldoAkhir)}</p><p className="text-xs text-slate-500">Saldo Akhir</p></div>
        <div className="rounded-xl bg-indigo-50 p-3 text-center"><p className="text-lg font-bold text-indigo-700">{payments.filter(p => p.tanggalBayar.startsWith(prefix)).length}</p><p className="text-xs text-indigo-500">Pembayaran</p></div>
      </div>

      {/* Detail */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">📥 Pemasukan Bulan Ini</p>
          <div className="space-y-2">
            {[
              { label: 'Penjualan Kasir', amount: totalPenjualan, color: 'bg-emerald-400', icon: '🛒' },
              { label: 'Pencairan Marketplace', amount: totalPencairanBulan, color: 'bg-sky-400', icon: '💸' },
            ].map(item => {
              const max = Math.max(totalPenjualan, totalPencairanBulan, 1);
              return (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="text-sm">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-0.5"><span className="text-slate-600">{item.label}</span><span className="font-semibold text-slate-700">{fmtRp(item.amount)}</span></div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${(item.amount/max)*100}%` }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">📤 Pengeluaran Bulan Ini</p>
          <div className="space-y-2">
            {[
              { label: 'Pembayaran PO', amount: totalPembayaran, color: 'bg-red-400', icon: '💳' },
              { label: 'Biaya Operasional', amount: totalBiaya, color: 'bg-amber-400', icon: '💸' },
              { label: 'Pembelian OPEX', amount: totalOpex, color: 'bg-blue-400', icon: '📦' },
            ].map(item => {
              const max = Math.max(totalPembayaran, totalBiaya, totalOpex, 1);
              return (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="text-sm">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-0.5"><span className="text-slate-600">{item.label}</span><span className="font-semibold text-slate-700">{fmtRp(item.amount)}</span></div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${(item.amount/max)*100}%` }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tren harian */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">📊 Arus Harian <span className="text-emerald-500">▲masuk</span> <span className="text-red-400">▼keluar</span></p>
          <div className="flex items-end gap-[1px] h-24">
            {dailyFlow.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end min-w-[6px] h-full">
                <div className="w-full bg-emerald-400 rounded-t-sm transition-all" style={{ height: `${Math.max((d.masuk/maxFlow)*100, d.masuk > 0 ? 2 : 0)}%` }} title={`${d.tgl}: masuk ${fmtRp(d.masuk)}`} />
                <div className="w-full bg-red-400 transition-all" style={{ height: `${Math.max((d.keluar/maxFlow)*100, d.keluar > 0 ? 2 : 0)}%` }} title={`${d.tgl}: keluar ${fmtRp(d.keluar)}`} />
                {dailyFlow.length <= 31 && (i % 5 === 0 || i === dailyFlow.length-1) && <span className="text-[8px] text-slate-400 mt-0.5">{d.tgl}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================ */
/* TAB 3: Riwayat Pembayaran                                        */
/* ================================================================ */
function RiwayatTab() {
  const [payments] = useLocalStorage<PaymentRecord[]>(PAYMENT_STORAGE, []);
  const [search, setSearch] = useState('');
  const [filterBulan, setFilterBulan] = useState('');

  const filtered = useMemo(() => {
    return payments.filter(p => {
      if (filterBulan && !p.tanggalBayar.startsWith(filterBulan)) return false;
      if (search && !p.noPO.toLowerCase().includes(search.toLowerCase()) && !p.supplierNama.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [payments, filterBulan, search]);

  const totalDibayar = filtered.reduce((s, p) => s + p.jumlahDibayar, 0);

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Riwayat Pembayaran</h2>
      <p className="mt-1 text-sm text-slate-500">Log semua pembayaran yang telah dilakukan oleh tim Finance.</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-indigo-50 p-3 text-center"><p className="text-2xl font-bold text-indigo-700">{filtered.length}</p><p className="text-xs text-indigo-500">Total Transaksi</p></div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center"><p className="text-2xl font-bold text-emerald-600">Rp {totalDibayar.toLocaleString('id-ID')}</p><p className="text-xs text-emerald-500">Total Dibayar</p></div>
        <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-2xl font-bold text-slate-600">{Array.from(new Set(payments.map(p => p.dibayarOleh).filter(Boolean))).length}</p><p className="text-xs text-slate-400">Petugas</p></div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Bulan</label>
          <input type="month" value={filterBulan} onChange={e => setFilterBulan(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-slate-500 mb-1">Cari PO / Supplier</label>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ketik No PO atau supplier…" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
        </div>
        {filterBulan && <button onClick={() => setFilterBulan('')} className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600 hover:bg-slate-200">✕ Clear</button>}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-indigo-50 text-xs uppercase text-indigo-600">
              <th className="px-3 py-3 font-semibold">Tgl Bayar</th>
              <th className="px-3 py-3 font-semibold">No PO</th>
              <th className="px-3 py-3 font-semibold hidden sm:table-cell">Supplier</th>
              <th className="px-3 py-3 text-right font-semibold">Jumlah</th>
              <th className="px-3 py-3 font-semibold hidden sm:table-cell">Metode</th>
              <th className="px-3 py-3 font-semibold hidden sm:table-cell">No. Ref</th>
              <th className="px-3 py-3 font-semibold hidden sm:table-cell">Oleh</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">Belum ada riwayat pembayaran.</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition">
                <td className="px-3 py-2.5 text-xs text-slate-500">{p.tanggalBayar}</td>
                <td className="px-3 py-2.5 font-mono text-xs font-bold text-indigo-700">{p.noPO}</td>
                <td className="px-3 py-2.5 text-xs text-slate-700 hidden sm:table-cell">{p.supplierNama}</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-emerald-600">Rp {p.jumlahDibayar.toLocaleString('id-ID')}</td>
                <td className="px-3 py-2.5 text-xs text-slate-500 hidden sm:table-cell">{METODE_OPTIONS.find(m => m.value === p.metode)?.label ?? p.metode}</td>
                <td className="px-3 py-2.5 text-xs text-slate-400 hidden sm:table-cell font-mono">{p.nomorRef}</td>
                <td className="px-3 py-2.5 text-xs text-slate-500 hidden sm:table-cell">{p.dibayarOleh}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================================ */
/* TAB 4: Arsip Bukti Bayar                                         */
/* ================================================================ */
function ArsipBuktiTab() {
  const [buktiList] = useLocalStorage<BuktiBayar[]>(BUKTI_STORAGE, []);
  const [search, setSearch] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return buktiList.filter(b => {
      if (search && !b.noPO.toLowerCase().includes(search.toLowerCase()) && !b.supplierNama.toLowerCase().includes(search.toLowerCase()) && !b.nomorRef.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [buktiList, search]);

  const handleDelete = (id: string) => {
    // Karena useLocalStorage immutable dari komponen ini, kita bypass dengan update langsung
    try {
      const raw = localStorage.getItem(BUKTI_STORAGE);
      const list: BuktiBayar[] = raw ? JSON.parse(raw) : [];
      const updated = list.filter(b => b.id !== id);
      localStorage.setItem(BUKTI_STORAGE, JSON.stringify(updated));
      // Force re-render by reloading — sederhana untuk prototype
      window.location.reload();
    } catch { /* fallback */ }
    setConfirmDelete(null);
  };

  const previewBukti = previewId ? buktiList.find(b => b.id === previewId) : null;

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Arsip Bukti Bayar</h2>
      <p className="mt-1 text-sm text-slate-500">Semua bukti screenshot transfer yang diunggah saat konfirmasi pembayaran.</p>

      {/* KPI */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-indigo-50 p-3 text-center"><p className="text-2xl font-bold text-indigo-700">{buktiList.length}</p><p className="text-xs text-indigo-500">Total Arsip</p></div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center"><p className="text-2xl font-bold text-emerald-600">{buktiList.filter(b => b.ocrRawText).length}</p><p className="text-xs text-emerald-500">Dengan OCR</p></div>
        <div className="rounded-xl bg-amber-50 p-3 text-center"><p className="text-2xl font-bold text-amber-600">{new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p><p className="text-xs text-amber-500">Periode</p></div>
      </div>

      {/* Search */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
        <label className="block text-xs text-slate-500 mb-1">Cari No PO / Supplier / No. Ref</label>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ketik untuk mencari…" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
          <span className="text-4xl">🗄️</span>
          <p className="mt-3 text-sm font-medium text-slate-500">Belum ada arsip bukti bayar</p>
          <p className="mt-1 text-xs text-slate-400">Upload bukti transfer saat melakukan konfirmasi pembayaran di tab Pembayaran PO.</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(bukti => (
            <div key={bukti.id} className="group rounded-xl border border-slate-200 bg-white p-3 hover:border-indigo-300 hover:shadow-sm transition">
              {/* Thumbnail */}
              <div
                className="relative cursor-pointer overflow-hidden rounded-lg bg-slate-100 h-36 flex items-center justify-center"
                onClick={() => setPreviewId(bukti.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bukti.imageBase64} alt={`Bukti ${bukti.noPO}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                  <span className="text-white text-lg opacity-0 group-hover:opacity-100 transition">🔍</span>
                </div>
              </div>

              {/* Info */}
              <div className="mt-2 space-y-1">
                <p className="font-mono text-xs font-bold text-indigo-700">{bukti.noPO}</p>
                <p className="text-xs text-slate-500 truncate">{bukti.supplierNama}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-600">Rp {bukti.jumlah.toLocaleString('id-ID')}</span>
                  <span className="text-[10px] text-slate-400">{bukti.tanggalBayar}</span>
                </div>
                {bukti.nomorRef && bukti.nomorRef !== '-' && (
                  <p className="text-[10px] text-slate-400 font-mono truncate">Ref: {bukti.nomorRef}</p>
                )}
                {bukti.ocrRawText && (
                  <span className="inline-block rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] text-indigo-500 font-medium">🤖 OCR</span>
                )}
              </div>

              {/* Actions */}
              <div className="mt-2 flex gap-1">
                <button
                  onClick={() => setPreviewId(bukti.id)}
                  className="flex-1 rounded-lg bg-indigo-50 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100"
                >
                  🔍 Lihat
                </button>
                <button
                  onClick={() => setConfirmDelete(bukti.id)}
                  className="rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-100"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Preview Gambar */}
      {previewBukti && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewId(null)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 rounded-t-2xl">
              <div>
                <p className="text-sm font-bold text-slate-800">{previewBukti.noPO} — {previewBukti.supplierNama}</p>
                <p className="text-xs text-slate-400">{previewBukti.tanggalBayar} · Rp {previewBukti.jumlah.toLocaleString('id-ID')}</p>
              </div>
              <button onClick={() => setPreviewId(null)} className="rounded-full bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200">✕</button>
            </div>
            <div className="p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewBukti.imageBase64} alt={`Bukti ${previewBukti.noPO}`} className="w-full rounded-xl border border-slate-100" />
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-400">No. Referensi:</span> <span className="font-mono font-medium text-slate-700">{previewBukti.nomorRef}</span></div>
                <div><span className="text-slate-400">Tanggal Bayar:</span> <span className="font-medium text-slate-700">{previewBukti.tanggalBayar}</span></div>
                <div><span className="text-slate-400">ID Pembayaran:</span> <span className="font-mono text-slate-500">{previewBukti.paymentId}</span></div>
                <div><span className="text-slate-400">Disimpan:</span> <span className="text-slate-500">{new Date(previewBukti.createdAt).toLocaleString('id-ID')}</span></div>
              </div>
              {previewBukti.ocrRawText && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-slate-400">📄 Hasil OCR Mentah</summary>
                  <pre className="mt-1 max-h-32 overflow-y-auto rounded-lg bg-slate-50 p-2 text-[10px] text-slate-500 whitespace-pre-wrap">{previewBukti.ocrRawText}</pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Konfirmasi Hapus */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-slate-800">Hapus Arsip?</p>
            <p className="mt-1 text-xs text-slate-500">Bukti bayar ini akan dihapus permanen dari arsip. Data pembayaran tetap tersimpan.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-xl bg-slate-100 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200">Batal</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 rounded-xl bg-red-500 py-2 text-sm font-bold text-white hover:bg-red-600">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================ */
/* TAB 5: Refund / Koreksi Keuangan                                  */
/* ================================================================ */
interface RefundItem {
  id: string;
  koreksiId: string;
  noPO: string;
  supplierNama: string;
  sku: string;
  namaSku: string;
  qty: number;
  tanggal: string;
  status: 'menunggu_refund' | 'diproses' | 'selesai';
  nilaiRefund?: number;
}

const REFUND_STORAGE = 'mma_koreksi_refund';

function RefundTab() {
  const [refundList, setRefundList] = useState<RefundItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try { const r = localStorage.getItem(REFUND_STORAGE); if (r) setRefundList(JSON.parse(r)); } catch {}
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) { try { localStorage.setItem(REFUND_STORAGE, JSON.stringify(refundList)); } catch {} }
  }, [refundList, mounted]);

  const getHargaBeli = (noPO: string, sku: string): number => {
    try {
      const raw = localStorage.getItem('mma_hpp_purchases');
      if (!raw) return 0;
      const hpp: any[] = JSON.parse(raw);
      const found = hpp.find((p: any) => p.noPO === noPO && p.sku === sku);
      return found?.hargaBeli || 0;
    } catch { return 0; }
  };

  const updateStatus = (id: string, status: RefundItem['status']) => {
    if (status === 'selesai') {
      // Tanya dulu: masuk Kas Besar atau Kas Kecil?
      setPilihKasId(id);
      return;
    }
    const updated = refundList.map(r => r.id === id ? { ...r, status } : r);
    setRefundList(updated);
    localStorage.setItem(REFUND_STORAGE, JSON.stringify(updated));
  };

  // Pilih kas untuk refund
  const [pilihKasId, setPilihKasId] = useState<string | null>(null);
  const selesaikanRefund = (keKasKecil: boolean) => {
    if (!pilihKasId) return;
    const id = pilihKasId;
    const updated = refundList.map(r => r.id === id ? { ...r, status: 'selesai' as const } : r);
    setRefundList(updated);
    localStorage.setItem(REFUND_STORAGE, JSON.stringify(updated));

    const item = refundList.find(r => r.id === id);
    if (item) {
      const nilai = item.nilaiRefund || getHargaBeli(item.noPO, item.sku) * item.qty;
      if (nilai > 0) {
        try {
          if (keKasKecil) {
            const kk = JSON.parse(localStorage.getItem(KAS_KECIL_STORAGE) || '[]');
            kk.unshift({
              id: `kk-refund-${Date.now()}`,
              tanggal: new Date().toISOString().slice(0, 10),
              jumlah: nilai,
              jenis: 'masuk',
              keterangan: `Refund ${item.noPO} - ${item.namaSku} (${item.supplierNama})`,
              sumber: 'refund',
            });
            localStorage.setItem(KAS_KECIL_STORAGE, JSON.stringify(kk));
          }
          // Kalau Kas Besar: uang otomatis sudah dihitung sebagai pengurangan pengeluaran di SaldoKas
          // (karena pembayaran PO sudah dicatat sebelumnya, refund mengembalikan ke kas besar)
        } catch {}
      }
    }
    setPilihKasId(null);
  };

  const setNilaiRefund = (id: string, nilai: number) => {
    const updated = refundList.map(r => r.id === id ? { ...r, nilaiRefund: nilai } : r);
    setRefundList(updated);
    localStorage.setItem(REFUND_STORAGE, JSON.stringify(updated));
  };

  const pending = refundList.filter(r => r.status === 'menunggu_refund');
  const totalSelesai = refundList.filter(r => r.status === 'selesai').reduce((s, r) => {
    const harga = r.nilaiRefund || getHargaBeli(r.noPO, r.sku) * r.qty;
    return s + harga;
  }, 0);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      menunggu_refund: 'bg-red-100 text-red-700',
      diproses: 'bg-amber-100 text-amber-700',
      selesai: 'bg-emerald-100 text-emerald-700',
    };
    const label: Record<string, string> = {
      menunggu_refund: '⏳ Menunggu',
      diproses: '🔄 Diproses',
      selesai: '✅ Selesai',
    };
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status]}`}>{label[status]}</span>;
  };

  if (!mounted) return <div className="py-12 text-center text-slate-400">Memuat data refund...</div>;

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-red-500 to-amber-400" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">↩️ Refund / Koreksi Keuangan</h2>
      <p className="mt-1 text-sm text-slate-500">Daftar refund dari koreksi PO Purchasing. Proses pengembalian dana.</p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-red-50 p-3 text-center"><p className="text-2xl font-bold text-red-600">{pending.length}</p><p className="text-xs text-red-500">Menunggu</p></div>
        <div className="rounded-xl bg-amber-50 p-3 text-center"><p className="text-2xl font-bold text-amber-600">{refundList.filter(r => r.status === 'diproses').length}</p><p className="text-xs text-amber-500">Diproses</p></div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center"><p className="text-2xl font-bold text-emerald-600">Rp {totalSelesai.toLocaleString('id-ID')}</p><p className="text-xs text-emerald-500">Total Selesai</p></div>
      </div>

      {pending.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-bold text-red-700 mb-2">⏳ Perlu Diproses ({pending.length})</p>
          <div className="space-y-2">
            {pending.map(r => {
              const hargaSatuan = getHargaBeli(r.noPO, r.sku);
              const estimasi = r.nilaiRefund || (hargaSatuan * r.qty);
              return (
                <div key={r.id} className="rounded-xl border-2 border-red-200 bg-red-50/50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800">
                        <span className="font-mono text-red-600">{r.noPO}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {r.sku} — {r.namaSku} ×{r.qty} · {r.supplierNama}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-slate-500">Nilai Refund:</span>
                        <input type="number" value={r.nilaiRefund || estimasi}
                          onChange={e => setNilaiRefund(r.id, +e.target.value)}
                          className="w-40 rounded-lg border px-2 py-1 text-xs font-bold text-slate-700" />
                        <span className="text-[10px] text-slate-400">Estimasi: Rp {(hargaSatuan * r.qty).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => updateStatus(r.id, 'diproses')}
                        className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200">🔄 Proses</button>
                      <button onClick={() => updateStatus(r.id, 'selesai')}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600">✅ Selesai</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {refundList.filter(r => r.status !== 'menunggu_refund').length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-bold text-slate-700 mb-2">📋 Riwayat Refund</p>
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead><tr className="bg-slate-50 text-xs uppercase text-slate-500">
                {['No PO','SKU','Nama','Qty','Supplier','Nilai','Status'].map(c => <th key={c} className="px-3 py-2 font-semibold">{c}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-50 bg-white">
                {refundList.filter(r => r.status !== 'menunggu_refund').map(r => {
                  const harga = r.nilaiRefund || getHargaBeli(r.noPO, r.sku) * r.qty;
                  return (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-mono text-[10px] text-indigo-600">{r.noPO}</td>
                      <td className="px-3 py-2 font-mono text-[10px]">{r.sku}</td>
                      <td className="px-3 py-2 text-slate-700">{r.namaSku}</td>
                      <td className="px-3 py-2 text-center">{r.qty}</td>
                      <td className="px-3 py-2 text-[10px]">{r.supplierNama}</td>
                      <td className="px-3 py-2 font-semibold">Rp {harga.toLocaleString('id-ID')}</td>
                      <td className="px-3 py-2">{statusBadge(r.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {refundList.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
          <p className="text-4xl">💰</p>
          <p className="mt-2 text-sm font-semibold text-slate-500">Belum ada refund</p>
          <p className="text-xs text-slate-400 mt-1">Refund muncul saat Purchasing menandai koreksi sebagai "Retur".</p>
        </div>
      )}

      {/* Modal Pilih Kas — refund mau masuk mana? */}
      {pilihKasId && (() => {
        const item = refundList.find(r => r.id === pilihKasId);
        const nilai = item ? (item.nilaiRefund || getHargaBeli(item.noPO, item.sku) * item.qty) : 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPilihKasId(null)}>
            <div className="w-full max-w-xs rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 text-center">
                <p className="text-lg">💰</p>
                <p className="text-sm font-bold text-slate-800 mt-2">Refund Selesai</p>
                <p className="text-xs text-slate-500 mt-1">
                  {item?.noPO} — {item?.namaSku}<br />
                  Nilai: <strong>Rp {nilai.toLocaleString('id-ID')}</strong>
                </p>
                <p className="text-xs text-slate-500 mt-3">Uang refund masuk ke:</p>
              </div>
              <div className="flex gap-2 px-5 pb-5">
                <button
                  onClick={() => selesaikanRefund(false)}
                  className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white hover:bg-emerald-600"
                >
                  🏦 Kas Besar<br /><span className="text-[10px] font-normal">(Bank / Modal)</span>
                </button>
                <button
                  onClick={() => selesaikanRefund(true)}
                  className="flex-1 rounded-xl bg-amber-500 py-3 text-sm font-bold text-white hover:bg-amber-600"
                >
                  🪙 Kas Kecil<br /><span className="text-[10px] font-normal">(Cash / Operasional)</span>
                </button>
              </div>
              <button onClick={() => setPilihKasId(null)}
                className="w-full border-t border-slate-200 py-2 text-xs text-slate-400 hover:text-slate-600">Batal</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
