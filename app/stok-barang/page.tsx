'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { mockStockData } from '@/app/mockData';
import { BarangMasukForm, type BarangMasukEntry } from '@/app/stok-barang/components/BarangMasukForm';
import { BarangKeluarForm, type BarangKeluarEntry } from '@/app/stok-barang/components/BarangKeluarForm';
import { useSkus, type SkuItem } from '@/app/context/SkuContext';

type Tab = 'opname' | 'masuk' | 'keluar' | 'cek-stok' | 'riwayat' | 'po-check';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'opname', label: 'Stok Opname', icon: '🔍' },
  { key: 'masuk', label: 'Barang Masuk', icon: '📥' },
  { key: 'keluar', label: 'Barang Keluar', icon: '📤' },
  { key: 'cek-stok', label: 'Cek Stok', icon: '📋' },
  { key: 'riwayat', label: 'Riwayat Mutasi', icon: '🕐' },
  { key: 'po-check', label: 'PO Checklist', icon: '✅' },
];

export default function StokBarangPage() {
  const [tab, setTab] = useState<Tab>('opname');

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="rounded-3xl bg-gradient-to-br from-brand-700 via-brand-500 to-brand-300 p-5 text-white shadow-lg sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-100 sm:text-sm">
          Inventory
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Inventory</h1>
        <p className="mt-1 text-sm text-brand-100 sm:text-base">
          Stok opname, barang masuk/keluar, cek stok, riwayat mutasi & checklist PO.
        </p>
      </header>

      {/* Tab Navigation */}
      <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:px-5 sm:text-sm ${
              tab === t.key
                ? 'bg-brand-500 text-white shadow'
                : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'
            }`}
          >
            <span className="text-base sm:text-lg">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <section className="card-blue">
        {tab === 'opname' && <StokOpname />}
        {tab === 'masuk' && <BarangMasuk />}
        {tab === 'keluar' && <BarangKeluar />}
        {tab === 'cek-stok' && <CekStok />}
        {tab === 'riwayat' && <RiwayatMutasi />}        {tab==='po-check' && <PoChecklist />}      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-komponen per tab                                              */
/* ------------------------------------------------------------------ */

/* ── Stok Opname: hitung fisik vs sistem, scan barcode (kamera + hardware scanner) + input manual ── */
const OPNAME_STORAGE = 'mma_opname_session';

interface OpnameItem {
  id: string; nama: string; kategori: string; stok: number; stokMin: number;
  hargaJual: number; qtyFisik: number | null; selisih: number; keterangan: string;
}

function StokOpname() {
  const { skus, setSkus } = useSkus();

  /* Petakan SkuItem dari context ke format opname */
  const cekStokFromSkus = useMemo(() => skus.map((s: SkuItem) => ({
    id: s.sku,
    nama: s.nama,
    kategori: s.kategori,
    stok: s.stok,
    stokMin: s.minStok,
    hargaJual: s.hargaJual,
  })), [skus]);

  /* Load opname session dari localStorage (biar gak hilang pas refresh) */
  const [items,setItems]=useState<OpnameItem[]>(() => {
    if (typeof window === 'undefined') return cekStokFromSkus.map(p => ({...p,qtyFisik:null as number|null,selisih:0,keterangan:''}));
    try {
      const saved = localStorage.getItem(OPNAME_STORAGE);
      if (saved) {
        const parsed: OpnameItem[] = JSON.parse(saved);
        // Merge: item yg ada di localStorage tetap, item baru dari skus ditambahkan
        const savedMap = new Map(parsed.map(p => [p.id, p]));
        return cekStokFromSkus.map(p => {
          const existing = savedMap.get(p.id);
          return existing ? { ...p, qtyFisik: existing.qtyFisik, selisih: (existing.qtyFisik ?? p.stok) - p.stok, keterangan: existing.keterangan } : { ...p, qtyFisik: null, selisih: 0, keterangan: '' };
        });
      }
    } catch {}
    return cekStokFromSkus.map(p => ({...p,qtyFisik:null as number|null,selisih:0,keterangan:''}));
  });

  /* Sinkronkan items jika skus berubah (data baru dari upload/master) */
  useEffect(() => {
    setItems(prev => {
      const prevMap = new Map(prev.map(p => [p.id, p]));
      return cekStokFromSkus.map(p => {
        const existing = prevMap.get(p.id);
        return existing
          ? { ...p, qtyFisik: existing.qtyFisik, selisih: (existing.qtyFisik ?? p.stok) - p.stok, keterangan: existing.keterangan }
          : { ...p, qtyFisik: null, selisih: 0, keterangan: '' };
      });
    });
  }, [cekStokFromSkus]);

  /* Persist opname session ke localStorage setiap kali items berubah */
  useEffect(() => {
    try { localStorage.setItem(OPNAME_STORAGE, JSON.stringify(items)); } catch {}
  }, [items]);

  const [saved,setSaved]=useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('mma_opname_saved');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  /* Persist saved state */
  useEffect(() => {
    try { localStorage.setItem('mma_opname_saved', JSON.stringify(saved)); } catch {}
  }, [saved]);
  const [scanning,setScanning]=useState(false);
  const [scanResult,setScanResult]=useState<string|null>(null);
  const [scanError,setScanError]=useState('');
  const scannerRef=useRef<Html5Qrcode|null>(null);
  const inputRefs=useRef<Map<string,HTMLInputElement>>(new Map());

  /* ── Panel koreksi: tampil setelah scan / pilih manual ── */
  const [koreksi,setKoreksi]=useState<{sku:string; nama:string; qty:number}|null>(null);
  const [qtyKoreksi,setQtyKoreksi]=useState('');

  /* ── Hardware scanner (keyboard wedge) ── */
  const [hwBuffer,setHwBuffer]=useState('');
  const hwTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const hwLastRef=useRef(0);

  /* ── Input manual: search + pilih SKU ── */
  const [manualSearch, setManualSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [manualQty, setManualQty] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredManual = useMemo(() => {
    if (!manualSearch.trim()) return [];
    const q = manualSearch.toLowerCase();
    return items.filter(i =>
      i.id.toLowerCase().includes(q) ||
      i.nama.toLowerCase().includes(q) ||
      i.kategori.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [manualSearch, items]);

  /* Klik luar dropdown → tutup */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleFisik=(id:string,val:string)=>{
    setItems(prev=>prev.map(p=>{
      if(p.id!==id)return p;
      const fisik=val===''?null:+val;
      return {...p,qtyFisik:fisik,selisih:(fisik??p.stok)-p.stok};
    }));
  };

  const handleSimpan=(id:string)=>{
    const item=items.find(p=>p.id===id);if(!item||item.qtyFisik===null)return;
    setSaved(prev=>[...prev,id]);

    // Update stok di Master Data (SkuContext) sesuai hasil opname fisik
    setSkus(prev => prev.map(s => s.sku === id ? { ...s, stok: item.qtyFisik! } : s));
  };

  /* ── Temukan SKU & buka panel koreksi ── */
  const onSkuScanned=(sku:string)=>{
    const found=items.find(p=>p.id===sku||p.nama.toLowerCase().includes(sku.toLowerCase()));
    if(found){
      const current=found.qtyFisik??0;
      setKoreksi({sku:found.id, nama:found.nama, qty:current});
      setQtyKoreksi(String(current||''));
      setScanError('');
      setTimeout(()=>{
        const el=inputRefs.current.get(found.id);
        el?.scrollIntoView({behavior:'smooth',block:'center'});
      },100);
    }else{
      setScanError(`SKU "${sku}" tidak ditemukan.`);
    }
  };

  /* ── Pilih dari dropdown manual ── */
  const onManualSelect = (item: typeof items[0]) => {
    const current = item.qtyFisik ?? 0;
    setKoreksi({ sku: item.id, nama: item.nama, qty: current });
    setQtyKoreksi(String(current || ''));
    setManualSearch('');
    setShowDropdown(false);
    setManualQty('');
    setTimeout(() => {
      const el = inputRefs.current.get(item.id);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  /* ── Input manual langsung (tanpa panel koreksi) ── */
  const onManualQuickInput = () => {
    if (!manualSearch.trim() || manualQty === '') return;
    const qty = +manualQty || 0;
    // Cari item yang cocok (prioritas: SKU exact match)
    let found = items.find(i => i.id.toLowerCase() === manualSearch.trim().toLowerCase());
    if (!found) found = items.find(i => i.nama.toLowerCase().includes(manualSearch.trim().toLowerCase()));
    if (found) {
      setItems(prev => prev.map(p => p.id === found!.id ? { ...p, qtyFisik: qty, selisih: qty - p.stok } : p));
    }
    setManualSearch('');
    setManualQty('');
    setShowDropdown(false);
  };

  /* ── Konfirmasi koreksi ── */
  const confirmKoreksi=()=>{
    if(!koreksi)return;
    const qty=+qtyKoreksi||0;
    setItems(prev=>prev.map(p=>p.id===koreksi.sku?{...p,qtyFisik:qty,selisih:qty-p.stok}:p));
    setKoreksi(null);setQtyKoreksi('');setScanResult(null);
  };

  /* ══════ Kamera Barcode ══════ */
  const startScan=async()=>{
    setScanError('');setScanResult(null);setScanning(true);
    try{
      const scanner=new Html5Qrcode('barcode-reader');
      scannerRef.current=scanner;
      await scanner.start(
        {facingMode:'environment'},
        {fps:10, qrbox:{width:250, height:150}},
        (decodedText)=>{
          const sku=decodedText.trim();
          setScanResult(sku);
          onSkuScanned(sku);
          setTimeout(()=>stopScan(),1200);
        },
        ()=>{}
      );
    }catch(err:unknown){
      const msg=err instanceof Error?err.message:'Gagal mengakses kamera.';
      setScanError(msg.includes('NotAllowed')||msg.includes('Permission')?'Izin kamera ditolak. Cek Settings > Privacy > Camera.':msg);
      setScanning(false);
    }
  };

  const stopScan=async()=>{
    if(scannerRef.current){try{await scannerRef.current.stop();}catch{};scannerRef.current=null;}
    setScanning(false);
  };
  useEffect(()=>{return ()=>{if(scannerRef.current){scannerRef.current.stop().catch(()=>{});}};},[]);

  /* ══════ Hardware Scanner (keyboard wedge) ══════ */
  useEffect(()=>{
    const onKeyDown=(e:KeyboardEvent)=>{
      const tag=(e.target as HTMLElement)?.tagName;
      if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
      const now=Date.now();
      if(now-hwLastRef.current>100){setHwBuffer('');if(hwTimerRef.current)clearTimeout(hwTimerRef.current);}
      hwLastRef.current=now;
      if(e.key==='Enter'){
        const scanned=hwBuffer.trim();
        setHwBuffer('');
        if(scanned){setScanResult(scanned);onSkuScanned(scanned);}
        e.preventDefault();
      }else if(e.key.length===1){
        setHwBuffer(p=>p+e.key);
        if(hwTimerRef.current)clearTimeout(hwTimerRef.current);
        hwTimerRef.current=setTimeout(()=>{setHwBuffer('');},80);
      }
    };
    window.addEventListener('keydown',onKeyDown);
    return ()=>window.removeEventListener('keydown',onKeyDown);
  },[items]);

  /* ══════ Render ══════ */
  const totalSelisih=items.reduce((s,i)=>s+(i.qtyFisik!==null?i.selisih:0),0);
  const sudahDihitung=items.filter(i=>i.qtyFisik!==null).length;

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />

      {/* Header + Scan button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Stok Opname</h2>
          <p className="mt-1 text-sm text-slate-500">Scan barcode, gunakan mesin scanner, atau cari manual SKU/produk di bawah.</p>
        </div>
        <div className="flex gap-2">
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">
            <span>🖨️</span><span>Scanner siap</span><span className={`ml-1 h-2 w-2 rounded-full ${hwBuffer?'bg-emerald-400 animate-pulse':'bg-slate-300'}`} />
          </div>
          <button onClick={scanning?stopScan:startScan} className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${scanning?'bg-red-500 hover:bg-red-600 animate-pulse':'bg-brand-500 hover:bg-brand-700'}`}>
            {scanning?'⏹ Stop Kamera':'📷 Scan Kamera'}
          </button>
        </div>
      </div>

      {/* Hardware scanner input (tersembunyi) */}
      <input type="text" value={hwBuffer} onChange={()=>{}} className="absolute -left-[9999px]" aria-hidden="true" tabIndex={-1} />

      {/* ── INPUT MANUAL: Search + Quick Input ── */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">✍️ Input Manual — cari SKU atau nama produk</p>
        <div className="flex flex-wrap items-end gap-3">
          {/* Search box + dropdown */}
          <div className="relative flex-1 min-w-[220px]" ref={dropdownRef}>
            <input
              ref={searchRef}
              type="text"
              value={manualSearch}
              onChange={e => { setManualSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => { if (manualSearch.trim()) setShowDropdown(true); }}
              onKeyDown={e => { if (e.key === 'Enter' && filteredManual.length === 1) onManualSelect(filteredManual[0]); }}
              placeholder="🔍 Ketik SKU atau nama produk…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            {/* Dropdown hasil pencarian */}
            {showDropdown && manualSearch.trim() && (
              <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
                {filteredManual.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400">Tidak ditemukan. Coba kata kunci lain.</p>
                ) : (
                  filteredManual.map(item => (
                    <button
                      key={item.id}
                      onClick={() => onManualSelect(item)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-brand-50 transition first:rounded-t-xl last:rounded-b-xl"
                    >
                      <span className="font-mono text-xs text-brand-600 w-[100px] shrink-0">{item.id}</span>
                      <span className="truncate font-medium text-slate-700">{item.nama}</span>
                      <span className="ml-auto shrink-0 text-xs text-slate-400">Stok: {item.stok}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {/* Quick Qty + Submit */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={manualQty}
              onChange={e => setManualQty(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onManualQuickInput(); }}
              placeholder="Qty"
              className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-sm font-bold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <button
              onClick={onManualQuickInput}
              disabled={!manualSearch.trim() || manualQty === ''}
              className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
            >
              ✅ Input
            </button>
          </div>
        </div>
      </div>

      {/* Scanner Area (kamera) */}
      {scanning&&(
        <div className="mt-3 overflow-hidden rounded-2xl border-2 border-brand-300 bg-black">
          <div id="barcode-reader" className="w-full [&_video]:!w-full [&_video]:!rounded-none" style={{maxHeight:'320px'}} />
        </div>
      )}

      {/* Panel Koreksi — muncul setelah scan / pilih manual */}
      {koreksi&&(
        <div className="mt-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[180px]">
              <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide">✅ SKU Terbaca — Koreksi Jumlah</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-slate-800">{koreksi.sku}</p>
              <p className="text-sm text-slate-600 truncate max-w-[300px]" title={koreksi.nama}>{koreksi.nama}</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Qty Fisik:</span>
                <input type="number" value={qtyKoreksi} onChange={e=>setQtyKoreksi(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')confirmKoreksi();}} className="w-20 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-center text-sm font-bold text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200" autoFocus />
              </label>
              <button onClick={confirmKoreksi} className="rounded-xl bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">✅ Konfirmasi</button>
              <button onClick={()=>{setKoreksi(null);setScanResult(null);}} className="rounded-xl bg-slate-100 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-200">✕ Batal</button>
            </div>
          </div>
          <p className="mt-2 text-xs text-amber-500">Stok sistem: <strong>{items.find(p=>p.id===koreksi.sku)?.stok??'-'}</strong> → Selisih: <strong className={(+qtyKoreksi||0)-(items.find(p=>p.id===koreksi.sku)?.stok??0)===0?'text-emerald-600':'text-red-600'}>{(+qtyKoreksi||0)-(items.find(p=>p.id===koreksi.sku)?.stok??0)>=0?'+':''}{(+qtyKoreksi||0)-(items.find(p=>p.id===koreksi.sku)?.stok??0)}</strong></p>
        </div>
      )}

      {/* Scan Result Feedback */}
      {scanResult&&!koreksi&&(
        <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
          Terakhir scan: <code className="font-mono text-slate-700">{scanResult}</code>
        </div>
      )}
      {scanError&&(
        <div className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{scanError}</div>
      )}

      {/* Ringkasan */}
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-brand-50 p-3 text-center"><p className="text-2xl font-bold text-brand-700">{items.length}</p><p className="text-xs text-brand-500">Total SKU</p></div>
        <div className="rounded-xl bg-amber-50 p-3 text-center"><p className="text-2xl font-bold text-amber-600">{sudahDihitung}</p><p className="text-xs text-amber-500">Sudah Dihitung</p></div>
        <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-2xl font-bold text-slate-600">{items.length - sudahDihitung}</p><p className="text-xs text-slate-400">Belum</p></div>
        <div className={`rounded-xl p-3 text-center ${totalSelisih===0?'bg-emerald-50':totalSelisih>0?'bg-blue-50':'bg-red-50'}`}><p className={`text-2xl font-bold ${totalSelisih===0?'text-emerald-600':totalSelisih>0?'text-blue-600':'text-red-600'}`}>{totalSelisih>0?'+':''}{totalSelisih}</p><p className="text-xs text-slate-500">Total Selisih</p></div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{width:`${items.length>0?(sudahDihitung/items.length)*100:0}%`}} /></div>

      {/* Tabel Opname — kolom dirapihkan */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-brand-50 text-xs uppercase text-brand-500">
              <th className="w-[40px] px-3 py-3 text-center font-semibold">No</th>
              <th className="w-[110px] px-3 py-3 font-semibold whitespace-nowrap">SKU</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap">Nama Produk</th>
              <th className="w-[90px] px-3 py-3 font-semibold whitespace-nowrap hidden sm:table-cell">Kategori</th>
              <th className="w-[80px] px-3 py-3 text-center font-semibold">Stok<br/>Sistem</th>
              <th className="w-[90px] px-3 py-3 text-center font-semibold">Stok<br/>Fisik</th>
              <th className="w-[75px] px-3 py-3 text-center font-semibold">Selisih</th>
              <th className="w-[95px] px-3 py-3 text-center font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {items.map((item, idx) => {
              const isCounted = item.qtyFisik !== null;
              const isSaved = saved.includes(item.id);
              const selisihVal = isCounted ? item.selisih : 0;
              return (
                <tr key={item.id} className={`transition hover:bg-slate-50 ${isSaved ? 'bg-emerald-50/60' : isCounted ? 'bg-amber-50/40' : ''}`}>
                  {/* No */}
                  <td className="px-3 py-3 text-center text-xs text-slate-400">{idx + 1}</td>
                  {/* SKU */}
                  <td className="px-3 py-3 font-mono text-xs font-semibold text-brand-700">{item.id}</td>
                  {/* Nama Produk */}
                  <td className="px-3 py-3 max-w-[200px] truncate font-medium text-slate-800" title={item.nama}>{item.nama}</td>
                  {/* Kategori (hidden on mobile) */}
                  <td className="px-3 py-3 text-xs text-slate-500 hidden sm:table-cell">
                    {item.kategori ? <span className="rounded-full bg-slate-100 px-2 py-0.5">{item.kategori}</span> : <span className="text-slate-300">-</span>}
                  </td>
                  {/* Stok Sistem */}
                  <td className="px-3 py-3 text-center font-semibold text-slate-700">{item.stok}</td>
                  {/* Stok Fisik */}
                  <td className="px-3 py-3 text-center">
                    <input
                      ref={el => { if (el) inputRefs.current.set(item.id, el); }}
                      type="number"
                      value={item.qtyFisik ?? ''}
                      onChange={e => handleFisik(item.id, e.target.value)}
                      placeholder="-"
                      className="w-[68px] rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                  </td>
                  {/* Selisih */}
                  <td className={`px-3 py-3 text-center font-bold text-sm ${!isCounted ? 'text-slate-300' : selisihVal === 0 ? 'text-emerald-600' : selisihVal > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {isCounted ? (selisihVal > 0 ? '+' : '') + selisihVal : '-'}
                  </td>
                  {/* Status + Aksi */}
                  <td className="px-3 py-3 text-center">
                    {isSaved ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">✅ Simpan</span>
                    ) : isCounted ? (
                      <button onClick={() => handleSimpan(item.id)} className="rounded-lg bg-brand-500 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 transition">Simpan</button>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BarangMasuk() {
  const [entries, setEntries] = useState(mockStockData.barangMasuk);

  const handleAdd = useCallback((entry: BarangMasukEntry) => {
    setEntries((prev) => [entry, ...prev]);
  }, []);

  const allEntries = entries;

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Barang Masuk</h2>
      <p className="mt-1 text-sm text-slate-500">Pencatatan penerimaan barang dari supplier</p>

      <div className="mt-4">
        <BarangMasukForm onAdd={handleAdd} />
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-brand-100 text-xs uppercase text-brand-500">
              <th className="pb-2 pr-3 font-semibold">Produk</th>
              <th className="pb-2 pr-3 font-semibold">Jumlah</th>
              <th className="pb-2 pr-3 font-semibold">Supplier</th>
              <th className="pb-2 font-semibold">Tanggal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {allEntries.map((item) => (
              <tr key={item.id} className="hover:bg-brand-50/50">
                <td className="py-2.5 pr-3 font-medium text-slate-800">{item.produk}</td>
                <td className="py-2.5 pr-3 font-semibold text-brand-600">+{item.jumlah}</td>
                <td className="py-2.5 pr-3 text-slate-600">{item.supplier}</td>
                <td className="py-2.5 text-slate-500">{item.tanggal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BarangKeluar() {
  const [entries, setEntries] = useState(mockStockData.barangKeluar);

  const handleAdd = useCallback((entry: BarangKeluarEntry) => {
    setEntries((prev) => [entry, ...prev]);
  }, []);

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Barang Keluar</h2>
      <p className="mt-1 text-sm text-slate-500">Pencatatan pengeluaran barang</p>

      <div className="mt-4">
        <BarangKeluarForm onAdd={handleAdd} />
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-brand-100 text-xs uppercase text-brand-500">
              <th className="pb-2 pr-3 font-semibold">Produk</th>
              <th className="pb-2 pr-3 font-semibold">Jumlah</th>
              <th className="pb-2 pr-3 font-semibold">Keperluan</th>
              <th className="pb-2 font-semibold">Tanggal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((item) => (
              <tr key={item.id} className="hover:bg-brand-50/50">
                <td className="py-2.5 pr-3 font-medium text-slate-800">{item.produk}</td>
                <td className="py-2.5 pr-3 font-semibold text-red-500">-{item.jumlah}</td>
                <td className="py-2.5 pr-3 text-slate-600">{item.keperluan}</td>
                <td className="py-2.5 text-slate-500">{item.tanggal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CekStok() {
  const { skus } = useSkus();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'nama' | 'stok'>('nama');

  /* Petakan SkuItem dari context ke format cek stok */
  const cekStokFromSkus = useMemo(() => skus.map((s: SkuItem) => ({
    id: s.sku,
    nama: s.nama,
    kategori: s.kategori,
    stok: s.stok,
    stokMin: s.minStok,
    hargaJual: s.hargaJual,
  })), [skus]);

  const filtered = cekStokFromSkus
    .filter((item) =>
      item.nama.toLowerCase().includes(search.toLowerCase()) ||
      item.kategori.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'nama') return a.nama.localeCompare(b.nama);
      return a.stok - b.stok;
    });

  const totalProduk = cekStokFromSkus.length;
  const menipis = cekStokFromSkus.filter((i) => i.stok < i.stokMin).length;

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Cek Stok</h2>
      <p className="mt-1 text-sm text-slate-500">Daftar stok real-time semua produk</p>

      {/* Ringkasan */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-brand-50 p-3 text-center">
          <p className="text-2xl font-bold text-brand-700">{totalProduk}</p>
          <p className="text-xs text-brand-500">Total Produk</p>
        </div>
        <div className="rounded-xl bg-red-50 p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{menipis}</p>
          <p className="text-xs text-red-500">Stok Menipis</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{totalProduk - menipis}</p>
          <p className="text-xs text-emerald-500">Stok Aman</p>
        </div>
      </div>

      {/* Pencarian */}
      <div className="mt-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Cari produk atau kategori..."
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:max-w-xs"
        />
      </div>

      {/* Tabel */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-brand-100 text-xs uppercase text-brand-500">
              <th
                className="cursor-pointer pb-2 pr-3 font-semibold hover:text-brand-700"
                onClick={() => setSortBy('nama')}
              >
                Produk {sortBy === 'nama' ? '▲' : ''}
              </th>
              <th className="pb-2 pr-3 font-semibold">Kategori</th>
              <th className="pb-2 pr-3 font-semibold">Harga Jual</th>
              <th
                className="cursor-pointer pb-2 pr-3 font-semibold hover:text-brand-700"
                onClick={() => setSortBy('stok')}
              >
                Stok {sortBy === 'stok' ? '▲' : ''}
              </th>
              <th className="pb-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  Tidak ada produk ditemukan.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const maxStok = 50; // batas visual
                const barWidth = Math.min((item.stok / maxStok) * 100, 100);
                return (
                  <tr key={item.id} className="hover:bg-brand-50/50">
                    <td className="py-2.5 pr-3 font-medium text-slate-800">{item.nama}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{item.kategori}</td>
                    <td className="py-2.5 pr-3 text-slate-600">Rp {item.hargaJual.toLocaleString('id-ID')}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="w-10 text-right text-sm font-semibold text-slate-700">{item.stok}</span>
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all ${item.stok < item.stokMin ? 'bg-red-400' : 'bg-brand-500'}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        item.stok < item.stokMin
                          ? 'bg-red-100 text-red-600'
                          : 'bg-emerald-100 text-emerald-600'
                      }`}>
                        {item.stok < item.stokMin ? '⚠ Menipis' : '✓ Aman'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RiwayatMutasi() {
  const [filterTipe, setFilterTipe] = useState<'semua' | 'masuk' | 'keluar'>('semua');
  const [searchProduk, setSearchProduk] = useState('');

  const filtered = mockStockData.riwayatMutasi.filter((item) => {
    const matchTipe = filterTipe === 'semua' || item.tipe === filterTipe;
    const matchProduk = item.produk.toLowerCase().includes(searchProduk.toLowerCase());
    return matchTipe && matchProduk;
  });

  const totalMasuk = mockStockData.riwayatMutasi
    .filter((i) => i.tipe === 'masuk')
    .reduce((sum, i) => sum + i.jumlah, 0);
  const totalKeluar = mockStockData.riwayatMutasi
    .filter((i) => i.tipe === 'keluar')
    .reduce((sum, i) => sum + i.jumlah, 0);

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Riwayat Mutasi</h2>
      <p className="mt-1 text-sm text-slate-500">Log kronologis pergerakan barang</p>

      {/* Ringkasan */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-brand-50 p-3 text-center">
          <p className="text-xl font-bold text-brand-700">+{totalMasuk}</p>
          <p className="text-xs text-brand-500">Total Barang Masuk</p>
        </div>
        <div className="rounded-xl bg-red-50 p-3 text-center">
          <p className="text-xl font-bold text-red-600">-{totalKeluar}</p>
          <p className="text-xs text-red-500">Total Barang Keluar</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-center">
          <p className="text-xl font-bold text-slate-700">{filtered.length}</p>
          <p className="text-xs text-slate-500">Log Tercatat</p>
        </div>
      </div>

      {/* Filter */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(['semua', 'masuk', 'keluar'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterTipe(t)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition sm:text-sm ${
              filterTipe === t
                ? 'bg-brand-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-brand-50'
            }`}
          >
            {t === 'semua' ? '📋 Semua' : t === 'masuk' ? '📥 Masuk' : '📤 Keluar'}
          </button>
        ))}
        <input
          type="text"
          value={searchProduk}
          onChange={(e) => setSearchProduk(e.target.value)}
          placeholder="🔍 Filter produk..."
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:ml-auto sm:text-sm"
        />
      </div>

      {/* Tabel */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-brand-100 text-xs uppercase text-brand-500">
              <th className="pb-2 pr-3 font-semibold">Produk</th>
              <th className="pb-2 pr-3 font-semibold">Tipe</th>
              <th className="pb-2 pr-3 font-semibold">Jumlah</th>
              <th className="pb-2 pr-3 font-semibold">Keterangan</th>
              <th className="pb-2 font-semibold">Tanggal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  Tidak ada mutasi ditemukan.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="hover:bg-brand-50/50">
                  <td className="py-2.5 pr-3 font-medium text-slate-800">{item.produk}</td>
                  <td className="py-2.5 pr-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      item.tipe === 'masuk'
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {item.tipe === 'masuk' ? '📥 Masuk' : '📤 Keluar'}
                    </span>
                  </td>
                  <td className={`py-2.5 pr-3 font-semibold ${item.tipe === 'masuk' ? 'text-brand-600' : 'text-red-500'}`}>
                    {item.tipe === 'masuk' ? '+' : '-'}{item.jumlah}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">{item.keterangan}</td>
                  <td className="py-2.5 text-slate-500">{item.tanggal}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── PO Checklist ── */
interface PoCheckItem { sku: string; nama: string; qty: number; noPO: string; supplier: string; sampaiAt: string; checked: boolean; petugas?: string; kendaraan?: string; }

/* ── Koreksi PO Types ── */
interface KoreksiPO {
  id: string;
  noPO: string;
  sku: string;
  namaSku: string;
  qty: number;
  supplierNama: string;
  jenisKoreksi: 'salah_datang' | 'tidak_datang' | 'rusak' | 'tidak_lengkap';
  catatan: string;
  status: 'pending' | 'retur' | 'tukar' | 'selesai';
  diajukanOleh: string;
  diajukanPada: string;
  diprosesPada?: string;
}

const KOREKSI_STORAGE = 'mma_koreksi_po';

const JENIS_KOREKSI: Record<string, { label: string; icon: string }> = {
  salah_datang: { label: 'Barang Salah Datang', icon: '❌' },
  tidak_datang: { label: 'Barang Tidak Datang', icon: '🚫' },
  rusak: { label: 'Barang Rusak / Tidak Sesuai', icon: '💔' },
  tidak_lengkap: { label: 'Barang Tidak Lengkap', icon: '📉' },
};

function PoChecklist() {
  const [items, setItems] = useState<PoCheckItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const r = localStorage.getItem('mma_po_inventory_check');
      if (r) {
        const data = JSON.parse(r);
        // Migrasi data lama: pastikan field baru ada
        return data.map((d: any) => ({
          sku: d.sku || '',
          nama: d.nama || d.namaSku || '',
          qty: d.qty || 0,
          noPO: d.noPO || d.poNo || '',
          supplier: d.supplier || d.supplierNama || '',
          sampaiAt: d.sampaiAt || d.completedAt || '',
          checked: !!d.checked,
          petugas: d.petugas || '',
          kendaraan: d.kendaraan || '',
        }));
      }
      return [];
    } catch { return []; }
  });

  const toggleCheck = (idx: number) => setItems(prev => prev.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item));
  const checkAll = () => setItems(prev => prev.map(item => ({ ...item, checked: true })));
  const checkAllInPO = (noPO: string) => setItems(prev => prev.map(item => item.noPO === noPO ? { ...item, checked: true } : item));
  const clearChecked = () => {
    const remaining = items.filter(i => !i.checked);
    setItems(remaining);
    try { localStorage.setItem('mma_po_inventory_check', JSON.stringify(remaining)); } catch {}
  };
  useEffect(() => { try { localStorage.setItem('mma_po_inventory_check', JSON.stringify(items)); } catch {} }, [items]);

  /* ── Koreksi State ── */
  const [koreksiItem, setKoreksiItem] = useState<PoCheckItem | null>(null);
  const [koreksiJenis, setKoreksiJenis] = useState<KoreksiPO['jenisKoreksi']>('salah_datang');
  const [koreksiCatatan, setKoreksiCatatan] = useState('');
  const [koreksiSuccess, setKoreksiSuccess] = useState(false);
  const [koreksiVersion, setKoreksiVersion] = useState(0); // trigger re-memo

  // Cek koreksi yang sudah ada (anti double) — re-compute tiap koreksiVersion
  const existingKoreksi = useMemo(() => {
    try {
      const raw = localStorage.getItem(KOREKSI_STORAGE);
      if (!raw) return new Map<string, KoreksiPO>();
      const list: KoreksiPO[] = JSON.parse(raw);
      const map = new Map<string, KoreksiPO>();
      for (const k of list) {
        const key = `${k.noPO}|${k.sku}`;
        if (!map.has(key)) map.set(key, k);
      }
      return map;
    } catch { return new Map<string, KoreksiPO>(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [koreksiVersion, items]);

  const submitKoreksi = () => {
    if (!koreksiItem) return;
    // Cek double — langsung dari localStorage (biar aman dari race condition)
    const key = `${koreksiItem.noPO}|${koreksiItem.sku}`;
    try {
      const raw = localStorage.getItem(KOREKSI_STORAGE) || '[]';
      const existingList: KoreksiPO[] = JSON.parse(raw);
      const alreadyExists = existingList.some(k => `${k.noPO}|${k.sku}` === key);
      if (alreadyExists) {
        setKoreksiItem(null);
        setKoreksiCatatan('');
        return; // sudah ada, jangan submit lagi
      }

      const record: KoreksiPO = {
        id: `koreksi-${Date.now()}`,
        noPO: koreksiItem.noPO,
        sku: koreksiItem.sku,
        namaSku: koreksiItem.nama,
        qty: koreksiItem.qty,
        supplierNama: koreksiItem.supplier,
        jenisKoreksi: koreksiJenis,
        catatan: koreksiCatatan.trim(),
        status: 'pending',
        diajukanOleh: 'Inventory',
        diajukanPada: new Date().toISOString(),
      };
      localStorage.setItem(KOREKSI_STORAGE, JSON.stringify([record, ...existingList]));
      setKoreksiVersion(v => v + 1); // trigger re-memo
      setKoreksiSuccess(true);
      setTimeout(() => { setKoreksiItem(null); setKoreksiCatatan(''); setKoreksiSuccess(false); }, 2000);
    } catch {}
  };

  // Group by noPO
  const grouped = useMemo(() => {
    const map = new Map<string, { items: PoCheckItem[]; supplier: string; petugas: string; kendaraan: string; sampaiAt: string; totalQty: number; checkedQty: number }>();
    for (const item of items) {
      const g = map.get(item.noPO) || { items: [], supplier: item.supplier, petugas: item.petugas || '', kendaraan: item.kendaraan || '', sampaiAt: item.sampaiAt, totalQty: 0, checkedQty: 0 };
      g.items.push(item);
      g.totalQty += item.qty;
      if (item.checked) g.checkedQty += item.qty;
      map.set(item.noPO, g);
    }
    return Array.from(map.entries()).map(([noPO, data]) => ({ noPO, ...data }));
  }, [items]);

  const totalItems = items.length;
  const checkedItems = items.filter(i => i.checked).length;
  const progressPct = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;

  if (items.length === 0) return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">✅ PO Checklist</h2>
      <p className="mt-1 text-sm text-slate-500">Cek barang yang datang dari Logistik per No PO. Centang SKU yang sudah diverifikasi.</p>
      <div className="mt-8 text-center py-12 text-slate-400">
        <p className="text-4xl mb-2">📋</p>
        <p className="font-semibold">Belum ada PO yang perlu dicek.</p>
        <p className="text-sm mt-1">PO yang sudah "Sampai di Gudang" dari Logistik akan muncul di sini.</p>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">✅ PO Checklist</h2>
          <p className="text-sm text-slate-500">{grouped.length} PO • {totalItems} SKU • {checkedItems} dicek</p>
        </div>
        <div className="flex gap-2">
          <button onClick={checkAll} className="rounded-lg bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-200">☑ Cek Semua</button>
          <button onClick={clearChecked} disabled={checkedItems === 0} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50">🗑 Hapus Dicek</button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 flex items-center gap-2">
        <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="text-xs font-semibold text-slate-500">{checkedItems}/{totalItems}</span>
      </div>

      {/* PO Groups */}
      <div className="mt-4 space-y-4">
        {grouped.map(g => {
          const poProgress = g.totalQty > 0 ? (g.checkedQty / g.totalQty) * 100 : 0;
          const isComplete = g.items.every(i => i.checked);
          return (
            <div key={g.noPO} className={`rounded-xl border bg-white p-4 transition ${isComplete ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'}`}>
              {/* Header PO */}
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-bold text-indigo-700 text-sm">{g.noPO}</p>
                    {isComplete && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">✅ LENGKAP</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{g.supplier}</p>
                </div>
                <div className="text-right text-xs">
                  <span className="text-slate-400">Tiba: </span>
                  <span className="text-slate-600">{g.sampaiAt ? new Date(g.sampaiAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                </div>
              </div>

              {/* Info Petugas & Kendaraan */}
              <div className="grid grid-cols-2 gap-2 mb-3 text-xs bg-slate-50 rounded-lg p-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-500">🛵</span>
                  <span className="text-slate-400">Petugas:</span>
                  <span className="font-semibold text-slate-700">{g.petugas || '-'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-blue-500">🚛</span>
                  <span className="text-slate-400">Kendaraan:</span>
                  <span className="font-semibold text-slate-700">{g.kendaraan || '-'}</span>
                </div>
              </div>

              {/* Progress per PO */}
              <div className="flex items-center gap-2 mb-3">
                <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${poProgress}%` }} />
                </div>
                <span className="text-[10px] text-slate-400">{g.checkedQty}/{g.totalQty} pcs</span>
                {!isComplete && (
                  <button onClick={() => checkAllInPO(g.noPO)} className="text-[10px] text-brand-500 hover:text-brand-700 font-semibold">Cek Semua</button>
                )}
              </div>

              {/* SKU Checklist */}
              <div className="space-y-1">
                {g.items.map((item, idx) => {
                  const globalIdx = items.indexOf(item);
                  return (
                    <label
                      key={`${item.noPO}-${item.sku}-${idx}`}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition ${
                        item.checked ? 'bg-emerald-50' : 'bg-white border border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleCheck(globalIdx)}
                        className="rounded accent-emerald-500 w-4 h-4 shrink-0"
                      />
                      <span className="font-mono text-xs text-indigo-600 w-20 shrink-0">{item.sku}</span>
                      <span className={`text-xs flex-1 ${item.checked ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>
                        {item.nama}
                      </span>
                      <span className={`text-xs font-bold shrink-0 ${item.checked ? 'text-emerald-600' : 'text-slate-600'}`}>
                        ×{item.qty}
                      </span>
                      {/* Koreksi button — anti double */}
                      {(() => {
                        const koreksiKey = `${item.noPO}|${item.sku}`;
                        const sudah = existingKoreksi.get(koreksiKey);
                        if (sudah) {
                          const statusLabel: Record<string, string> = {
                            pending: '⏳ Pending',
                            retur: '↩️ Retur',
                            tukar: '🔄 Tukar',
                            selesai: '✅ Selesai',
                          };
                          return (
                            <span className="ml-1 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500"
                              title={`${sudah.jenisKoreksi}: ${sudah.catatan || '-'}`}>
                              {statusLabel[sudah.status] || 'Dikoreksi'}
                            </span>
                          );
                        }
                        return (
                          <button
                            onClick={(e) => { e.preventDefault(); setKoreksiItem(item); setKoreksiJenis('salah_datang'); setKoreksiCatatan(''); setKoreksiSuccess(false); }}
                            className="ml-1 shrink-0 rounded-lg bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-500 hover:bg-red-100 transition"
                            title="Laporkan masalah dengan barang ini"
                          >
                            ⚠️ Koreksi
                          </button>
                        );
                      })()}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Koreksi */}
      {koreksiItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setKoreksiItem(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-sm font-bold text-red-600">⚠️ Koreksi Barang</p>
              <p className="mt-1 font-mono text-xs text-slate-500">{koreksiItem.noPO} — {koreksiItem.sku}</p>
              <p className="text-xs text-slate-600 mt-0.5">{koreksiItem.nama} ×{koreksiItem.qty}</p>
            </div>
            {koreksiSuccess ? (
              <div className="p-5 text-center">
                <p className="text-emerald-600 font-bold">✅ Koreksi berhasil dicatat!</p>
                <p className="text-xs text-slate-500 mt-1">Purchasing akan menindaklanjuti.</p>
              </div>
            ) : (
              <div className="p-5 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Jenis Koreksi</label>
                  <div className="space-y-1">
                    {Object.entries(JENIS_KOREKSI).map(([key, val]) => (
                      <label key={key} className={`flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer border text-xs transition ${
                        koreksiJenis === key ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-red-200'
                      }`}>
                        <input type="radio" name="koreksiJenis" value={key} checked={koreksiJenis === key}
                          onChange={() => setKoreksiJenis(key as KoreksiPO['jenisKoreksi'])}
                          className="accent-red-500" />
                        <span>{val.icon} {val.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Catatan</label>
                  <textarea value={koreksiCatatan} onChange={e => setKoreksiCatatan(e.target.value)}
                    placeholder="Jelaskan detail masalah..."
                    rows={2} className="w-full rounded-xl border px-3 py-2 text-sm focus:border-red-500 focus:outline-none" />
                </div>
              </div>
            )}
            <div className="flex gap-2 border-t border-slate-200 px-5 py-3">
              <button onClick={() => setKoreksiItem(null)} className="flex-1 rounded-xl bg-slate-100 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200">
                {koreksiSuccess ? 'Tutup' : 'Batal'}
              </button>
              {!koreksiSuccess && (
                <button onClick={submitKoreksi} className="flex-1 rounded-xl bg-red-500 py-2 text-sm font-bold text-white hover:bg-red-600">
                  ⚠️ Catat Koreksi
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
