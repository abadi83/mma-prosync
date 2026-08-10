'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useAgregasi, type AgregasiRow } from '@/app/context/AgregasiContext';

type Tab = 'shopee' | 'operasional' | 'keuangan' | 'riwayat';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'shopee', label: 'Pesanan Marketplace', icon: '🛒' },
  { key: 'operasional', label: 'Input Operasional', icon: '📋' },
  { key: 'keuangan', label: 'Input Keuangan', icon: '💰' },
  { key: 'riwayat', label: 'Riwayat Entry', icon: '📜' },
];

/* ── Data Marketplace dari Data Master ── */
const MARKETPLACE_TOKO = [
  { id: 'mp-1', nama: 'Shopee — MITRA MULIA ABADI', marketplace: 'Shopee', persenFee: 10 },
  { id: 'mp-2', nama: 'Lazada — MITRA MULIA ABADI', marketplace: 'Lazada', persenFee: 8 },
  { id: 'mp-3', nama: 'Tokopedia — Berkah Abadi Official', marketplace: 'Tokopedia', persenFee: 6 },
  { id: 'mp-4', nama: 'TikTok Shop — MITRA MULIA ABADI', marketplace: 'TikTok Shop', persenFee: 5 },
];

/* ── Types ── */
interface OpsEntry { id: string; tanggal: string; jamBuka: string; jamTutup: string; jumlahKaryawan: number; catatan: string; }
interface KeuEntry { id: string; tanggal: string; marketplaceId: string; marketplaceNama: string; pendapatanKotor: number; feeMarketplace: number; biayaIklan: number; biayaPengemasan: number; biayaPengiriman: number; pendapatanBersih: number; catatan: string; }

/* ── Marketplace Order Detail (fee breakdown + SKU items for HPP) ── */
interface MpOrderItem {
  sku: string;
  nama: string;
  qty: number;
  hargaJual: number;
  hpp: number;        // HPP dari Master SKU (per unit)
}
interface MpOrder {
  id: string;
  noPesanan: string;
  tanggal: string;
  marketplaceId: string;
  marketplace: string;
  tokoNama: string;
  pendapatanKotor: number;
  pendapatanBersih: number; // net after marketplace fees
  // Fee breakdown
  totalBiaya: number;
  feeAdmin: number;
  feeLayanan: number;
  ongkirAktual: number;
  subsidiOngkir: number;
  biayaPemrosesan: number;   // 1250/paket — biaya per ORDER, bukan per SKU
  premiProteksi: number;
  biayaAMS: number;
  biayaTransaksi: number;
  komisi: number;
  // SKU detail
  items: MpOrderItem[];
  // HPP (dihitung dari Master SKU)
  totalHPP: number;
  labaKotor: number; // pendapatanBersih - totalHPP
  catatan: string;
}
interface ShopeeOrder {
  id: string;
  noPesanan: string;          // [0] No. Pesanan
  sku: string;                // [13] Nomor Referensi SKU
  hargaAwal: number;          // [15] Harga Awal
  kurir: string;              // [4] Opsi Pengiriman
  waktuDibuat: string;        // [8] Waktu Pesanan Dibuat
  noResi: string;             // [3] No. Resi
  namaProduk: string;         // [12] Nama Produk
  jumlah: number;             // [17] Jumlah
  statusPesanan: string;      // [1] Status Pesanan
  sla: string;                // [6] Pesanan Harus Dikirimkan Sebelum
  username: string;           // [41] Username Pembeli
  totalPembayaran: number;    // [37] Total Pembayaran
}

