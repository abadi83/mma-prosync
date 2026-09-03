'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSkus, type SkuItem } from '@/app/context/SkuContext';
import { useAgregasi } from '@/app/context/AgregasiContext';
import { computeBelanjaOrders, computeBelanjaSkuSummary } from '@/app/lib/belanja';
import { useAkuntansi } from '@/app/context/AkuntansiContext';
import InvoiceExport, { type InvoicePOData, type InvoicePOItem, InvoicePreview } from '@/app/components/InvoicePO';
import KoreksiPOTab from '@/app/pembelian/components/KoreksiPOTab';
import { useSuppliers } from '@/app/hooks/useSuppliers';
import { recordActivity } from '@/app/lib/recordActivity';
import { addTombstones } from '@/app/lib/tombstones';
import type { BuktiBayar } from '@/app/types';

/* ================================================================ */
/* Types                                                             */
/* ================================================================ */

/* ── Payment Method ── */
type MetodeBayar = 'cash' | 'transfer' | 'dp' | 'kontrabon';
const METODE_OPTIONS: { value: MetodeBayar; label: string; icon: string }[] = [
  { value: 'cash', label: 'Cash / Tunai', icon: '💵' },
  { value: 'transfer', label: 'Transfer', icon: '🏦' },
  { value: 'dp', label: 'DP (Down Payment)', icon: '📋' },
  { value: 'kontrabon', label: 'Kontrabon / Bon', icon: '📄' },
];

/* ── HPP SKU Purchase Record ── */
interface HppPurchase {
  id: string;
  noPO: string;
  sku: string;
  namaSku: string;
  supplierId: string;
  supplierNama: string;
  qty: number;
  hargaBeli: number;
  total: number;
  metodeBayar: MetodeBayar;
  dibayar: number;       // jumlah yang sudah dibayar (untuk DP: nominal DP; Cash/Transfer: full)
  sisaTagihan: number;   // total - dibayar (0 = lunas)
  tanggal: string;
  jatuhTempo: string;    // untuk kontrabon
  lunas: boolean;
  dikoreksi?: boolean;   // PO pernah dikoreksi (harga/qty/foto nota)
  koreksiPada?: string;  // waktu koreksi terakhir
  petugasLogistik?: string;  // Nama petugas yang menjemput PO (cash: yg talangi dulu)
  pickupStatus?: 'belum' | 'sedang' | 'sampai'; // status penjemputan oleh logistik
  fotoBase64?: string;   // foto nota/invoice (compressed)
  namaFileFoto?: string;
}

const HPP_STORAGE = 'mma_hpp_purchases';

/* ── Kompresi gambar sebelum simpan ke localStorage ── */
function compressImage(file: File): Promise<{ base64: string; nama: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 800; const maxH = 600;
        let w = img.width; let h = img.height;
        if (w > maxW) { h = (h * maxW) / w; w = maxW; }
        if (h > maxH) { w = (w * maxH) / h; h = maxH; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ base64: canvas.toDataURL('image/jpeg', 0.6), nama: file.name });
      };
      img.onerror = () => reject(new Error('Gagal memuat gambar.'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsDataURL(file);
  });
}

/* Auto-generate No PO */
function generateNoPO(existing: HppPurchase[]): string {
  const now = new Date();
  const yymmdd = `${String(now.getFullYear()).slice(2)}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const todayCount = existing.filter(p => p.noPO.startsWith(`PO-${yymmdd}`)).length + 1;
  return `PO-${yymmdd}-${String(todayCount).padStart(3,'0')}`;
}

/* ── OPEX Purchase Record ── */
interface OpexPurchase {
  id: string;
  namaItem: string;
  kategori: string;
  subKategori?: string;
  qty: number;
  satuan: string;
  hargaSatuan: number;
  total: number;
  supplierNama: string;
  tanggal: string;
}

const OPEX_STORAGE = 'mma_opex_purchases';

/* ── Biaya Operasional Record ── */
interface BiayaOp {
  id: string;
  deskripsi: string;
  kategori: string;
  jumlah: number;
  tanggal: string;
  nonTunai?: boolean; // akrual: masuk Laba Rugi tapi TIDAK mengurangi Arus Kas
}

const BIAYA_STORAGE = 'mma_biaya_operasional';

/* ================================================================ */
/* Tab type                                                          */
/* ================================================================ */
type Tab = 'dashboard' | 'hpp' | 'opex' | 'biaya' | 'arsip' | 'koreksi' | 'belanja';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'hpp', label: 'Pembelian HPP SKU', icon: '📦' },
  { key: 'opex', label: 'Pembelian OPEX', icon: '📋' },
  { key: 'biaya', label: 'Biaya Operasional', icon: '💸' },
  { key: 'arsip', label: 'Arsip Invoice', icon: '🗄️' },
  { key: 'koreksi', label: 'Koreksi PO', icon: '⚠️' },
  { key: 'belanja', label: 'Belanja Picking', icon: '🛒' },
];

/* ── Kategori OPEX ── */
const OPEX_KATEGORI = ['Packing & Kemasan', 'ATK & Kantor', 'Kebersihan', 'Peralatan', 'Lainnya'];
const OPEX_SUB_KATEGORI: Record<string, string[]> = {
  'Packing & Kemasan': ['Kardus', 'Bubble Wrap', 'Plastik', 'Lakban', 'Lainnya'],
};
const OPEX_SATUAN = ['pcs', 'roll', 'pack', 'kg', 'liter', 'set', 'box'];

/* ── Kategori Biaya Operasional ── */
const BIAYA_KATEGORI = ['Listrik & Air', 'Internet & Pulsa', 'Transport & BBM', 'Sewa Tempat', 'Gaji & Upah', 'Marketing & Iklan', 'Maintenance', 'Cicilan Kendaraan', 'Cicilan Utang Usaha', 'Ongkir Supplier', 'Ongkir Refund Customer', 'Refund Manual Marketplace', 'Fee Pengantaran Barang/Toren', 'Fee Marketing', 'Renovasi dan Infrastruktur', 'Parkir', 'Tips Supplier', 'Gas 3kg', 'Air Minum', 'Biaya Tukang', 'Service Kendaraan Gudang', 'Lainnya'];

/* Format label bulan untuk filter (YYYY-MM → "Agustus 2026") */
const NAMA_BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const fmtBulan = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${NAMA_BULAN[(+m) - 1] || m} ${y}`;
};

/* ================================================================ */
/* Main Page                                                         */
/* ================================================================ */
export default function PembelianPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const { allRows } = useAgregasi();
  const { skus } = useSkus();
  const belanjaCount = useMemo(() => computeBelanjaOrders(allRows, skus).length, [allRows, skus]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-500 to-emerald-300 p-5 text-white shadow-lg sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-100 sm:text-sm">Purchasing</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Pembelian & Biaya</h1>
        <p className="mt-1 text-sm text-emerald-100 sm:text-base">Catat pembelian HPP SKU, OPEX packing & ATK, dan biaya operasional harian.</p>
      </header>

      {/* Tab Navigation */}
      <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm" role="tablist">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:px-5 sm:text-sm ${
              tab === t.key
                ? 'bg-emerald-500 text-white shadow'
                : t.key === 'belanja' && belanjaCount > 0
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
            }`}
          >
            <span className="text-base sm:text-lg">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
            {t.key === 'belanja' && belanjaCount > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab === t.key ? 'bg-white text-red-600' : 'bg-red-500 text-white'}`}>{belanjaCount}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <section className="card-blue">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'hpp' && <HppSkuTab />}
        {tab === 'opex' && <OpexTab />}
        {tab === 'biaya' && <BiayaOpTab />}
        {tab === 'arsip' && <ArsipTab />}
        {tab === 'koreksi' && <KoreksiPOTab />}
        {tab === 'belanja' && <BelanjaPickingTab onGoHpp={() => setTab('hpp')} />}
      </section>
    </main>
  );
}

/* ================================================================ */
/* TAB BELANJA PICKING: daftar belanja otomatis dari tim gudang     */
/* ================================================================ */
function BelanjaPickingTab({ onGoHpp }: { onGoHpp?: () => void }) {
  const { allRows } = useAgregasi();
  const { skus, setSkus } = useSkus();
  const { addJurnal } = useAkuntansi();
  const [purchases, setPurchases] = useLocalStorage<HppPurchase[]>(HPP_STORAGE, []);
  const [hargaHistory, setHargaHistory] = useLocalStorage<any[]>('mma_harga_modal_history', []);
  const suppliers = useSuppliers();
  const summaries = useMemo(() => computeBelanjaSkuSummary(allRows, skus), [allRows, skus]);
  const orders = useMemo(() => computeBelanjaOrders(allRows, skus), [allRows, skus]);
  const totalQty = summaries.reduce((s, x) => s + x.qty, 0);

  /* ── Seleksi manual per SKU + supplier per SKU ── */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [supplierBySku, setSupplierBySku] = useState<Record<string, string>>({});
  const [qtyBySku, setQtyBySku] = useState<Record<string, number>>({});
  const [hargaBySku, setHargaBySku] = useState<Record<string, string>>({});
  const [metodeBayar, setMetodeBayar] = useState<MetodeBayar>('cash');
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [dpAmount, setDpAmount] = useState('');
  const [jatuhTempo, setJatuhTempo] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); });
  const [ferr, setFerr] = useState('');

  /* SKU yang sudah punya PO terbuka (belum lunas) → hindari dobel beli */
  const alreadyPoed = useMemo(() => new Set(purchases.filter(p => !p.lunas).map(p => p.sku)), [purchases]);
  const selectable = summaries.filter(s => !alreadyPoed.has(s.sku));

  /* Auto-fill satu SKU: supplier pertama, qty kebutuhan, & harga (history → master) */
  const autofill = (sku: string, needed: number) => {
    setSupplierBySku(p => (p[sku] ? p : suppliers[0] ? { ...p, [sku]: suppliers[0].id } : p));
    setQtyBySku(p => (p[sku] !== undefined ? p : { ...p, [sku]: needed ?? 1 }));
    setHargaBySku(p => {
      if (p[sku] !== undefined) return p;
      const hist = purchases.filter(x => x.sku === sku).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
      const inv = skus.find(x => x.sku.toLowerCase() === sku.toLowerCase());
      const auto = hist.length > 0 ? String(hist[0].hargaBeli) : (inv ? String(inv.hargaBaru || inv.hargaModalLama || '') : '');
      return { ...p, [sku]: auto };
    });
  };

  const toggleSelect = (sku: string) => {
    const willSelect = !selected.has(sku);
    setSelected(prev => {
      const n = new Set(prev);
      if (willSelect) n.add(sku); else n.delete(sku);
      return n;
    });
    if (willSelect) {
      const s = summaries.find(x => x.sku === sku);
      autofill(sku, s?.qty ?? 1);
    }
  };

  const selectedList = summaries.filter(s => selected.has(s.sku));
  const selectAll = () => {
    const list = selectable;
    setSelected(new Set(list.map(s => s.sku)));
    for (const s of list) autofill(s.sku, s.qty);
  };
  const deselectAll = () => setSelected(new Set());
  const estTotal = selectedList.filter(s => !alreadyPoed.has(s.sku)).reduce((sum, s) => sum + (qtyBySku[s.sku] || s.qty) * +(hargaBySku[s.sku] || 0), 0);

  /* ── Buat PO: 1 No PO per supplier (supplier bisa beda per SKU) ── */
  const submitPO = () => {
    setFerr('');
    const lines = selectedList.filter(s => !alreadyPoed.has(s.sku));
    if (lines.length === 0) { setFerr('Pilih minimal 1 SKU yang belum di-PO.'); return; }
    for (const s of lines) {
      if (!supplierBySku[s.sku]) { setFerr(`Pilih supplier untuk SKU ${s.sku}.`); return; }
      const q = qtyBySku[s.sku];
      if (!q || q <= 0) { setFerr(`Qty untuk SKU ${s.sku} harus lebih dari 0.`); return; }
      const h = +(hargaBySku[s.sku] || 0);
      if (!h || h <= 0) { setFerr(`Harga beli untuk SKU ${s.sku} harus lebih dari 0.`); return; }
    }
    if (metodeBayar === 'dp' && (!dpAmount || +dpAmount <= 0)) { setFerr('Isi jumlah DP.'); return; }

    // Group by supplier → satu No PO per supplier
    const groups = new Map<string, typeof lines>();
    for (const s of lines) {
      const supId = supplierBySku[s.sku];
      if (!groups.has(supId)) groups.set(supId, []);
      groups.get(supId)!.push(s);
    }

    const now = new Date();
    const yymmdd = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    let seq = purchases.filter(p => p.noPO.startsWith(`PO-${yymmdd}`)).length;

    for (const [supId, items] of groups) {
      seq += 1;
      const poNumber = `PO-${yymmdd}-${String(seq).padStart(3, '0')}`;
      const sup = suppliers.find(x => x.id === supId);
      const groupTotal = items.reduce((s2, it) => s2 + (qtyBySku[it.sku] || it.qty) * +(hargaBySku[it.sku] || 0), 0);

      for (const it of items) {
        const q = qtyBySku[it.sku] || it.qty;
        const h = +(hargaBySku[it.sku] || 0);
        const subtotal = q * h;
        const purchase: HppPurchase = {
          id: `hpp-belanja-${Date.now()}-${it.sku}`,
          noPO: poNumber, sku: it.sku, namaSku: it.namaProduk,
          supplierId: supId, supplierNama: sup?.nama ?? '',
          qty: q, hargaBeli: h, total: subtotal,
          metodeBayar,
          dibayar: 0, sisaTagihan: subtotal,
          tanggal, jatuhTempo: metodeBayar === 'kontrabon' ? jatuhTempo : '',
          lunas: false, pickupStatus: 'belum',
        };
        setPurchases(prev => [purchase, ...prev]);
        // Stok TIDAK naik di sini — naik saat barang berhasil di-checklist di Stok Barang → PO Checklist

        // Update harga modal untuk SKU yang sudah ada di inventory
        const inv = skus.find(x => x.sku.toLowerCase() === it.sku.toLowerCase());
        if (inv) {
          const oldHarga = inv.hargaBaru || inv.hargaModalLama || 0;
          if (h !== oldHarga && oldHarga > 0) {
            const persen = (((h - oldHarga) / oldHarga) * 100).toFixed(2);
            setHargaHistory((prev: any[]) => [{ id: `hist-${Date.now()}-${it.sku}`, sku: it.sku, nama: it.namaProduk, hargaLama: oldHarga, hargaBaru: h, persen, supplier: sup?.nama || '', noPO: poNumber, tanggal }, ...prev].slice(0, 100));
            setSkus((prev: SkuItem[]) => prev.map(x => x.sku.toLowerCase() === it.sku.toLowerCase() ? { ...x, hargaModalLama: oldHarga, hargaBaru: h, perubahanHargaBeli: `${persen.startsWith('-') ? '' : '+'}${persen}%` } : x));
          }
        }
      }

      // Auto-jurnal per PO (sama dengan HppSkuTab)
      const dp = metodeBayar === 'dp' ? (+dpAmount || 0) : 0;
      const cashBayar = metodeBayar === 'cash' || metodeBayar === 'transfer' ? groupTotal : dp;
      if (cashBayar > 0) addJurnal({ tanggal, akunDebitId: '1-1200', akunKreditId: '1-1000', nominal: cashBayar, keterangan: `Pembelian ${poNumber} - ${sup?.nama || ''} (dibayar)`, referensi: poNumber });
      if (groupTotal - cashBayar > 0) addJurnal({ tanggal, akunDebitId: '1-1200', akunKreditId: '2-1000', nominal: groupTotal - cashBayar, keterangan: `Pembelian ${poNumber} - ${sup?.nama || ''} (utang)`, referensi: poNumber });
    }

    const poCount = groups.size;
    setSelected(new Set());
    setSupplierBySku({}); setQtyBySku({}); setHargaBySku({});
    setDpAmount('');

    // ── Rekam aktivitas (KPI) ──
    recordActivity([{ modul: 'pembelian', aksi: 'po', refLabel: `${poCount} PO • ${lines.length} SKU`, detail: { poCount, skuCount: lines.length, total: estTotal } }]);

    alert(`✅ ${poCount} PO dibuat untuk ${lines.length} SKU dari daftar belanja picking.\n📦 Stok akan otomatis naik saat barang berhasil di-checklist di Stok Barang → PO Checklist.`);
  };

  if (summaries.length === 0) {
    return (
      <div>
        <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" />
        <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🛒 Belanja Picking</h2>
        <div className="mt-8 text-center py-12 text-slate-400">
          <p className="text-4xl mb-2">🛒</p>
          <p className="font-semibold">Belum ada permintaan belanja dari tim Picking. 👍</p>
          <p className="text-sm mt-1">Daftar di sini terisi otomatis dari pesanan yang SKU-nya kosong / tidak ada di Inventory.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-red-500 to-orange-300" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🛒 Belanja Picking</h2>
          <p className="mt-1 text-sm text-slate-500">{summaries.length} SKU perlu dibeli • total {totalQty} pcs • dari {orders.length} pesanan gudang.</p>
        </div>
        <div className="flex gap-2">
          {onGoHpp && <button onClick={onGoHpp} className="rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">📦 Pembelian HPP SKU</button>}
        </div>
      </div>

      {/* Toolbar PO */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">🧾 Buat PO dari daftar ini — supplier bisa beda per SKU</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[10px] font-semibold text-slate-500">Metode Bayar</label>
            <select value={metodeBayar} onChange={e => setMetodeBayar(e.target.value as MetodeBayar)} className="mt-0.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
              {METODE_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.icon} {m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500">Tanggal</label>
            <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="mt-0.5 block rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
          {metodeBayar === 'dp' && (
            <div>
              <label className="text-[10px] font-semibold text-slate-500">Jumlah DP (Rp)</label>
              <input type="number" value={dpAmount} onChange={e => setDpAmount(e.target.value)} placeholder="Nominal DP" className="mt-0.5 block w-32 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>
          )}
          {metodeBayar === 'kontrabon' && (
            <div>
              <label className="text-[10px] font-semibold text-slate-500">Jatuh Tempo</label>
              <input type="date" value={jatuhTempo} onChange={e => setJatuhTempo(e.target.value)} className="mt-0.5 block rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={selectAll} disabled={selectable.length === 0} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-emerald-50 disabled:opacity-40">☑ Pilih Semua</button>
            <button onClick={deselectAll} disabled={selected.size === 0} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-emerald-50 disabled:opacity-40">☐ Batal</button>
            <button onClick={submitPO} disabled={selectedList.filter(s => !alreadyPoed.has(s.sku)).length === 0} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed">
              🧾 Buat PO ({selectedList.filter(s => !alreadyPoed.has(s.sku)).length} SKU)
            </button>
          </div>
        </div>
        {ferr && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{ferr}</p>}
      </div>

      {/* Tabel pilih per SKU */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead><tr className="bg-red-50 text-xs uppercase text-red-500">
            {['Pilih', 'SKU', 'Nama Produk', 'Qty', 'Supplier', 'Harga Beli', 'Status', 'Prioritas'].map(c => <th key={c} className="px-3 py-3 font-semibold whitespace-nowrap">{c}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {summaries.map((s, i) => {
              const poed = alreadyPoed.has(s.sku);
              const isSel = selected.has(s.sku);
              const supVal = supplierBySku[s.sku] || '';
              return (
                <tr key={s.sku} className={poed ? 'bg-emerald-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-red-50/20'}>
                  <td className="px-3 py-3 text-center">
                    <input type="checkbox" checked={isSel} disabled={poed} onChange={() => toggleSelect(s.sku)} className="h-4 w-4 cursor-pointer rounded accent-emerald-500 disabled:cursor-not-allowed" />
                  </td>
                  <td className="px-3 py-3 font-mono text-xs font-semibold text-slate-800">{s.sku}</td>
                  <td className="px-3 py-3 max-w-[220px] truncate font-medium text-slate-700" title={s.namaProduk}>{s.namaProduk}</td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min={1}
                      value={qtyBySku[s.sku] ?? s.qty}
                      disabled={!isSel}
                      onChange={e => setQtyBySku(p => ({ ...p, [s.sku]: +e.target.value }))}
                      className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm font-bold text-slate-800 focus:border-emerald-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={supVal}
                      disabled={!isSel}
                      onChange={e => setSupplierBySku(p => ({ ...p, [s.sku]: e.target.value }))}
                      className={`rounded-lg border px-2 py-1.5 text-xs focus:border-emerald-500 focus:outline-none ${supVal ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold' : 'border-slate-200 text-slate-500'} disabled:bg-slate-50 disabled:text-slate-400`}
                    >
                      <option value="">— pilih supplier —</option>
                      {suppliers.map(sp => <option key={sp.id} value={sp.id}>{sp.nama}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min={1}
                      value={hargaBySku[s.sku] ?? ''}
                      disabled={!isSel}
                      onChange={e => setHargaBySku(p => ({ ...p, [s.sku]: e.target.value }))}
                      placeholder="Rp"
                      className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold text-slate-800 focus:border-emerald-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </td>
                  <td className="px-3 py-3">
                    {poed ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 whitespace-nowrap">⏳ Sudah di-PO</span>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${s.reason === 'not-found' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                        {s.reason === 'not-found' ? '❌ Tidak ada di Inventory' : '⚠️ Stok 0'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {s.qty >= 20 ? <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">🔥 Urgent</span>
                      : s.qty >= 10 ? <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white">⚠️ Sedang</span>
                      : <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">Normal</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer estimasi */}
      {selectedList.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
          <p className="text-emerald-800"><strong>{selectedList.filter(s => !alreadyPoed.has(s.sku)).length} SKU dipilih</strong> • estimasi <strong>Rp {estTotal.toLocaleString('id-ID')}</strong> • {new Set(selectedList.filter(s => !alreadyPoed.has(s.sku)).map(s => supplierBySku[s.sku]).filter(Boolean)).size} supplier</p>
          <button onClick={submitPO} disabled={selectedList.filter(s => !alreadyPoed.has(s.sku)).length === 0} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed">🧾 Buat PO Sekarang</button>
        </div>
      )}

      {/* Detail per pesanan */}
      <h3 className="mt-6 mb-2 text-sm font-bold text-slate-700">📋 Rincian per pesanan gudang</h3>
      <div className="grid gap-3 lg:grid-cols-2">
        {orders.map(o => (
          <div key={o.key} className="rounded-2xl border border-red-200 bg-red-50/40 p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{o.marketplace}</span>
              <span className="font-mono text-xs font-bold text-slate-800">{o.noPesanan}</span>
              <span className="font-mono text-[10px] text-slate-500">{o.noResi || '-'}</span>
            </div>
            <ul className="mt-2 space-y-1">
              {o.items.map((it, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs">
                  <span className="font-mono text-[10px] font-semibold text-slate-700">{it.sku}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-600" title={it.namaProduk}>{it.namaProduk}</span>
                  <span className="shrink-0 font-semibold text-slate-500">Qty {it.qty}</span>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap ${it.reason === 'not-found' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{it.reason === 'not-found' ? '❌ Belum ada' : '⚠️ Stok 0'}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================ */
/* TAB 0: Dashboard — grafik & analitik pembelian                    */
/* ================================================================ */
function DashboardTab() {
  const [hppData] = useLocalStorage<HppPurchase[]>(HPP_STORAGE, []);
  const [opexData] = useLocalStorage<OpexPurchase[]>(OPEX_STORAGE, []);
  const [biayaData] = useLocalStorage<BiayaOp[]>(BIAYA_STORAGE, []);
  const suppliers = useSuppliers();

  /* ── Periode ── */
  const [periode, setPeriode] = useState<'7hari' | '30hari' | 'bulanini' | 'semua'>('bulanini');

  const rangeStart = useMemo(() => {
    const now = new Date(); now.setHours(23, 59, 59, 999);
    if (periode === '7hari') { const d = new Date(now); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d.toISOString().slice(0, 10); }
    if (periode === '30hari') { const d = new Date(now); d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0); return d.toISOString().slice(0, 10); }
    if (periode === 'bulanini') return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    return '2000-01-01';
  }, [periode]);

  const hppFiltered = useMemo(() => hppData.filter(p => p.tanggal >= rangeStart), [hppData, rangeStart]);
  const opexFiltered = useMemo(() => opexData.filter(p => p.tanggal >= rangeStart), [opexData, rangeStart]);
  const biayaFiltered = useMemo(() => biayaData.filter(p => p.tanggal >= rangeStart), [biayaData, rangeStart]);

  /* ── KPI Cards ── */
  const totalHpp = hppFiltered.reduce((s, p) => s + p.total, 0);
  const totalOpex = opexFiltered.reduce((s, p) => s + p.total, 0);
  const totalBiaya = biayaFiltered.reduce((s, p) => s + p.jumlah, 0);
  const totalUtang = hppFiltered.filter(p => !p.lunas).reduce((s, p) => s + p.sisaTagihan, 0);
  // Hitung PO unik (satu PO bisa multi SKU)
  const uniquePOs = new Set(hppFiltered.map(p => p.noPO));
  const totalPo = uniquePOs.size;
  const poLunasSet = new Set(hppFiltered.filter(p => p.lunas).map(p => p.noPO));
  // PO lunas = semua line item dalam PO itu lunas
  const poLunas = Array.from(uniquePOs).filter(noPO => {
    const lines = hppFiltered.filter(p => p.noPO === noPO);
    return lines.every(p => p.lunas);
  }).length;

  /* ── Top SKU by Qty ── */
  const topSku = useMemo(() => {
    const map: Record<string, { sku: string; nama: string; qty: number; total: number }> = {};
    hppFiltered.forEach(p => {
      if (!map[p.sku]) map[p.sku] = { sku: p.sku, nama: p.namaSku, qty: 0, total: 0 };
      map[p.sku].qty += p.qty;
      map[p.sku].total += p.total;
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 6);
  }, [hppFiltered]);
  const maxSkuQty = Math.max(...topSku.map(s => s.qty), 1);

  /* ── Top Supplier by Total ── */
  const topSupplier = useMemo(() => {
    const map: Record<string, { id: string; nama: string; total: number; count: number }> = {};
    hppFiltered.forEach(p => {
      if (!map[p.supplierId]) map[p.supplierId] = { id: p.supplierId, nama: p.supplierNama, total: 0, count: 0 };
      map[p.supplierId].total += p.total;
      map[p.supplierId].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [hppFiltered]);
  const maxSuppTotal = Math.max(...topSupplier.map(s => s.total), 1);

  /* ── Chart: Tren harian (7/30 hari) ── */
  const dailyTrend = useMemo(() => {
    const days: { tgl: string; hpp: number; opex: number; biaya: number }[] = [];
    const count = periode === '7hari' ? 7 : periode === 'semua' ? 30 : 30;
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const tgl = d.toISOString().slice(0, 10);
      days.push({
        tgl: tgl.slice(5),
        hpp: hppData.filter(p => p.tanggal === tgl).reduce((s, p) => s + p.total, 0),
        opex: opexData.filter(p => p.tanggal === tgl).reduce((s, p) => s + p.total, 0),
        biaya: biayaData.filter(p => p.tanggal === tgl).reduce((s, p) => s + p.jumlah, 0),
      });
    }
    return days;
  }, [hppData, opexData, biayaData, periode]);
  const maxDaily = Math.max(...dailyTrend.map(d => d.hpp + d.opex + d.biaya), 1);

  /* ── OPEX by Kategori ── */
  const opexByKategori = useMemo(() => {
    const map: Record<string, number> = {};
    opexFiltered.forEach(p => {
      const k = p.subKategori ? `${p.kategori} — ${p.subKategori}` : p.kategori;
      map[k] = (map[k] || 0) + p.total;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [opexFiltered]);
  const maxOpexKat = Math.max(...opexByKategori.map(k => k[1]), 1);

  /* ── Biaya by Kategori ── */
  const biayaByKategori = useMemo(() => {
    const map: Record<string, number> = {};
    biayaFiltered.forEach(b => { map[b.kategori] = (map[b.kategori] || 0) + b.jumlah; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [biayaFiltered]);
  const maxBiayaKat = Math.max(...biayaByKategori.map(k => k[1]), 1);

  /* ── Metode Bayar breakdown ── */
  const metodeBreakdown = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    hppFiltered.forEach(p => {
      const m = METODE_OPTIONS.find(o => o.value === p.metodeBayar)?.label ?? p.metodeBayar;
      if (!map[m]) map[m] = { count: 0, total: 0 };
      map[m].count += 1;
      map[m].total += p.total;
    });
    return Object.entries(map);
  }, [hppFiltered]);

  /* ── Format Rupiah pendek ── */
  const fmtRp = (n: number) => {
    if (n >= 1000000) return `Rp ${(n/1000000).toFixed(1)}jt`;
    if (n >= 1000) return `Rp ${(n/1000).toFixed(0)}rb`;
    return `Rp ${n}`;
  };

  const barColors = ['bg-emerald-400', 'bg-blue-400', 'bg-amber-400', 'bg-purple-400', 'bg-rose-400', 'bg-cyan-400'];

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Dashboard Purchasing</h2>
          <p className="mt-1 text-sm text-slate-500">Analitik pembelian HPP, OPEX, biaya operasional & utang PO.</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {(['7hari','30hari','bulanini','semua'] as const).map(p => (
            <button key={p} onClick={() => setPeriode(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${periode === p ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {p === '7hari' ? '7 Hari' : p === '30hari' ? '30 Hari' : p === 'bulanini' ? 'Bulan Ini' : 'Semua'}
            </button>
          ))}
        </div>
      </div>

      {/* ══════ KPI Cards ══════ */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Total HPP', value: fmtRp(totalHpp), color: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', sub: `${totalPo} PO` },
          { label: 'Total OPEX', value: fmtRp(totalOpex), color: 'bg-blue-50 border-blue-200', text: 'text-blue-700', sub: `${opexFiltered.length} item` },
          { label: 'Biaya Ops', value: fmtRp(totalBiaya), color: 'bg-amber-50 border-amber-200', text: 'text-amber-700', sub: `${biayaFiltered.length} catatan` },
          { label: 'Utang PO', value: fmtRp(totalUtang), color: totalUtang > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200', text: totalUtang > 0 ? 'text-red-700' : 'text-emerald-700', sub: `${hppFiltered.filter(p=>!p.lunas).length} belum lunas` },
          { label: 'PO Lunas', value: `${poLunas}`, color: 'bg-green-50 border-green-200', text: 'text-green-700', sub: `dari ${totalPo} PO` },
          { label: 'Grand Total', value: fmtRp(totalHpp+totalOpex+totalBiaya), color: 'bg-slate-100 border-slate-300', text: 'text-slate-800', sub: 'semua pengeluaran' },
        ].map((kpi, i) => (
          <div key={i} className={`rounded-2xl border ${kpi.color} p-3`}>
            <p className="text-xs text-slate-500">{kpi.label}</p>
            <p className={`mt-1 text-lg font-bold ${kpi.text}`}>{kpi.value}</p>
            <p className="text-[10px] text-slate-400">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ══════ Row 1: Tren Harian + Top SKU ══════ */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Tren Harian */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">📈 Tren Pengeluaran Harian</p>
          <div className="flex items-end gap-[2px] h-32">
            {dailyTrend.map((d, i) => {
              const hHpp = (d.hpp / maxDaily) * 100;
              const hOpex = (d.opex / maxDaily) * 100;
              const hBiaya = (d.biaya / maxDaily) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-[14px]">
                  <div className="w-full flex flex-col-reverse rounded-t-sm overflow-hidden" style={{ height: '100px' }}>
                    {d.biaya > 0 && <div className="bg-amber-400 w-full transition-all" style={{ height: `${Math.max(hBiaya, 1)}%` }} title={`Biaya: ${fmtRp(d.biaya)}`} />}
                    {d.opex > 0 && <div className="bg-blue-400 w-full transition-all" style={{ height: `${Math.max(hOpex, 1)}%` }} title={`OPEX: ${fmtRp(d.opex)}`} />}
                    {d.hpp > 0 && <div className="bg-emerald-400 w-full transition-all" style={{ height: `${Math.max(hHpp, 1)}%` }} title={`HPP: ${fmtRp(d.hpp)}`} />}
                  </div>
                  {(periode === '7hari' || i % 5 === 0 || i === dailyTrend.length - 1) && (
                    <span className="text-[9px] text-slate-400 whitespace-nowrap">{d.tgl}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-400" /> HPP</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-400" /> OPEX</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400" /> Biaya</span>
          </div>
        </div>

        {/* Top SKU */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">🏆 Top SKU — Qty Dibeli</p>
          {topSku.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">Belum ada data pembelian.</p>
          ) : (
            <div className="space-y-2">
              {topSku.map((s, i) => (
                <div key={s.sku} className="flex items-center gap-2">
                  <span className="w-5 text-xs font-bold text-slate-400">#{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-mono text-emerald-700 truncate">{s.sku}</span>
                      <span className="font-semibold text-slate-600 ml-2 shrink-0">{s.qty} pcs</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${barColors[i]} transition-all duration-700`} style={{ width: `${(s.qty / maxSkuQty) * 100}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{s.nama}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════ Row 2: Top Supplier + Metode Bayar ══════ */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Top Supplier */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">🏭 Top Supplier — Total Pembelian</p>
          {topSupplier.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">Belum ada data pembelian.</p>
          ) : (
            <div className="space-y-2">
              {topSupplier.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="w-5 text-xs font-bold text-slate-400">#{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-medium text-slate-700 truncate">{s.nama}</span>
                      <span className="font-semibold text-slate-600 ml-2 shrink-0">{fmtRp(s.total)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${barColors[i]} transition-all duration-700`} style={{ width: `${(s.total / maxSuppTotal) * 100}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{s.count} PO</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Metode Bayar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">💳 Metode Pembayaran</p>
          {metodeBreakdown.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">Belum ada data pembelian.</p>
          ) : (
            <div className="space-y-2">
              {metodeBreakdown.map(([nama, data], i) => {
                const maxM = Math.max(...metodeBreakdown.map(m => m[1].total), 1);
                return (
                  <div key={nama} className="flex items-center gap-2">
                    <span className="text-sm">{METODE_OPTIONS.find(o => o.label === nama)?.icon ?? '💳'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="font-medium text-slate-700">{nama}</span>
                        <span className="font-semibold text-slate-600 ml-2 shrink-0">{fmtRp(data.total)} ({data.count} PO)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${barColors[i]} transition-all duration-700`} style={{ width: `${(data.total / maxM) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══════ Row 3: OPEX + Biaya per Kategori ══════ */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* OPEX per Kategori */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">📦 OPEX per Kategori</p>
          {opexByKategori.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">Belum ada pembelian OPEX.</p>
          ) : (
            <div className="space-y-2">
              {opexByKategori.map(([kat, tot], i) => (
                <div key={kat} className="flex items-center gap-2">
                  <span className="text-sm shrink-0">{['📦','📋','🧹','🔧','📌'][i] ?? '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-medium text-slate-700">{kat}</span>
                      <span className="font-semibold text-blue-600 ml-2 shrink-0">{fmtRp(tot)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${barColors[i % barColors.length]} transition-all duration-700`} style={{ width: `${(tot / maxOpexKat) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Biaya per Kategori */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">💸 Biaya Operasional per Kategori</p>
          {biayaByKategori.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">Belum ada biaya operasional.</p>
          ) : (
            <div className="space-y-2">
              {biayaByKategori.map(([kat, tot], i) => (
                <div key={kat} className="flex items-center gap-2">
                  <span className="text-sm shrink-0">{['⚡','📶','🚗','🏠','👥','📢','🔧','📌'][i] ?? '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-medium text-slate-700">{kat}</span>
                      <span className="font-semibold text-amber-600 ml-2 shrink-0">{fmtRp(tot)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${barColors[i % barColors.length]} transition-all duration-700`} style={{ width: `${(tot / maxBiayaKat) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════ Row 4: Outstanding Utang PO ══════ */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">⚠️ Outstanding Utang PO</p>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${totalUtang > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
            {totalUtang > 0 ? `${hppFiltered.filter(p=>!p.lunas).length} PO belum lunas` : 'Semua lunas ✅'}
          </span>
        </div>
        {hppFiltered.filter(p => !p.lunas).length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">Tidak ada utang PO. Semua pembelian sudah lunas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-red-500 border-b border-red-100">
                  <th className="pb-2 pr-2 font-semibold">No PO</th>
                  <th className="pb-2 pr-2 font-semibold">Supplier</th>
                  <th className="pb-2 pr-2 font-semibold">Total</th>
                  <th className="pb-2 pr-2 font-semibold">Dibayar</th>
                  <th className="pb-2 pr-2 font-semibold">Sisa</th>
                  <th className="pb-2 pr-2 font-semibold">Metode</th>
                  <th className="pb-2 font-semibold">Jatuh Tempo</th>
                </tr>
              </thead>
              <tbody>
                {hppFiltered.filter(p => !p.lunas).slice(0, 10).map(p => (
                  <tr key={p.id} className="border-b border-red-50">
                    <td className="py-1.5 pr-2 font-mono text-xs text-red-700">{p.noPO}</td>
                    <td className="py-1.5 pr-2 text-xs text-slate-700">{p.supplierNama}</td>
                    <td className="py-1.5 pr-2 text-xs">Rp {p.total.toLocaleString('id-ID')}</td>
                    <td className="py-1.5 pr-2 text-xs text-emerald-600">Rp {p.dibayar.toLocaleString('id-ID')}</td>
                    <td className="py-1.5 pr-2 text-xs font-bold text-red-600">Rp {p.sisaTagihan.toLocaleString('id-ID')}</td>
                    <td className="py-1.5 pr-2 text-xs">{p.metodeBayar === 'dp' ? 'DP' : 'Kontrabon'}</td>
                    <td className="py-1.5 text-xs text-red-500">{p.jatuhTempo || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================ */
/* HELPER: load / save localStorage                                  */
/* ================================================================ */

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

/* ================================================================ */
/* TAB 1: Pembelian HPP SKU                                         */
/* ================================================================ */
function HppSkuTab() {
  const { skus, setSkus } = useSkus();
  const [purchases, setPurchases] = useLocalStorage<HppPurchase[]>(HPP_STORAGE, []);
  const suppliers = useSuppliers();
  const { addJurnal } = useAkuntansi();  // <-- Auto-jurnal

  /* Form state — single line input, multi-line cart */
  interface CartItem { sku: string; namaSku: string; qty: number; hargaBeli: number; subtotal: number; }
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedSku, setSelectedSku] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [qty, setQty] = useState('');
  const [hargaBeli, setHargaBeli] = useState('');
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [metodeBayar, setMetodeBayar] = useState<MetodeBayar>('cash');
  const [dpAmount, setDpAmount] = useState('');
  const [jatuhTempo, setJatuhTempo] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); });
  const [ferr, setFerr] = useState('');
  const [searchSku, setSearchSku] = useState('');
  const [showSkuDropdown, setShowSkuDropdown] = useState(false);
  const [noPO, setNoPO] = useState('');

  /* ── Invoice Export Modal ── */
  const [exportPoData, setExportPoData] = useState<InvoicePOData | null>(null);

  /* ── Foto Nota / Invoice ── */
  const [fotoBase64, setFotoBase64] = useState('');
  const [fotoNama, setFotoNama] = useState('');
  const [fotoLoading, setFotoLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setFerr('Hanya file gambar yang didukung (JPG, PNG).'); return; }
    setFotoLoading(true); setFerr('');
    try {
      const { base64, nama } = await compressImage(file);
      setFotoBase64(base64); setFotoNama(nama);
    } catch { setFerr('Gagal mengompresi gambar.'); }
    setFotoLoading(false);
    // Reset input agar bisa upload ulang file yang sama
    e.target.value = '';
  };

  const hapusFoto = () => { setFotoBase64(''); setFotoNama(''); };

  /* Filtered SKU list */
  const filteredSkus = useMemo(() => {
    if (!searchSku.trim()) return skus.slice(0, 15);
    const q = searchSku.toLowerCase();
    return skus.filter(s => s.sku.toLowerCase().includes(q) || s.nama.toLowerCase().includes(q)).slice(0, 10);
  }, [searchSku, skus]);

  const selectedSkuData = useMemo(() => skus.find(s => s.sku === selectedSku), [selectedSku, skus]);
  const selectedSupplierData = useMemo(() => suppliers.find(s => s.id === selectedSupplier), [selectedSupplier, suppliers]);

  // Auto-fill harga beli: dari history pembelian terakhir, fallback ke hargaBaru SKU
  const handleSkuSelected = (sku: string) => {
    setSelectedSku(sku);
    setSearchSku('');
    setShowSkuDropdown(false);
    const s = skus.find(x => x.sku === sku);
    if (!s) return;
    // Cari harga beli terakhir dari history pembelian untuk SKU ini
    const history = purchases.filter(p => p.sku === sku).sort((a,b) => b.tanggal.localeCompare(a.tanggal));
    if (history.length > 0) {
      setHargaBeli(String(history[0].hargaBeli));
    } else {
      // Fallback ke harga modal terbaru dari Master Data
      setHargaBeli(String(s.hargaBaru || s.hargaModalLama || 0));
    }
  };

  /* ── Harga Modal History ── */
  const [hargaHistory, setHargaHistory] = useLocalStorage<any[]>('mma_harga_modal_history', []);
  const [showHistory, setShowHistory] = useState(false);

  const total = useMemo(() => cart.reduce((s, item) => s + item.subtotal, 0), [cart]);
  const dibayar = metodeBayar === 'cash' || metodeBayar === 'transfer' ? total : metodeBayar === 'dp' ? (+dpAmount || 0) : 0;
  const sisa = total - dibayar;

  // Add current SKU line to cart
  const addToCart = () => {
    setFerr('');
    if (!selectedSku) { setFerr('Pilih SKU terlebih dahulu.'); return; }
    if (!qty || +qty <= 0) { setFerr('Jumlah (Qty) harus lebih dari 0.'); return; }
    if (!hargaBeli || +hargaBeli <= 0) { setFerr('Harga beli harus lebih dari 0.'); return; }
    const s = skus.find(x => x.sku === selectedSku);
    if (!s) return;
    const item: CartItem = { sku: selectedSku, namaSku: s.nama, qty: +qty, hargaBeli: +hargaBeli, subtotal: (+qty) * (+hargaBeli) };
    // Cek duplikat SKU — replace jika sudah ada
    setCart(prev => { const existing = prev.findIndex(i => i.sku === selectedSku); if (existing >= 0) { const copy = [...prev]; copy[existing] = item; return copy; } return [...prev, item]; });
    // Reset line input
    setSelectedSku(''); setQty(''); setHargaBeli(''); setSearchSku('');
  };

  const removeFromCart = (sku: string) => setCart(prev => prev.filter(i => i.sku !== sku));

  const handleSubmit = () => {
    setFerr('');
    if (cart.length === 0) { setFerr('Tambahkan minimal 1 SKU ke keranjang.'); return; }
    if (!selectedSupplier) { setFerr('Pilih Supplier terlebih dahulu.'); return; }
    if (metodeBayar === 'dp' && (!dpAmount || +dpAmount <= 0)) { setFerr('Isi jumlah DP.'); return; }
    if (metodeBayar === 'dp' && +dpAmount >= total) { setFerr('Jumlah DP tidak boleh ≥ total. Gunakan Cash/Transfer jika lunas.'); return; }

    const poNumber = noPO || generateNoPO(purchases);
    const now = new Date().toISOString();

    for (const item of cart) {
      const purchase: HppPurchase = {
        id: `hpp-${Date.now()}-${item.sku}`,
        noPO: poNumber,
        sku: item.sku,
        namaSku: item.namaSku,
        supplierId: selectedSupplier,
        supplierNama: selectedSupplierData?.nama ?? '',
        qty: item.qty,
        hargaBeli: item.hargaBeli,
        total: item.subtotal,
        metodeBayar,
        dibayar: 0,
        sisaTagihan: item.subtotal,
        tanggal: tanggal || new Date().toISOString().slice(0, 10),
        jatuhTempo: metodeBayar === 'kontrabon' ? jatuhTempo : '',
        lunas: false,
        pickupStatus: 'belum',  // menunggu penjemputan oleh logistik
        ...(fotoBase64 ? { fotoBase64, namaFileFoto: fotoNama } : {}),
      };
      setPurchases(prev => [purchase, ...prev]);
      // Stok TIDAK naik di sini — naik saat barang berhasil di-checklist di Stok Barang → PO Checklist

      // Update harga modal
      const selectedSkuData = skus.find(s => s.sku === item.sku);
      const oldHarga = selectedSkuData?.hargaBaru || selectedSkuData?.hargaModalLama || 0;
      if (selectedSkuData && item.hargaBeli !== oldHarga && oldHarga > 0) {
        const persen = (((item.hargaBeli - oldHarga) / oldHarga) * 100).toFixed(2);
        const perubahan = `${persen.startsWith('-') ? '' : '+'}${persen}%`;
        setHargaHistory((prev: any[]) => [{ id: `hist-${Date.now()}`, sku: item.sku, nama: item.namaSku, hargaLama: oldHarga, hargaBaru: item.hargaBeli, persen, supplier: selectedSupplierData?.nama || '', noPO: poNumber, tanggal: purchase.tanggal }, ...prev].slice(0, 100));
        setSkus((prev: SkuItem[]) => prev.map(s => s.sku === item.sku ? { ...s, hargaModalLama: oldHarga, hargaBaru: item.hargaBeli, perubahanHargaBeli: perubahan } : s));
      }
    }

    // Auto-jurnal
    const totalHpp = cart.reduce((s,i) => s + i.subtotal, 0);
    const dp = metodeBayar === 'dp' ? (+dpAmount || 0) : 0;
    const cashBayar = metodeBayar === 'cash' || metodeBayar === 'transfer' ? totalHpp : dp;
    if (cashBayar > 0) {
      addJurnal({ tanggal: tanggal, akunDebitId: '1-1200', akunKreditId: '1-1000', nominal: cashBayar, keterangan: `Pembelian ${poNumber} - ${selectedSupplierData?.nama || ''} (dibayar)`, referensi: poNumber });
    }
    if (totalHpp - cashBayar > 0) {
      addJurnal({ tanggal: tanggal, akunDebitId: '1-1200', akunKreditId: '2-1000', nominal: totalHpp - cashBayar, keterangan: `Pembelian ${poNumber} - ${selectedSupplierData?.nama || ''} (utang)`, referensi: poNumber });
    }

    // Reset
    setCart([]); setSelectedSupplier(''); setNoPO('');
    setTanggal(new Date().toISOString().slice(0, 10));
    setMetodeBayar('cash'); setDpAmount(''); setFotoBase64(''); setFotoNama('');
    const d = new Date(); d.setDate(d.getDate() + 30); setJatuhTempo(d.toISOString().slice(0, 10));

    // ── Rekam aktivitas (KPI) ──
    recordActivity([{ modul: 'pembelian', aksi: 'po', refLabel: poNumber, detail: { skuCount: cart.length, total: totalHpp, supplier: selectedSupplierData?.nama || '', metodeBayar } }]);
  };

  /* Summary */
  const totalBulanIni = useMemo(() => {
    const now = new Date(); const bulan = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    return purchases.filter(p => p.tanggal.startsWith(bulan)).reduce((s, p) => s + p.total, 0);
  }, [purchases]);

  const totalUtang = useMemo(() => purchases.filter(p => !p.lunas).reduce((s, p) => s + p.sisaTagihan, 0), [purchases]);

  /* ── Group by No PO (satu PO bisa multi SKU) ── */
  const poGroups = useMemo(() => {
    const map = new Map<string, { noPO: string; supplierId: string; supplierNama: string; total: number; dibayar: number; sisa: number; lunas: boolean; jatuhTempo: string; metodeBayar: MetodeBayar; tanggal: string; items: HppPurchase[] }>();
    for (const p of purchases) {
      const g = map.get(p.noPO) || { noPO: p.noPO, supplierId: p.supplierId, supplierNama: p.supplierNama, total: 0, dibayar: 0, sisa: 0, lunas: true, jatuhTempo: '', metodeBayar: p.metodeBayar, tanggal: p.tanggal, items: [] };
      g.items.push(p);
      g.total += p.total;
      g.dibayar += p.dibayar;
      g.sisa += p.sisaTagihan;
      if (!p.lunas) g.lunas = false;
      if (p.jatuhTempo && (!g.jatuhTempo || p.jatuhTempo < g.jatuhTempo)) g.jatuhTempo = p.jatuhTempo;
      map.set(p.noPO, g);
    }
    return Array.from(map.values()).sort((a,b) => b.noPO.localeCompare(a.noPO));
  }, [purchases]);

  const utangPoGroups = useMemo(() => poGroups.filter(g => !g.lunas), [poGroups]);

  /* Badge warna metode bayar */
  const metodeBadge = (m: MetodeBayar) => {
    const map: Record<MetodeBayar, string> = { cash: 'bg-green-100 text-green-700', transfer: 'bg-blue-100 text-blue-700', dp: 'bg-amber-100 text-amber-700', kontrabon: 'bg-red-100 text-red-700' };
    const label: Record<MetodeBayar, string> = { cash: 'Cash', transfer: 'Transfer', dp: 'DP', kontrabon: 'Kontrabon' };
    return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${map[m]}`}>{label[m]}</span>;
  };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Pembelian HPP SKU</h2>
      <p className="mt-1 text-sm text-slate-500">Catat pembelian barang dagang (SKU) dengan No PO, metode bayar & tracking utang.</p>

      {/* Form */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">🛒 Form Pembelian Baru — Multi SKU</p>

        {/* No PO + Supplier */}
        <div className="grid gap-3 sm:grid-cols-2 mb-3">
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">No PO</label><input type="text" value={noPO} onChange={e => setNoPO(e.target.value)} placeholder="Auto-generate jika kosong" className="w-full rounded-xl border px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Supplier *</label><select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className="w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"><option value="">-- Pilih Supplier --</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}</select></div>
        </div>

        {/* SKU line input */}
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="relative"><label className="block text-xs font-semibold text-slate-600 mb-1">Cari SKU</label><input type="text" value={selectedSkuData ? `${selectedSku} — ${selectedSkuData.nama.slice(0,25)}` : searchSku} onChange={e => { setSearchSku(e.target.value); setSelectedSku(''); setShowSkuDropdown(true); }} onFocus={() => { if (!selectedSku) setShowSkuDropdown(true); }} placeholder="Ketik SKU..." className="w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
            {showSkuDropdown && !selectedSku && searchSku && (<div className="absolute z-20 mt-1 w-full rounded-xl border bg-white shadow-lg max-h-48 overflow-y-auto">{filteredSkus.length===0?<p className="px-3 py-2 text-sm text-slate-400">Tidak ditemukan</p>:filteredSkus.map(s=>(<button key={s.sku} onClick={()=>handleSkuSelected(s.sku)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-emerald-50"><span className="font-mono text-xs text-emerald-600 w-20 shrink-0">{s.sku}</span><span className="truncate">{s.nama}</span></button>))}</div>)}
          </div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Qty</label><input type="number" value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" className="w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm text-center font-bold focus:border-emerald-500 focus:outline-none" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Harga Beli/Unit</label><input type="number" value={hargaBeli} onChange={e=>setHargaBeli(e.target.value)} placeholder="0" className="w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm text-center font-bold focus:border-emerald-500 focus:outline-none" /></div>
          <div className="flex items-end"><button onClick={addToCart} className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition">➕ Tambah ke Keranjang</button></div>
        </div>

        {/* Cart */}
        {cart.length > 0 && (
          <div className="mt-3 rounded-xl border-2 border-emerald-200 bg-emerald-50/30 p-3">
            <p className="text-xs font-bold text-emerald-700 mb-2">🛒 Keranjang ({cart.length} SKU)</p>
            {cart.map(item => (<div key={item.sku} className="flex items-center justify-between py-1.5 border-b border-emerald-100 last:border-0 text-xs"><div className="flex items-center gap-2 flex-1"><span className="font-mono text-emerald-600 w-20">{item.sku}</span><span className="text-slate-600 truncate max-w-[150px]">{item.namaSku}</span></div><span className="mx-2">×{item.qty}</span><span className="font-semibold w-24 text-right">Rp {item.subtotal.toLocaleString('id-ID')}</span><button onClick={()=>removeFromCart(item.sku)} className="ml-2 text-red-400 hover:text-red-600">✕</button></div>))}
            <div className="mt-2 text-right text-sm font-bold text-emerald-700">Total: Rp {total.toLocaleString('id-ID')}</div>
          </div>
        )}

        {/* Payment */}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal</label><input type="date" value={tanggal} onChange={e=>setTanggal(e.target.value)} className="w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Metode Bayar</label><select value={metodeBayar} onChange={e=>{setMetodeBayar(e.target.value as MetodeBayar);setDpAmount('');}} className="w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">{METODE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.icon} {o.label}</option>)}</select></div>
          {metodeBayar==='dp'&&<div><label className="block text-xs font-semibold text-slate-600 mb-1">Jumlah DP</label><input type="number" value={dpAmount} onChange={e=>setDpAmount(e.target.value)} placeholder="0" className="w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-center font-bold focus:border-amber-500 focus:outline-none" /></div>}
          {metodeBayar==='kontrabon'&&<div><label className="block text-xs font-semibold text-slate-600 mb-1">Jatuh Tempo</label><input type="date" value={jatuhTempo} onChange={e=>setJatuhTempo(e.target.value)} className="w-full rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm focus:border-red-500 focus:outline-none" /></div>}
        </div>

        {/* Foto */}
        <div className="mt-3 border-t pt-3"><p className="text-xs font-semibold text-slate-400 mb-2">📸 Foto Nota (opsional)</p><div className="flex gap-2"><input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFilePicked} className="hidden" /><button onClick={()=>cameraInputRef.current?.click()} className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200">📷 Kamera</button><input ref={fileInputRef} type="file" accept="image/*" onChange={handleFilePicked} className="hidden" /><button onClick={()=>fileInputRef.current?.click()} className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200">📁 Upload</button>{fotoLoading&&<span className="text-xs text-slate-400">Mengompresi...</span>}</div>{fotoBase64&&<div className="mt-2 relative inline-block"><img src={fotoBase64} className="h-24 rounded-xl border object-cover" /><button onClick={hapusFoto} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-xs text-white">✕</button></div>}</div>

        {total>0&&(<div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><div className="flex flex-wrap gap-x-6"><span>Total: <strong>Rp {total.toLocaleString('id-ID')}</strong></span><span>Dibayar: <strong className="text-emerald-600">Rp {dibayar.toLocaleString('id-ID')}</strong></span>{sisa>0&&<span>Sisa: <strong className="text-red-600">Rp {sisa.toLocaleString('id-ID')}</strong></span>}</div></div>)}
        {ferr&&<p className="mt-2 text-sm text-red-500">{ferr}</p>}
        <button onClick={handleSubmit} disabled={cart.length===0||!selectedSupplier} className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:bg-slate-300 transition">➕ Catat Pembelian ({cart.length} SKU)</button>
      </div>

      {/* Ringkasan */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-emerald-50 p-3 text-center"><p className="text-2xl font-bold text-emerald-700">{poGroups.length}</p><p className="text-xs text-emerald-500">Total PO</p></div>
        <div className="rounded-xl bg-blue-50 p-3 text-center"><p className="text-2xl font-bold text-blue-600">Rp {totalBulanIni.toLocaleString('id-ID')}</p><p className="text-xs text-blue-500">Total Bulan Ini</p></div>
        <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-2xl font-bold text-slate-600">{purchases.reduce((s, p) => s + p.qty, 0)}</p><p className="text-xs text-slate-400">Total Qty</p></div>
        <div className={`rounded-xl p-3 text-center ${totalUtang > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}><p className={`text-2xl font-bold ${totalUtang > 0 ? 'text-red-600' : 'text-emerald-600'}`}>Rp {totalUtang.toLocaleString('id-ID')}</p><p className={`text-xs ${totalUtang > 0 ? 'text-red-500' : 'text-emerald-500'}`}>Utang Usaha</p></div>
      </div>

      {/* SECTION: Utang Usaha — grouped by PO */}
      {utangPoGroups.length > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-red-200 bg-red-50/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⚠️</span>
            <h3 className="text-base font-bold text-red-700">Utang Usaha / Outstanding</h3>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">{utangPoGroups.length} PO</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-red-500 border-b border-red-200">
                  <th className="pb-2 pr-2 font-semibold whitespace-nowrap">No PO</th>
                  <th className="pb-2 pr-2 font-semibold whitespace-nowrap">Supplier</th>
                  <th className="pb-2 pr-2 font-semibold whitespace-nowrap">Total</th>
                  <th className="pb-2 pr-2 font-semibold whitespace-nowrap">Dibayar</th>
                  <th className="pb-2 pr-2 font-semibold whitespace-nowrap">Sisa</th>
                  <th className="pb-2 pr-2 font-semibold whitespace-nowrap">Metode</th>
                  <th className="pb-2 pr-2 font-semibold whitespace-nowrap">Jatuh Tempo</th>
                </tr>
              </thead>
              <tbody>
                {utangPoGroups.map(g => (
                  <tr key={g.noPO} className="border-b border-red-100">
                    <td className="py-2 pr-2 font-mono text-xs text-red-700">
                      <details>
                        <summary className="cursor-pointer">{g.noPO} ({g.items.length} SKU)</summary>
                        <div className="mt-1 pl-2 border-l-2 border-red-200 text-[10px]">
                          {g.items.map(item => (
                            <div key={item.id} className="py-0.5">
                              <span className="font-mono text-red-400">{item.sku}</span> <span className="text-slate-500">{item.namaSku}</span> <span className="text-slate-400">×{item.qty}</span> <span className="text-slate-500">Rp {item.total.toLocaleString('id-ID')}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </td>
                    <td className="py-2 pr-2 text-xs text-slate-700">{g.supplierNama}</td>
                    <td className="py-2 pr-2 text-xs text-slate-600">Rp {g.total.toLocaleString('id-ID')}</td>
                    <td className="py-2 pr-2 text-xs text-emerald-600">Rp {g.dibayar.toLocaleString('id-ID')}</td>
                    <td className="py-2 pr-2 text-xs font-bold text-red-600">Rp {g.sisa.toLocaleString('id-ID')}</td>
                    <td className="py-2 pr-2">{metodeBadge(g.metodeBayar)}</td>
                    <td className="py-2 pr-2 text-xs text-slate-500">{g.jatuhTempo || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabel Riwayat PO */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-emerald-50 text-xs uppercase text-emerald-600">
              <th className="px-3 py-3 font-semibold whitespace-nowrap">No PO</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap">Tanggal</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap">SKU</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap hidden sm:table-cell">Supplier</th>
              <th className="px-3 py-3 text-center font-semibold">Qty</th>
              <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Total</th>
              <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Bayar</th>
              <th className="px-3 py-3 text-center font-semibold">Status</th>
              <th className="px-3 py-3 text-center font-semibold">Pickup</th>
              <th className="px-3 py-3 text-center font-semibold">Ekspor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {poGroups.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-sm text-slate-400">Belum ada data pembelian.</td></tr>
            ) : poGroups.map(g => {
              const invoiceData: InvoicePOData = {
                noPO: g.noPO,
                supplierNama: g.supplierNama,
                tanggal: g.tanggal,
                metodeBayar: METODE_OPTIONS.find(m => m.value === g.metodeBayar)?.label ?? g.metodeBayar,
                items: g.items.map(x => ({ sku: x.sku, namaSku: x.namaSku, qty: x.qty, hargaBeli: x.hargaBeli, subtotal: x.total })),
                total: g.total,
                dibayar: g.dibayar,
                sisa: g.sisa,
                lunas: g.lunas,
                jatuhTempo: g.jatuhTempo || undefined,
              };
              const urgent = !g.lunas && g.jatuhTempo && g.jatuhTempo <= new Date().toISOString().slice(0,10);
              return (
              <tr key={g.noPO} className={`hover:bg-slate-50 transition ${!g.lunas ? 'bg-red-50/30' : ''} ${urgent ? 'bg-red-100/50' : ''}`}>
                <td className="px-3 py-2.5 font-mono text-xs font-bold text-emerald-700">
                  <details>
                    <summary className="cursor-pointer">{g.noPO} <span className="text-[10px] text-slate-400 font-normal">({g.items.length} SKU)</span></summary>
                    <div className="mt-1 pl-2 border-l-2 border-emerald-200">
                      {g.items.map(item => (
                        <div key={item.id} className="text-[10px] py-0.5">
                          <span className="font-mono text-emerald-500">{item.sku}</span>{' '}
                          <span className="text-slate-500">{item.namaSku}</span>{' '}
                          <span className="text-slate-400">×{item.qty}</span>{' '}
                          <span className="text-slate-500">Rp {item.total.toLocaleString('id-ID')}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-500">{g.tanggal}</td>
                <td className="px-3 py-2.5 max-w-[140px] truncate text-xs text-slate-700">
                  {g.items.length === 1 ? g.items[0].sku : `${g.items.length} SKU`}
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-500 hidden sm:table-cell">{g.supplierNama}</td>
                <td className="px-3 py-2.5 text-center font-semibold text-slate-700">{g.items.reduce((s, i) => s + i.qty, 0)}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-slate-700 whitespace-nowrap">Rp {g.total.toLocaleString('id-ID')}</td>
                <td className="px-3 py-2.5 text-center">{metodeBadge(g.metodeBayar)}</td>
                <td className="px-3 py-2.5 text-center">
                  {g.lunas
                    ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">✅ Lunas</span>
                    : <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">⚠ Rp {g.sisa.toLocaleString('id-ID')}</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {g.items[0]?.pickupStatus === 'sampai'
                    ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">✅ Sampai</span>
                    : g.items[0]?.pickupStatus === 'sedang'
                    ? <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">🚛 Dipickup</span>
                    : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">🕐 Belum</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <button
                    onClick={() => setExportPoData(invoiceData)}
                    className="rounded-lg bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-200 transition"
                    title="Ekspor invoice ke WhatsApp / CSV / Gambar"
                  >
                    📤 Kirim
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* History Harga Modal */}
      {hargaHistory.length > 0 && (
        <details className="mt-5" open={showHistory}>
          <summary className="cursor-pointer text-sm font-bold text-slate-700 hover:text-emerald-700" onClick={() => setShowHistory(!showHistory)}>
            📈 History Harga Modal ({hargaHistory.length} perubahan)
          </summary>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead><tr className="bg-amber-50 text-xs uppercase text-amber-600">
                {['Tanggal','No PO','SKU','Nama','Harga Lama','Harga Baru','Perubahan','Supplier'].map(c => <th key={c} className="px-3 py-2 font-semibold whitespace-nowrap">{c}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-50 bg-white">
                {hargaHistory.map((h: any) => {
                  const isNaik = !h.persen.startsWith('-');
                  return (<tr key={h.id} className="hover:bg-amber-50/30"><td className="px-3 py-2 text-slate-500">{h.tanggal}</td><td className="px-3 py-2 font-mono text-[10px] text-slate-500">{h.noPO}</td><td className="px-3 py-2 font-mono text-xs text-emerald-600">{h.sku}</td><td className="px-3 py-2 text-slate-700 max-w-[150px] truncate">{h.nama}</td><td className="px-3 py-2 text-right text-slate-500">Rp {h.hargaLama.toLocaleString('id-ID')}</td><td className="px-3 py-2 text-right font-bold text-slate-700">Rp {h.hargaBaru.toLocaleString('id-ID')}</td><td className={`px-3 py-2 text-center font-bold ${isNaik?'text-red-500':'text-emerald-500'}`}>{h.persen}%</td><td className="px-3 py-2 text-slate-500 text-[10px]">{h.supplier}</td></tr>);
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Modal Invoice Export */}
      {exportPoData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setExportPoData(null)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-3 rounded-t-2xl flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-indigo-700">📤 Ekspor Invoice</p>
                <p className="text-xs text-slate-500 font-mono">{exportPoData.noPO} — {exportPoData.supplierNama}</p>
              </div>
              <button onClick={() => setExportPoData(null)} className="rounded-full bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200">✕</button>
            </div>
            <div className="p-5">
              <InvoiceExport
                data={exportPoData}
                tokoNama="MMA ProSync"
                isLunas={exportPoData.lunas}
                onClose={() => setExportPoData(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================ */
/* TAB 2: Pembelian OPEX (Packing, ATK, dll)                        */
/* ================================================================ */
function OpexTab() {
  const [purchases, setPurchases] = useLocalStorage<OpexPurchase[]>(OPEX_STORAGE, []);

  const [namaItem, setNamaItem] = useState('');
  const [kategori, setKategori] = useState(OPEX_KATEGORI[0]);
  const [subKategori, setSubKategori] = useState('');
  const [kategoriCustom, setKategoriCustom] = useState('');
  const [subKategoriCustom, setSubKategoriCustom] = useState('');
  const [qty, setQty] = useState('');
  const [satuan, setSatuan] = useState('pcs');
  const [hargaSatuan, setHargaSatuan] = useState('');
  const [supplierNama, setSupplierNama] = useState('');
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [ferr, setFerr] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  /* ── Filter: bulan & kategori ── */
  const [filterKategori, setFilterKategori] = useState('semua');
  const [filterBulan, setFilterBulan] = useState('semua');

  /* Opsi kategori = bawaan + kategori yang sudah dipakai di data (custom tetap bisa dipilih/difilter) */
  const kategoriOptions = useMemo(() => {
    const set = new Set<string>(OPEX_KATEGORI);
    for (const p of purchases) if (p.kategori) set.add(p.kategori);
    return Array.from(set);
  }, [purchases]);

  /* Opsi sub kategori Packing = bawaan + sub yang sudah dipakai di data (custom tetap bisa dipilih) */
  const subKategoriOptions = useMemo(() => {
    const set = new Set<string>(OPEX_SUB_KATEGORI['Packing & Kemasan'] || []);
    for (const p of purchases) if (p.subKategori && p.kategori === 'Packing & Kemasan') set.add(p.subKategori);
    return Array.from(set);
  }, [purchases]);

  const total = useMemo(() => (+qty || 0) * (+hargaSatuan || 0), [qty, hargaSatuan]);

  /* Buka form untuk edit */
  const openEdit = (p: OpexPurchase) => {
    setNamaItem(p.namaItem);
    if (OPEX_KATEGORI.includes(p.kategori)) { setKategori(p.kategori); setKategoriCustom(''); }
    else { setKategori('__custom__'); setKategoriCustom(p.kategori); }
    if (p.subKategori && !subKategoriOptions.includes(p.subKategori)) { setSubKategori('__custom__'); setSubKategoriCustom(p.subKategori); }
    else { setSubKategori(p.subKategori || ''); setSubKategoriCustom(''); }
    setQty(String(p.qty));
    setSatuan(p.satuan);
    setHargaSatuan(String(p.hargaSatuan));
    setSupplierNama(p.supplierNama === '-' ? '' : p.supplierNama);
    setTanggal(p.tanggal);
    setEditId(p.id);
    setFerr('');
  };

  const cancelEdit = () => {
    setEditId(null);
    setNamaItem(''); setQty(''); setHargaSatuan(''); setSupplierNama('');
    setTanggal(new Date().toISOString().slice(0, 10));
    setKategori(OPEX_KATEGORI[0]); setSatuan('pcs');
  };

  const handleDelete = () => {
    if (!deleteId) return;
    setPurchases(prev => prev.filter(p => p.id !== deleteId));
    addTombstones([{ id: deleteId, kind: 'opex' }]);
    setDeleteId(null);
  };

  const handleSubmit = () => {
    setFerr('');
    if (!namaItem.trim()) { setFerr('Nama item wajib diisi.'); return; }
    if (!qty || +qty <= 0) { setFerr('Jumlah harus lebih dari 0.'); return; }
    if (!hargaSatuan || +hargaSatuan <= 0) { setFerr('Harga satuan harus lebih dari 0.'); return; }
    const kat = kategori === '__custom__' ? (kategoriCustom.trim() || 'Lainnya') : kategori;
    const sub = kat === 'Packing & Kemasan'
      ? (subKategori === '__custom__' ? subKategoriCustom.trim() : subKategori)
      : '';

    if (editId) {
      // Update entry
      setPurchases(prev => prev.map(p => p.id === editId ? {
        ...p,
        namaItem: namaItem.trim(),
        kategori: kat,
        subKategori: sub,
        qty: +qty,
        satuan,
        hargaSatuan: +hargaSatuan,
        total: +qty * +hargaSatuan,
        supplierNama: supplierNama.trim() || '-',
        tanggal: tanggal || new Date().toISOString().slice(0, 10),
      } : p));
      recordActivity([{ modul: 'pembelian', aksi: 'opex', refLabel: `${namaItem.trim()} (${kat})`, detail: { total: +qty * +hargaSatuan, tanggal, edit: true } }]);
      cancelEdit();
      return;
    }

    const purchase: OpexPurchase = {
      id: `opex-${Date.now()}`,
      namaItem: namaItem.trim(),
      kategori: kat,
      subKategori: sub,
      qty: +qty,
      satuan,
      hargaSatuan: +hargaSatuan,
      total: +qty * +hargaSatuan,
      supplierNama: supplierNama.trim() || '-',
      tanggal: tanggal || new Date().toISOString().slice(0, 10),
    };

    setPurchases(prev => [purchase, ...prev]);
    recordActivity([{ modul: 'pembelian', aksi: 'opex', refLabel: `${purchase.namaItem} (${purchase.kategori})`, detail: { total: purchase.total, tanggal: purchase.tanggal } }]);
    setNamaItem(''); setQty(''); setHargaSatuan(''); setSupplierNama('');
    setTanggal(new Date().toISOString().slice(0, 10));
    setKategori(OPEX_KATEGORI[0]); setSubKategori(''); setKategoriCustom(''); setSubKategoriCustom(''); setKategoriCustom(''); setSubKategoriCustom(''); setSatuan('pcs');
  };

  const totalBulanIni = useMemo(() => {
    const now = new Date(); const bulan = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    return purchases.filter(p => p.tanggal.startsWith(bulan)).reduce((s, p) => s + p.total, 0);
  }, [purchases]);

  /* ── Filter: kategori + bulan ── */
  const bulanOptions = useMemo(() => {
    const set = new Set(purchases.map(p => (p.tanggal || '').slice(0, 7)).filter(Boolean));
    return Array.from(set).sort().reverse();
  }, [purchases]);

  const filtered = useMemo(() => purchases.filter(p => {
    if (filterKategori !== 'semua' && p.kategori !== filterKategori) return false;
    if (filterBulan !== 'semua' && !(p.tanggal || '').startsWith(filterBulan)) return false;
    return true;
  }), [purchases, filterKategori, filterBulan]);

  /* Group by kategori (sub-kategori digabung ke label) untuk summary (ikut filter) */
  const byKategori = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(p => {
      const k = p.subKategori ? `${p.kategori} — ${p.subKategori}` : p.kategori;
      map[k] = (map[k] || 0) + p.total;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Pembelian OPEX</h2>
      <p className="mt-1 text-sm text-slate-500">Catat pembelian bahan packing, ATK, kebersihan, dan perlengkapan operasional (non-SKU).</p>

      {/* Form */}
      <div className={`mt-4 rounded-2xl border bg-white p-4 shadow-sm ${editId ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'}`}>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{editId ? '✏️ Koreksi Pembelian OPEX' : '📋 Form Pembelian OPEX'}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Item *</label>
            <input type="text" value={namaItem} onChange={e => setNamaItem(e.target.value)} placeholder="Contoh: Bubble Wrap 50cm, Lakban Coklat, Kertas A4…" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori</label>
            <select value={kategori} onChange={e => { setKategori(e.target.value); setSubKategori(''); setKategoriCustom(p => (e.target.value === '__custom__' ? p : '')); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100">
              {kategoriOptions.map(k => <option key={k} value={k}>{k}</option>)}
              <option value="__custom__">➕ Tambah Baru...</option>
            </select>
            {kategori === '__custom__' && (
              <input type="text" value={kategoriCustom} onChange={e => setKategoriCustom(e.target.value)} placeholder="Nama kategori baru..." className="mt-1 w-full rounded-lg border border-dashed border-emerald-300 bg-white px-2 py-1.5 text-xs focus:border-emerald-500 focus:outline-none" />
            )}
          </div>
          {kategori === 'Packing & Kemasan' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Sub Kategori Packing</label>
              <select value={subKategori} onChange={e => setSubKategori(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100">
                <option value="">— Pilih —</option>
                {subKategoriOptions.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="__custom__">➕ Tambah Baru...</option>
              </select>
              {subKategori === '__custom__' && (
                <input type="text" value={subKategoriCustom} onChange={e => setSubKategoriCustom(e.target.value)} placeholder="Nama sub kategori baru..." className="mt-1 w-full rounded-lg border border-dashed border-emerald-300 bg-white px-2 py-1.5 text-xs focus:border-emerald-500 focus:outline-none" />
              )}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Jumlah (Qty) *</label>
            <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-center font-bold focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Satuan</label>
            <select value={satuan} onChange={e => setSatuan(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100">
              {OPEX_SATUAN.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Harga Satuan *</label>
            <input type="number" value={hargaSatuan} onChange={e => setHargaSatuan(e.target.value)} placeholder="0" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-center font-bold focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Total</label>
            <div className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-center font-bold text-slate-700">
              Rp {total.toLocaleString('id-ID')}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Supplier (opsional)</label>
            <input type="text" value={supplierNama} onChange={e => setSupplierNama(e.target.value)} placeholder="Nama toko / supplier…" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal</label>
            <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
          </div>
        </div>
        {ferr && <p className="mt-2 text-sm text-red-500">{ferr}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={handleSubmit} className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white transition sm:px-8 ${editId ? 'bg-amber-500 hover:bg-amber-700' : 'bg-emerald-500 hover:bg-emerald-700'}`}>
            {editId ? '💾 Simpan Koreksi' : '➕ Catat OPEX'}
          </button>
          {editId && <button onClick={cancelEdit} className="rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-300 transition">✕ Batal Edit</button>}
        </div>
      </div>

      {/* ── Filter: bulan & kategori ── */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <span className="text-xs font-semibold text-slate-500">🔍 Filter:</span>
        <select value={filterBulan} onChange={e => setFilterBulan(e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none">
          <option value="semua">Semua Bulan</option>
          {bulanOptions.map(b => <option key={b} value={b}>{fmtBulan(b)}</option>)}
        </select>
        <select value={filterKategori} onChange={e => setFilterKategori(e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none">
          <option value="semua">Semua Kategori</option>
          {kategoriOptions.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <span className="text-[11px] text-slate-400">{filtered.length} dari {purchases.length} item</span>
        {(filterKategori !== 'semua' || filterBulan !== 'semua') && (
          <button onClick={() => { setFilterKategori('semua'); setFilterBulan('semua'); }} className="rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-200">✕ Reset</button>
        )}
      </div>

      {/* Ringkasan per Kategori */}
      {byKategori.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {byKategori.map(([kat, tot]) => (
            <div key={kat} className="rounded-xl bg-slate-50 p-2 text-center">
              <p className="text-xs text-slate-400">{kat}</p>
              <p className="text-sm font-bold text-slate-700">Rp {tot.toLocaleString('id-ID')}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabel */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-emerald-50 text-xs uppercase text-emerald-600">
              <th className="px-3 py-3 font-semibold whitespace-nowrap">Tanggal</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap">Nama Item</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap hidden sm:table-cell">Kategori</th>
              <th className="px-3 py-3 text-center font-semibold">Qty</th>
              <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Harga</th>
              <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Total</th>
              <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">{purchases.length === 0 ? 'Belum ada data pembelian OPEX.' : 'Tidak ada data yang cocok dengan filter.'}</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className={`hover:bg-slate-50 transition ${editId === p.id ? 'bg-amber-50/50' : ''}`}>
                <td className="px-3 py-2.5 text-xs text-slate-500">{p.tanggal}</td>
                <td className="px-3 py-2.5 max-w-[200px] truncate font-medium text-slate-800" title={p.namaItem}>{p.namaItem}</td>
                <td className="px-3 py-2.5 text-xs text-slate-500 hidden sm:table-cell"><span className="rounded-full bg-slate-100 px-2 py-0.5">{p.kategori}{p.subKategori ? ` • ${p.subKategori}` : ''}</span></td>
                <td className="px-3 py-2.5 text-center text-slate-700">{p.qty} {p.satuan}</td>
                <td className="px-3 py-2.5 text-right text-slate-600">Rp {p.hargaSatuan.toLocaleString('id-ID')}</td>
                <td className="px-3 py-2.5 text-right font-bold text-slate-800">Rp {p.total.toLocaleString('id-ID')}</td>
                <td className="px-3 py-2.5 text-center">
                  <div className="flex justify-center gap-1">
                    <button onClick={() => openEdit(p)} title="Koreksi / Edit" className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200 transition">✏️</button>
                    <button onClick={() => setDeleteId(p.id)} title="Hapus" className="rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-200 transition">🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Konfirmasi Hapus */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-80 rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-lg font-bold text-slate-800">🗑️ Hapus OPEX?</p>
            <p className="mt-2 text-sm text-slate-600">Data pembelian OPEX ini akan dihapus permanen.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button>
              <button onClick={handleDelete} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================ */
/* TAB 3: Biaya Operasional (Variable Cost / Daily Expense)         */
/* ================================================================ */
function BiayaOpTab() {
  const [biayaList, setBiayaList] = useLocalStorage<BiayaOp[]>(BIAYA_STORAGE, []);

  const [deskripsi, setDeskripsi] = useState('');
  const [kategori, setKategori] = useState(BIAYA_KATEGORI[0]);
  const [kategoriCustom, setKategoriCustom] = useState('');
  const [jumlah, setJumlah] = useState('');
  const [nonTunai, setNonTunai] = useState(false);
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [ferr, setFerr] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  /* ── Filter: bulan & kategori ── */
  const [filterKategori, setFilterKategori] = useState('semua');
  const [filterBulan, setFilterBulan] = useState('semua');

  /* Opsi kategori = bawaan + kategori yang sudah dipakai di data (custom tetap bisa dipilih/difilter) */
  const kategoriOptions = useMemo(() => {
    const set = new Set<string>(BIAYA_KATEGORI);
    for (const b of biayaList) if (b.kategori) set.add(b.kategori);
    return Array.from(set);
  }, [biayaList]);

  const openEdit = (b: BiayaOp) => {
    setDeskripsi(b.deskripsi);
    if (BIAYA_KATEGORI.includes(b.kategori)) { setKategori(b.kategori); setKategoriCustom(''); }
    else { setKategori('__custom__'); setKategoriCustom(b.kategori); }
    setJumlah(String(b.jumlah));
    setNonTunai(!!b.nonTunai);
    setTanggal(b.tanggal);
    setEditId(b.id);
    setFerr('');
  };

  const cancelEdit = () => {
    setEditId(null);
    setDeskripsi(''); setJumlah('');
    setNonTunai(false);
    setTanggal(new Date().toISOString().slice(0, 10));
    setKategori(BIAYA_KATEGORI[0]); setKategoriCustom('');
  };

  const handleDelete = () => {
    if (!deleteId) return;
    setBiayaList(prev => prev.filter(b => b.id !== deleteId));
    addTombstones([{ id: deleteId, kind: 'biaya' }]);
    setDeleteId(null);
  };

  const handleSubmit = () => {
    setFerr('');
    if (!deskripsi.trim()) { setFerr('Deskripsi wajib diisi.'); return; }
    if (!jumlah || +jumlah <= 0) { setFerr('Jumlah harus lebih dari 0.'); return; }
    const kat = kategori === '__custom__' ? (kategoriCustom.trim() || 'Lainnya') : kategori;

    if (editId) {
      setBiayaList(prev => prev.map(b => b.id === editId ? {
        ...b,
        deskripsi: deskripsi.trim(),
        kategori: kat,
        jumlah: +jumlah,
        nonTunai,
        tanggal: tanggal || new Date().toISOString().slice(0, 10),
      } : b));
      recordActivity([{ modul: 'pembelian', aksi: 'biaya', refLabel: `${deskripsi.trim()} (${kat})`, detail: { jumlah: +jumlah, tanggal, edit: true } }]);
      cancelEdit();
      return;
    }

    const biaya: BiayaOp = {
      id: `biaya-${Date.now()}`,
      deskripsi: deskripsi.trim(),
      kategori: kat,
      jumlah: +jumlah,
      nonTunai,
      tanggal: tanggal || new Date().toISOString().slice(0, 10),
    };

    setBiayaList(prev => [biaya, ...prev]);
    recordActivity([{ modul: 'pembelian', aksi: 'biaya', refLabel: `${biaya.deskripsi} (${biaya.kategori})`, detail: { jumlah: biaya.jumlah, tanggal: biaya.tanggal } }]);
    setDeskripsi(''); setJumlah('');
    setTanggal(new Date().toISOString().slice(0, 10));
    setKategori(BIAYA_KATEGORI[0]); setKategoriCustom('');
  };

  /* Summary */
  const totalBulanIni = useMemo(() => {
    const now = new Date(); const bulan = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    return biayaList.filter(b => b.tanggal.startsWith(bulan)).reduce((s, b) => s + b.jumlah, 0);
  }, [biayaList]);

  const totalHariIni = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return biayaList.filter(b => b.tanggal === today).reduce((s, b) => s + b.jumlah, 0);
  }, [biayaList]);

  /* ── Filter: kategori + bulan ── */
  const bulanOptions = useMemo(() => {
    const set = new Set(biayaList.map(b => (b.tanggal || '').slice(0, 7)).filter(Boolean));
    return Array.from(set).sort().reverse();
  }, [biayaList]);

  const filtered = useMemo(() => biayaList.filter(b => {
    if (filterKategori !== 'semua' && b.kategori !== filterKategori) return false;
    if (filterBulan !== 'semua' && !(b.tanggal || '').startsWith(filterBulan)) return false;
    return true;
  }), [biayaList, filterKategori, filterBulan]);

  /* Per kategori (ikut filter) */
  const byKategori = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(b => { map[b.kategori] = (map[b.kategori] || 0) + b.jumlah; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  /* 7 hari terakhir */
  const last7Days = useMemo(() => {
    const days: { tgl: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const tgl = d.toISOString().slice(0, 10);
      const total = biayaList.filter(b => b.tanggal === tgl).reduce((s, b) => s + b.jumlah, 0);
      days.push({ tgl: tgl.slice(5), total });
    }
    return days;
  }, [biayaList]);

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Biaya Operasional</h2>
      <p className="mt-1 text-sm text-slate-500">Catat pengeluaran harian: listrik, internet, transport, sewa, gaji, marketing, dll.</p>

      {/* Quick Form */}
      <div className={`mt-4 rounded-2xl border bg-white p-4 shadow-sm ${editId ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'}`}>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{editId ? '✏️ Koreksi Biaya' : '💸 Catat Biaya Harian'}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Deskripsi *</label>
            <input type="text" value={deskripsi} onChange={e => setDeskripsi(e.target.value)} placeholder="Contoh: Bayar listrik, Bensin…" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori</label>
            <select value={kategori} onChange={e => setKategori(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100">
              {kategoriOptions.map(k => <option key={k} value={k}>{k}</option>)}
              <option value="__custom__">➕ Tambah Baru...</option>
            </select>
            {kategori === '__custom__' && (
              <input type="text" value={kategoriCustom} onChange={e => setKategoriCustom(e.target.value)} placeholder="Nama kategori baru..." className="mt-1 w-full rounded-lg border border-dashed border-emerald-300 bg-white px-2 py-1.5 text-xs focus:border-emerald-500 focus:outline-none" />
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Jumlah (Rp) *</label>
            <input type="number" value={jumlah} onChange={e => setJumlah(e.target.value)} placeholder="0" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-center font-bold focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal</label>
            <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
          </div>
        </div>
        {ferr && <p className="mt-2 text-sm text-red-500">{ferr}</p>}
        <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 border border-amber-200">
          <input type="checkbox" checked={nonTunai} onChange={e => setNonTunai(e.target.checked)} className="h-4 w-4 accent-amber-600" />
          🧾 Non-Tunai (Akrual) — tetap masuk Laba Rugi, tapi TIDAK mengurangi Arus Kas
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={handleSubmit} className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white transition sm:px-8 ${editId ? 'bg-amber-500 hover:bg-amber-700' : 'bg-emerald-500 hover:bg-emerald-700'}`}>
            {editId ? '💾 Simpan Koreksi' : '➕ Catat Biaya'}
          </button>
          {editId && <button onClick={cancelEdit} className="rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-300 transition">✕ Batal Edit</button>}
        </div>
      </div>

      {/* ── Filter: bulan & kategori ── */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <span className="text-xs font-semibold text-slate-500">🔍 Filter:</span>
        <select value={filterBulan} onChange={e => setFilterBulan(e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none">
          <option value="semua">Semua Bulan</option>
          {bulanOptions.map(b => <option key={b} value={b}>{fmtBulan(b)}</option>)}
        </select>
        <select value={filterKategori} onChange={e => setFilterKategori(e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none">
          <option value="semua">Semua Kategori</option>
          {kategoriOptions.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <span className="text-[11px] text-slate-400">{filtered.length} dari {biayaList.length} catatan</span>
        {(filterKategori !== 'semua' || filterBulan !== 'semua') && (
          <button onClick={() => { setFilterKategori('semua'); setFilterBulan('semua'); }} className="rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-200">✕ Reset</button>
        )}
      </div>

      {/* Ringkasan */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-red-50 p-3 text-center">
          <p className="text-2xl font-bold text-red-600">Rp {totalHariIni.toLocaleString('id-ID')}</p>
          <p className="text-xs text-red-500">Pengeluaran Hari Ini</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">Rp {totalBulanIni.toLocaleString('id-ID')}</p>
          <p className="text-xs text-amber-500">Total Bulan Ini</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-center">
          <p className="text-2xl font-bold text-slate-600">{biayaList.length}</p>
          <p className="text-xs text-slate-400">Total Catatan</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{byKategori.length}</p>
          <p className="text-xs text-emerald-500">Kategori Terpakai</p>
        </div>
      </div>

      {/* Mini Chart: 7 hari terakhir */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">📊 7 Hari Terakhir</p>
        <div className="flex items-end gap-1 h-24">
          {last7Days.map(d => {
            const maxVal = Math.max(...last7Days.map(x => x.total), 1);
            const h = (d.total / maxVal) * 100;
            return (
              <div key={d.tgl} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-slate-600">{d.total > 0 ? 'Rp ' + (d.total >= 1000 ? (d.total/1000).toFixed(0)+'k' : d.total) : ''}</span>
                <div className={`w-full rounded-t-md transition-all ${d.total > 0 ? 'bg-red-400' : 'bg-slate-200'}`} style={{ height: `${Math.max(h, d.total > 0 ? 8 : 4)}%` }} />
                <span className="text-[10px] text-slate-400">{d.tgl}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per Kategori */}
      {byKategori.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {byKategori.map(([kat, tot]) => (
            <div key={kat} className="rounded-xl bg-slate-50 p-2 text-center">
              <p className="text-xs text-slate-400">{kat}</p>
              <p className="text-sm font-bold text-slate-700">Rp {tot.toLocaleString('id-ID')}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabel */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-emerald-50 text-xs uppercase text-emerald-600">
              <th className="px-3 py-3 font-semibold whitespace-nowrap">Tanggal</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap">Deskripsi</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap hidden sm:table-cell">Kategori</th>
              <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Jumlah</th>
              <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-400">{biayaList.length === 0 ? 'Belum ada catatan biaya operasional.' : 'Tidak ada data yang cocok dengan filter.'}</td></tr>
            ) : filtered.map(b => (
              <tr key={b.id} className={`hover:bg-slate-50 transition ${editId === b.id ? 'bg-amber-50/50' : ''}`}>
                <td className="px-3 py-2.5 text-xs text-slate-500">{b.tanggal}</td>
                <td className="px-3 py-2.5 max-w-[220px] truncate font-medium text-slate-800" title={b.deskripsi}>{b.deskripsi}</td>
                <td className="px-3 py-2.5 text-xs text-slate-500 hidden sm:table-cell"><span className="rounded-full bg-slate-100 px-2 py-0.5">{b.kategori}</span></td>
                <td className="px-3 py-2.5 text-right font-bold text-red-600">-Rp {b.jumlah.toLocaleString('id-ID')}</td>
                <td className="px-3 py-2.5 text-center">
                  <div className="flex justify-center gap-1">
                    <button onClick={() => openEdit(b)} title="Koreksi / Edit" className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200 transition">✏️</button>
                    <button onClick={() => setDeleteId(b.id)} title="Hapus" className="rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-200 transition">🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Konfirmasi Hapus */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-80 rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-lg font-bold text-slate-800">🗑️ Hapus Biaya?</p>
            <p className="mt-2 text-sm text-slate-600">Catatan biaya ini akan dihapus permanen.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button>
              <button onClick={handleDelete} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================ */
/* TAB 4: Arsip Invoice — semua PO dengan filter & ekspor           */
/* ================================================================ */
function ArsipTab() {
  const [purchases, setPurchases] = useLocalStorage<HppPurchase[]>(HPP_STORAGE, []);
  const [buktiList, setBuktiList] = useLocalStorage<BuktiBayar[]>('mma_bukti_bayar', []);
  const suppliers = useSuppliers();
  const { skus, setSkus, updateStok } = useSkus();

  const [filterTglDari, setFilterTglDari] = useState('');
  const [filterTglSampai, setFilterTglSampai] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState<'semua' | 'lunas' | 'belum'>('semua');
  const [searchPO, setSearchPO] = useState('');
  const [lightbox, setLightbox] = useState<HppPurchase | null>(null);
  const [exportPoData, setExportPoData] = useState<InvoicePOData | null>(null);
  const [detailPoData, setDetailPoData] = useState<InvoicePOData | null>(null);

  // ── Koreksi PO: ubah harga beli/qty SKU & perbarui foto nota ──
  const [koreksiPo, setKoreksiPo] = useState<PoGroupArchived | null>(null);
  const [koreksiItems, setKoreksiItems] = useState<{ sku: string; namaSku: string; qty: number; hargaBeli: number }[]>([]);
  const [koreksiFoto, setKoreksiFoto] = useState<{ base64: string; nama: string }>({ base64: '', nama: '' });
  const [koreksiLoading, setKoreksiLoading] = useState(false);
  const koreksiFileRef = useRef<HTMLInputElement>(null);

  // Bukti bayar dari Keuangan — bisa dilihat di sini tanpa pindah modul
  const [buktiLightbox, setBuktiLightbox] = useState<BuktiBayar | null>(null);
  useEffect(() => {
    const reload = () => {
      try {
        const raw = localStorage.getItem('mma_bukti_bayar');
        if (raw) setBuktiList(JSON.parse(raw));
      } catch {}
    };
    window.addEventListener('bukti-bayar-updated', reload);
    window.addEventListener('storage', reload);
    window.addEventListener('shared-data-updated', reload);
    return () => {
      window.removeEventListener('bukti-bayar-updated', reload);
      window.removeEventListener('storage', reload);
      window.removeEventListener('shared-data-updated', reload);
    };
  }, [setBuktiList]);

  const buktiByPo = useMemo(() => {
    const m = new Map<string, BuktiBayar[]>();
    for (const b of buktiList) {
      if (!b.noPO) continue;
      const arr = m.get(b.noPO) || [];
      arr.push(b);
      m.set(b.noPO, arr);
    }
    return m;
  }, [buktiList]);

  const openKoreksi = (g: PoGroupArchived) => {
    setKoreksiPo(g);
    setKoreksiItems(g.items.map(x => ({ sku: x.sku, namaSku: x.namaSku, qty: x.qty, hargaBeli: x.hargaBeli })));
    const foto = g.items.find(x => x.namaFileFoto);
    setKoreksiFoto({ base64: g.fotoBase64 || '', nama: foto?.namaFileFoto || '' });
  };

  const handleKoreksiFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Hanya file gambar yang didukung (JPG, PNG).'); return; }
    setKoreksiLoading(true);
    try {
      const { base64, nama } = await compressImage(file);
      setKoreksiFoto({ base64, nama });
    } catch { alert('Gagal mengompresi gambar.'); }
    setKoreksiLoading(false);
    e.target.value = '';
  };

  const saveKoreksi = () => {
    if (!koreksiPo) return;
    const bySku = new Map(koreksiItems.map(it => [it.sku, it]));
    const updated = purchases.map(p => {
      if (p.noPO !== koreksiPo.noPO) return p;
      const it = bySku.get(p.sku);
      if (!it) return p;
      const newTotal = it.qty * it.hargaBeli;
      const newSisa = Math.max(0, newTotal - (p.dibayar || 0));
      const deltaQty = it.qty - (p.qty || 0);
      if (deltaQty !== 0) void updateStok(p.sku, deltaQty);
      // Koreksi harga modal + riwayat kalau harga beli berubah
      if (it.hargaBeli > 0 && it.hargaBeli !== p.hargaBeli) {
        const inv = skus.find(s => s.sku.toLowerCase() === p.sku.toLowerCase());
        if (inv) {
          const oldHarga = inv.hargaBaru || inv.hargaModalLama || 0;
          if (oldHarga > 0 && it.hargaBeli !== oldHarga) {
            const persen = (((it.hargaBeli - oldHarga) / oldHarga) * 100).toFixed(2);
            const perubahan = `${persen.startsWith('-') ? '' : '+'}${persen}%`;
            try {
              const hist = JSON.parse(localStorage.getItem('mma_harga_modal_history') || '[]');
              const entry = { id: `hist-koreksi-${Date.now()}-${p.sku}`, sku: p.sku, nama: p.namaSku, hargaLama: oldHarga, hargaBaru: it.hargaBeli, persen, supplier: p.supplierNama, noPO: p.noPO, tanggal: new Date().toISOString().slice(0, 10), keterangan: 'Koreksi PO' };
              localStorage.setItem('mma_harga_modal_history', JSON.stringify([entry, ...hist].slice(0, 100)));
            } catch {}
            setSkus((prev: SkuItem[]) => prev.map(s => s.sku.toLowerCase() === p.sku.toLowerCase() ? { ...s, hargaModalLama: oldHarga, hargaBaru: it.hargaBeli, perubahanHargaBeli: perubahan } : s));
          }
        }
      }
      return {
        ...p,
        qty: it.qty,
        hargaBeli: it.hargaBeli,
        total: newTotal,
        sisaTagihan: newSisa,
        lunas: newSisa <= 0,
        dikoreksi: true,
        koreksiPada: new Date().toISOString(),
        ...(koreksiFoto.base64 ? { fotoBase64: koreksiFoto.base64, namaFileFoto: koreksiFoto.nama || p.namaFileFoto } : {}),
      };
    });
    setPurchases(updated);
    try { window.dispatchEvent(new Event('pembelian-updated')); } catch {}
    setKoreksiPo(null);
    alert(`✅ Koreksi ${koreksiPo.noPO} tersimpan.\nHarga beli, qty & foto nota sudah diperbarui.`);
  };

  // Group purchases by noPO
  interface PoGroupArchived {
    noPO: string;
    supplierId: string;
    supplierNama: string;
    tanggal: string;
    metodeBayar: string;
    items: HppPurchase[];
    total: number;
    dibayar: number;
    sisa: number;
    lunas: boolean;
    jatuhTempo: string;
    hasFoto: boolean;
    fotoBase64?: string;
  }

  const poGroups = useMemo(() => {
    const map = new Map<string, PoGroupArchived>();
    for (const p of purchases) {
      const g = map.get(p.noPO) || {
        noPO: p.noPO,
        supplierId: p.supplierId,
        supplierNama: p.supplierNama,
        tanggal: p.tanggal,
        metodeBayar: METODE_OPTIONS.find(m => m.value === p.metodeBayar)?.label ?? p.metodeBayar,
        items: [],
        total: 0,
        dibayar: 0,
        sisa: 0,
        lunas: true,
        jatuhTempo: p.jatuhTempo || '',
        hasFoto: false,
        fotoBase64: undefined,
      };
      g.items.push(p);
      g.total += p.total;
      g.dibayar += p.dibayar;
      g.sisa += p.sisaTagihan;
      if (!p.lunas) g.lunas = false;
      if (p.jatuhTempo && (!g.jatuhTempo || p.jatuhTempo < g.jatuhTempo)) g.jatuhTempo = p.jatuhTempo;
      if (p.fotoBase64 && !g.hasFoto) { g.hasFoto = true; g.fotoBase64 = p.fotoBase64; }
      if (p.tanggal < g.tanggal) g.tanggal = p.tanggal;
      map.set(p.noPO, g);
    }
    return Array.from(map.values()).sort((a, b) => b.noPO.localeCompare(a.noPO));
  }, [purchases]);

  const filtered = useMemo(() => {
    return poGroups.filter(g => {
      if (filterTglDari && g.tanggal < filterTglDari) return false;
      if (filterTglSampai && g.tanggal > filterTglSampai) return false;
      if (filterSupplier && g.supplierId !== filterSupplier) return false;
      if (filterStatus === 'lunas' && !g.lunas) return false;
      if (filterStatus === 'belum' && g.lunas) return false;
      if (searchPO && !g.noPO.toLowerCase().includes(searchPO.toLowerCase()) && !g.supplierNama.toLowerCase().includes(searchPO.toLowerCase())) return false;
      return true;
    });
  }, [poGroups, filterTglDari, filterTglSampai, filterSupplier, filterStatus, searchPO]);

  const supplierOptions = useMemo(() => {
    const ids = new Set(purchases.map(p => p.supplierId));
    return suppliers.filter(s => ids.has(s.id));
  }, [purchases, suppliers]);

  const totalLunas = poGroups.filter(g => g.lunas).length;
  const totalBelum = poGroups.filter(g => !g.lunas).length;
  const totalDenganFoto = poGroups.filter(g => g.hasFoto).length;

  // Build InvoicePOData for export
  const buildInvoiceData = (g: PoGroupArchived): InvoicePOData => ({
    noPO: g.noPO,
    supplierNama: g.supplierNama,
    tanggal: g.tanggal,
    metodeBayar: g.metodeBayar,
    items: g.items.map(x => ({ sku: x.sku, namaSku: x.namaSku, qty: x.qty, hargaBeli: x.hargaBeli, subtotal: x.total })),
    total: g.total,
    dibayar: g.dibayar,
    sisa: g.sisa,
    lunas: g.lunas,
    jatuhTempo: g.jatuhTempo || undefined,
  });

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Arsip Invoice</h2>
      <p className="mt-1 text-sm text-slate-500">Semua Purchase Order (PO). Invoice lunas otomatis tersimpan di sini. Klik <strong>📤 Kirim</strong> untuk ekspor ke WhatsApp/CSV/Gambar.</p>

      {/* KPI */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-emerald-50 p-3 text-center"><p className="text-2xl font-bold text-emerald-700">{poGroups.length}</p><p className="text-xs text-emerald-500">Total PO</p></div>
        <div className="rounded-xl bg-green-50 p-3 text-center"><p className="text-2xl font-bold text-green-600">{totalLunas}</p><p className="text-xs text-green-500">Lunas ✅</p></div>
        <div className="rounded-xl bg-red-50 p-3 text-center"><p className="text-2xl font-bold text-red-600">{totalBelum}</p><p className="text-xs text-red-500">Belum Lunas</p></div>
        <div className="rounded-xl bg-indigo-50 p-3 text-center"><p className="text-2xl font-bold text-indigo-600">{totalDenganFoto}</p><p className="text-xs text-indigo-500">Dengan Foto 📸</p></div>
      </div>

      {/* Filter */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">🔍 Filter Arsip</p>
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="block text-xs text-slate-500 mb-1">Dari Tgl</label><input type="date" value={filterTglDari} onChange={e => setFilterTglDari(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" /></div>
          <div><label className="block text-xs text-slate-500 mb-1">Sampai Tgl</label><input type="date" value={filterTglSampai} onChange={e => setFilterTglSampai(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" /></div>
          <div><label className="block text-xs text-slate-500 mb-1">Supplier</label><select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"><option value="">Semua Supplier</option>{supplierOptions.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}</select></div>
          <div><label className="block text-xs text-slate-500 mb-1">Status</label><select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"><option value="semua">Semua Status</option><option value="lunas">✅ Lunas</option><option value="belum">⚠️ Belum Lunas</option></select></div>
          <div className="flex-1 min-w-[160px]"><label className="block text-xs text-slate-500 mb-1">Cari PO / Supplier</label><input type="text" value={searchPO} onChange={e => setSearchPO(e.target.value)} placeholder="Ketik No PO atau supplier…" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" /></div>
          <button onClick={() => { setFilterTglDari(''); setFilterTglSampai(''); setFilterSupplier(''); setFilterStatus('semua'); setSearchPO(''); }} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition">🔄 Reset</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
          <p className="text-4xl">🗄️</p>
          <p className="mt-2 text-sm font-semibold text-slate-500">Belum ada PO</p>
          <p className="mt-1 text-xs text-slate-400">Buat Purchase Order di tab Pembelian HPP SKU.</p>
        </div>
      ) : (
        /* ── Grid Cards ── */
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(g => (
            <div key={g.noPO} className="group rounded-2xl border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md hover:border-emerald-300 transition">
              {/* Thumbnail foto jika ada */}
              {g.hasFoto && g.fotoBase64 ? (
                <div className="relative cursor-pointer overflow-hidden rounded-xl bg-slate-100 aspect-[4/3] mb-2" onClick={() => setLightbox(g.items[0])}>
                  <img src={g.fotoBase64} alt={"Nota " + g.noPO} className="h-full w-full object-cover group-hover:scale-105 transition duration-300" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center"><span className="opacity-0 group-hover:opacity-100 text-white text-2xl transition">🔍</span></div>
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-xl bg-slate-100 aspect-[4/3] mb-2">
                  <span className="text-3xl text-slate-300">📄</span>
                </div>
              )}

              {/* Info */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-emerald-700">{g.noPO}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${g.lunas ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                    {g.lunas ? '✅ Lunas' : '⚠️ ' + g.metodeBayar}
                  </span>
                </div>
                <p className="text-xs text-slate-600 truncate">{g.supplierNama}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{g.tanggal}</span>
                  <span className="font-semibold text-slate-700">Rp {g.total.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <span>{g.items.length} SKU</span>
                  {g.hasFoto && <span>· 📸 Foto</span>}
                  {g.lunas && <span>· 🗄️ Diarsipkan</span>}
                </div>

                {/* Actions */}
                <div className="flex gap-1 pt-1 border-t border-slate-100">
                  <button
                    onClick={() => { setDetailPoData(buildInvoiceData(g)); }}
                    className="flex-1 rounded-lg bg-slate-100 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                  >
                    🔍 Detail
                  </button>
                  <button
                    onClick={() => setExportPoData(buildInvoiceData(g))}
                    className="flex-1 rounded-lg bg-indigo-100 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-200"
                  >
                    📤 Kirim
                  </button>
                  <button
                    onClick={() => openKoreksi(g)}
                    className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200"
                    title="Koreksi harga beli/qty SKU & perbarui foto nota"
                  >
                    ✏️ Koreksi
                  </button>
                </div>

                {/* Bukti bayar dari Keuangan */}
                {(() => {
                  const bList = buktiByPo.get(g.noPO) || [];
                  if (bList.length === 0) return null;
                  return (
                    <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-slate-100">
                      {bList.slice(0, 4).map(b => (
                        <button key={b.id} onClick={() => setBuktiLightbox(b)}
                          className="h-10 w-14 overflow-hidden rounded-lg border border-emerald-200 bg-slate-100"
                          title={`Bukti bayar ${b.tanggalBayar} — Rp ${(b.jumlah || 0).toLocaleString('id-ID')}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={b.imageBase64} alt="Bukti Bayar" className="h-full w-full object-cover" />
                        </button>
                      ))}
                      <span className="text-[10px] text-slate-400">💳 {bList.length} bukti bayar (Keuangan)</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Bukti Bayar dari Keuangan */}
      {buktiLightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setBuktiLightbox(null)}>
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div>
                <p className="font-mono text-sm font-bold text-emerald-700">💳 Bukti Bayar — {buktiLightbox.noPO} <span className="text-[10px] font-normal text-slate-400">(dari Keuangan)</span></p>
                <p className="text-xs text-slate-500">{buktiLightbox.supplierNama} · {buktiLightbox.tanggalBayar} · Rp {(buktiLightbox.jumlah || 0).toLocaleString('id-ID')}</p>
              </div>
              <button onClick={() => setBuktiLightbox(null)} className="rounded-full bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200">✕</button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={buktiLightbox.imageBase64} alt="Bukti Bayar" className="max-h-[75vh] w-full object-contain bg-slate-50" />
            {buktiLightbox.nomorRef && buktiLightbox.nomorRef !== '-' && (
              <p className="px-5 py-2 text-xs text-slate-400 font-mono border-t border-slate-100">Ref: {buktiLightbox.nomorRef}</p>
            )}
          </div>
        </div>
      )}

      {/* Modal Koreksi PO */}
      {koreksiPo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setKoreksiPo(null)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-amber-200 px-5 py-3 rounded-t-2xl flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-amber-700">✏️ Koreksi PO</p>
                <p className="text-xs text-slate-500 font-mono">{koreksiPo.noPO} — {koreksiPo.supplierNama}</p>
              </div>
              <button onClick={() => setKoreksiPo(null)} className="rounded-full bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-500">Koreksi dari supplier (biasanya kontrabon): ubah harga beli/qty SKU & ganti foto nota. Total & sisa tagihan dihitung ulang otomatis.</p>
              {koreksiItems.map((it, i) => (
                <div key={it.sku} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs font-bold text-slate-700 mb-2">{it.sku} — <span className="font-normal text-slate-500">{it.namaSku}</span></p>
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <span className="block text-[10px] text-slate-500 mb-0.5">Qty</span>
                      <input type="number" value={it.qty} onChange={e => setKoreksiItems(prev => prev.map((x, xi) => xi === i ? { ...x, qty: +e.target.value || 0 } : x))} className="w-full rounded-lg border px-2 py-1 text-sm font-semibold" />
                    </label>
                    <label className="flex-1">
                      <span className="block text-[10px] text-slate-500 mb-0.5">Harga Beli (Rp)</span>
                      <input type="number" value={it.hargaBeli} onChange={e => setKoreksiItems(prev => prev.map((x, xi) => xi === i ? { ...x, hargaBeli: +e.target.value || 0 } : x))} className="w-full rounded-lg border px-2 py-1 text-sm font-semibold" />
                    </label>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">Subtotal baru: Rp {(it.qty * it.hargaBeli).toLocaleString('id-ID')}</p>
                </div>
              ))}

              {/* Foto nota */}
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-bold text-slate-700 mb-2">📸 Foto Bukti Nota</p>
                {koreksiFoto.base64 ? (
                  <div className="mb-2 overflow-hidden rounded-lg bg-slate-100 aspect-[4/3]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={koreksiFoto.base64} alt="Nota" className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <p className="mb-2 text-[11px] text-slate-400">Belum ada foto. Upload foto nota terbaru.</p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => koreksiFileRef.current?.click()} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600" disabled={koreksiLoading}>
                    {koreksiLoading ? '⏳ Memproses…' : koreksiFoto.base64 ? '🔄 Ganti Foto' : '📤 Upload Foto'}
                  </button>
                  {koreksiFoto.base64 && <button onClick={() => setKoreksiFoto({ base64: '', nama: '' })} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-200">🗑 Hapus</button>}
                  <input ref={koreksiFileRef} type="file" accept="image/*" className="hidden" onChange={handleKoreksiFoto} />
                </div>
              </div>

              <button onClick={saveKoreksi} className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white hover:bg-amber-600 transition">💾 Simpan Koreksi</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Foto */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
              <div><p className="font-mono text-sm font-bold text-emerald-700">{lightbox.noPO}</p><p className="text-xs text-slate-500">{lightbox.supplierNama} · {lightbox.tanggal}</p></div>
              <button onClick={() => setLightbox(null)} className="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition">✕ Tutup</button>
            </div>
            <div className="p-2"><img src={lightbox.fotoBase64} alt={"Nota " + lightbox.noPO} className="max-h-[70vh] rounded-xl object-contain" /></div>
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                <div><span className="text-xs text-slate-400">Total</span><p className="font-bold text-slate-800">Rp {lightbox.total.toLocaleString('id-ID')}</p></div>
                <div><span className="text-xs text-slate-400">Dibayar</span><p className="font-semibold text-emerald-600">Rp {lightbox.dibayar.toLocaleString('id-ID')}</p></div>
                <div><span className="text-xs text-slate-400">Sisa</span><p className={"font-semibold " + (lightbox.sisaTagihan > 0 ? 'text-red-600' : 'text-emerald-600')}>Rp {lightbox.sisaTagihan.toLocaleString('id-ID')}</p></div>
                <div><span className="text-xs text-slate-400">Metode</span><p className="font-semibold text-slate-700">{METODE_OPTIONS.find(m => m.value === lightbox.metodeBayar)?.label ?? lightbox.metodeBayar}</p></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Invoice Export */}
      {exportPoData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setExportPoData(null)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-3 rounded-t-2xl flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-indigo-700">📤 Ekspor Invoice</p>
                <p className="text-xs text-slate-500 font-mono">{exportPoData.noPO} — {exportPoData.supplierNama}</p>
              </div>
              <button onClick={() => setExportPoData(null)} className="rounded-full bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200">✕</button>
            </div>
            <div className="p-5">
              <InvoiceExport data={exportPoData} tokoNama="MMA ProSync" isLunas={exportPoData.lunas} onClose={() => setExportPoData(null)} />
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail + PDF */}
      {detailPoData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetailPoData(null)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-5 py-3 rounded-t-2xl flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800">📋 Detail Invoice</p>
                <p className="text-xs text-slate-500 font-mono">{detailPoData.noPO} — {detailPoData.supplierNama}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => {
                    const prevTitle = document.title;
                    document.title = `Invoice_${detailPoData.noPO}_${detailPoData.supplierNama.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    window.print();
                    setTimeout(() => { document.title = prevTitle; }, 500);
                  }}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600">
                  📄 PDF
                </button>
                <button onClick={() => setDetailPoData(null)} className="rounded-full bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200">✕</button>
              </div>
            </div>
            <div className="p-4">
              <InvoicePreview data={detailPoData} tokoNama="MMA ProSync" />
            </div>
            <div className="border-t border-slate-200 px-5 py-3 text-center">
              <p className="text-xs text-slate-400">💡 Klik <strong>📄 PDF</strong> lalu pilih <strong>Save as PDF</strong> di dialog print.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