export default function DataEntryPage() {
  const [tab, setTab] = useState<Tab>('shopee');

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-3xl bg-gradient-to-br from-brand-700 via-brand-500 to-brand-300 p-5 text-white shadow-lg sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-100 sm:text-sm">Data Entry</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Input Data</h1>
        <p className="mt-1 text-sm text-brand-100 sm:text-base">Catat data operasional harian & keuangan per marketplace secara terstruktur.</p>
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm" role="tablist">
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={tab===t.key} onClick={()=>setTab(t.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:px-5 sm:text-sm ${tab===t.key?'bg-brand-500 text-white shadow':'text-slate-600 hover:bg-brand-50 hover:text-brand-700'}`}>
            <span className="text-base sm:text-lg">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </nav>

      <section className="card-blue">
        {tab==='shopee' && <PesananShopee />}
        {tab==='operasional' && <InputOperasional />}
        {tab==='keuangan' && <InputKeuangan />}
        {tab==='riwayat' && <RiwayatEntry />}
      </section>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* INPUT PESANAN SHOPEE — Multi‑SKU + Format Indonesia              */
/* ═══════════════════════════════════════════════════════════════════ */

/* ── Parse number: "8.250"→8250, "1.500.000"→1500000, "36455.00"→36455 ── */
function parseRp(val: string): number {
  const s=String(val??'').trim();
  if(!s)return 0;
  // "36455.00" → dot diikuti tepat 2 digit di akhir = desimal
  if(/\.\d{2}$/.test(s)&&!s.includes(','))return +s.replace(/\.\d{2}$/,'')||0;
  // Pakai koma sebagai desimal (format Indonesia)
  if(s.includes(',')&&!s.includes('.'))return +s.replace(/\./g,'').replace(',','.')||0;
  if(s.includes(',')&&s.includes('.')){
    return +s.replace(/\./g,'').replace(',','.')||0;
  }
  // Hanya titik → titik adalah pemisah ribuan (Shopee: "8.250" = Rp 8.250)
  return +s.replace(/\./g,'')||0;
}

/* ── Grouped order (multi‑SKU per No. Pesanan + Resi) ── */
interface GroupedOrder {
  noPesanan: string;
  noResi: string;
  statusPesanan: string;
  sla: string;
  kurir: string;
  waktuDibuat: string;
  username: string;
  items: { sku: string; namaProduk: string; jumlah: number; hargaAwal: number; }[];
  totalPendapatan: number;
}

function groupOrders(orders: ShopeeOrder[]): GroupedOrder[] {
  const map=new Map<string,GroupedOrder>();
  for(const o of orders){
    const key=`${o.noPesanan}||${o.noResi}`;
    if(!map.has(key)){
      map.set(key,{
        noPesanan:o.noPesanan,noResi:o.noResi,statusPesanan:o.statusPesanan,
        sla:o.sla,kurir:o.kurir,waktuDibuat:o.waktuDibuat,username:o.username,
        items:[],totalPendapatan:0,
      });
    }
    const g=map.get(key)!;
    g.items.push({sku:o.sku,namaProduk:o.namaProduk,jumlah:o.jumlah,hargaAwal:o.hargaAwal});
    g.totalPendapatan+=o.totalPembayaran||(o.hargaAwal*o.jumlah);
  }
  return Array.from(map.values());
}
interface UploadHistory { id: string; waktu: string; marketplace: string; namaToko: string; jumlah: number; fileName: string; }

function PesananShopee() {
  const { addRows } = useAgregasi();
  const [orders, setOrders] = useState<ShopeeOrder[]>([]);
  const [staged, setStaged] = useState<ShopeeOrder[]|null>(null); // data sebelum konfirmasi
  const [stagedFile, setStagedFile] = useState(''); // nama file yang di-upload
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('semua');
  const [selectedToko, setSelectedToko] = useState(MARKETPLACE_TOKO[0].id);
  const [history, setHistory] = useState<UploadHistory[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const toko = MARKETPLACE_TOKO.find(t=>t.id===selectedToko)!;

  /* ── Grouped data (dari orders yang sudah dikonfirmasi) ── */
  const grouped = groupOrders(orders);
  const uniqueOrders = new Set(orders.map(o=>o.noPesanan)).size;
  const statuses = Array.from(new Set(grouped.map(g => g.statusPesanan)));
  const filtered = filter==='semua'?grouped:grouped.filter(g=>g.statusPesanan===filter);

  /* ── Stats ── */
  const totalItems = orders.reduce((s,o)=>s+o.jumlah,0);
  const perluDikirim = grouped.filter(g=>g.statusPesanan==='Perlu Dikirim').length;
  const totalPendapatan = grouped.reduce((s,g)=>s+g.totalPendapatan,0);

  /* ── SLA warning ── */
  const now = new Date();
  const slaWarning = grouped.filter(g=>{
    if(g.statusPesanan!=='Perlu Dikirim')return false;
    const sla=new Date(g.sla);if(isNaN(sla.getTime()))return false;
    return (sla.getTime()-now.getTime())<24*60*60*1000;
  }).length;

  /* ── Expand state ── */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (key:string) => setExpanded(prev=>{
    const next=new Set(prev);
    next.has(key)?next.delete(key):next.add(key);
    return next;
  });

  /* ── Upload Excel — dynamic column mapping by header name ── */
  const uploadFile=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];if(!file)return;
    setUploading(true);setErr('');
    const r=new FileReader();
    r.onload=ev=>{
      try{
        const data=new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb=XLSX.read(data,{type:'array'});
        const sheet=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json<string[]>(sheet,{header:1});
        if(rows.length<2){setErr('File Excel kosong atau hanya header.');setUploading(false);return;}

        // Build header→index map (case-insensitive, partial match)
        const header=rows[0].map((h:string)=>String(h).toLowerCase().trim());
        const idx=(...keywords:string[])=>header.findIndex(h=>keywords.some(k=>h.includes(k)));

        const iNoPesanan    = idx('no. pesanan','no pesanan','order id','ordernumber','order_number','order number','order_no');
        const iSku          = idx('nomor referensi sku','sku referensi','sku ref','seller sku','sellersku');
        const iHargaAwal    = idx('harga awal','sku unit original price','original price','unitprice');
        const iKurir        = idx('opsi pengiriman','shipping provider','shippingproviderfm','logistics provider','courier','logistic');
        const iWaktuDibuat  = idx('waktu pesanan dibuat','created time','createtime');
        // Lazada: trackingCode spesifik (hindari cdTrackingCode)
        const lazTracking=header.findIndex(h=>h==='trackingcode');
        const iNoResi       = lazTracking>=0?lazTracking:idx('trackingcodefm','tracking id','no. resi','no resi','trackingcode','tracking_number','tracking number','tracking_code','tracking code');
        const iNamaProduk   = idx('nama produk','nama item','product name','itemname');
        const iJumlah       = idx('jumlah','kuantity','quantity');
        const iStatus       = idx('status pesanan','order status','status');
        const iSla          = idx('harus dikirimkan sebelum','sla','rts time','ttssla','rtssla');
        const iUsername     = idx('username','buyer username','customername');
        const iTotalBayar   = idx('total pembayaran','order amount','paidprice');

        if(iNoPesanan<0||iNamaProduk<0){setErr('Kolom Order ID/No. Pesanan dan Nama Produk wajib ada.');setUploading(false);return;}

        // Deteksi baris deskripsi (TikTok: row is description, not data)
        const isDataRow=(r:string[])=>r&&r[iNoPesanan]&&!/^platform unique|^current order|^the filed|^platform sku|^seller sku input|^platform product|^platform sku variation|^sku sold|^sku returned|^1 sku original|^it equals|^total platform|^total seller|^the order|^shipping fee/i.test(String(r[iNoPesanan]));

        const items:ShopeeOrder[]=[];
        for(let i=1;i<rows.length;i++){
          const r=rows[i];if(!r||!isDataRow(r))continue;
          items.push({
            id:`shp-${Date.now()}-${i}`,
            noPesanan: String(r[iNoPesanan]??'').trim(),
            sku: iSku>=0?String(r[iSku]??'').trim():'',
            hargaAwal: iHargaAwal>=0?parseRp(r[iHargaAwal]):0,
            kurir: iKurir>=0?String(r[iKurir]??'').trim():'',
            waktuDibuat: iWaktuDibuat>=0?String(r[iWaktuDibuat]??'').trim():'',
            noResi: iNoResi>=0?String(r[iNoResi]??'').trim():'',
            namaProduk: String(r[iNamaProduk]??'').trim(),
            jumlah: iJumlah>=0?(+String(r[iJumlah]??'0').replace(/[^0-9.-]/g,'')||0):1, // Lazada: tidak ada kolom qty → default 1
            statusPesanan: iStatus>=0?String(r[iStatus]??'').trim():'',
            sla: iSla>=0?String(r[iSla]??'').trim():'',
            username: iUsername>=0?String(r[iUsername]??'').trim():'',
            totalPembayaran: iTotalBayar>=0?parseRp(r[iTotalBayar]):0,
          });
        }
        if(items.length===0){setErr('Tidak ada data pesanan valid.');setUploading(false);return;}
        // Stage dulu — jangan langsung kirim ke context
        setStaged(items);setStagedFile(file.name);setErr('');
        setUploading(false);
      }catch{setErr('Gagal membaca file Excel.');}
      setUploading(false);
    };
    r.onerror=()=>{setErr('Gagal membaca file.');setUploading(false);};
    r.readAsArrayBuffer(file);
  };

  /* ── Konfirmasi: kirim staged → context + history ── */
  const confirmUpload = () => {
    if (!staged || staged.length === 0) return;
    setOrders(prev => {
      const combined = [...staged, ...prev];
      const map = new Map<string, ShopeeOrder>();
      for (const o of combined) map.set(`${o.noPesanan}||${o.noResi}||${o.sku}`, o);
      return Array.from(map.values());
    });

    const ctxRows: AgregasiRow[] = staged.map(o => ({
      id: o.id, marketplace: toko.marketplace, namaToko: toko.nama.split('—')[1]?.trim() || toko.nama,
      noPesanan: o.noPesanan, noResi: o.noResi, sku: o.sku, namaProduk: o.namaProduk,
      hargaJual: o.hargaAwal, kuantity: o.jumlah, kurir: o.kurir,
      statusPesanan: o.statusPesanan, dibuat: o.waktuDibuat, sla: o.sla,
    }));
    addRows(ctxRows);

    setHistory(prev => [{
      id: `h-${Date.now()}`, waktu: new Date().toLocaleString('id-ID'),
      marketplace: toko.marketplace, namaToko: toko.nama.split('—')[1]?.trim() || toko.nama,
      jumlah: staged.length, fileName: stagedFile,
    }, ...prev]);

    setStaged(null); setStagedFile('');
    alert(`✅ ${staged.length} pesanan dikonfirmasi & dikirim ke Operasional Gudang.`);
  };

  const cancelUpload = () => { setStaged(null); setStagedFile(''); setErr(''); };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🛒 Pesanan Marketplace</h2>
          <p className="mt-1 text-sm text-slate-500">Shopee, TikTok & Lazada — pilih toko → upload Excel → mapping otomatis.</p>
        </div>
        <div className="flex gap-2">
          {/* Pilih Toko dari Data Master */}
          <select value={selectedToko} onChange={e=>{setSelectedToko(e.target.value);setOrders([]);}} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 focus:border-brand-500 focus:outline-none">
            {MARKETPLACE_TOKO.map(m=>(
              <option key={m.id} value={m.id}>{m.marketplace} — {m.nama.split('—')[1]?.trim()||m.nama}</option>
            ))}
          </select>
          <label className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${uploading?'bg-slate-400':'bg-orange-500 hover:bg-orange-600'}`}>
            {uploading?'⏳ Memproses...':'📥 Upload Excel'}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={uploadFile} className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>
      {err&&<p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}

      {/* ── Staged Upload Panel ── */}
      {staged&&(
        <div className="mt-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-amber-800">📋 Data Siap Dikonfirmasi</p>
              <p className="text-xs text-amber-600">{staged.length} baris dari <strong>{stagedFile}</strong> • {toko.marketplace} — {toko.nama}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={cancelUpload} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200">✕ Batal</button>
              <button onClick={confirmUpload} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">✅ Konfirmasi Kirim ke Operasional</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload History ── */}
      {history.length>0&&(
        <details className="mt-3 rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700">📜 Riwayat Upload ({history.length})</summary>
          <div className="px-4 pb-3 divide-y divide-slate-50">
            {history.slice(0, 15).map(h=>(
              <div key={h.id} className="flex items-center justify-between py-1.5 text-xs">
                <div><span className="font-semibold text-slate-700">{h.marketplace}</span><span className="text-slate-400 mx-1">•</span><span className="text-slate-500">{h.namaToko}</span></div>
                <div className="flex items-center gap-3"><span className="text-slate-400">{h.fileName}</span><span className="text-slate-400">{h.jumlah} baris</span><span className="text-slate-300">{h.waktu}</span></div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Toko aktif + info */}
      {orders.length>0&&(
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-1.5 text-xs text-brand-600">
          <span className="font-bold">{toko.marketplace}</span>
          <span className="text-slate-400">|</span>
          <span>{toko.nama}</span>
          <span className="text-slate-400">|</span>
          <span>Fee {toko.persenFee}%</span>
        </div>
      )}

      {/* Stats Cards */}
      {orders.length>0&&(
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-xl bg-brand-50 p-3 text-center"><p className="text-2xl font-bold text-brand-700">{uniqueOrders}</p><p className="text-xs text-brand-500">Pesanan</p></div>
          <div className="rounded-xl bg-purple-50 p-3 text-center"><p className="text-2xl font-bold text-purple-600">{totalItems}</p><p className="text-xs text-purple-500">Item</p></div>
          <div className="rounded-xl bg-amber-50 p-3 text-center"><p className="text-2xl font-bold text-amber-600">{perluDikirim}</p><p className="text-xs text-amber-500">Perlu Dikirim</p></div>
          <div className={`rounded-xl p-3 text-center ${slaWarning>0?'bg-red-50':'bg-emerald-50'}`}><p className={`text-2xl font-bold ${slaWarning>0?'text-red-600':'text-emerald-600'}`}>{slaWarning}</p><p className="text-xs text-slate-500">⚠ Deadline {'<'}24j</p></div>
          <div className="rounded-xl bg-blue-50 p-3 text-center"><p className="text-2xl font-bold text-blue-600">Rp {(totalPendapatan/1000).toFixed(0)}k</p><p className="text-xs text-blue-500">Pendapatan</p></div>
        </div>
      )}

      {/* Filter status */}
      {orders.length>0&&(
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={()=>setFilter('semua')} className={`rounded-full px-3 py-1 text-xs font-semibold transition ${filter==='semua'?'bg-brand-500 text-white':'bg-slate-100 text-slate-600 hover:bg-brand-100'}`}>Semua ({grouped.length})</button>
          {statuses.map(s=>(
            <button key={s} onClick={()=>setFilter(s)} className={`rounded-full px-3 py-1 text-xs font-semibold transition ${filter===s?'bg-brand-500 text-white':s==='Perlu Dikirim'?'bg-amber-100 text-amber-700 hover:bg-amber-200':s.includes('Diterima')||s==='Selesai'?'bg-emerald-100 text-emerald-700 hover:bg-emerald-200':s==='Dikirim'||s.includes('Dikirim')?'bg-blue-100 text-blue-700 hover:bg-blue-200':s.includes('Dibatalkan')?'bg-red-100 text-red-700 hover:bg-red-200':'bg-slate-100 text-slate-600 hover:bg-brand-100'}`}>
              {s} ({grouped.filter(g=>g.statusPesanan===s).length})
            </button>
          ))}
        </div>
      )}

      {/* Tabel Pesanan — Grouped by No. Pesanan + Resi */}
      {orders.length>0&&(
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead><tr className="bg-brand-50 text-xs uppercase text-brand-500">
              {['No. Pesanan','No. Resi','Item','Total','Kurir','Dibuat','SLA','Status'].map(c=><th key={c} className="px-2 py-3 font-semibold whitespace-nowrap">{c}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {filtered.map(g=>{
                const key=`${g.noPesanan}||${g.noResi}`;
                const isUrgent=g.statusPesanan==='Perlu Dikirim'&&(()=>{const d=new Date(g.sla);return!isNaN(d.getTime())&&(d.getTime()-Date.now())<24*60*60*1000;})();
                const isExpanded=expanded.has(key);
                const itemCount=g.items.length;
                return(
                  <React.Fragment key={key}>
                    <tr className={`cursor-pointer transition ${isUrgent?'bg-red-50/40':'hover:bg-brand-50/30'}`} onClick={()=>toggleExpand(key)}>
                      <td className="px-2 py-2.5 font-mono text-[11px] text-slate-700 max-w-[100px] truncate" title={g.noPesanan}>{g.noPesanan}</td>
                      <td className="px-2 py-2.5 font-mono text-[10px] text-slate-500 max-w-[100px] truncate" title={g.noResi}>{g.noResi||'-'}</td>
                      <td className="px-2 py-2.5">
                        <span className="font-semibold text-brand-700">{itemCount} SKU</span>
                        <span className="text-slate-400 ml-1">{isExpanded?'▲':'▼'}</span>
                      </td>
                      <td className="px-2 py-2.5 font-semibold whitespace-nowrap">Rp {g.totalPendapatan.toLocaleString('id-ID')}</td>
                      <td className="px-2 py-2.5 text-slate-500 max-w-[100px] truncate text-[10px]" title={g.kurir}>{g.kurir.split('-')[0]?.trim()||g.kurir}</td>
                      <td className="px-2 py-2.5 text-[10px] whitespace-nowrap">{g.waktuDibuat?.replace(' ',' ')}</td>
                      <td className={`px-2 py-2.5 text-[10px] whitespace-nowrap font-semibold ${isUrgent?'text-red-600':g.statusPesanan.includes('Diterima')||g.statusPesanan==='Selesai'?'text-slate-400':'text-amber-600'}`}>{g.sla||'-'}</td>
                      <td className="px-2 py-2.5"><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${g.statusPesanan==='Perlu Dikirim'?'bg-amber-100 text-amber-700':g.statusPesanan.includes('Diterima')||g.statusPesanan==='Selesai'?'bg-emerald-100 text-emerald-700':g.statusPesanan.includes('Dikirim')?'bg-blue-100 text-blue-700':g.statusPesanan.includes('Dibatalkan')?'bg-red-100 text-red-700':'bg-slate-100 text-slate-600'}`}>{g.statusPesanan}</span></td>
                    </tr>
                    {/* Expanded: SKU items */}
                    {isExpanded&&g.items.map((item,i)=>(
                      <tr key={`${key}-${i}`} className="bg-slate-50/50 border-b border-slate-100">
                        <td colSpan={2} className="px-2 py-1.5"></td>
                        <td className="px-2 py-1.5 text-[11px] max-w-[180px] truncate" title={item.namaProduk}>
                          <span className="text-slate-400 mr-1">└</span>
                          <span className="font-mono text-[10px] text-brand-600 mr-1">{item.sku||'-'}</span>
                          {item.namaProduk}
                        </td>
                        <td className="px-2 py-1.5 text-[11px] whitespace-nowrap">Rp {item.hargaAwal.toLocaleString('id-ID')} × {item.jumlah}</td>
                        <td colSpan={4} className="px-2 py-1.5"></td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {orders.length===0&&(
        <div className="mt-8 text-center py-12 text-slate-400">
          <p className="text-5xl mb-3">🛒</p>
          <p className="font-semibold">Belum ada data pesanan.</p>
          <p className="text-sm mt-1">Pilih toko di atas, lalu upload file Excel Order dari Shopee.</p>
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-left text-xs text-slate-500 inline-block">
            <p className="font-semibold text-slate-600 mb-1">📋 Mapping otomatis (Shopee, TikTok & Lazada):</p>
            <p>Shopee: No. Pesanan / TikTok: Order ID / Lazada: orderNumber → SKU → Produk → Qty → Harga → Kurir → Resi → Status → SLA</p>
            <p className="mt-1 text-slate-400">Lazada: tanpa kolom Qty — setiap baris = 1 item. Multi-SKU via No. Pesanan + Resi yang sama.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* INPUT DATA OPERASIONAL                                            */
/* ═══════════════════════════════════════════════════════════════════ */
function InputOperasional() {
  const [entries, setEntries] = useState<OpsEntry[]>([]);
  const [form, setForm] = useState({ tanggal: new Date().toISOString().slice(0, 10), jamBuka: '08:00', jamTutup: '17:00', jumlahKaryawan: '', catatan: '' });
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState(false);

  const save = () => {
    if (!form.jumlahKaryawan || +form.jumlahKaryawan <= 0) { setErr('Jumlah karyawan wajib diisi.'); return; }
    setEntries(p => [{ id: `ops-${Date.now()}`, ...form, jumlahKaryawan: +form.jumlahKaryawan }, ...p]);
    setForm({ tanggal: new Date().toISOString().slice(0, 10), jamBuka: '08:00', jamTutup: '17:00', jumlahKaryawan: '', catatan: '' });
    setErr(''); setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📋 Input Data Operasional</h2>
      <p className="mt-1 text-sm text-slate-500">Jam operasional toko, jumlah staf, dan catatan harian.</p>

      {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
      {success && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">✅ Data operasional tersimpan.</p>}

      <div className="mt-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Tanggal</span><input type="date" value={form.tanggal} onChange={e => setForm({ ...form, tanggal: e.target.value })} className="rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Jam Buka</span><input type="time" value={form.jamBuka} onChange={e => setForm({ ...form, jamBuka: e.target.value })} className="rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Jam Tutup</span><input type="time" value={form.jamTutup} onChange={e => setForm({ ...form, jamTutup: e.target.value })} className="rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Jumlah Karyawan *</span><input type="number" value={form.jumlahKaryawan} onChange={e => setForm({ ...form, jumlahKaryawan: e.target.value })} placeholder="cth: 5" className="rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-2"><span className="text-xs font-semibold text-slate-600">Catatan</span><input type="text" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} placeholder="Kejadian khusus, masalah, dll" className="rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /></label>
        </div>
        <button onClick={save} className="mt-4 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">💾 Simpan</button>
      </div>

      {/* Tabel riwayat */}
      {entries.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-bold text-slate-700">📋 Riwayat Hari Ini</p>
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-brand-50 text-xs uppercase text-brand-500">{['Tanggal','Buka','Tutup','Karyawan','Catatan'].map(c => <th key={c} className="px-3 py-2 font-semibold">{c}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-50 bg-white">{entries.map(e => (
                <tr key={e.id}><td className="px-3 py-2">{e.tanggal}</td><td className="px-3 py-2">{e.jamBuka}</td><td className="px-3 py-2">{e.jamTutup}</td><td className="px-3 py-2 font-semibold text-brand-700">{e.jumlahKaryawan}</td><td className="px-3 py-2 text-slate-500 max-w-[200px] truncate">{e.catatan || '-'}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* INPUT DATA KEUANGAN PER MARKETPLACE                               */
/* ═══════════════════════════════════════════════════════════════════ */
function InputKeuangan() {
  const [entries, setEntries] = useState<KeuEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('mma_keuangan_manual');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [selectedMp, setSelectedMp] = useState(MARKETPLACE_TOKO[0].id);
  const [form, setForm] = useState({ tanggal: new Date().toISOString().slice(0, 10), pendapatanKotor: '', biayaIklan: '', biayaPengemasan: '', biayaPengiriman: '', catatan: '' });
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // State untuk upload Excel: pilih marketplace & toko
  const [uploadMp, setUploadMp] = useState(MARKETPLACE_TOKO[0].id);
  const [uploadToko, setUploadToko] = useState('');
  const [tokoList, setTokoList] = useState<{id:string;nama:string;marketplace:string}[]>([]);

  // Load toko dari Master Data
  useEffect(() => {
    const DEFAULT_TOKO = [
      { id:'t-1',nama:'Toko Berkah Abadi',marketplace:'Shopee' },
      { id:'t-2',nama:'Berkah Abadi Official',marketplace:'Tokopedia' },
      { id:'t-3',nama:'Toko Berkah Abadi',marketplace:'Lazada' },
    ];
    try {
      const stored = localStorage.getItem('mma_toko_master');
      if (stored) setTokoList(JSON.parse(stored));
      else setTokoList(DEFAULT_TOKO);
    } catch { setTokoList(DEFAULT_TOKO); }
  }, []);

  // Persist manual entries ke localStorage (biar Laba Rugi bisa baca)
  useEffect(() => {
    try { localStorage.setItem('mma_keuangan_manual', JSON.stringify(entries)); } catch { }
  }, [entries]);

  const mp = MARKETPLACE_TOKO.find(m => m.id === selectedMp)!;
  const pk = +form.pendapatanKotor || 0;
  const fee = Math.round(pk * mp.persenFee / 100);
  const biayaLain = (+form.biayaIklan || 0) + (+form.biayaPengemasan || 0) + (+form.biayaPengiriman || 0);
  const bersih = pk - fee - biayaLain;

  // Filter toko by selected marketplace
  const uploadMpObj = MARKETPLACE_TOKO.find(m => m.id === uploadMp);
  const filteredToko = tokoList.filter(t => t.marketplace === uploadMpObj?.marketplace);

  /* ── Upload File Excel Laporan Keuangan Marketplace (dengan fee breakdown) ── */
  const uploadKeuangan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true); setErr('');
    const r = new FileReader();
    r.onload = ev => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        let sheetName = wb.SheetNames[0];
        for (const sn of wb.SheetNames) {
          if (sn.toLowerCase().includes('penghasilan') || sn.toLowerCase().includes('income') || sn.toLowerCase().includes('pesanan')) { sheetName = sn; break; }
        }
        const sheet = wb.Sheets[sheetName];
        const raw = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
        if (raw.length < 2) { setErr('File kosong.'); setUploading(false); return; }
        const h = raw[0].map((c: string) => String(c || '').toLowerCase().trim());
        const idx = (...kw: string[]) => h.findIndex(hh => kw.some(k => hh.includes(k)));
        const isShopee = h.includes('id pesanan') && h.includes('total penghasilan') && h.includes('total laba');
        // ── Deteksi format Lazada: kolom "nama biaya" + "nomor pesanan" ──
        const isLazada = h.some(hh => hh === 'nama biaya') && h.some(hh => hh === 'nomor pesanan');

        // ── Deteksi marketplace ──
        const mpObj = uploadMpObj || MARKETPLACE_TOKO[0];
        const tokoNama = uploadToko ? (filteredToko.find(t=>t.id===uploadToko)?.nama || '') : (mpObj.nama.split('—')[1]?.trim() || mpObj.nama);

        // ── PARSE LAZADA (format vertikal: 1 pesanan = banyak baris jenis biaya) ──
        if (isLazada) {
          const iNamaBiaya = h.findIndex(hh => hh === 'nama biaya');       // Kolom D
          const iJumlah = h.findIndex(hh => hh === 'jumlah (termasuk pajak)'); // Kolom E
          const iNoPesanan = h.findIndex(hh => hh === 'nomor pesanan');    // Kolom K
          const iIdPesanan = h.findIndex(hh => hh === 'id pesanan');       // Kolom L
          const iSkuPenjual = h.findIndex(hh => hh === 'sku penjual');     // Kolom M
          const iNamaProduk = h.findIndex(hh => hh === 'nama produk');     // Kolom R
          const iStatusPesanan = h.findIndex(hh => hh === 'status pesanan'); // Kolom Q
          const iWht = h.findIndex(hh => hh === 'wht amount');             // Kolom O
          const iTanggalTransaksi = h.findIndex(hh => hh === 'tanggal transaksi'); // Kolom C

          if (iNamaBiaya < 0 || iJumlah < 0 || iNoPesanan < 0) {
            setErr('Format Lazada: kolom Nama Biaya / Jumlah / Nomor Pesanan wajib ada.'); setUploading(false); return;
          }

          // Group by Nomor Pesanan
          const orderMapLazada = new Map<string, {
            noPesanan: string; tanggal: string; items: { sku: string; nama: string; qty: number; hargaJual: number }[];
            omset: number; komisi: number; freeShipping: number; promosi: number;
            processingFee: number; biayaTransaksi: number; diskon: number; wht: number;
          }>();

          for (let i = 1; i < raw.length; i++) {
            const row = raw[i]; if (!row || row.length < 2) continue;
            const noPesanan = String(row[iNoPesanan] || '').trim();
            const namaBiaya = String(row[iNamaBiaya] || '').trim().toLowerCase();
            const jumlah = parseRp(row[iJumlah] || '0');
            if (!noPesanan && !namaBiaya) continue;

            // If no order number but has biaya, attach to last order
            const key = noPesanan || (orderMapLazada.size > 0 ? Array.from(orderMapLazada.keys()).pop()! : '');
            if (!key) continue;

            if (!orderMapLazada.has(key)) {
              const tgl = iTanggalTransaksi >= 0 ? String(row[iTanggalTransaksi] || '').trim().slice(0, 10) : '';
              orderMapLazada.set(key, { noPesanan: key, tanggal: tgl, items: [], omset: 0, komisi: 0, freeShipping: 0, promosi: 0, processingFee: 0, biayaTransaksi: 0, diskon: 0, wht: 0 });
            }
            const order = orderMapLazada.get(key)!;

            // Parse SKU items
            const sku = iSkuPenjual >= 0 ? String(row[iSkuPenjual] || '').trim() : '';
            const namaProduk = iNamaProduk >= 0 ? String(row[iNamaProduk] || '').trim() : '';
            if (sku || namaProduk) {
              const existingItem = order.items.find(it => it.sku === sku && it.nama === namaProduk);
              if (existingItem) existingItem.qty++;
              else order.items.push({ sku, nama: namaProduk, qty: 1, hargaJual: 0 });
            }

            // Categorize by Nama Biaya
            if (namaBiaya === 'omset penjualan') order.omset += jumlah;
            else if (namaBiaya.includes('komisi')) order.komisi += Math.abs(jumlah);
            else if (namaBiaya.includes('free shipping') || namaBiaya.includes('gratis ongkir')) order.freeShipping += Math.abs(jumlah);
            else if (namaBiaya.includes('promosi') || namaBiaya.includes('lazkoin')) order.promosi += Math.abs(jumlah);
            else if (namaBiaya.includes('processing fee') || namaBiaya.includes('pemrosesan')) order.processingFee += Math.abs(jumlah);
            else if (namaBiaya.includes('transaksi')) order.biayaTransaksi += Math.abs(jumlah);
            else if (namaBiaya.includes('diskon')) order.diskon += Math.abs(jumlah);
            // WHT
            const wht = iWht >= 0 ? parseRp(row[iWht] || '0') : 0;
            if (wht > 0) order.wht += wht;
            // Update tanggal
            if (iTanggalTransaksi >= 0 && !order.tanggal) order.tanggal = String(row[iTanggalTransaksi] || '').trim().slice(0, 10);
          }

          // Convert to MpOrder + HPP matching
          const skuHppMap = new Map<string, number>();
          let skuMapSize = 0;
          try {
            const skuData = JSON.parse(localStorage.getItem('mma_sku_data') || '[]');
            for (const s of skuData) { if (s.sku && s.hargaBaru > 0) { skuHppMap.set(String(s.sku).trim(), s.hargaBaru); skuMapSize++; } }
          } catch { }

          const newOrders: MpOrder[] = [];
          let totalHppAll = 0, matchedSku = 0, unmatchedSku = 0;
          const unmatchedList: string[] = [];

          for (const [orderId, o] of orderMapLazada) {
            const totalFeeLazada = o.komisi + o.freeShipping + o.promosi + o.processingFee + o.biayaTransaksi + o.diskon + o.wht;
            const gross = o.omset || 0;
            if (gross <= 0 && totalFeeLazada <= 0) continue;

            let totalHPP = 0;
            const itemsWithHpp: MpOrderItem[] = o.items.map(item => {
              const cleanSku = String(item.sku).trim();
              const hpp = skuHppMap.get(cleanSku);
              if (hpp !== undefined && hpp > 0) { matchedSku++; return { ...item, hpp, hargaJual: 0 }; }
              else if (cleanSku) { unmatchedSku++; if (!unmatchedList.includes(cleanSku)) unmatchedList.push(cleanSku); return { ...item, hpp: 0, hargaJual: 0 }; }
              return { ...item, hpp: 0, hargaJual: 0 };
            });
            totalHPP = itemsWithHpp.reduce((s, it) => s + (it.hpp * it.qty), 0);
            totalHppAll += totalHPP;

            const labaFinal = gross - totalFeeLazada - totalHPP;
            newOrders.push({
              id: `mp-${Date.now()}-${orderId.slice(-6)}`, noPesanan: orderId,
              tanggal: o.tanggal || new Date().toISOString().slice(0, 10),
              marketplaceId: mpObj.id, marketplace: mpObj.marketplace, tokoNama,
              pendapatanKotor: gross,
              pendapatanBersih: labaFinal,
              totalBiaya: totalFeeLazada,
              feeAdmin: o.komisi, feeLayanan: 0, ongkirAktual: o.freeShipping, subsidiOngkir: 0,
              biayaPemrosesan: o.processingFee, premiProteksi: 0, biayaAMS: 0,
              biayaTransaksi: o.biayaTransaksi, komisi: 0,
              items: itemsWithHpp, totalHPP,
              labaKotor: labaFinal,
              catatan: `Upload Lazada ${file.name}`,
            });
          }

          // Save
          try {
            const existing = JSON.parse(localStorage.getItem('mma_marketplace_orders') || '[]');
            localStorage.setItem('mma_marketplace_orders', JSON.stringify([...newOrders, ...existing]));
            const summary = newOrders.map(o => ({
              id: o.id, tanggal: o.tanggal, marketplaceId: o.marketplaceId, marketplaceNama: `${o.marketplace} — ${o.tokoNama}`,
              pendapatanKotor: o.pendapatanKotor, feeMarketplace: o.totalBiaya, biayaIklan: 0, biayaPengemasan: 0,
              biayaPengiriman: o.ongkirAktual, pendapatanBersih: o.pendapatanBersih, biayaProses: o.biayaPemrosesan, totalHPP: o.totalHPP, catatan: o.catatan,
            }));
            const existingOld = JSON.parse(localStorage.getItem('mma_marketplace_income') || '[]');
            localStorage.setItem('mma_marketplace_income', JSON.stringify([...summary, ...existingOld]));
            window.dispatchEvent(new Event('refresh-laporan'));
          } catch { }

          const totalNet = newOrders.reduce((s,o) => s + o.pendapatanBersih, 0);
          const totalKotor = newOrders.reduce((s,o) => s + o.pendapatanKotor, 0);
          const totalFee = newOrders.reduce((s,o) => s + o.totalBiaya, 0);
          setSuccess(true); setErr('');
          alert(`✅ ${newOrders.length} order diupload (${mpObj.marketplace} - Lazada).\n\n📊 Ringkasan:\n💰 Kotor: Rp ${totalKotor.toLocaleString('id-ID')}\n🛒 Fee: Rp ${totalFee.toLocaleString('id-ID')}\n📦 HPP: Rp ${totalHppAll.toLocaleString('id-ID')}\n📈 Profit: Rp ${totalNet.toLocaleString('id-ID')}${unmatchedSku>0?`\n⚠️ ${unmatchedSku} SKU tidak match`:'\n✅ Semua SKU match'}`);
          setTimeout(() => setSuccess(false), 5000);
          setUploading(false);
          if (fileRef.current) fileRef.current.value = '';
          return; // Selesai — jangan lanjut ke parsing Shopee
        }

        // Column indices — deteksi lebih luas termasuk "biaya proses" (1250/paket)
        const iId = h.findIndex(hh => hh === 'id pesanan');
        // ── Deteksi kolom Tanggal: header dulu, fallback ke kolom B (index 1) ──
        let iTanggal = idx('tanggal', 'waktu pesanan dibuat', 'created time', 'waktu dibuat', 'order date');
        if (iTanggal < 0) {
          // Fallback: cek kolom index 1 (kolom B) — apakah isinya mirip tanggal?
          const sample = raw.slice(1, 10).map(r => String(r[1] || '').trim()).filter(Boolean);
          const dateLike = sample.filter(s => /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(s) || /\d{4}-\d{2}-\d{2}/.test(s));
          if (dateLike.length >= sample.length * 0.5) iTanggal = 1;
        }
        const iProduk = h.findIndex(hh => hh === 'produk');
        const iSku = h.findIndex(hh => hh === 'sku');
        const iQty = h.findIndex(hh => hh === 'jumlah');
        // ── Kolom H/I: Total Harga Produk/Jual ──
        const iHargaJual = idx('total harga jual', 'total harga produk', 'total harga', 'harga produk', 'harga jual', 'total harga barang');
        const iPenghasilan = isShopee ? h.findIndex(hh => hh === 'total penghasilan') : idx('total penghasilan', 'total laba', 'penghasilan bersih', 'net income');
        const iLaba = isShopee ? h.findIndex(hh => hh === 'total laba') : -1;
        // ── Total Biaya ──
        const iTotalBiaya = idx('total biaya', 'jumlah biaya', 'total fees', 'total beban', 'jumlah beban');
        // ── Fee columns (M,N,Q,R,S,T,U + others) ──
        const iFeeAdmin = idx('biaya admin', 'admin fee', 'biaya administrasi');
        const iFeeLayanan = idx('biaya layanan', 'service fee', 'biaya pelayanan', 'biaya jasa');
        const iOngkirAktual = idx('ongkir aktual', 'ongkos kirim aktual', 'actual shipping', 'ongkos kirim', 'biaya kirim', 'shipping fee');
        const iSubsidiOngkir = idx('subsidi ongkir', 'subsidi pengiriman', 'shipping subsidy', 'subsidi ongkos kirim');
        const iBiayaPemrosesan = idx('biaya pemrosesan pesanan', 'biaya pemrosesan', 'biaya proses', 'processing fee', 'biaya penanganan', 'handling fee', 'biaya pemroses', 'biaya pack');
        const iPremiProteksi = idx('premi proteksi pengiriman', 'premi proteksi', 'insurance', 'proteksi', 'asuransi');
        const iBiayaAMS = idx('biaya admin ams', 'biaya ams', 'ams fee', 'admin ams');
        const iBiayaTransaksi = idx('biaya transaksi penjual', 'biaya transaksi', 'transaction fee', 'biaya trans');
        const iKomisi = idx('komisi', 'commission', 'biaya komisi');

        if (iPenghasilan < 0) { setErr('Kolom pendapatan tidak ditemukan. Header: ' + h.slice(0, 8).join(', ')); setUploading(false); return; }

        // Kumpulkan data per order (handle multi-SKU)
        const orderMap = new Map<string, { id: string; tanggal: string; totalHargaProduk: number; penghasilan: number; laba: number; totalBiaya: number; feeAdmin: number; feeLayanan: number; ongkirAktual: number; subsidiOngkir: number; biayaPemrosesan: number; premiProteksi: number; biayaAMS: number; biayaTransaksi: number; komisi: number; items: MpOrderItem[] }>();

        for (let i = 1; i < raw.length; i++) {
          const row = raw[i]; if (!row || row.length < 2) continue;
          const orderId = String(row[iId] || '').trim();
          if (!orderId) {
            // Baris ANAK: tambahkan SKU ke order yang sedang diproses
            if (orderMap.size === 0) continue;
            const lastOrder = Array.from(orderMap.values()).pop()!;
            const sku = iSku >= 0 ? String(row[iSku] || '').trim() : '';
            const nama = iProduk >= 0 ? String(row[iProduk] || '').trim() : '';
            const qty = iQty >= 0 ? (parseInt(String(row[iQty] || '0')) || 1) : 1;
            const harga = iHargaJual >= 0 ? parseRp(row[iHargaJual] || '0') : 0;
            if (sku || nama) lastOrder.items.push({ sku, nama, qty, hargaJual: harga, hpp: 0 });
            continue;
          }

          // Baris INDUK — Total Harga Produk hanya dari kolom ini (baris induk)
          const totalHargaProduk = iHargaJual >= 0 ? parseRp(row[iHargaJual] || '0') : 0;
          const penghasilan = parseRp(row[iPenghasilan] || '0');
          const laba = iLaba >= 0 ? parseRp(row[iLaba] || '0') : penghasilan;
          if (penghasilan <= 0 && laba <= 0 && totalHargaProduk <= 0) continue;

          const tanggal = iTanggal >= 0 ? String(row[iTanggal] || '').trim().slice(0, 10) : '';
          const totalBiaya = iTotalBiaya >= 0 ? parseRp(row[iTotalBiaya] || '0') : 0;
          const feeAdmin = iFeeAdmin >= 0 ? parseRp(row[iFeeAdmin] || '0') : 0;
          const feeLayanan = iFeeLayanan >= 0 ? parseRp(row[iFeeLayanan] || '0') : 0;
          const ongkirAktual = iOngkirAktual >= 0 ? parseRp(row[iOngkirAktual] || '0') : 0;
          const subsidiOngkir = iSubsidiOngkir >= 0 ? parseRp(row[iSubsidiOngkir] || '0') : 0;
          const biayaPemrosesan = iBiayaPemrosesan >= 0 ? parseRp(row[iBiayaPemrosesan] || '0') : 0;
          const premiProteksi = iPremiProteksi >= 0 ? parseRp(row[iPremiProteksi] || '0') : 0;
          const biayaAMS = iBiayaAMS >= 0 ? parseRp(row[iBiayaAMS] || '0') : 0;
          const biayaTransaksi = iBiayaTransaksi >= 0 ? parseRp(row[iBiayaTransaksi] || '0') : 0;
          const komisi = iKomisi >= 0 ? parseRp(row[iKomisi] || '0') : 0;

          // SKU baris pertama (INDUK juga bisa punya produk)
          const sku = iSku >= 0 ? String(row[iSku] || '').trim() : '';
          const nama = iProduk >= 0 ? String(row[iProduk] || '').trim() : '';
          const qty = iQty >= 0 ? (parseInt(String(row[iQty] || '0')) || 1) : 1;
          const harga = iHargaJual >= 0 ? parseRp(row[iHargaJual] || '0') : 0;

          orderMap.set(orderId, {
            id: orderId, tanggal, totalHargaProduk,
            penghasilan, laba: laba || penghasilan,
            totalBiaya, feeAdmin, feeLayanan, ongkirAktual, subsidiOngkir,
            biayaPemrosesan, premiProteksi, biayaAMS, biayaTransaksi, komisi,
            items: (sku || nama) ? [{ sku, nama, qty, hargaJual: harga, hpp: 0 }] : [],
          });
        }

        // Konversi ke MpOrder + hitung HPP dari Master SKU
        const skuHppMap = new Map<string, number>();
        let skuMapSize = 0;
        try {
          const skuData = JSON.parse(localStorage.getItem('mma_sku_data') || '[]');
          for (const s of skuData) { if (s.sku && s.hargaBaru > 0) { skuHppMap.set(String(s.sku).trim(), s.hargaBaru); skuMapSize++; } }
        } catch { }

        const newOrders: MpOrder[] = [];
        let totalHppAll = 0, matchedSku = 0, unmatchedSku = 0;
        const unmatchedList: string[] = [];
        for (const [orderId, o] of orderMap) {
          let totalHPP = 0;
          // Per-SKU: attach HPP dari Master Data
          const itemsWithHpp: MpOrderItem[] = o.items.map(item => {
            const cleanSku = String(item.sku).trim();
            const hpp = skuHppMap.get(cleanSku);
            if (hpp !== undefined && hpp > 0) {
              matchedSku++;
              return { ...item, hpp };
            } else if (cleanSku) {
              unmatchedSku++;
              if (!unmatchedList.includes(cleanSku)) unmatchedList.push(cleanSku);
              return { ...item, hpp: 0 };
            }
            return { ...item, hpp: 0 };
          });
          totalHPP = itemsWithHpp.reduce((s, it) => s + (it.hpp * it.qty), 0);
          totalHppAll += totalHPP;

          // ── Kotor = Total Harga Produk dari kolom H/I Excel (baris INDUK, SUDAH total, tidak dikali qty) ──
          const grossRevenue = o.totalHargaProduk || o.penghasilan || 0;
          // ── Total Fee = jumlah SEMUA kolom fee: M+N+Q+R+S+T+U+dll ──
          const totalFeeAll = (o.feeAdmin || 0) + (o.feeLayanan || 0) + (o.komisi || 0)
            + (o.biayaPemrosesan || 0) + (o.biayaTransaksi || 0)
            + (o.ongkirAktual || 0) - (o.subsidiOngkir || 0)
            + (o.premiProteksi || 0) + (o.biayaAMS || 0);
          // Kalau individual fee kosong, fallback ke kolom "Total Biaya"
          const totalBiayaFinal = totalFeeAll > 0 ? totalFeeAll : (o.totalBiaya || 0);
          // ── Laba Bersih = Kotor - Total Fee - HPP (sebelum OPEX) ──
          const labaFinal = grossRevenue - totalBiayaFinal - totalHPP;

          newOrders.push({
            id: `mp-${Date.now()}-${orderId.slice(-6)}`,
            noPesanan: orderId,
            tanggal: o.tanggal || new Date().toISOString().slice(0, 10),
            marketplaceId: mpObj.id,
            marketplace: mpObj.marketplace,
            tokoNama,
            pendapatanKotor: grossRevenue,                        // ← dari kolom H/I Excel (Total Harga Produk)
            pendapatanBersih: labaFinal,                          // ← LABA BERSIH: Kotor - Fee - HPP (sebelum OPEX)
            totalBiaya: totalBiayaFinal,                          // ← TOTAL semua kolom fee (M+N+Q+R+S+T+U...)
            feeAdmin: o.feeAdmin,
            feeLayanan: o.feeLayanan,
            ongkirAktual: o.ongkirAktual,
            subsidiOngkir: o.subsidiOngkir,
            biayaPemrosesan: o.biayaPemrosesan,
            premiProteksi: o.premiProteksi,
            biayaAMS: o.biayaAMS,
            biayaTransaksi: o.biayaTransaksi,
            komisi: o.komisi,
            items: itemsWithHpp,
            totalHPP,
            labaKotor: labaFinal,                                 // ← sama dengan pendapatanBersih
            catatan: `Upload ${file.name}`,
          });
        }

        // Simpan ke localStorage
        try {
          const existing = JSON.parse(localStorage.getItem('mma_marketplace_orders') || '[]');
          localStorage.setItem('mma_marketplace_orders', JSON.stringify([...newOrders, ...existing]));
          // Juga simpan ringkasan untuk kompatibilitas
          const summary = newOrders.map(o => ({
            id: o.id, tanggal: o.tanggal, marketplaceId: o.marketplaceId, marketplaceNama: `${o.marketplace} — ${o.tokoNama}`,
            pendapatanKotor: o.pendapatanKotor, feeMarketplace: o.totalBiaya, biayaIklan: 0, biayaPengemasan: 0,
            biayaPengiriman: o.ongkirAktual, pendapatanBersih: o.pendapatanBersih, biayaProses: o.biayaPemrosesan, totalHPP: o.totalHPP, catatan: o.catatan,
          }));
          const existingOld = JSON.parse(localStorage.getItem('mma_marketplace_income') || '[]');
          localStorage.setItem('mma_marketplace_income', JSON.stringify([...summary, ...existingOld]));
          // ── Trigger refresh Laba Rugi ──
          window.dispatchEvent(new Event('refresh-laporan'));
        } catch { }

        const totalNet = newOrders.reduce((s,o) => s + o.pendapatanBersih, 0);
        const totalKotor = newOrders.reduce((s,o) => s + o.pendapatanKotor, 0);
        const totalFee = newOrders.reduce((s,o) => s + o.totalBiaya, 0);
        setSuccess(true); setErr('');

        // ── Kolom terdeteksi (debug) ──
        const colsFound: string[] = [];
        if (iHargaJual >= 0) colsFound.push('✅ Total Harga Produk');
        else colsFound.push('❌ Total Harga Produk (H/I)');
        if (iPenghasilan >= 0) colsFound.push('✅ Penghasilan');
        else colsFound.push('❌ Penghasilan');
        if (iTotalBiaya >= 0) colsFound.push('✅ Total Biaya');
        const feeCols = [iFeeAdmin, iFeeLayanan, iOngkirAktual, iSubsidiOngkir, iBiayaPemrosesan, iPremiProteksi, iBiayaAMS, iBiayaTransaksi, iKomisi];
        const feeFound = feeCols.filter(c => c >= 0).length;
        colsFound.push(`${feeFound}/${feeCols.length} kolom fee terdeteksi`);

        const hppMsg = totalHppAll > 0
          ? `\n✅ HPP: Rp ${totalHppAll.toLocaleString('id-ID')} (${matchedSku} SKU matched dari ${skuMapSize} di Master)`
          : '\n⚠️ HPP: Rp 0 — tidak ada SKU yang match dengan Master Data!';
        const unmatchedMsg = unmatchedSku > 0
          ? `\n⚠️ ${unmatchedSku} SKU tidak ditemukan di Master: ${unmatchedList.slice(0,5).join(', ')}${unmatchedList.length>5?'...':''}`
          : '';
        alert(`✅ ${newOrders.length} order diupload (${mpObj.marketplace}).\n\n📊 Ringkasan:\n💰 Kotor: Rp ${totalKotor.toLocaleString('id-ID')}\n🛒 Fee: Rp ${totalFee.toLocaleString('id-ID')}\n📦 HPP: Rp ${totalHppAll.toLocaleString('id-ID')}\n📈 Profit: Rp ${totalNet.toLocaleString('id-ID')}\n\n🔍 Kolom Terdeteksi:\n${colsFound.join('\n')}${hppMsg}${unmatchedMsg}`);
        setTimeout(() => setSuccess(false), 5000);
      } catch { setErr('Gagal membaca file. Pastikan format Excel benar.'); }
      setUploading(false);
    };
    r.onerror = () => { setErr('Gagal membaca file.'); setUploading(false); };
    r.readAsArrayBuffer(file);
  };

  const save = () => {
    if (pk <= 0) { setErr('Pendapatan kotor wajib diisi.'); return; }
    setEntries(p => [{ id: `keu-${Date.now()}`, tanggal: form.tanggal, marketplaceId: mp.id, marketplaceNama: mp.nama, pendapatanKotor: pk, feeMarketplace: fee, biayaIklan: +form.biayaIklan || 0, biayaPengemasan: +form.biayaPengemasan || 0, biayaPengiriman: +form.biayaPengiriman || 0, pendapatanBersih: bersih, catatan: form.catatan }, ...p]);
    setForm({ tanggal: new Date().toISOString().slice(0, 10), pendapatanKotor: '', biayaIklan: '', biayaPengemasan: '', biayaPengiriman: '', catatan: '' });
    setErr(''); setSuccess(true);
    // ── Trigger refresh Laba Rugi ──
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('refresh-laporan'));
    setTimeout(() => setSuccess(false), 3000);
  };

  const totalBersih = entries.reduce((s, e) => s + e.pendapatanBersih, 0);

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">💰 Input Data Keuangan</h2>
          <p className="mt-1 text-sm text-slate-500">Input manual atau upload file Excel laporan keuangan marketplace (Shopee, Tokopedia, dll).</p>
        </div>
        {/* ── Reset Data ── */}
        <button
          onClick={() => {
            if (!confirm('⚠️ Hapus SEMUA data Input Keuangan & Riwayat Marketplace?\n\nData yang dihapus: Upload Excel, input manual, riwayat marketplace.\n\nData Master SKU & lainnya TIDAK terpengaruh.')) return;
            localStorage.removeItem('mma_marketplace_orders');
            localStorage.removeItem('mma_marketplace_income');
            localStorage.removeItem('mma_keuangan_manual');
            setEntries([]);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            window.dispatchEvent(new Event('refresh-upload-history'));
            window.dispatchEvent(new Event('storage'));
          }}
          className="rounded-xl bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-200 transition"
        >
          🗑️ Reset Data
        </button>
      </div>

      {/* Upload Excel */}
      <div className="mt-3 rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-4">
        <p className="text-xs font-semibold text-emerald-700 mb-2">📤 Upload File Excel Laporan Marketplace</p>
        <p className="text-[11px] text-slate-500 mb-3">Upload file Penghasilan/Income dari Shopee, Tokopedia, dll. Fee otomatis di-breakdown, HPP auto-match dari Master SKU.</p>
        {/* Pilih Marketplace & Toko */}
        <div className="flex flex-wrap items-end gap-2 mb-3">
          <div>
            <label className="text-[10px] font-semibold text-slate-500">Marketplace</label>
            <select value={uploadMp} onChange={e => { setUploadMp(e.target.value); setUploadToko(''); }}
              className="rounded-lg border bg-white px-2 py-1.5 text-xs text-slate-700">
              {MARKETPLACE_TOKO.map(m => <option key={m.id} value={m.id}>{m.marketplace}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500">Toko</label>
            <select value={uploadToko} onChange={e => setUploadToko(e.target.value)}
              className="rounded-lg border bg-white px-2 py-1.5 text-xs text-slate-700 min-w-[140px]">
              <option value="">— Semua Toko {uploadMpObj?.marketplace || ''} —</option>
              {filteredToko.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)}
            </select>
          </div>
          <label className={`cursor-pointer inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${uploading ? 'bg-slate-400' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
            {uploading ? '⏳ Memproses...' : '📥 Upload Excel'}
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={uploadKeuangan} className="hidden" disabled={uploading} />
          </label>
        </div>
        <p className="text-[10px] text-emerald-600 mt-1">✅ Fee breakdown per order • HPP auto dari Master SKU • Support multi-SKU (baris induk+anak)</p>
      </div>

      {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
      {success && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">✅ Data keuangan tersimpan.</p>}

      {/* Pilih Marketplace */}
      <div className="mt-4 flex flex-wrap gap-2">
        {MARKETPLACE_TOKO.map(m => (
          <button key={m.id} onClick={() => setSelectedMp(m.id)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition border-2 ${selectedMp===m.id?'border-brand-500 bg-brand-50 text-brand-700':'border-slate-200 bg-white text-slate-500 hover:border-brand-300'}`}>
            {m.marketplace} <span className="text-slate-400">(fee {m.persenFee}%)</span>
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="mt-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-slate-700">{mp.marketplace} — {mp.nama.split('—')[1]?.trim() || mp.nama}</p>
        <p className="text-xs text-slate-400">Fee marketplace: {mp.persenFee}% • Auto-hitung</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Tanggal</span><input type="date" value={form.tanggal} onChange={e => setForm({ ...form, tanggal: e.target.value })} className="rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Pendapatan Kotor *</span><input type="number" value={form.pendapatanKotor} onChange={e => setForm({ ...form, pendapatanKotor: e.target.value })} placeholder="Rp" className="rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Biaya Iklan</span><input type="number" value={form.biayaIklan} onChange={e => setForm({ ...form, biayaIklan: e.target.value })} placeholder="Rp" className="rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Biaya Pengemasan</span><input type="number" value={form.biayaPengemasan} onChange={e => setForm({ ...form, biayaPengemasan: e.target.value })} placeholder="Rp" className="rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Biaya Pengiriman</span><input type="number" value={form.biayaPengiriman} onChange={e => setForm({ ...form, biayaPengiriman: e.target.value })} placeholder="Rp" className="rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Catatan</span><input type="text" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} placeholder="Nomor invoice, dll" className="rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /></label>
        </div>

        {/* Ringkasan kalkulasi */}
        {pk > 0 && (
          <div className="mt-4 rounded-xl bg-slate-50 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><span className="text-slate-400">Pendapatan Kotor</span><p className="font-bold text-slate-800">Rp {pk.toLocaleString('id-ID')}</p></div>
            <div><span className="text-slate-400">Fee {mp.persenFee}%</span><p className="font-bold text-red-500">− Rp {fee.toLocaleString('id-ID')}</p></div>
            <div><span className="text-slate-400">Biaya Lain</span><p className="font-bold text-red-500">− Rp {biayaLain.toLocaleString('id-ID')}</p></div>
            <div><span className="text-slate-400">Pendapatan Bersih</span><p className="font-bold text-emerald-600">Rp {bersih.toLocaleString('id-ID')}</p></div>
          </div>
        )}

        <button onClick={save} className="mt-4 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">💾 Simpan</button>
      </div>

      {/* Tabel riwayat keuangan */}
      {entries.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-700">💰 Riwayat Input Keuangan</p>
            <p className="text-sm text-slate-500">Total Bersih: <strong className="text-emerald-600">Rp {totalBersih.toLocaleString('id-ID')}</strong></p>
          </div>
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-brand-50 text-xs uppercase text-brand-500">{['Tgl','Marketplace','Kotor','Fee','Iklan','Kemas','Kirim','Bersih','Catatan'].map(c => <th key={c} className="px-2 py-2 font-semibold whitespace-nowrap">{c}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-50 bg-white">{entries.map(e => (
                <tr key={e.id}>
                  <td className="px-2 py-2 text-xs">{e.tanggal}</td>
                  <td className="px-2 py-2 text-xs font-medium max-w-[120px] truncate">{e.marketplaceNama.split('—')[0]?.trim()}</td>
                  <td className="px-2 py-2">Rp {e.pendapatanKotor.toLocaleString('id-ID')}</td>
                  <td className="px-2 py-2 text-red-500">−{e.feeMarketplace.toLocaleString('id-ID')}</td>
                  <td className="px-2 py-2">{e.biayaIklan>0?`Rp ${e.biayaIklan.toLocaleString('id-ID')}`:'-'}</td>
                  <td className="px-2 py-2">{e.biayaPengemasan>0?`Rp ${e.biayaPengemasan.toLocaleString('id-ID')}`:'-'}</td>
                  <td className="px-2 py-2">{e.biayaPengiriman>0?`Rp ${e.biayaPengiriman.toLocaleString('id-ID')}`:'-'}</td>
                  <td className="px-2 py-2 font-bold text-emerald-600">Rp {e.pendapatanBersih.toLocaleString('id-ID')}</td>
                  <td className="px-2 py-2 text-xs text-slate-400 max-w-[80px] truncate">{e.catatan||'-'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Riwayat Upload Marketplace (detail per order + HPP) */}
      <UploadHistory />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* RIWAYAT ENTRY (gabungan)                                          */
/* ═══════════════════════════════════════════════════════════════════ */
function RiwayatEntry() {
  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📜 Riwayat Entry</h2>
      <p className="mt-1 text-sm text-slate-500">Semua data yang sudah diinput akan muncul di sini setelah disimpan. Riwayat akan terintegrasi antar sesi.</p>
      <div className="mt-6 text-center py-10 text-slate-400">
        <p className="text-4xl mb-2">📜</p>
        <p className="text-sm">Riwayat entry akan ditampilkan di sini.</p>
        <p className="text-xs mt-1">Gunakan tab Input Operasional & Input Keuangan untuk mencatat data baru.</p>
      </div>
    </div>
  );
}

/* ── Upload History: tampilkan detail order marketplace + HPP match ── */
function UploadHistory() {
  const [orders, setOrders] = useState<MpOrder[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAllSku, setShowAllSku] = useState(false);

  useEffect(() => {
    const loadOrders = () => {
      try {
        const stored = localStorage.getItem('mma_marketplace_orders');
        if (stored) setOrders(JSON.parse(stored));
        else setOrders([]);
      } catch { }
    };
    loadOrders();
    window.addEventListener('storage', loadOrders);
    // Juga listen custom refresh event
    window.addEventListener('refresh-upload-history', loadOrders);
    return () => {
      window.removeEventListener('storage', loadOrders);
      window.removeEventListener('refresh-upload-history', loadOrders);
    };
  }, []);

  const toggle = (id: string) => {
    setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  if (orders.length === 0) return null;

  const totalNet = orders.reduce((s, o) => s + o.pendapatanBersih, 0);     // sekarang = Laba/Rugi
  const totalHpp = orders.reduce((s, o) => s + o.totalHPP, 0);
  const totalKotor = orders.reduce((s, o) => s + o.pendapatanKotor, 0);    // GROSS
  const totalFee = orders.reduce((s, o) => s + (o.totalBiaya || 0), 0);   // udah total semua fee
  const totalBiayaProses = orders.reduce((s, o) => s + (o.biayaPemrosesan || 0), 0);

  // Kumpulkan semua SKU unik dengan HPP
  const skuSummary = new Map<string, { nama: string; totalQty: number; totalHpp: number; hppUnit: number; muncul: number }>();
  for (const o of orders) {
    for (const item of o.items) {
      if (!item.sku) continue;
      const key = item.sku;
      const existing = skuSummary.get(key);
      if (existing) {
        existing.totalQty += item.qty;
        existing.totalHpp += (item.hpp || 0) * item.qty;
        existing.muncul++;
      } else {
        skuSummary.set(key, {
          nama: item.nama,
          totalQty: item.qty,
          totalHpp: (item.hpp || 0) * item.qty,
          hppUnit: item.hpp || 0,
          muncul: 1,
        });
      }
    }
  }

  return (
    <div className="mt-5 space-y-4">
      {/* Ringkasan Total */}
      <div className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
        <p className="text-sm font-bold text-slate-700 mb-3">📊 Ringkasan Upload Marketplace</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <p className="text-slate-400">💰 Pendapatan Kotor</p>
            <p className="text-lg font-bold text-slate-700">Rp {totalKotor.toLocaleString('id-ID')}</p>
            <p className="text-[10px] text-slate-400">Gross (tanpa potongan)</p>
          </div>
          <div className="rounded-xl bg-red-50 p-3 text-center">
            <p className="text-red-400">🛒 Total Fee + Biaya</p>
            <p className="text-lg font-bold text-red-600">−Rp {totalFee.toLocaleString('id-ID')}</p>
            <p className="text-[10px] text-red-400">fee MP + biaya proses</p>
          </div>
          <div className="rounded-xl bg-purple-50 p-3 text-center">
            <p className="text-purple-500">📦 Total HPP</p>
            <p className="text-lg font-bold text-purple-600">−Rp {totalHpp.toLocaleString('id-ID')}</p>
            <p className="text-[10px] text-purple-400">harga modal SKU</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-3 text-center">
            <p className="text-amber-500">Biaya Proses</p>
            <p className="text-lg font-bold text-amber-600">−Rp {totalBiayaProses.toLocaleString('id-ID')}</p>
            <p className="text-[10px] text-amber-400">per paket</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-3 text-center">
            <p className="text-blue-500">Pendapatan Bersih</p>
            <p className="text-lg font-bold text-blue-600">Rp {(totalKotor - totalFee).toLocaleString('id-ID')}</p>
            <p className="text-[10px] text-blue-400">Kotor − Fee</p>
          </div>
          <div className={`rounded-xl p-3 text-center ${totalNet >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <p className={totalNet >= 0 ? 'text-emerald-500' : 'text-red-500'}>📊 Laba / Rugi</p>
            <p className={`text-lg font-bold ${totalNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              Rp {totalNet.toLocaleString('id-ID')}
            </p>
            <p className={`text-[10px] ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>Kotor − Fee − HPP</p>
          </div>
        </div>
      </div>

      {/* Tabel Utama */}
      <div className="rounded-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="bg-brand-50 text-[10px] uppercase text-brand-500">
              {['No. Pesanan','Tgl','MP','Kotor','Fee','B.Proses','HPP','Laba/Rugi','SKU'].map(c => <th key={c} className="px-2 py-2 font-semibold whitespace-nowrap">{c}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {orders.slice(0, 100).map(o => {
                const grossMargin = o.pendapatanKotor - o.totalHPP;  // margin kotor per SKU (sebelum fee)
                const isOpen = expanded.has(o.id);
                return (
                  <React.Fragment key={o.id}>
                    <tr className={`cursor-pointer hover:bg-brand-50/30 transition ${isOpen?'bg-brand-50/60':''}`} onClick={() => toggle(o.id)}>
                      <td className="px-2 py-2 font-mono text-[10px] text-slate-600 max-w-[100px] truncate">{o.noPesanan}</td>
                      <td className="px-2 py-2 text-[10px] whitespace-nowrap">{o.tanggal}</td>
                      <td className="px-2 py-2 font-medium text-[10px]">{o.marketplace}</td>
                      <td className="px-2 py-2 text-[10px]">Rp {o.pendapatanKotor.toLocaleString('id-ID')}</td>
                      <td className="px-2 py-2 text-[10px] text-red-500">−{o.totalBiaya.toLocaleString('id-ID')}</td>
                      <td className="px-2 py-2 text-[10px] text-amber-600">{o.biayaPemrosesan > 0 ? `−${o.biayaPemrosesan.toLocaleString('id-ID')}` : '-'}</td>
                      <td className="px-2 py-2 text-[10px] text-purple-600">{o.totalHPP>0?`Rp ${o.totalHPP.toLocaleString('id-ID')}`:'⚠️ 0'}</td>
                      <td className="px-2 py-2 text-[10px] font-bold" style={{color: o.pendapatanBersih>=0?'#059669':'#dc2626'}}>Rp {o.pendapatanBersih.toLocaleString('id-ID')}</td>
                      <td className="px-2 py-2 text-[10px] text-brand-500 font-semibold">{o.items.length} SKU {isOpen?'▲':'▼'}</td>
                    </tr>
                    {/* ── EXPANDED DETAIL ROW ── */}
                    {isOpen && (
                      <tr key={`det-${o.id}`}>
                        <td colSpan={10} className="px-4 py-3 bg-slate-50/70 border-t border-slate-100">
                          {/* Fee Breakdown */}
                          <div className="mb-3">
                            <p className="text-[11px] font-bold text-slate-600 mb-2">💰 Rincian Biaya (per ORDER — paket):</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 text-[10px]">
                              {o.feeAdmin > 0 && <div className="rounded-lg bg-white px-2 py-1.5 border border-slate-100"><span className="text-slate-400">Fee Admin</span><p className="font-semibold text-red-500">−Rp {o.feeAdmin.toLocaleString('id-ID')}</p></div>}
                              {o.feeLayanan > 0 && <div className="rounded-lg bg-white px-2 py-1.5 border border-slate-100"><span className="text-slate-400">Fee Layanan</span><p className="font-semibold text-red-500">−Rp {o.feeLayanan.toLocaleString('id-ID')}</p></div>}
                              {o.komisi > 0 && <div className="rounded-lg bg-white px-2 py-1.5 border border-slate-100"><span className="text-slate-400">Komisi</span><p className="font-semibold text-red-500">−Rp {o.komisi.toLocaleString('id-ID')}</p></div>}
                              {o.biayaPemrosesan > 0 && <div className="rounded-lg bg-amber-50 px-2 py-1.5 border border-amber-100"><span className="text-amber-600">Biaya Proses (1250/paket)</span><p className="font-semibold text-amber-700">−Rp {o.biayaPemrosesan.toLocaleString('id-ID')}</p></div>}
                              {o.biayaTransaksi > 0 && <div className="rounded-lg bg-white px-2 py-1.5 border border-slate-100"><span className="text-slate-400">Biaya Transaksi</span><p className="font-semibold text-red-500">−Rp {o.biayaTransaksi.toLocaleString('id-ID')}</p></div>}
                              {o.ongkirAktual > 0 && <div className="rounded-lg bg-white px-2 py-1.5 border border-slate-100"><span className="text-slate-400">Ongkir Aktual</span><p className="font-semibold text-red-500">−Rp {o.ongkirAktual.toLocaleString('id-ID')}</p></div>}
                              {o.subsidiOngkir > 0 && <div className="rounded-lg bg-white px-2 py-1.5 border border-slate-100"><span className="text-slate-400">Subsidi Ongkir</span><p className="font-semibold text-emerald-500">+Rp {o.subsidiOngkir.toLocaleString('id-ID')}</p></div>}
                              {o.premiProteksi > 0 && <div className="rounded-lg bg-white px-2 py-1.5 border border-slate-100"><span className="text-slate-400">Premi Proteksi</span><p className="font-semibold text-red-500">−Rp {o.premiProteksi.toLocaleString('id-ID')}</p></div>}
                              {o.biayaAMS > 0 && <div className="rounded-lg bg-white px-2 py-1.5 border border-slate-100"><span className="text-slate-400">Biaya AMS</span><p className="font-semibold text-red-500">−Rp {o.biayaAMS.toLocaleString('id-ID')}</p></div>}
                            </div>
                            {/* Total verifikasi */}
                            <div className="mt-2 rounded-lg bg-slate-100 px-3 py-1.5 flex items-center justify-between text-[10px]">
                              <span className="text-slate-500">Total Biaya Terhitung:</span>
                              <span className="font-bold text-slate-700">
                                Rp {(o.feeAdmin + o.feeLayanan + o.komisi + o.biayaPemrosesan + o.biayaTransaksi + o.ongkirAktual - o.subsidiOngkir + o.premiProteksi + o.biayaAMS).toLocaleString('id-ID')}
                                {Math.abs(o.totalBiaya - (o.feeAdmin + o.feeLayanan + o.komisi + o.biayaPemrosesan + o.biayaTransaksi + o.ongkirAktual - o.subsidiOngkir + o.premiProteksi + o.biayaAMS)) > 100 &&
                                  <span className="text-amber-500 ml-1">(Excel: Rp {o.totalBiaya.toLocaleString('id-ID')})</span>
                                }
                              </span>
                            </div>
                          </div>

                          {/* SKU Detail dengan HPP */}
                          <div>
                            <p className="text-[11px] font-bold text-slate-600 mb-2">📦 Detail SKU & HPP (dari Master Data):</p>
                            <div className="overflow-x-auto rounded-lg border border-slate-100">
                              <table className="w-full text-[10px]">
                                <thead><tr className="bg-slate-100 text-slate-500">
                                  <th className="px-2 py-1.5 text-left font-semibold">SKU</th>
                                  <th className="px-2 py-1.5 text-left font-semibold">Nama Produk</th>
                                  <th className="px-2 py-1.5 text-center font-semibold">Qty</th>
                                  <th className="px-2 py-1.5 text-right font-semibold">Harga Jual</th>
                                  <th className="px-2 py-1.5 text-right font-semibold">HPP/Unit</th>
                                  <th className="px-2 py-1.5 text-right font-semibold">Subtotal HPP</th>
                                  <th className="px-2 py-1.5 text-right font-semibold">Laba/SKU</th>
                                </tr></thead>
                                <tbody className="divide-y divide-slate-50">
                                  {o.items.map((item, idx) => {
                                    const subtotalHpp = (item.hpp || 0) * item.qty;
                                    const revenueItem = item.hargaJual; // ← sudah total dari Excel, tidak dikali qty
                                    const labaItem = revenueItem - subtotalHpp;
                                    return (
                                      <tr key={idx} className="hover:bg-white">
                                        <td className="px-2 py-1.5 font-mono text-brand-700">{item.sku || '-'}</td>
                                        <td className="px-2 py-1.5 text-slate-600 max-w-[150px] truncate">{item.nama || '-'}</td>
                                        <td className="px-2 py-1.5 text-center">{item.qty}</td>
                                        <td className="px-2 py-1.5 text-right">Rp {item.hargaJual.toLocaleString('id-ID')}</td>
                                        <td className={`px-2 py-1.5 text-right font-semibold ${item.hpp > 0 ? 'text-purple-600' : 'text-red-400'}`}>
                                          {item.hpp > 0 ? `Rp ${item.hpp.toLocaleString('id-ID')}` : '⚠ Tdk ada'}
                                        </td>
                                        <td className="px-2 py-1.5 text-right text-purple-600">Rp {subtotalHpp.toLocaleString('id-ID')}</td>
                                        <td className={`px-2 py-1.5 text-right font-bold ${labaItem >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                          Rp {labaItem.toLocaleString('id-ID')}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot><tr className="bg-slate-50 font-semibold">
                                  <td colSpan={3} className="px-2 py-2 text-slate-500">TOTAL</td>
                                  <td className="px-2 py-2 text-right">Rp {o.items.reduce((s,i)=>s + i.hargaJual,0).toLocaleString('id-ID')}</td>
                                  <td className="px-2 py-2"></td>
                                  <td className="px-2 py-2 text-right text-purple-600">Rp {o.totalHPP.toLocaleString('id-ID')}</td>
                                  <td className={`px-2 py-2 text-right ${grossMargin>=0?'text-emerald-600':'text-red-500'}`}>Rp {grossMargin.toLocaleString('id-ID')}</td>
                                </tr></tfoot>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ringkasan Semua SKU */}
      {skuSummary.size > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-slate-700">🔍 Ringkasan Semua SKU & HPP</p>
            <button onClick={() => setShowAllSku(!showAllSku)} className="text-xs text-brand-500 font-semibold">
              {showAllSku ? 'Sembunyikan' : `Lihat Semua (${skuSummary.size} SKU)`}
            </button>
          </div>
          {showAllSku && (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-[10px]">
                <thead><tr className="bg-slate-100 text-slate-500">
                  <th className="px-2 py-1.5 text-left font-semibold">SKU</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Nama</th>
                  <th className="px-2 py-1.5 text-center font-semibold">Total Qty</th>
                  <th className="px-2 py-1.5 text-right font-semibold">HPP/Unit</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Total HPP</th>
                  <th className="px-2 py-1.5 text-center font-semibold">Muncul</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {Array.from(skuSummary.entries()).sort((a,b) => b[1].totalHpp - a[1].totalHpp).map(([sku, info]) => (
                    <tr key={sku} className="hover:bg-white">
                      <td className="px-2 py-1.5 font-mono text-brand-700">{sku}</td>
                      <td className="px-2 py-1.5 text-slate-600 max-w-[200px] truncate">{info.nama}</td>
                      <td className="px-2 py-1.5 text-center">{info.totalQty}</td>
                      <td className={`px-2 py-1.5 text-right font-semibold ${info.hppUnit > 0 ? 'text-purple-600' : 'text-red-400'}`}>
                        {info.hppUnit > 0 ? `Rp ${info.hppUnit.toLocaleString('id-ID')}` : '⚠ Tdk ada'}
                      </td>
                      <td className="px-2 py-1.5 text-right text-purple-600">Rp {info.totalHpp.toLocaleString('id-ID')}</td>
                      <td className="px-2 py-1.5 text-center text-slate-400">{info.muncul}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {orders.length > 100 && <p className="text-xs text-slate-400 text-center">Menampilkan 100 dari {orders.length} order</p>}
    </div>
  );
}
