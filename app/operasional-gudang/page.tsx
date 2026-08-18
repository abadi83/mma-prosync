'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useAgregasi, type AgregasiRow } from '@/app/context/AgregasiContext';
import { useSkus } from '@/app/context/SkuContext';

type Tab = 'agregasi' | 'picking' | 'qc' | 'packing' | 'runner' | 'logistik' | 'belanja';

const TABS = [
  { key: 'agregasi' as const, label: 'Dashboard', icon: '📊' },
  { key: 'picking' as const, label: 'Picking', icon: '📋' },
  { key: 'qc' as const, label: 'QC', icon: '🔍' },
  { key: 'packing' as const, label: 'Packing', icon: '📦' },
  { key: 'runner' as const, label: 'Runner Scan', icon: '📱' },
  { key: 'logistik' as const, label: 'Logistik', icon: '🚛' },
  { key: 'belanja' as const, label: 'Harus Belanja', icon: '🛒' },
];

/* ── Parse Rupiah ── */
function parseRp(val: string): number {
  const s=String(val??'').trim();if(!s)return 0;
  if(/\.\d{2}$/.test(s)&&!s.includes(','))return +s.replace(/\.\d{2}$/,'')||0;
  if(s.includes(',')&&!s.includes('.'))return +s.replace(/\./g,'').replace(',','.')||0;
  if(s.includes(',')&&s.includes('.'))return +s.replace(/\./g,'').replace(',','.')||0;
  return +s.replace(/\./g,'')||0;
}

interface GroupedOrder { noPesanan:string;noResi:string;marketplace:string;namaToko:string;statusPesanan:string;sla:string;kurir:string;dibuat:string;items:{sku:string;namaProduk:string;qty:number;harga:number}[];total:number; }

/* ── Helper: deteksi SKU pesanan yang KOSONG / TIDAK ADA di Inventory ── */
export interface BelanjaItem {
  sku: string;
  namaProduk: string;
  qty: number;
  reason: 'not-found' | 'stok-kosong';
}

export interface BelanjaOrder {
  key: string;
  noPesanan: string;
  noResi: string;
  marketplace: string;
  namaToko: string;
  statusPesanan: string;
  statusProses?: string;
  items: BelanjaItem[];
}

/** SKU tidak ada di inventory → 'not-found'; ada tapi stok 0 → 'stok-kosong'; selain itu null */
export function skuInventoryStatus(sku: string, inv: Map<string, number>): 'not-found' | 'stok-kosong' | null {
  const s = sku.trim().toLowerCase();
  if (!s) return null;
  const stok = inv.get(s);
  if (stok === undefined) return 'not-found';
  if (stok <= 0) return 'stok-kosong';
  return null;
}

/** Pesanan yang punya SKU kosong / tidak terdaftar di Inventory → Harus Belanja */
export function computeBelanjaOrders(allRows: AgregasiRow[], skus: { sku: string; stok: number }[]): BelanjaOrder[] {
  const inv = new Map<string, number>();
  for (const s of skus) inv.set(s.sku.toLowerCase(), s.stok);
  const map = new Map<string, BelanjaOrder>();
  for (const r of allRows) {
    // Skip pesanan yang dibatalkan — gak perlu belanja
    if (r.statusProses === 'Dibatalkan') continue;
    if (/dibatalkan|cancelled|batal/i.test(r.statusPesanan)) continue;
    const status = skuInventoryStatus(r.sku, inv);
    if (!status) continue;
    const key = `${r.noPesanan}||${r.noResi}`;
    if (!map.has(key)) map.set(key, { key, noPesanan: r.noPesanan, noResi: r.noResi, marketplace: r.marketplace, namaToko: r.namaToko, statusPesanan: r.statusPesanan, statusProses: r.statusProses, items: [] });
    const bo = map.get(key)!;
    if (!bo.items.some(i => i.sku === r.sku)) {
      bo.items.push({ sku: r.sku, namaProduk: r.namaProduk, qty: r.kuantity, reason: status });
    }
  }
  return Array.from(map.values());
}

export default function OperasionalGudangPage() {
  const [tab, setTab] = useState<Tab>('agregasi');
  const { allRows } = useAgregasi();
  const { skus } = useSkus();
  const belanjaCount = useMemo(() => computeBelanjaOrders(allRows, skus).length, [allRows, skus]);
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-3xl bg-gradient-to-br from-brand-700 via-brand-500 to-brand-300 p-5 text-white shadow-lg sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-100 sm:text-sm">Warehouse</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Operasional Gudang</h1>
        <p className="mt-1 text-sm text-brand-100 sm:text-base">Dashboard agregasi pesanan, picking, QC, packing, runner scanner & logistik.</p>
      </header>
      <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm" role="tablist">
        {TABS.map(t=>(<button key={t.key} role="tab" aria-selected={tab===t.key} onClick={()=>setTab(t.key)} className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:px-5 sm:text-sm ${tab===t.key?'bg-brand-500 text-white shadow':t.key==='belanja'&&belanjaCount>0?'bg-red-50 text-red-600 hover:bg-red-100':'text-slate-600 hover:bg-brand-50 hover:text-brand-700'}`}><span className="text-base sm:text-lg">{t.icon}</span><span className="hidden sm:inline">{t.label}</span>{t.key==='belanja'&&belanjaCount>0&&<span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab===t.key?'bg-white text-red-600':'bg-red-500 text-white'}`}>{belanjaCount}</span>}</button>))}
      </nav>
      <section className="card-blue">
        {tab==='agregasi' && <AgregasiDashboard />}
        {tab==='picking' && <PickingList />}
        {tab==='qc' && <QCList />}
        {tab==='packing' && <PackingList />}
        {tab==='runner' && <RunnerScan />}
        {tab==='logistik' && <LogistikTab />}
        {tab==='belanja' && <HarusBelanjaTab />}
      </section>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* AGREGASI DASHBOARD                                                */
/* ═══════════════════════════════════════════════════════════════════ */
function AgregasiDashboard() {
  const { allRows, addRows, updateStatusPicking, clearRows } = useAgregasi();
  const { skus } = useSkus();
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const [filterMp, setFilterMp] = useState('semua');
  const [filterStatus, setFilterStatus] = useState('semua');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const pickingRef = useRef<HTMLInputElement>(null);
  const toggle=(k:string)=>setExpanded(p=>{const n=new Set(p);n.has(k)?n.delete(k):n.add(k);return n;});

  /* Inventory map + pesanan yang harus belanja */
  const invMap = useMemo(() => { const m = new Map<string, number>(); for (const s of skus) m.set(s.sku.toLowerCase(), s.stok); return m; }, [skus]);
  const belanjaOrders = useMemo(() => computeBelanjaOrders(allRows, skus), [allRows, skus]);
  const belanjaSet = useMemo(() => new Set(belanjaOrders.map(o => o.key)), [belanjaOrders]);

  const upload=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];if(!file)return;
    setUploading(true);setErr('');
    const r=new FileReader();
    r.onload=ev=>{
      try{
        const data=new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb=XLSX.read(data,{type:'array'});
        const sheet=wb.Sheets[wb.SheetNames[0]];
        const raw=XLSX.utils.sheet_to_json<string[]>(sheet,{header:1});
        if(raw.length<2){setErr('File kosong.');setUploading(false);return;}
        const h=raw[0].map((c:string)=>String(c).toLowerCase().trim());
        const isAgregasi=h[0]==='marketplace'&&h[1]==='nama toko';

        const items:AgregasiRow[]=[];
        if(isAgregasi){
          for(let i=1;i<raw.length;i++){
            const r=raw[i];if(!r||!r[2])continue;
            items.push({id:`ag-${i}`,marketplace:String(r[0]??'').trim(),namaToko:String(r[1]??'').trim(),noPesanan:String(r[2]??'').trim(),noResi:String(r[3]??'').trim(),sku:String(r[4]??'').trim(),namaProduk:String(r[5]??'').trim(),hargaJual:parseRp(r[6]),kuantity:+String(r[7]??'1')||1,kurir:String(r[8]??'').trim(),statusPesanan:String(r[9]??'').trim(),dibuat:String(r[10]??'').trim(),sla:String(r[11]??'').trim()});
          }
        }else{
          const idx=(...kw:string[])=>h.findIndex(hh=>kw.some(k=>hh.includes(k)));
          const iNo=idx('no. pesanan','order id','ordernumber','order_number','order number','order_no','no pesanan');
          const iSku=idx('seller sku','sellersku','nomor referensi sku');
          const iHarga=idx('unitprice','harga awal','sku unit original price');
          const iKurir=idx('shippingproviderfm','opsi pengiriman','shipping provider');
          const iWaktu=idx('createtime','created time','waktu pesanan dibuat');
          const iResi=idx('trackingcode','no. resi','tracking id','tracking_code','tracking code','tracking_number','tracking number');
          const iNama=idx('itemname','nama produk','product name');
          const iQty=idx('quantity','jumlah');
          const iStatus=idx('status','status pesanan','order status');
          const iSla=idx('ttssla','rtssla','harus dikirimkan sebelum');
          if(iNo<0||iNama<0){setErr('Format tidak dikenali. Cek header: '+h.slice(0,10).join(', '));setUploading(false);return;}
          const sn=wb.SheetNames[0].toLowerCase();
          let mp='Marketplace';if(sn.includes('shopee')||h.some(x=>x.includes('no. pesanan')))mp='Shopee';else if(sn.includes('tiktok')||h.some(x=>x.includes('order id')))mp='TikTok Shop';else if(sn.includes('lazada')||h.some(x=>x.includes('ordernumber')))mp='Lazada';
          for(let i=1;i<raw.length;i++){
            const r=raw[i];if(!r||!r[iNo])continue;
            if(/^platform unique|^current order|^the filed|^platform sku|^seller sku input|^platform product/i.test(String(r[iNo])))continue;
            items.push({id:`rw-${i}`,marketplace:mp,namaToko:'',noPesanan:String(r[iNo]??'').trim(),noResi:iResi>=0?String(r[iResi]??'').trim():'',sku:iSku>=0?String(r[iSku]??'').trim():'',namaProduk:String(r[iNama]??'').trim(),hargaJual:iHarga>=0?parseRp(r[iHarga]):0,kuantity:iQty>=0?(+String(r[iQty]??'1')||1):1,kurir:iKurir>=0?String(r[iKurir]??'').trim():'',statusPesanan:iStatus>=0?String(r[iStatus]??'').trim():'',dibuat:iWaktu>=0?String(r[iWaktu]??'').trim():'',sla:iSla>=0?String(r[iSla]??'').trim():''});
          }
        }
        if(items.length===0){setErr('Tidak ada data valid.');setUploading(false);return;}
        addRows(items);setErr('');
        alert(`✅ ${items.length} baris berhasil diimpor.`);
      }catch{setErr('Gagal membaca file.');}
      setUploading(false);
    };
    r.onerror=()=>{setErr('Gagal membaca file.');setUploading(false);};
    r.readAsArrayBuffer(file);
  };

  /* ── Upload Picking (tracking_number + order_sn) → update status ── */
  const uploadPicking=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];if(!file)return;
    setUploading(true);setErr('');
    const r=new FileReader();
    r.onload=ev=>{
      try{
        const data=new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb=XLSX.read(data,{type:'array'});
        const sheet=wb.Sheets[wb.SheetNames[0]];
        const raw=XLSX.utils.sheet_to_json<string[]>(sheet,{header:1});
        if(raw.length<2){setErr('File picking kosong.');setUploading(false);return;}
        const h=raw[0].map((c:string)=>String(c).toLowerCase().trim());
        const idx=(...kw:string[])=>h.findIndex(hh=>kw.some(k=>hh.includes(k)));
        const iResi=idx('tracking_number','tracking number','tracking id','tracking_id','trackingcode','tracking_code','tracking code','no. resi','no resi','resi','nomor resi');
        const iOrder=idx('order_sn','order sn','order_id','order id','ordernumber','order_number','order number','order_no','no. pesanan','no pesanan','nomor pesanan','package id','package_id');
        if(iResi<0||iOrder<0){setErr('File picking harus punya kolom tracking & order ID. Cek header: '+h.slice(0,10).join(', '));setUploading(false);return;}

        const matches:{noPesanan:string;noResi:string}[]=[];
        for(let i=1;i<raw.length;i++){
          const row=raw[i];if(!row||!row[iResi]||!row[iOrder])continue;
          matches.push({noPesanan:String(row[iOrder]).trim(),noResi:String(row[iResi]).trim()});
        }
        const result=updateStatusPicking(matches);
        setErr('');
        // Cek SKU pesanan yang terpengaruh vs Inventory
        const opSet = new Set(matches.map(m => m.noPesanan.trim()).filter(Boolean));
        const orSet = new Set(matches.map(m => m.noResi.trim()).filter(Boolean));
        const affected = allRows.filter(r => opSet.has(r.noPesanan) || (r.noResi && orSet.has(r.noResi)));
        const belanja = computeBelanjaOrders(affected, skus);
        alert(`📦 Picking selesai: ${result.updated} pesanan diupdate ke "Dipicking". ${result.notFound>0?result.notFound+' tidak ditemukan di dashboard. ':''}${belanja.length>0?`⚠️ ${belanja.length} pesanan punya SKU kosong/tidak ada di Inventory — cek tab 🛒 Harus Belanja.`:''}`);
      }catch{setErr('Gagal membaca file picking.');}
      setUploading(false);
    };
    r.onerror=()=>{setErr('Gagal membaca file.');setUploading(false);};
    r.readAsArrayBuffer(file);
  };

  /* ── Grouping ── */
  const grouped:GroupedOrder[]=[];
  const map=new Map<string,GroupedOrder>();
  for(const o of allRows){
    const k=`${o.noPesanan}||${o.noResi}`;
    if(!map.has(k))map.set(k,{noPesanan:o.noPesanan,noResi:o.noResi,marketplace:o.marketplace,namaToko:o.namaToko,statusPesanan:o.statusPesanan,sla:o.sla,kurir:o.kurir,dibuat:o.dibuat,items:[],total:0});
    const g=map.get(k)!;
    g.items.push({sku:o.sku,namaProduk:o.namaProduk,qty:o.kuantity,harga:o.hargaJual});
    g.total+=o.hargaJual*o.kuantity||o.hargaJual;
  }
  map.forEach(v=>grouped.push(v));

  /* ── Filter ── */
  const marketplaces=['semua',...Array.from(new Set(allRows.map(r=>r.marketplace)))];
  const statuses=['semua',...Array.from(new Set(allRows.map(r=>r.statusPesanan)))];
  let f=filterMp==='semua'?grouped:grouped.filter(g=>g.marketplace===filterMp);
  f=filterStatus==='semua'?f:f.filter(g=>g.statusPesanan===filterStatus);

  /* ── Stats ── */
  const totalOrder=grouped.length;
  const totalItem=allRows.reduce((s,r)=>s+r.kuantity,0);
  const totalPendapatan=grouped.reduce((s,g)=>s+g.total,0);
  const perluDikirim=grouped.filter(g=>g.statusPesanan==='Perlu Dikirim'||g.statusPesanan==='shipped'||g.statusPesanan==='Dikirim').length;
  const dipicking=allRows.filter(r=>r.statusProses==='Dipicking').length;
  const diQC=allRows.filter(r=>r.statusProses==='DiQC').length;
  const totalDiproses=allRows.filter(r=>r.statusProses&&r.statusProses!=='Perlu Dikirim').length;
  const now=new Date();
  const slaUrgent=grouped.filter(g=>{const d=new Date(g.sla);return!isNaN(d.getTime())&&(d.getTime()-now.getTime())<24*60*60*1000&&(g.statusPesanan==='Perlu Dikirim'||g.statusPesanan==='shipped');}).length;

  const mpBreakdown=new Map<string,{orders:number;items:number;revenue:number}>();
  for(const g of grouped){const e=mpBreakdown.get(g.marketplace)||{orders:0,items:0,revenue:0};e.orders++;e.items+=g.items.reduce((s,i)=>s+i.qty,0);e.revenue+=g.total;mpBreakdown.set(g.marketplace,e);}

  const MP_COLORS:Record<string,string>={Shopee:'from-orange-400 to-orange-500','TikTok Shop':'from-slate-600 to-slate-700',Lazada:'from-blue-400 to-blue-600',Tokopedia:'from-emerald-400 to-emerald-600'};

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold text-slate-800 sm:text-xl">📊 Dashboard Agregasi Pesanan</h2><p className="mt-1 text-sm text-slate-500">Upload order & picking → status otomatis terupdate.</p></div>
        <div className="flex gap-2">
          <label className={`cursor-pointer rounded-xl px-3 py-1.5 text-sm font-semibold text-white transition ${uploading?'bg-slate-400':'bg-emerald-500 hover:bg-emerald-600'}`}>{uploading?'⏳':'📦 Upload Picking'}<input ref={pickingRef} type="file" accept=".xlsx,.xls" onChange={uploadPicking} className="hidden" disabled={uploading} /></label>
          <label className={`cursor-pointer rounded-xl px-3 py-1.5 text-sm font-semibold text-white transition ${uploading?'bg-slate-400':'bg-brand-500 hover:bg-brand-700'}`}>{uploading?'⏳':'📥 Upload Order'}<input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={upload} className="hidden" disabled={uploading} /></label>
          <button onClick={() => { if (confirm('⚠️ Hapus SEMUA data agregasi? Data tidak bisa dikembalikan.')) { clearRows(); alert('✅ Data agregasi direset.'); } }} className="rounded-xl px-3 py-1.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition">🗑 Reset</button>
        </div>
      </div>
      {err&&<p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}

      {allRows.length>0&&(<>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-brand-50 p-3 text-center"><p className="text-2xl font-bold text-brand-700">{totalOrder}</p><p className="text-xs text-brand-500">Pesanan</p></div>
          <div className="rounded-xl bg-purple-50 p-3 text-center"><p className="text-2xl font-bold text-purple-600">{totalItem}</p><p className="text-xs text-purple-500">Item</p></div>
          <div className="rounded-xl bg-amber-50 p-3 text-center"><p className="text-2xl font-bold text-amber-600">{perluDikirim}</p><p className="text-xs text-amber-500">Perlu Dikirim</p></div>
          <div className="rounded-xl bg-blue-50 p-3 text-center"><p className="text-2xl font-bold text-blue-600">{dipicking}</p><p className="text-xs text-blue-500">📋 Picking</p></div>
          <div className="rounded-xl bg-amber-50 p-3 text-center"><p className="text-2xl font-bold text-amber-600">{diQC}</p><p className="text-xs text-amber-500">🔍 QC</p></div>
          <div className={`rounded-xl p-3 text-center ${slaUrgent>0?'bg-red-50':'bg-emerald-50'}`}><p className={`text-2xl font-bold ${slaUrgent>0?'text-red-600':'text-emerald-600'}`}>{slaUrgent}</p><p className="text-xs text-slate-500">⚠ Deadline {'<'}24j</p></div>
          <div className="rounded-xl bg-blue-50 p-3 text-center"><p className="text-2xl font-bold text-blue-600">Rp {(totalPendapatan/1000).toFixed(0)}k</p><p className="text-xs text-blue-500">Pendapatan</p></div>
          <div className={`rounded-xl p-3 text-center ${belanjaOrders.length>0?'bg-red-50':'bg-emerald-50'}`}><p className={`text-2xl font-bold ${belanjaOrders.length>0?'text-red-600':'text-emerald-600'}`}>{belanjaOrders.length}</p><p className="text-xs text-slate-500">🛒 Harus Belanja</p></div>
        </div>

        {/* Progress packing bar */}
        {totalOrder>0&&<div className="mt-2"><div className="flex justify-between text-xs text-slate-400 mb-1"><span>Progress Gudang</span><span>{totalDiproses}/{totalOrder} diproses</span></div><div className="h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{width:`${totalOrder>0?(totalDiproses/totalOrder)*100:0}%`}} /></div></div>}

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from(mpBreakdown.entries()).map(([mp,data])=>(<div key={mp} className={`rounded-xl bg-gradient-to-br ${MP_COLORS[mp]||'from-slate-400 to-slate-500'} p-4 text-white shadow-sm`}><p className="text-xs font-semibold uppercase tracking-wide opacity-80">{mp}</p><p className="mt-2 text-2xl font-bold">{data.orders}<span className="text-sm font-normal ml-1">orders</span></p><p className="text-xs mt-1 opacity-80">{data.items} item • Rp {(data.revenue/1000).toFixed(0)}k</p></div>))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <select value={filterMp} onChange={e=>setFilterMp(e.target.value)} className="rounded-xl border bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">{marketplaces.map(m=><option key={m} value={m}>{m==='semua'?'🛒 Semua Marketplace':m}</option>)}</select>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="rounded-xl border bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">{statuses.map(s=><option key={s} value={s}>{s==='semua'?'📋 Semua Status':s}</option>)}</select>
          <span className="text-xs text-slate-400 self-center ml-auto">{f.length} pesanan ditampilkan</span>
        </div>

        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead><tr className="bg-brand-50 text-xs uppercase text-brand-500">{['MP / Toko','No. Pesanan','Resi','Item','Total','Kurir','SLA','Status','Gudang'].map(c=><th key={c} className="px-2 py-3 font-semibold whitespace-nowrap">{c}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {f.map(g=>{const k=`${g.noPesanan}||${g.noResi}`;const isExp=expanded.has(k);const urgent=(()=>{const d=new Date(g.sla);return!isNaN(d.getTime())&&(d.getTime()-Date.now())<24*60*60*1000&&(g.statusPesanan==='Perlu Dikirim'||g.statusPesanan==='shipped');})();
                const sp=allRows.find(r=>r.noPesanan===g.noPesanan&&r.noResi===g.noResi)?.statusProses;
                const statusGdg=sp==='Dipicking'?<span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">📋 Picking</span>:sp==='DiQC'?<span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">🔍 QC</span>:sp==='Dipacking'?<span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">📦 Packing</span>:sp==='Dikirim'?<span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">🚚 Dikirim</span>:<span className="text-[10px] text-slate-300">-</span>;
                return(<React.Fragment key={k}>
                  <tr className={`cursor-pointer transition ${urgent?'bg-red-50/40':'hover:bg-brand-50/30'}`} onClick={()=>toggle(k)}>
                    <td className="px-2 py-2.5"><div className="flex flex-col"><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold w-fit ${g.marketplace==='Shopee'?'bg-orange-100 text-orange-700':g.marketplace==='TikTok Shop'?'bg-slate-200 text-slate-700':g.marketplace==='Lazada'?'bg-blue-100 text-blue-700':'bg-slate-100 text-slate-600'}`}>{g.marketplace}</span>{g.namaToko&&<span className="text-[9px] text-slate-400 mt-0.5 truncate max-w-[80px]" title={g.namaToko}>{g.namaToko}</span>}</div></td>
                    <td className="px-2 py-2.5 font-mono text-[11px] text-slate-700 max-w-[100px] truncate" title={g.noPesanan}>{g.noPesanan}</td>
                    <td className="px-2 py-2.5 font-mono text-[10px] text-slate-500 max-w-[90px] truncate" title={g.noResi}>{g.noResi||'-'}</td>
                    <td className="px-2 py-2.5"><span className="font-semibold text-brand-700">{g.items.length} SKU</span>{belanjaSet.has(k)&&<span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600 whitespace-nowrap">🛒 Belanja</span>}<span className="text-slate-400 ml-1">{isExp?'▲':'▼'}</span></td>
                    <td className="px-2 py-2.5 font-semibold whitespace-nowrap">Rp {g.total.toLocaleString('id-ID')}</td>
                    <td className="px-2 py-2.5 text-slate-500 max-w-[100px] truncate text-[10px]">{g.kurir.split('-')[0]?.trim()||g.kurir.split(':')[0]?.trim()||g.kurir}</td>
                    <td className={`px-2 py-2.5 text-[10px] whitespace-nowrap font-semibold ${urgent?'text-red-600':'text-slate-500'}`}>{g.sla||'-'}</td>
                    <td className="px-2 py-2.5"><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${g.statusPesanan==='Perlu Dikirim'||g.statusPesanan==='shipped'?'bg-amber-100 text-amber-700':g.statusPesanan.includes('Diterima')||g.statusPesanan==='Selesai'||g.statusPesanan==='delivered'?'bg-emerald-100 text-emerald-700':g.statusPesanan.includes('Dikirim')?'bg-blue-100 text-blue-700':g.statusPesanan.includes('Dibatalkan')||g.statusPesanan==='cancelled'?'bg-red-100 text-red-700':'bg-slate-100 text-slate-600'}`}>{g.statusPesanan}</span></td>
                    <td className="px-2 py-2.5">{statusGdg}</td>
                  </tr>
                  {isExp&&g.items.map((item,i)=>{const st=skuInventoryStatus(item.sku, invMap);return(<tr key={`${k}-${i}`} className="bg-slate-50/50 border-b border-slate-100"><td colSpan={2}></td><td colSpan={2} className="px-2 py-1.5 text-[11px]"><span className="text-slate-400 mr-1">└</span><span className="font-mono text-[10px] text-brand-600 mr-1">{item.sku||'-'}</span><span className="max-w-[180px] truncate inline-block" title={item.namaProduk}>{item.namaProduk}</span>{st&&<span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap ${st==='not-found'?'bg-red-100 text-red-700':'bg-orange-100 text-orange-700'}`}>{st==='not-found'?'❌ Tidak ada di Inventory':'⚠️ Stok 0'} 🛒</span>}</td><td className="px-2 py-1.5 text-[11px] whitespace-nowrap">Rp {item.harga.toLocaleString('id-ID')} × {item.qty}</td><td colSpan={5}></td></tr>);})}
                </React.Fragment>);})}
            </tbody>
          </table>
        </div>
      </>)}

      {allRows.length===0&&(<div className="mt-8 text-center py-12 text-slate-400"><p className="text-5xl mb-3">📊</p><p className="font-semibold">Belum ada data agregasi.</p><p className="text-sm mt-1">Upload file di Data Entry atau di sini. Data akan tersinkron otomatis.</p></div>)}
    </div>
  );
}

/* ── Tab Khusus: pesanan dengan SKU kosong / tidak ada di Inventory → Harus Belanja ── */
function HarusBelanjaTab() {
  const { allRows } = useAgregasi();
  const { skus } = useSkus();
  const orders = useMemo(() => computeBelanjaOrders(allRows, skus), [allRows, skus]);
  const totalItems = orders.reduce((s, o) => s + o.items.length, 0);

  if (orders.length === 0) {
    return (
      <div>
        <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
        <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🛒 Harus Belanja</h2>
        <div className="mt-8 text-center py-12 text-slate-400">
          <p className="text-4xl mb-2">🛒</p>
          <p className="font-semibold">Semua SKU pesanan tersedia di Inventory. 👍</p>
          <p className="text-sm mt-1">Pesanan yang punya SKU kosong / tidak terdaftar di Inventory akan muncul di sini.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-red-500 to-orange-300" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🛒 Harus Belanja</h2>
          <p className="mt-1 text-sm text-slate-500">{orders.length} pesanan • {totalItems} SKU kosong / tidak ada di Inventory.</p>
        </div>
        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">⚠️ Perlu stok sebelum dikirim</span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {orders.map(o => (
          <div key={o.key} className="rounded-2xl border-2 border-red-200 bg-red-50/40 p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{o.marketplace}</span>
              <span className="font-mono text-xs font-bold text-slate-800">{o.noPesanan}</span>
              <span className="font-mono text-[10px] text-slate-500">{o.noResi || '-'}</span>
              <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">🛒 Harus Belanja</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">🏪 {o.namaToko || '-'} • Status: {o.statusPesanan || '-'}{o.statusProses ? ` • Gudang: ${o.statusProses}` : ''}</p>
            <ul className="mt-3 space-y-1.5">
              {o.items.map((it, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs shadow-sm">
                  <span className="font-mono text-[10px] font-semibold text-brand-700">{it.sku}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-700" title={it.namaProduk}>{it.namaProduk}</span>
                  <span className="shrink-0 font-semibold text-slate-500">Qty {it.qty}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold whitespace-nowrap ${it.reason === 'not-found' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                    {it.reason === 'not-found' ? '❌ Tidak ada di Inventory' : '⚠️ Stok 0'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── QC List: data dari context dengan status DiQC ── */
function QCList() {
  const { allRows, setAllRows } = useAgregasi();
  const qcItems = allRows.filter(r => r.statusProses === 'DiQC');

  const grouped = new Map<string, { noPesanan: string; noResi: string; marketplace: string; namaToko: string; items: AgregasiRow[] }>();
  for (const r of qcItems) {
    const key = `${r.noPesanan}||${r.noResi}`;
    if (!grouped.has(key)) grouped.set(key, { noPesanan: r.noPesanan, noResi: r.noResi, marketplace: r.marketplace, namaToko: r.namaToko, items: [] });
    grouped.get(key)!.items.push(r);
  }

  // State untuk jenis paket per pesanan
  const [paketTypes, setPaketTypes] = useState<Record<string, 'Reguler' | 'Besar'>>({});

  const handleQCComplete = (noPesanan: string, noResi: string) => {
    const jenis = paketTypes[`${noPesanan}||${noResi}`] || 'Reguler';
    // Advance single order to Dipacking + set jenisPaket
    setAllRows((prev: AgregasiRow[]) => prev.map((r: AgregasiRow) => {
      if (r.noPesanan === noPesanan && r.noResi === noResi && r.statusProses === 'DiQC') {
        return { ...r, statusProses: 'Dipacking' as const, jenisPaket: jenis };
      }
      return r;
    }));
  };

  if (qcItems.length === 0) {
    return (
      <div>
        <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
        <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🔍 Quality Control</h2>
        <div className="mt-8 text-center py-12 text-slate-400">
          <p className="text-4xl mb-2">🔍</p>
          <p className="font-semibold">Belum ada item untuk QC.</p>
          <p className="text-sm mt-1">Selesaikan picking terlebih dahulu, lalu item akan muncul di sini.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🔍 Quality Control</h2>
          <p className="mt-1 text-sm text-slate-500">{grouped.size} pesanan • {qcItems.length} item perlu diperiksa</p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">🔍 DiQC</span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead><tr className="bg-brand-50 text-xs uppercase text-brand-500">
            {['No. Pesanan','No. Resi','MP','Toko','SKU','Nama Produk','Qty','Kondisi','Jenis Paket','Aksi'].map(c => <th key={c} className="px-2 py-3 font-semibold whitespace-nowrap">{c}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {Array.from(grouped.values()).map((g, gi) => {
              const orderKey = `${g.noPesanan}||${g.noResi}`;
              const selectedPaket = paketTypes[orderKey] || 'Reguler';
              return (
              <React.Fragment key={orderKey}>
                {g.items.map((item, ii) => (
                  <tr key={item.id} className={gi % 2 === 0 ? 'bg-white' : 'bg-amber-50/20'}>
                    {ii === 0 && (
                      <>
                        <td className="px-2 py-2.5 font-mono text-xs text-slate-700" rowSpan={g.items.length}>{g.noPesanan}</td>
                        <td className="px-2 py-2.5 font-mono text-[10px] text-slate-500" rowSpan={g.items.length}>{g.noResi}</td>
                        <td className="px-2 py-2.5" rowSpan={g.items.length}><span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{g.marketplace}</span></td>
                        <td className="px-2 py-2.5 text-xs text-slate-600 max-w-[80px] truncate" rowSpan={g.items.length} title={g.namaToko}>{g.namaToko || '-'}</td>
                      </>
                    )}
                    <td className="px-2 py-2.5 font-mono text-xs text-brand-600">{item.sku || '-'}</td>
                    <td className="px-2 py-2.5 text-xs max-w-[200px] truncate" title={item.namaProduk}>{item.namaProduk}</td>
                    <td className="px-2 py-2.5 font-semibold">{item.kuantity}</td>
                    <td className="px-2 py-2.5">
                      <select className="rounded-lg border border-slate-200 text-xs px-1 py-0.5" defaultValue="baik">
                        <option value="baik">✅ Baik</option>
                        <option value="cacat">❌ Cacat</option>
                        <option value="kurang">⚠️ Kurang</option>
                      </select>
                    </td>
                    {ii === 0 && (
                      <td className="px-2 py-2.5" rowSpan={g.items.length}>
                        <select
                          value={selectedPaket}
                          onChange={e => setPaketTypes(prev => ({ ...prev, [orderKey]: e.target.value as 'Reguler' | 'Besar' }))}
                          className="rounded-lg border-2 border-amber-300 bg-amber-50 text-xs font-semibold px-1.5 py-1 text-amber-700 focus:border-amber-500 focus:outline-none"
                        >
                          <option value="Reguler">📦 Reguler</option>
                          <option value="Besar">🚛 Paket Besar</option>
                        </select>
                      </td>
                    )}
                    {ii === 0 && (
                      <td className="px-2 py-2.5" rowSpan={g.items.length}>
                        <button onClick={() => handleQCComplete(g.noPesanan, g.noResi)} className="rounded-lg bg-emerald-500 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-600 whitespace-nowrap">
                          ✅ Lulus QC → {selectedPaket === 'Besar' ? '🚛 Packing Besar' : '📦 Packing'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Packing List: data dari context dengan status Dipacking ── */
function PackingList() {
  const { allRows, setAllRows } = useAgregasi();
  const packingItems = allRows.filter(r => r.statusProses === 'Dipacking');

  // Group by noPesanan||noResi
  const grouped = new Map<string, {
    noPesanan: string; noResi: string; marketplace: string; namaToko: string;
    jenisPaket?: string; items: AgregasiRow[];
  }>();
  for (const r of packingItems) {
    const key = `${r.noPesanan}||${r.noResi}`;
    if (!grouped.has(key)) grouped.set(key, {
      noPesanan: r.noPesanan, noResi: r.noResi, marketplace: r.marketplace,
      namaToko: r.namaToko, jenisPaket: r.jenisPaket, items: [],
    });
    grouped.get(key)!.items.push(r);
  }

  const handleKirim = (noPesanan: string, noResi: string) => {
    setAllRows((prev: AgregasiRow[]) => prev.map((r: AgregasiRow) => {
      if (r.noPesanan === noPesanan && r.noResi === noResi && r.statusProses === 'Dipacking') {
        return { ...r, statusProses: 'DiScanRunner' as const };
      }
      return r;
    }));
  };

  if (packingItems.length === 0) {
    return (
      <div>
        <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
        <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📦 Packing</h2>
        <div className="mt-8 text-center py-12 text-slate-400">
          <p className="text-4xl mb-2">📦</p>
          <p className="font-semibold">Belum ada item untuk packing.</p>
          <p className="text-sm mt-1">Selesaikan QC terlebih dahulu, lalu item akan muncul di sini.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📦 Packing</h2>
          <p className="mt-1 text-sm text-slate-500">{grouped.size} pesanan • {packingItems.length} item siap dikemas</p>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">📦 Dipacking</span>
      </div>

      {/* Summary: Reguler vs Besar */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-blue-50 p-3 text-center border border-blue-200">
          <p className="text-2xl font-bold text-blue-600">
            {Array.from(grouped.values()).filter(g => g.jenisPaket !== 'Besar').length}
          </p>
          <p className="text-xs text-blue-500">📦 Paket Reguler</p>
        </div>
        <div className="rounded-xl bg-orange-50 p-3 text-center border border-orange-200">
          <p className="text-2xl font-bold text-orange-600">
            {Array.from(grouped.values()).filter(g => g.jenisPaket === 'Besar').length}
          </p>
          <p className="text-xs text-orange-500">🚛 Paket Besar</p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead><tr className="bg-emerald-50 text-xs uppercase text-emerald-600">
            {['No. Pesanan','No. Resi','MP','Toko','SKU','Nama Produk','Qty','Jenis Paket','Aksi'].map(c => (
              <th key={c} className="px-2 py-3 font-semibold whitespace-nowrap">{c}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {Array.from(grouped.entries()).map(([key, g], gi) => (
              <React.Fragment key={key}>
                {g.items.map((item, ii) => (
                  <tr key={item.id} className={gi % 2 === 0 ? 'bg-white' : 'bg-emerald-50/20'}>
                    {ii === 0 && (
                      <>
                        <td className="px-2 py-2.5 font-mono text-xs text-slate-700" rowSpan={g.items.length}>{g.noPesanan}</td>
                        <td className="px-2 py-2.5 font-mono text-[10px] text-slate-500" rowSpan={g.items.length}>{g.noResi}</td>
                        <td className="px-2 py-2.5" rowSpan={g.items.length}>
                          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{g.marketplace}</span>
                        </td>
                        <td className="px-2 py-2.5 text-xs text-slate-600 max-w-[80px] truncate" rowSpan={g.items.length} title={g.namaToko}>{g.namaToko || '-'}</td>
                      </>
                    )}
                    <td className="px-2 py-2.5 font-mono text-xs text-brand-600">{item.sku || '-'}</td>
                    <td className="px-2 py-2.5 text-xs max-w-[200px] truncate" title={item.namaProduk}>{item.namaProduk}</td>
                    <td className="px-2 py-2.5 font-semibold">{item.kuantity}</td>
                    {ii === 0 && (
                      <td className="px-2 py-2.5" rowSpan={g.items.length}>
                        {g.jenisPaket === 'Besar' ? (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">🚛 Besar</span>
                        ) : (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">📦 Reguler</span>
                        )}
                      </td>
                    )}
                    {ii === 0 && (
                      <td className="px-2 py-2.5" rowSpan={g.items.length}>
                        <button onClick={() => handleKirim(g.noPesanan, g.noResi)}
                          className="rounded-lg bg-indigo-500 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-600 whitespace-nowrap">
                          📱 Serahkan ke Runner
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Runner Scan: scan paket → tentukan Pickup/Dropoff → Hand Over per Kurir ── */
function RunnerScan() {
  const { allRows, setAllRows } = useAgregasi();
  const scanItems = allRows.filter(r => r.statusProses === 'DiScanRunner');

  // Sub-tab: Scan Drop Off, Pickup, atau Riwayat
  const [subTab, setSubTab] = useState<'scan' | 'pickup' | 'riwayat'>('scan');
  const [pickupMode, setPickupMode] = useState<'pending' | 'confirmed'>('pending');

  // Per-paket mode (hanya untuk scan dropoff)
  const [deliveryMode, setDeliveryMode] = useState<'dropoff' | 'pickup'>('dropoff');

  const [scanInput, setScanInput] = useState('');
  const [scanMode, setScanMode] = useState<'manual' | 'camera'>('manual');
  const [lastScan, setLastScan] = useState<{ noPesanan: string; noResi: string; jam: string; mode: string } | null>(null);
  const [handoverList, setHandoverList] = useState<{
    noPesanan: string; noResi: string; jam: string; marketplace: string;
    jenisPaket?: string; kurir?: string; namaToko?: string; deliveryMode: string;
  }[]>([]);
  const [handoverDone, setHandoverDone] = useState(false);
  const [handoverResults, setHandoverResults] = useState<{
    kurir: string; mode: string; hoId: string; count: number; items: typeof handoverList;
  }[]>([]);
  const [filterKurir, setFilterKurir] = useState('semua');
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<any>(null);
  const scannerDivRef = useRef<HTMLDivElement>(null);

  // Data aktif
  const grouped = new Map<string, {
    noPesanan: string; noResi: string; marketplace: string; namaToko: string;
    jenisPaket?: string; kurir?: string; items: AgregasiRow[];
  }>();
  for (const r of scanItems) {
    const key = `${r.noPesanan}||${r.noResi}`;
    if (!grouped.has(key)) grouped.set(key, {
      noPesanan: r.noPesanan, noResi: r.noResi, marketplace: r.marketplace,
      namaToko: r.namaToko, jenisPaket: r.jenisPaket, kurir: r.kurir, items: [],
    });
    grouped.get(key)!.items.push(r);
  }

  const allKurir = Array.from(new Set(Array.from(grouped.values()).map(g => g.kurir || 'Tanpa Kurir'))).sort();

  const filteredGroups = filterKurir === 'semua'
    ? Array.from(grouped.entries())
    : Array.from(grouped.entries()).filter(([, g]) => (g.kurir || 'Tanpa Kurir') === filterKurir);

  const orderKeys = filteredGroups.map(([k]) => k);
  const scannedKeys = new Set(handoverList.map(h => `${h.noPesanan}||${h.noResi}`));
  const remainingOrders = orderKeys.filter(k => !scannedKeys.has(k));

  const kurirStats = new Map<string, { total: number; scanned: number }>();
  for (const [key, g] of grouped.entries()) {
    const kur = g.kurir || 'Tanpa Kurir';
    const s = kurirStats.get(kur) || { total: 0, scanned: 0 };
    s.total++;
    if (scannedKeys.has(key)) s.scanned++;
    kurirStats.set(kur, s);
  }

  // Group scanned by kurir + mode
  const handoverByKurirMode = useMemo(() => {
    const map = new Map<string, typeof handoverList>();
    for (const h of handoverList) {
      const kur = h.kurir || 'Tanpa Kurir';
      const mode = h.deliveryMode || 'dropoff';
      const groupKey = `${kur}||${mode}`;
      if (!map.has(groupKey)) map.set(groupKey, []);
      map.get(groupKey)!.push(h);
    }
    return map;
  }, [handoverList]);

  // Pickup groups (untuk tampilan pickup)
  const pickupGroups = useMemo(() => {
    const map = new Map<string, Map<string, { noPesanan: string; noResi: string; marketplace: string; jenisPaket?: string }[]>>();
    for (const [key, g] of grouped.entries()) {
      const kur = g.kurir || 'Tanpa Kurir';
      const toko = g.namaToko || 'Tanpa Toko';
      if (!map.has(kur)) map.set(kur, new Map());
      const tokoMap = map.get(kur)!;
      if (!tokoMap.has(toko)) tokoMap.set(toko, []);
      tokoMap.get(toko)!.push({
        noPesanan: g.noPesanan, noResi: g.noResi, marketplace: g.marketplace, jenisPaket: g.jenisPaket,
      });
    }
    return map;
  }, [grouped]);

  // Process scan — tag dengan deliveryMode saat ini
  const processScan = (scanValue: string) => {
    const val = scanValue.trim();
    if (!val) return;
    let matched: { noPesanan: string; noResi: string; marketplace: string; jenisPaket?: string; kurir?: string; namaToko?: string } | null = null;
    for (const [key, g] of filteredGroups) {
      if (scannedKeys.has(key)) continue;
      if (g.noPesanan === val || g.noResi === val || key === val ||
          g.noPesanan.toLowerCase().includes(val.toLowerCase()) ||
          (g.noResi && g.noResi.toLowerCase().includes(val.toLowerCase()))) {
        matched = { noPesanan: g.noPesanan, noResi: g.noResi, marketplace: g.marketplace, jenisPaket: g.jenisPaket, kurir: g.kurir, namaToko: g.namaToko };
        break;
      }
    }
    if (!matched) { alert(`❌ Order "${val}" tidak ditemukan atau sudah discan.`); return; }
    const jam = new Date().toLocaleTimeString('id-ID');
    setHandoverList(prev => [...prev, { ...matched!, jam, deliveryMode }]);
    setLastScan({ noPesanan: matched.noPesanan, noResi: matched.noResi, jam, mode: deliveryMode });
    setScanInput('');
    if (inputRef.current) inputRef.current.focus();
  };

  const handleManualScan = () => processScan(scanInput);

  const startCamera = async () => {
    setScanMode('camera');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (scannerDivRef.current) {
        const scanner = new Html5Qrcode('runner-scanner-view');
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => { processScan(decodedText); if (scannerRef.current) scannerRef.current.pause(); },
          () => {}
        );
      }
    } catch (e: any) { alert('Gagal mengakses kamera: ' + (e.message || 'Unknown')); setScanMode('manual'); }
  };

  const stopCamera = async () => {
    if (scannerRef.current) { try { await scannerRef.current.stop(); scannerRef.current = null; } catch { /* ignore */ } }
    setScanMode('manual');
  };

  useEffect(() => { return () => { if (scannerRef.current) scannerRef.current.stop().catch(() => {}); }; }, []);

  // Generate Hand Over — hanya untuk Drop Off (Pickup di-handle di overview)
  const generateHandOver = () => {
    if (handoverList.length === 0) return;
    const now = new Date().toISOString();
    const results: typeof handoverResults = [];

    // Hanya proses Drop Off
    const dropoffItems = handoverList.filter(h => h.deliveryMode === 'dropoff');
    const dropoffByKurir = new Map<string, typeof handoverList>();
    for (const h of dropoffItems) {
      const kur = h.kurir || 'Tanpa Kurir';
      if (!dropoffByKurir.has(kur)) dropoffByKurir.set(kur, []);
      dropoffByKurir.get(kur)!.push(h);
    }

    for (const [kurir, items] of dropoffByKurir.entries()) {
      const hoId = `HO-DO-${kurir.replace(/[^A-Z0-9]/gi, '').substring(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase().substring(0, 4)}`;
      const scannedSet = new Set(items.map(h => `${h.noPesanan}||${h.noResi}`));
      setAllRows((prev: AgregasiRow[]) => prev.map((r: AgregasiRow) => {
        const key = `${r.noPesanan}||${r.noResi}`;
        if (scannedSet.has(key) && r.statusProses === 'DiScanRunner') {
          return { ...r, statusProses: 'Dikirim' as const, handoverId: hoId, handoverAt: now };
        }
        return r;
      }));
      results.push({ kurir, mode: 'dropoff', hoId, count: items.length, items });
    }

    // Pickup items tetap di handoverList, di-handle manual via overview
    if (results.length > 0 || handoverList.some(h => h.deliveryMode === 'pickup')) {
      setHandoverResults(results);
      setHandoverDone(true);
    }
  };

  // ── Riwayat Hand Over ──
  const historyItems = allRows.filter(r => r.statusProses === 'Dikirim' && r.handoverId);
  const historyGrouped = useMemo(() => {
    const map = new Map<string, { hoId: string; handoverAt: string; kurir: string; items: AgregasiRow[] }>();
    for (const r of historyItems) {
      const hoId = r.handoverId!;
      if (!map.has(hoId)) map.set(hoId, { hoId, handoverAt: r.handoverAt || '', kurir: r.kurir || '-', items: [] });
      map.get(hoId)!.items.push(r);
    }
    return Array.from(map.values()).sort((a, b) => b.handoverAt.localeCompare(a.handoverAt));
  }, [historyItems]);

  if (subTab === 'riwayat') {
    return (
      <div>
        <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📜 Riwayat Hand Over</h2>
            <p className="mt-1 text-sm text-slate-500">{historyGrouped.length} hand over • {historyItems.length} paket sudah dikirim</p>
          </div>
          <button onClick={() => setSubTab('scan')}
            className="rounded-xl bg-indigo-100 px-4 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-200">
            ← Kembali ke Scan
          </button>
        </div>
        {historyGrouped.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-4xl mb-2">📜</p>
            <p className="font-semibold">Belum ada riwayat Hand Over.</p>
            <p className="text-sm mt-1">Scan & buat Hand Over terlebih dahulu.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {historyGrouped.map(ho => {
              const isPickup = ho.hoId.includes('PU-');
              return (
                <div key={ho.hoId} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs text-slate-400">Hand Over ID</p>
                      <p className="font-mono font-bold text-indigo-700 text-sm">{ho.hoId}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isPickup ? 'bg-cyan-100 text-cyan-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {isPickup ? '📥 Pickup' : '🚚 Drop Off'}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                        🚚 {ho.kurir}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(ho.handoverAt).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ho.items.map(r => (
                      <span key={r.id} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-mono text-emerald-700 border border-emerald-200">
                        {r.noPesanan}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">{ho.items.length} paket</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Hand Over Done Screen ──
  if (handoverDone) {
    return (
      <div>
        <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
        <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-300 p-6 text-center">
          <p className="text-5xl mb-4">✅</p>
          <h2 className="text-xl font-bold text-emerald-700">Hand Over Selesai!</h2>
          <p className="text-sm text-emerald-600 mt-1">{handoverResults.length} hand over • {handoverList.length} paket</p>
          <div className="mt-4 space-y-3 max-w-xl mx-auto">
            {handoverResults.map(r => (
              <div key={r.hoId} className="bg-white rounded-xl border border-emerald-200 p-4 text-left">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-[10px] text-slate-400">Hand Over ID</p>
                    <p className="font-mono font-bold text-indigo-700 text-xs">{r.hoId}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.mode === 'pickup' ? 'bg-cyan-100 text-cyan-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {r.mode === 'pickup' ? '📥 Pickup' : '🚚 Drop Off'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">🚚 {r.kurir}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-2">{r.count} paket</p>
                <div className="flex flex-wrap gap-1">
                  {r.items.map(h => (
                    <span key={`${h.noPesanan}||${h.noResi}`} className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-mono text-emerald-700">
                      {h.noPesanan}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-3 mt-5">
            <button onClick={() => { setHandoverDone(false); setHandoverList([]); setHandoverResults([]); setLastScan(null); }}
              className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
              ✅ Scan Lagi
            </button>
            <button onClick={() => { setHandoverDone(false); setHandoverList([]); setHandoverResults([]); setLastScan(null); setSubTab('riwayat'); }}
              className="rounded-xl bg-indigo-100 px-5 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-200">
              📜 Lihat Riwayat
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Pickup Sub-Tab ──
  if (subTab === 'pickup') {
    return (
      <div>
        <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300" />
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📥 Pickup Pesanan</h2>
            <p className="mt-1 text-sm text-slate-500">Daftar pesanan yang akan dipickup oleh kurir — per toko & kurir.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSubTab('scan')}
              className="rounded-xl bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-200">← Scan</button>
            <button onClick={() => setSubTab('riwayat')}
              className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200">📜 Riwayat</button>
          </div>
        </div>

        {/* Pickup Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl bg-cyan-50 p-3 text-center border border-cyan-200">
            <p className="text-2xl font-bold text-cyan-600">{Array.from(pickupGroups.values()).reduce((s, m) => s + Array.from(m.values()).reduce((s2, arr) => s2 + arr.length, 0), 0)}</p>
            <p className="text-xs text-cyan-500">Total Pesanan</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-3 text-center border border-blue-200">
            <p className="text-2xl font-bold text-blue-600">{pickupGroups.size}</p>
            <p className="text-xs text-blue-500">Kurir</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-center border border-slate-200">
            <p className="text-2xl font-bold text-slate-600">{Array.from(pickupGroups.values()).reduce((s, m) => s + m.size, 0)}</p>
            <p className="text-xs text-slate-500">Toko</p>
          </div>
        </div>

        {pickupGroups.size === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-4xl mb-2">📥</p>
            <p className="font-semibold">Belum ada pesanan pickup.</p>
            <p className="text-sm mt-1">Pesanan pickup akan muncul setelah packing selesai.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(pickupGroups.entries()).map(([kurir, tokoMap]) => (
              <div key={kurir} className="rounded-xl border-2 border-cyan-200 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📥</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">🚚 {kurir}</p>
                      <p className="text-[10px] text-slate-400">{tokoMap.size} toko · {Array.from(tokoMap.values()).reduce((s, arr) => s + arr.length, 0)} pesanan</p>
                    </div>
                  </div>
                  <button
                    className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600"
                    title="Konfirmasi pickup oleh kurir"
                  >
                    ✅ Konfirmasi Pickup
                  </button>
                </div>
                <div className="space-y-2">
                  {Array.from(tokoMap.entries()).map(([toko, orders]) => (
                    <div key={toko} className="rounded-lg bg-slate-50 p-2">
                      <p className="text-xs font-semibold text-slate-600 mb-1">🏪 {toko} ({orders.length} pesanan)</p>
                      <div className="flex flex-wrap gap-1">
                        {orders.map(order => (
                          <span key={order.noPesanan} className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-mono text-cyan-700 border border-cyan-200">
                            {order.noPesanan}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Empty State ──
  if (scanItems.length === 0) {
    return (
      <div>
        <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📱 Runner Scanner</h2>
          <div className="flex gap-2">
            <button onClick={() => setSubTab('pickup')}
              className="rounded-xl bg-cyan-100 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-200">
              📥 Pickup
            </button>
            <button onClick={() => setSubTab('riwayat')}
              className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200">
              📜 Riwayat HO {historyItems.length > 0 ? `(${historyGrouped.length})` : ''}
            </button>
          </div>
        </div>
        <div className="mt-8 text-center py-12 text-slate-400">
          <p className="text-4xl mb-2">📱</p>
          <p className="font-semibold">Belum ada paket untuk discan.</p>
          <p className="text-sm mt-1">Selesaikan packing terlebih dahulu, lalu paket akan muncul di sini.</p>
        </div>
      </div>
    );
  }

  // ── Main Scan View ──
  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📱 Runner Scanner</h2>
          <p className="mt-1 text-sm text-slate-500">
            {remainingOrders.length} dari {orderKeys.length} paket menunggu scan • Discan: {handoverList.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">📱 DiScanRunner</span>
          <button onClick={() => setSubTab('pickup')}
            className="rounded-xl bg-cyan-100 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-200">
            📥 Pickup {pickupGroups.size > 0 ? `(${Array.from(pickupGroups.values()).reduce((s, m) => s + Array.from(m.values()).reduce((s2, arr) => s2 + arr.length, 0), 0)})` : ''}
          </button>
          <button onClick={() => setSubTab('riwayat')}
            className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200">
            📜 Riwayat {historyGrouped.length > 0 ? `(${historyGrouped.length})` : ''}
          </button>
        </div>
      </div>

      {/* Kurir Filter */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500">🚚 Kurir:</span>
        <button onClick={() => setFilterKurir('semua')}
          className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${filterKurir === 'semua' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          Semua ({grouped.size})
        </button>
        {allKurir.map(kur => {
          const s = kurirStats.get(kur) || { total: 0, scanned: 0 };
          return (
            <button key={kur} onClick={() => setFilterKurir(kur)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${filterKurir === kur ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {kur} ({s.scanned}/{s.total})
            </button>
          );
        })}
      </div>

      {/* Scan Area */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Left: Scanner */}
        <div>
          <div className="rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/30 p-4">
            {/* Delivery Mode Selector + Camera/Manual */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="flex rounded-lg bg-white border border-slate-200 p-0.5 mr-auto">
                <button onClick={() => setDeliveryMode('dropoff')}
                  className={`rounded-md px-3 py-1.5 text-[11px] font-bold transition ${deliveryMode === 'dropoff' ? 'bg-indigo-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>
                  🚚 Drop Off
                </button>
                <button onClick={() => setDeliveryMode('pickup')}
                  className={`rounded-md px-3 py-1.5 text-[11px] font-bold transition ${deliveryMode === 'pickup' ? 'bg-cyan-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>
                  📥 Pickup
                </button>
              </div>
              <button onClick={() => { stopCamera(); setScanMode('manual'); }}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${scanMode === 'manual' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                ✏️
              </button>
              <button onClick={() => { setScanMode('camera'); setTimeout(startCamera, 100); }}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${scanMode === 'camera' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                📷
              </button>
              {scanMode === 'camera' && (
                <button onClick={stopCamera} className="rounded-lg px-2 py-1 text-[11px] text-red-500 hover:bg-red-50">✕</button>
              )}
            </div>

            {scanMode === 'manual' ? (
              <div className="flex gap-2">
                <input ref={inputRef} type="text" value={scanInput}
                  onChange={e => setScanInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') processScan(scanInput); }}
                  placeholder={`Scan untuk ${deliveryMode === 'pickup' ? 'Pickup' : 'Drop Off'} — ketik No. Pesanan / Resi...`}
                  className="flex-1 rounded-xl border-2 border-indigo-200 px-4 py-3 text-sm font-mono focus:border-indigo-500 focus:outline-none" autoFocus />
                <button onClick={handleManualScan}
                  className={`rounded-xl px-5 py-3 text-sm font-bold text-white transition ${deliveryMode === 'pickup' ? 'bg-cyan-500 hover:bg-cyan-600' : 'bg-indigo-500 hover:bg-indigo-600'}`}>
                  {deliveryMode === 'pickup' ? '📥 Pickup' : '🚚 Drop Off'}
                </button>
              </div>
            ) : (
              <div id="runner-scanner-view" ref={scannerDivRef} className="w-full aspect-video rounded-xl overflow-hidden bg-black" />
            )}
          </div>

          {lastScan && (
            <div className={`mt-2 rounded-xl border p-3 flex items-center gap-3 animate-pulse ${lastScan.mode === 'pickup' ? 'bg-cyan-50 border-cyan-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-sm font-bold text-slate-700">{lastScan.noPesanan}</p>
                <p className="text-xs text-slate-500">{lastScan.noResi} • {lastScan.jam} • <span className={lastScan.mode === 'pickup' ? 'text-cyan-600 font-semibold' : 'text-indigo-600 font-semibold'}>{lastScan.mode === 'pickup' ? '📥 Pickup' : '🚚 Drop Off'}</span></p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Lists */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-slate-700">📋 Daftar Scan {filterKurir !== 'semua' && <span className="text-xs text-indigo-500">— 🚚 {filterKurir}</span>}</p>
            {handoverList.length > 0 && (
              <button onClick={() => setHandoverList([])} className="text-xs text-red-400 hover:text-red-600">Reset</button>
            )}
          </div>

          {/* Waiting */}
          {remainingOrders.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-amber-600 mb-2">⏳ Menunggu Scan ({remainingOrders.length})</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {remainingOrders.map(k => {
                  const g = grouped.get(k)!;
                  return (
                    <div key={k} className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="font-mono font-semibold text-slate-700 truncate">{g.noPesanan}</span>
                        <span className="text-slate-300 text-[10px]">{g.marketplace}</span>
                        <span className="text-slate-300 text-[10px]">🚚{g.kurir || '-'}</span>
                      </div>
                      <span className={g.jenisPaket === 'Besar' ? 'text-orange-600 font-semibold shrink-0 ml-1 text-[10px]' : 'text-blue-600 shrink-0 ml-1 text-[10px]'}>
                        {g.jenisPaket === 'Besar' ? '🚛' : '📦'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Scanned — Grouped by Kurir + Mode */}
          {handoverByKurirMode.size > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-600 mb-2">✅ Siap Hand Over ({handoverList.length} paket)</p>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {Array.from(handoverByKurirMode.entries()).map(([groupKey, items]) => {
                  const [kurir, mode] = groupKey.split('||');
                  return (
                    <div key={groupKey} className="bg-emerald-50/50 rounded-lg px-3 py-2 border border-emerald-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-indigo-600">
                          {mode === 'pickup' ? '📥' : '🚚'} {kurir}
                          <span className={`ml-1 text-[10px] ${mode === 'pickup' ? 'text-cyan-500' : 'text-indigo-500'}`}>
                            ({mode === 'pickup' ? 'Pickup' : 'Drop Off'})
                          </span>
                        </span>
                        <span className="text-[10px] text-slate-400">{items.length} paket</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {items.map(h => (
                          <span key={`${h.noPesanan}||${h.noResi}`} className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-mono text-emerald-700">
                            {h.noPesanan}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {handoverList.length > 0 && (
            <button onClick={generateHandOver}
              className="mt-4 w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-bold text-white hover:bg-indigo-600 transition">
              📝 Buat Hand Over ({handoverList.length} paket • {handoverByKurirMode.size} grup)
            </button>
          )}
        </div>
      </div>

      {/* Pickup Overview — per paket Konfirmasi / Gagal */}
      <div className="mt-4 rounded-2xl border-2 border-cyan-200 bg-cyan-50/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-cyan-700">📥 Overview Pickup — Per Kurir & Toko</p>
          <span className="text-[10px] text-cyan-500">✓ / ✕ per paket</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from(pickupGroups.entries()).map(([kurir, tokoMap]) => {
            const allItems = Array.from(tokoMap.values()).flat();
            const allKeys = allItems.map(h => `${h.noPesanan}||${h.noResi}`);
            const confirmedKeys = new Set(allKeys.filter(k => {
              const g = grouped.get(k);
              return g && (g.items[0]?.statusProses === 'Dikirim');
            }));
            const pendingKeys = new Set(allKeys.filter(k => {
              const g = grouped.get(k);
              return g && (g.items[0]?.statusProses === 'PendingPickup');
            }));
            const activeKeys = allKeys.filter(k => !confirmedKeys.has(k) && !pendingKeys.has(k));

            const confirmOne = (key: string) => {
              const g = grouped.get(key);
              if (!g) return;
              const now = new Date().toISOString();
              const hoId = `HO-PU-${kurir.replace(/[^A-Z0-9]/gi, '').substring(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase().substring(0, 4)}`;
              setAllRows((prev: AgregasiRow[]) => prev.map((r: AgregasiRow) => {
                const rk = `${r.noPesanan}||${r.noResi}`;
                if (rk === key && r.statusProses === 'DiScanRunner') {
                  return { ...r, statusProses: 'Dikirim' as const, handoverId: hoId, handoverAt: now };
                }
                return r;
              }));
            };

            const failOne = (key: string) => {
              setAllRows((prev: AgregasiRow[]) => prev.map((r: AgregasiRow) => {
                const rk = `${r.noPesanan}||${r.noResi}`;
                if (rk === key && r.statusProses === 'DiScanRunner') {
                  return { ...r, statusProses: 'PendingPickup' as const };
                }
                return r;
              }));
            };

            const confirmAll = () => {
              if (activeKeys.length === 0) return;
              const now = new Date().toISOString();
              const hoId = `HO-PU-${kurir.replace(/[^A-Z0-9]/gi, '').substring(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase().substring(0, 4)}`;
              const keySet = new Set(activeKeys);
              setAllRows((prev: AgregasiRow[]) => prev.map((r: AgregasiRow) => {
                const key = `${r.noPesanan}||${r.noResi}`;
                if (keySet.has(key) && r.statusProses === 'DiScanRunner') {
                  return { ...r, statusProses: 'Dikirim' as const, handoverId: hoId, handoverAt: now };
                }
                return r;
              }));
            };

            const failAll = () => {
              if (activeKeys.length === 0) return;
              const keySet = new Set(activeKeys);
              setAllRows((prev: AgregasiRow[]) => prev.map((r: AgregasiRow) => {
                const key = `${r.noPesanan}||${r.noResi}`;
                if (keySet.has(key) && r.statusProses === 'DiScanRunner') {
                  return { ...r, statusProses: 'PendingPickup' as const };
                }
                return r;
              }));
            };

            return (
              <div key={kurir} className="bg-white rounded-xl border border-cyan-100 p-3">
                <p className="text-xs font-bold text-indigo-600 mb-2">🚚 {kurir} ({allItems.length} paket)</p>
                {Array.from(tokoMap.entries()).map(([toko, items]) => (
                  <div key={`${kurir}||${toko}`} className="py-0.5">
                    <span className="text-[10px] text-slate-400">🏪 {toko}</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {items.map(h => {
                        const key = `${h.noPesanan}||${h.noResi}`;
                        const isConfirmed = confirmedKeys.has(key);
                        const isPending = pendingKeys.has(key);
                        const isActive = !isConfirmed && !isPending;
                        if (isConfirmed) {
                          return <span key={key} className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-mono font-semibold text-emerald-700 border border-emerald-200">✅ {h.noPesanan.length > 12 ? h.noPesanan.substring(0, 12) + '…' : h.noPesanan}</span>;
                        }
                        if (isPending) {
                          return <span key={key} className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-mono font-semibold text-red-600 border border-red-200">⚠️ {h.noPesanan.length > 12 ? h.noPesanan.substring(0, 12) + '…' : h.noPesanan}</span>;
                        }
                        return (
                          <span key={key} className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 border border-amber-200 px-1 py-0.5">
                            <span className="font-mono font-semibold text-amber-700 text-[10px]">{h.noPesanan.length > 12 ? h.noPesanan.substring(0, 12) + '…' : h.noPesanan}</span>
                            <button onClick={(e: any) => { e.stopPropagation(); confirmOne(key); }} className="rounded-full bg-emerald-400 px-1 py-0.5 text-[9px] font-bold text-white hover:bg-emerald-500 leading-none" title="Konfirmasi Dikirim">✓</button>
                            <button onClick={(e: any) => { e.stopPropagation(); failOne(key); }} className="rounded-full bg-red-400 px-1 py-0.5 text-[9px] font-bold text-white hover:bg-red-500 leading-none" title="Gagal Pickup">✕</button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {activeKeys.length > 0 && (
                  <div className="mt-2 flex gap-1.5">
                    <button onClick={confirmAll} className="flex-1 rounded-lg bg-emerald-500 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-600 transition">✅ Semua ({activeKeys.length})</button>
                    <button onClick={failAll} className="flex-1 rounded-lg bg-red-400 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-red-500 transition">❌ Semua</button>
                  </div>
                )}
                <div className="flex gap-2 mt-1 text-[10px]">
                  {confirmedKeys.size > 0 && <span className="text-emerald-600">✅ {confirmedKeys.size} dikirim</span>}
                  {pendingKeys.size > 0 && <span className="text-red-500">⚠️ {pendingKeys.size} pending</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabel */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-xs">
          <thead><tr className="bg-indigo-50 text-xs uppercase text-indigo-600">
            {['No. Pesanan','No. Resi','MP','Kurir','Toko','Jenis','Item','Status'].map(c => (
              <th key={c} className="px-2 py-3 font-semibold whitespace-nowrap">{c}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {filteredGroups.map(([key, g]) => {
              const isScanned = scannedKeys.has(key);
              return (
                <tr key={key} className={isScanned ? 'bg-emerald-50/50' : 'hover:bg-indigo-50/20'}>
                  <td className="px-2 py-2.5 font-mono text-[11px] font-semibold text-slate-700">{g.noPesanan}</td>
                  <td className="px-2 py-2.5 font-mono text-[10px] text-slate-500 max-w-[90px] truncate" title={g.noResi}>{g.noResi || '-'}</td>
                  <td className="px-2 py-2.5"><span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{g.marketplace}</span></td>
                  <td className="px-2 py-2.5 text-[10px] text-slate-500 max-w-[80px] truncate" title={g.kurir}>{g.kurir || '-'}</td>
                  <td className="px-2 py-2.5 text-[10px] text-slate-500 max-w-[80px] truncate" title={g.namaToko}>{g.namaToko || '-'}</td>
                  <td className="px-2 py-2.5">{g.jenisPaket === 'Besar' ? <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">🚛 Besar</span> : <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">📦 Reguler</span>}</td>
                  <td className="px-2 py-2.5 text-slate-600">{g.items.length} SKU</td>
                  <td className="px-2 py-2.5">{isScanned ? <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">✅ Scanned</span> : <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">⏳ Menunggu</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Picking List ── */
function PickingList() {
  const { allRows, updateStatusToQC, updateStatusPicking, setAllRows } = useAgregasi();
  const picking = allRows.filter(r => r.statusProses === 'Dipicking');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [filterMp, setFilterMp] = useState('semua');
  const [filterToko, setFilterToko] = useState('semua');
  const [detailKey, setDetailKey] = useState<string|null>(null); // popup detail

  // Manual input scanner
  const [manualNoPesanan, setManualNoPesanan] = useState('');
  const [manualNoResi, setManualNoResi] = useState('');
  const [manualMsg, setManualMsg] = useState('');
  const manualRef = useRef<HTMLInputElement>(null);
  const resiRef = useRef<HTMLInputElement>(null);

  const grouped = new Map<string, { noPesanan: string; noResi: string; marketplace: string; namaToko: string; items: AgregasiRow[] }>();
  for (const r of picking) {
    const key = `${r.noPesanan}||${r.noResi}`;
    if (!grouped.has(key)) grouped.set(key, { noPesanan: r.noPesanan, noResi: r.noResi, marketplace: r.marketplace, namaToko: r.namaToko, items: [] });
    grouped.get(key)!.items.push(r);
  }

  // Dapatkan daftar marketplace & toko unik
  const allMp = Array.from(new Set(picking.map(r=>r.marketplace)));
  const allToko = Array.from(new Set(picking.map(r=>r.namaToko).filter(Boolean)));

  let groupList = Array.from(grouped.entries());
  if (filterMp!=='semua') groupList = groupList.filter(([,g])=>g.marketplace===filterMp);
  if (filterToko!=='semua') groupList = groupList.filter(([,g])=>g.namaToko===filterToko);

  const toggleSelect = (key: string) => setSelected(p => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const selectAll = () => setSelected(new Set(groupList.map(([k]) => k)));
  const deselectAll = () => setSelected(new Set());
  const confirmOne = (key: string) => {
    const n = updateStatusToQC([key]);
    if (n > 0) { setConfirmed((p: Set<string>) => { const ns = new Set(p); ns.add(key); return ns; }); setSelected((p: Set<string>) => { const nx = new Set(p); nx.delete(key); return nx; }); }
  };
  const confirmSelected = () => {
    const keys = Array.from(selected);
    const n = updateStatusToQC(keys);
    if (n > 0) { setConfirmed((p: Set<string>) => { const ns = new Set(p); for (const k of keys) ns.add(k); return ns; }); setSelected(new Set()); alert(`✅ ${n} pesanan dikonfirmasi → QC.`); }
  };

  /* ── Manual input: scanner atau ketik, minimal salah satu ── */
  const handleManualSubmit = () => {
    const pesanan = manualNoPesanan.trim();
    const resi = manualNoResi.trim();
    if (!pesanan && !resi) { setManualMsg('Isi minimal No. Pesanan atau No. Resi.'); return; }
    // Jika hanya resi yang diisi, pakai resi tanpa noPesanan
    if (!pesanan && resi) {
      const lines = resi.split(/[\n,;]+/).map(l=>l.trim()).filter(Boolean);
      const matches = lines.map(r => ({ noPesanan: '', noResi: r }));
      const result = updateStatusPicking(matches);
      setManualMsg(`✅ ${result.updated} pesanan diupdate.${result.notFound>0?' '+result.notFound+' tidak ditemukan.':''}`);
      setManualNoPesanan(''); setManualNoResi('');
      setTimeout(() => setManualMsg(''), 4000);
      manualRef.current?.focus();
      return;
    }
    // Bisa input multi-line (paste dari Excel/scanner bulk)
    const lines = pesanan.split(/[\n,;]+/).map(l=>l.trim()).filter(Boolean);
    const matches: { noPesanan: string; noResi: string }[] = [];
    for (const line of lines) {
      // Format: "NO_PESANAN NO_RESI" atau "NO_PESANAN" saja
      const parts = line.split(/\s+/);
      matches.push({ noPesanan: parts[0], noResi: parts[1] || resi || '' });
    }
    const result = updateStatusPicking(matches);
    setManualMsg(`✅ ${result.updated} item diupdate ke "Dipicking".${result.notFound>0?' '+result.notFound+' tidak ditemukan.':''}`);
    setManualNoPesanan(''); setManualNoResi('');
    setTimeout(() => setManualMsg(''), 4000);
    manualRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (manualNoPesanan.trim() || manualNoResi.trim()) handleManualSubmit();
    }
  };

  const handleResiKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (manualNoPesanan.trim() || manualNoResi.trim()) handleManualSubmit();
    }
  };

  // Detail popup: bisa satu atau gabungan dari selected
  const detailGroup = detailKey ? grouped.get(detailKey) : null;
  const selectedGroups = selected.size>0 ? Array.from(selected).map(k=>grouped.get(k)!).filter(Boolean) : [];

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📋 Daftar Picking</h2>
          <p className="mt-1 text-sm text-slate-500">{picking.length>0?`${groupList.length} resi • ${picking.length} item • ✅ ${confirmed.size} dikonfirmasi`:'Input manual / scanner'}</p>
        </div>
        {picking.length>0 && (
        <div className="flex gap-2">
          {selected.size>0&&<button onClick={()=>setDetailKey(null)} className="rounded-lg bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-200">📋 Detail ({selected.size})</button>}
          <button onClick={selectAll} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-brand-50">☑ Semua</button>
          <button onClick={deselectAll} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-brand-50">☐ Batal</button>
          <button onClick={confirmSelected} disabled={selected.size===0} className={`rounded-lg px-3 py-1 text-xs font-semibold text-white transition ${selected.size===0?'bg-slate-300 cursor-not-allowed':'bg-emerald-500 hover:bg-emerald-600'}`}>✅ Konfirmasi {selected.size>0?selected.size:''} → QC</button>
        </div>
        )}
      </div>

      {/* ── Manual Input Scanner ── */}
      <div className="mt-3 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/30 p-4">
        <p className="text-xs font-semibold text-brand-600 mb-3">🔫 Scan / Input Manual — isi No. Pesanan <span className="text-slate-400">atau</span> No. Resi (minimal salah satu)</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] font-semibold text-slate-500">No. Pesanan</label>
            <input
              ref={manualRef}
              type="text"
              value={manualNoPesanan}
              onChange={e => setManualNoPesanan(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scan / ketik No. Pesanan"
              className="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              autoFocus
            />
            <p className="text-[10px] text-slate-400 mt-0.5">Multi: pisahkan koma, titik koma, atau enter</p>
          </div>
          <span className="text-xs text-slate-400 pb-2">atau</span>
          <div className="w-40">
            <label className="text-[10px] font-semibold text-slate-500">No. Resi</label>
            <input
              ref={resiRef}
              type="text"
              value={manualNoResi}
              onChange={e => setManualNoResi(e.target.value)}
              onKeyDown={handleResiKeyDown}
              placeholder="Scan / ketik No. Resi"
              className="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <button
            onClick={handleManualSubmit}
            className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition whitespace-nowrap"
          >
            ➕ Picking
          </button>
        </div>
        {manualMsg && (
          <p className={`mt-2 text-xs font-semibold ${manualMsg.startsWith('✅')?'text-emerald-600':'text-red-500'}`}>{manualMsg}</p>
        )}
      </div>

      {picking.length === 0 && (
      <div className="mt-4 text-center py-8 text-slate-400">
        <p className="text-4xl mb-2">📋</p><p className="font-semibold">Belum ada item picking.</p><p className="text-sm mt-1">Scan atau input No. Pesanan di atas, atau upload file picking di tab Dashboard.</p>
      </div>
      )}

      {picking.length > 0 && (
      <>
      {/* Filters */}
      <div className="mt-3 flex flex-wrap gap-2">
        <select value={filterMp} onChange={e=>{setFilterMp(e.target.value);deselectAll();}} className="rounded-lg border bg-white px-2 py-1 text-xs text-slate-600">
          <option value="semua">🛒 Semua Marketplace</option>
          {allMp.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filterToko} onChange={e=>{setFilterToko(e.target.value);deselectAll();}} className="rounded-lg border bg-white px-2 py-1 text-xs text-slate-600">
          <option value="semua">🏪 Semua Toko</option>
          {allToko.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead><tr className="bg-brand-50 text-xs uppercase text-brand-500">
            {['☑','No. Resi','No. Pesanan','MP','Toko','Item','Aksi'].map(c => <th key={c} className="px-2 py-3 font-semibold whitespace-nowrap">{c}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {groupList.map(([key, g], gi) => {
              const isSel = selected.has(key);
              const isConf = confirmed.has(key);
              if (isConf) return null;
              return (
                <tr key={key} className={`cursor-pointer transition ${gi%2===0?'bg-white':'bg-blue-50/20'} ${isSel?'ring-1 ring-brand-300':''} hover:bg-brand-50/50`} onClick={()=>setDetailKey(key)}>
                  <td className="px-2 py-2.5" onClick={e=>{e.stopPropagation();toggleSelect(key);}}><input type="checkbox" checked={isSel} onChange={()=>{}} className="rounded accent-brand-500 w-4 h-4 cursor-pointer" /></td>
                  <td className="px-2 py-2.5 font-mono text-[11px] text-slate-600 font-semibold">{g.noResi}</td>
                  <td className="px-2 py-2.5 font-mono text-xs text-slate-700">{g.noPesanan}</td>
                  <td className="px-2 py-2.5"><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${g.marketplace==='Shopee'?'bg-orange-100 text-orange-700':g.marketplace==='TikTok Shop'?'bg-slate-200 text-slate-700':g.marketplace==='Lazada'?'bg-blue-100 text-blue-700':'bg-slate-100 text-slate-600'}`}>{g.marketplace}</span></td>
                  <td className="px-2 py-2.5 text-xs text-slate-600 max-w-[90px] truncate" title={g.namaToko}>{g.namaToko||'-'}</td>
                  <td className="px-2 py-2.5"><span className="font-semibold text-brand-700">{g.items.length} SKU</span><span className="text-slate-400 ml-1 text-[10px]">🔍 klik</span></td>
                  <td className="px-2 py-2.5" onClick={e=>e.stopPropagation()}><button onClick={()=>confirmOne(key)} className="rounded-lg bg-emerald-500 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-600 whitespace-nowrap">✅ Selesai</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>
      )}

      {/* ── Detail Popup Modal ── */}
      {(detailGroup||selectedGroups.length>0)&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={()=>{setDetailKey(null);setSelected(new Set());}}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={e=>e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-5 py-4 rounded-t-2xl flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-slate-800">📋 Detail Picking {selectedGroups.length>1?`(${selectedGroups.length} pesanan)`:`${selectedGroups.length===0?'':''}`}</p>
                {detailGroup&&<p className="text-xs text-slate-400">{detailGroup.noResi} • {detailGroup.marketplace} • {detailGroup.namaToko||'-'}</p>}
              </div>
              <button onClick={()=>{setDetailKey(null);setSelected(new Set());}} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {(detailGroup?[detailGroup]:selectedGroups).map(g=>(
                <div key={g.noResi} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-mono font-bold text-slate-700">{g.noResi}</span>
                    <span className="text-slate-400">|</span>
                    <span className="font-semibold">{g.marketplace}</span>
                    <span className="text-slate-400">|</span>
                    <span>{g.namaToko||'-'}</span>
                    <span className="text-slate-400">|</span>
                    <span>{g.items.length} SKU</span>
                    <span className="ml-auto"><button onClick={()=>confirmOne(`${g.noPesanan}||${g.noResi}`)} className="rounded-lg bg-emerald-500 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-600">✅ Selesai</button></span>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead><tr className="bg-brand-50/50 text-xs text-brand-500">{['SKU','Nama Produk','Qty','Harga'].map(c=><th key={c} className="px-3 py-2 font-semibold">{c}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {g.items.map(item=>(
                        <tr key={item.id} className="hover:bg-brand-50/30">
                          <td className="px-3 py-2.5 font-mono text-xs text-brand-700">{item.sku||'-'}</td>
                          <td className="px-3 py-2.5 text-xs" title={item.namaProduk}>{item.namaProduk}</td>
                          <td className="px-3 py-2.5 font-bold text-slate-800">{item.kuantity}</td>
                          <td className="px-3 py-2.5 text-xs whitespace-nowrap">Rp {item.hargaJual.toLocaleString('id-ID')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 bg-white border-t px-5 py-3 rounded-b-2xl flex justify-between">
              <span className="text-xs text-slate-400 self-center">Klik di luar untuk menutup</span>
              {selectedGroups.length>1&&(
                <button onClick={confirmSelected} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">✅ Konfirmasi Semua ({selectedGroups.length}) → QC</button>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmed.size > 0 && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm">
          <p className="font-semibold text-emerald-700">✅ {confirmed.size} resi sudah dikonfirmasi & dipindahkan ke QC</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* LOGISTIK TAB                                                      */
/* ═══════════════════════════════════════════════════════════════════ */
type LogistikSubTab = 'handover' | 'pengantaran' | 'po';

function LogistikTab() {
  const { allRows } = useAgregasi();
  const [subTab, setSubTab] = useState<LogistikSubTab>('handover');

  const fleet = useMemo(() => {
    if (typeof window === 'undefined') return [];
    try { const r = localStorage.getItem('mma_fleet_master'); return r ? JSON.parse(r) : []; } catch { return []; }
  }, []);
  const availableFleet = fleet.filter((f: any) => f.status === 'Tersedia');

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🚛 Logistik</h2>
      <p className="mt-1 text-sm text-slate-500">
        Handover, pengantaran penjualan offline & penjemputan PO • {availableFleet.length} kendaraan tersedia
      </p>

      <div className="mt-4 flex gap-1 rounded-2xl bg-slate-100 p-1 w-fit">
        {([
          { key: 'handover' as const, label: '📋 Handover', count: allRows.filter(r => r.statusProses === 'Dikirim' && r.handoverId).length },
          { key: 'pengantaran' as const, label: '🧾 Pengantaran', count: null },
          { key: 'po' as const, label: '🛒 PO Pickup', count: null },
        ]).map(s => (
          <button key={s.key} onClick={() => setSubTab(s.key)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${subTab === s.key ? 'bg-brand-500 text-white shadow' : 'text-slate-600 hover:bg-white'}`}>
            {s.label}{s.count !== null ? ` (${s.count})` : ''}
          </button>
        ))}
      </div>

      {subTab === 'handover' && <LogistikHandover allRows={allRows} />}
      {subTab === 'pengantaran' && <LogistikPengantaran fleet={availableFleet} />}
      {subTab === 'po' && <LogistikPO fleet={availableFleet} />}
    </div>
  );
}

function LogistikHandover({ allRows }: { allRows: AgregasiRow[] }) {
  const hoItems = allRows.filter(r => r.statusProses === 'Dikirim' && r.handoverId);
  const grouped = new Map<string, { hoId: string; handoverAt: string; kurir: string; items: AgregasiRow[] }>();
  for (const r of hoItems) {
    const hoId = r.handoverId!;
    if (!grouped.has(hoId)) grouped.set(hoId, { hoId, handoverAt: r.handoverAt || '', kurir: r.kurir || '-', items: [] });
    grouped.get(hoId)!.items.push(r);
  }
  const hoList = Array.from(grouped.values()).sort((a, b) => b.handoverAt.localeCompare(a.handoverAt));
  // Helper: hitung unique orders (per noPesanan||noResi), bukan per SKU
  const countOrders = (items: AgregasiRow[]) => new Set(items.map(r => `${r.noPesanan}||${r.noResi}`)).size;

  // Archive: completed handovers with signature/photo
  const [archive, setArchive] = useState<any[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const r = localStorage.getItem('mma_ho_archive'); return r ? JSON.parse(r) : []; } catch { return []; }
  });
  const [viewMode, setViewMode] = useState<'active' | 'archive'>('active');
  const [selectedHO, setSelectedHO] = useState<string | null>(null);
  const [petugas, setPetugas] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const signatureRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const activeHOs = hoList.filter(ho => !archive.find((a: any) => a.hoId === ho.hoId));
  const archiveHOs = archive.sort((a: any, b: any) => b.confirmedAt?.localeCompare(a.confirmedAt || '') || 0);

  // Signature canvas handlers
  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.moveTo(x, y);
  };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const stopDraw = () => setIsDrawing(false);
  const clearSignature = () => {
    const canvas = signatureRef.current;
    if (canvas) { const ctx = canvas.getContext('2d'); if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); }
  };

  // Camera
  const openCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch { alert('Gagal akses kamera'); setShowCamera(false); }
  };
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0);
    setPhotoData(canvas.toDataURL('image/jpeg'));
    closeCamera();
  };
  const closeCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setShowCamera(false);
  };

  // Confirm handover
  const confirmHandover = () => {
    if (!selectedHO || !petugas.trim()) { alert('Nama petugas logistik wajib diisi.'); return; }
    const ho = hoList.find(h => h.hoId === selectedHO);
    if (!ho) return;
    const sigData = signatureRef.current?.toDataURL() || '';
    const record = {
      hoId: ho.hoId, kurir: ho.kurir, items: ho.items.map(r => ({ noPesanan: r.noPesanan, noResi: r.noResi, sku: r.sku, namaProduk: r.namaProduk, qty: r.kuantity, marketplace: r.marketplace, namaToko: r.namaToko, jenisPaket: r.jenisPaket })),
      totalPaket: countOrders(ho.items), skuCount: ho.items.length, handoverAt: ho.handoverAt, confirmedAt: new Date().toISOString(),
      petugas, signature: sigData, photo: photoData,
    };
    const newArchive = [...archive, record];
    setArchive(newArchive);
    try { localStorage.setItem('mma_ho_archive', JSON.stringify(newArchive)); } catch {}
    setSelectedHO(null); setShowConfirm(false); setPetugas(''); setPhotoData(null); clearSignature();
  };

  // Download handover as HTML
  const downloadHO = (record: any) => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Handover ${record.hoId}</title><style>body{font-family:Arial;max-width:800px;margin:40px auto;padding:20px}h1{color:#4f46e5}.label{color:#64748b;font-size:12px}.val{font-weight:bold}.row{display:flex;justify-content:space-between;margin:8px 0}.box{border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:12px 0}.sig{max-width:300px;border:1px solid #cbd5e1;border-radius:8px}.photo{max-width:400px;border-radius:8px}table{width:100%;border-collapse:collapse;font-size:11px}td,th{border:1px solid #e2e8f0;padding:5px 6px;text-align:left}th{background:#f1f5f9}</style></head><body><h1>📋 Handover #${record.hoId}</h1><p class="label">Dokumen Serah Terima Resmi — MMA ProSync</p><div class="box"><div class="row"><span class="label">Handover ID</span><span class="val">${record.hoId}</span></div><div class="row"><span class="label">Kurir</span><span class="val">🚚 ${record.kurir}</span></div><div class="row"><span class="label">Total Paket</span><span class="val">${record.totalPaket}</span></div><div class="row"><span class="label">Petugas Logistik</span><span class="val">${record.petugas}</span></div><div class="row"><span class="label">Waktu Handover</span><span class="val">${new Date(record.handoverAt).toLocaleString('id-ID')}</span></div><div class="row"><span class="label">Waktu Konfirmasi</span><span class="val">${new Date(record.confirmedAt).toLocaleString('id-ID')}</span></div></div><div class="box"><p class="label">📦 Daftar Paket</p><table><thead><tr><th>No. Pesanan</th><th>No. Resi</th><th>SKU</th><th>Nama Produk</th><th>Qty</th><th>MP</th><th>Toko</th><th>Jenis</th></tr></thead><tbody>${record.items.map((i: any) => `<tr><td><b>${i.noPesanan}</b></td><td>${i.noResi||'-'}</td><td style="font-family:monospace;font-size:10px">${i.sku||'-'}</td><td>${i.namaProduk||'-'}</td><td>${i.qty||1}</td><td>${i.marketplace}</td><td>${i.namaToko||'-'}</td><td>${i.jenisPaket==='Besar'?'🚛 Besar':'📦 Reguler'}</td></tr>`).join('')}</tbody></table></div>${record.signature?`<div class="box"><p class="label">✍️ Tanda Tangan (Pihak Drop Off)</p><img src="${record.signature}" class="sig" /></div>`:''}${record.photo?`<div class="box"><p class="label">📸 Foto Bukti</p><img src="${record.photo}" class="photo" /></div>`:''}<p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:30px">Diterbitkan oleh MMA ProSync — ${new Date().toLocaleDateString('id-ID')}</p></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Handover_${record.hoId}.html`; a.click();
    URL.revokeObjectURL(url);
  };

  // Active HO view
  if (viewMode === 'active') {
    if (hoList.length === 0) return <div className="mt-6 text-center py-10 text-slate-400"><p className="text-4xl mb-2">📋</p><p className="font-semibold">Belum ada data Handover.</p><p className="text-sm mt-1">Handover akan muncul setelah Runner Scanner menyelesaikan proses.</p></div>;

    return (
      <div className="mt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="grid grid-cols-3 gap-3 flex-1 mr-4">
            <div className="rounded-xl bg-emerald-50 p-3 text-center border border-emerald-200"><p className="text-2xl font-bold text-emerald-600">{activeHOs.length}</p><p className="text-xs text-emerald-500">Aktif</p></div>
            <div className="rounded-xl bg-blue-50 p-3 text-center border border-blue-200"><p className="text-2xl font-bold text-blue-600">{new Set(hoItems.map(r => `${r.noPesanan}||${r.noResi}`)).size}</p><p className="text-xs text-blue-500">Pesanan</p></div>
            <div className="rounded-xl bg-slate-50 p-3 text-center border border-slate-200"><p className="text-2xl font-bold text-slate-600">{archiveHOs.length}</p><p className="text-xs text-slate-500">Arsip</p></div>
          </div>
          <button onClick={() => setViewMode('archive')} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200">📜 Arsip ({archiveHOs.length})</button>
        </div>

        {activeHOs.map(ho => {
          const mpSet = new Set(ho.items.map(r => r.marketplace));
          const tokoSet = new Set(ho.items.map(r => r.namaToko).filter(Boolean));
          return (
            <div key={ho.hoId} className="rounded-xl border border-slate-200 bg-white p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-mono font-bold text-indigo-700 text-sm">{ho.hoId}</p>
                  <p className="text-[10px] text-slate-400">{new Date(ho.handoverAt).toLocaleString('id-ID')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">🚚 {ho.kurir}</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{countOrders(ho.items)} paket</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {Array.from(mpSet).map(mp => (<span key={mp} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-600 border border-blue-200">{mp}</span>))}
                {Array.from(tokoSet).map(t => (<span key={t} className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500 border">🏪 {t}</span>))}
              </div>
              {/* Grouped by No Pesanan */}
              <details className="mb-2" open>
                <summary className="cursor-pointer text-[10px] text-slate-400 hover:text-slate-600">📦 {countOrders(ho.items)} pesanan ({ho.items.length} SKU) ▼</summary>
                <div className="mt-2 space-y-2 max-h-52 overflow-y-auto bg-slate-50 rounded-lg p-2">
                  {(() => {
                    const byOrder = new Map<string, AgregasiRow[]>();
                    for (const item of ho.items) {
                      const k = item.noPesanan;
                      if (!byOrder.has(k)) byOrder.set(k, []);
                      byOrder.get(k)!.push(item);
                    }
                    return Array.from(byOrder.entries()).map(([noPesanan, items]) => {
                      const first = items[0];
                      return (
                        <div key={noPesanan} className="bg-white rounded-lg border border-slate-100 p-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono font-bold text-slate-700 text-[11px]">📦 {noPesanan}</span>
                            <span className="text-[10px] text-slate-400">{items.length} SKU</span>
                          </div>
                          <div className="text-[9px] text-slate-400 mb-1">Resi: {first.noResi || '-'} • {first.marketplace}{first.namaToko ? ` • ${first.namaToko}` : ''}</div>
                          {items.map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] py-0.5 border-b border-slate-50 last:border-0">
                              <span className="font-mono text-indigo-500 w-16 truncate" title={item.sku}>{item.sku || '-'}</span>
                              <span className="text-slate-600 flex-1 truncate" title={item.namaProduk}>{item.namaProduk}</span>
                              <span className="text-slate-400 whitespace-nowrap">×{item.kuantity}</span>
                            </div>
                          ))}
                        </div>
                      );
                    });
                  })()}
                </div>
              </details>
              <button onClick={() => { setSelectedHO(ho.hoId); setShowConfirm(true); }}
                className="w-full rounded-lg bg-brand-500 py-2 text-xs font-bold text-white hover:bg-brand-600 transition">
                ✍️ Konfirmasi & Tanda Tangan
              </button>
            </div>
          );
        })}

        {/* Confirmation Modal */}
        {showConfirm && selectedHO && (() => {
          const ho = hoList.find(h => h.hoId === selectedHO)!;
          const mpSet = new Set(ho.items.map(r => r.marketplace));
          const tokoSet = new Set(ho.items.map(r => r.namaToko).filter(Boolean));
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl p-6">
                <h3 className="text-lg font-bold text-slate-800">📋 Konfirmasi Handover</h3>
                <p className="text-xs text-slate-400 mt-1">{ho.hoId}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-slate-50 rounded-xl p-3">
                  <div><span className="text-slate-400">Kurir:</span> <span className="font-semibold">{ho.kurir}</span></div>
                  <div><span className="text-slate-400">Paket:</span> <span className="font-semibold">{countOrders(ho.items)} pesanan ({ho.items.length} SKU)</span></div>
                  <div><span className="text-slate-400">Marketplace:</span> <span className="font-semibold">{Array.from(mpSet).join(', ')}</span></div>
                  <div><span className="text-slate-400">Toko:</span> <span className="font-semibold">{Array.from(tokoSet).join(', ')||'-'}</span></div>
                  <div className="col-span-2"><span className="text-slate-400">Waktu:</span> <span className="font-semibold">{new Date().toLocaleString('id-ID')}</span></div>
                </div>
                {/* SKU detail di modal — grouped by No Pesanan */}
                <details className="mt-3" open>
                  <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">📦 {countOrders(ho.items)} pesanan ({ho.items.length} SKU) ▼</summary>
                  <div className="mt-2 space-y-2 max-h-56 overflow-y-auto bg-slate-50 rounded-lg p-2">
                    {(() => {
                      const byOrder = new Map<string, AgregasiRow[]>();
                      for (const item of ho.items) {
                        const k = item.noPesanan;
                        if (!byOrder.has(k)) byOrder.set(k, []);
                        byOrder.get(k)!.push(item);
                      }
                      return Array.from(byOrder.entries()).map(([noPesanan, items]) => (
                        <div key={noPesanan} className="bg-white rounded-lg border border-slate-100 p-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono font-bold text-slate-700 text-[11px]">📦 {noPesanan}</span>
                            <span className="text-[10px] text-slate-400">{items.length} SKU</span>
                          </div>
                          <div className="text-[9px] text-slate-400 mb-1">{items[0].noResi || '-'} • {items[0].marketplace}{items[0].namaToko ? ` • ${items[0].namaToko}` : ''}</div>
                          {items.map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] py-0.5 border-b border-slate-50 last:border-0">
                              <span className="font-mono text-indigo-500 w-16 truncate" title={item.sku}>{item.sku || '-'}</span>
                              <span className="text-slate-600 flex-1 truncate" title={item.namaProduk}>{item.namaProduk}</span>
                              <span className="text-slate-400">×{item.kuantity}</span>
                              <span className="text-slate-400">Rp {item.hargaJual.toLocaleString('id-ID')}</span>
                            </div>
                          ))}
                        </div>
                      ));
                    })()}
                  </div>
                </details>
                <div className="mt-3"><span className="text-xs font-semibold text-slate-600">Petugas Logistik</span><input value={petugas} onChange={e => setPetugas(e.target.value)} placeholder="Nama petugas logistik" className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /></div>
                <div className="mt-3"><span className="text-xs font-semibold text-slate-600">✍️ Tanda Tangan (Pihak Drop Off)</span><canvas ref={signatureRef} width={350} height={120} className="mt-1 w-full rounded-xl border-2 border-dashed border-slate-300 bg-white touch-none" onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} /><button onClick={clearSignature} className="mt-1 text-xs text-red-400 hover:text-red-600">Hapus Tanda Tangan</button></div>
                <div className="mt-3"><span className="text-xs font-semibold text-slate-600">📸 Foto Bukti</span>
                  {!photoData ? (
                    !showCamera ? <button onClick={openCamera} className="mt-1 w-full rounded-xl border-2 border-dashed border-slate-300 py-8 text-sm text-slate-400 hover:bg-slate-50">📷 Buka Kamera</button>
                    : <div><video ref={videoRef} className="w-full rounded-xl bg-black" autoPlay playsInline /><div className="flex gap-2 mt-2"><button onClick={capturePhoto} className="flex-1 rounded-lg bg-emerald-500 py-2 text-xs font-bold text-white">📸 Ambil Foto</button><button onClick={closeCamera} className="rounded-lg bg-slate-100 px-4 py-2 text-xs text-slate-600">✕</button></div></div>
                  ) : (
                    <div><img src={photoData} className="w-full rounded-xl" alt="Bukti" /><button onClick={() => setPhotoData(null)} className="mt-1 text-xs text-red-400">Hapus Foto</button></div>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => { setShowConfirm(false); setSelectedHO(null); setPetugas(''); setPhotoData(null); clearSignature(); closeCamera(); }} className="flex-1 rounded-xl bg-slate-100 py-2 text-sm font-semibold text-slate-600">Batal</button>
                  <button onClick={confirmHandover} className="flex-1 rounded-xl bg-emerald-500 py-2 text-sm font-bold text-white hover:bg-emerald-600">✅ Konfirmasi Selesai</button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // Archive view
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-slate-700">📜 Arsip Handover ({archiveHOs.length})</h3>
        <button onClick={() => setViewMode('active')} className="rounded-xl bg-brand-100 px-4 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-200">← Kembali ke Aktif</button>
      </div>
      {archiveHOs.length === 0 ? (
        <div className="text-center py-10 text-slate-400"><p className="text-4xl mb-2">📜</p><p className="font-semibold">Belum ada arsip handover.</p><p className="text-sm mt-1">Konfirmasi handover terlebih dahulu.</p></div>
      ) : (
        <div className="space-y-3">
          {archiveHOs.map((record: any) => (
            <div key={record.hoId} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-mono font-bold text-indigo-700 text-sm">{record.hoId}</p>
                  <p className="text-[10px] text-slate-400">Dikonfirmasi: {new Date(record.confirmedAt).toLocaleString('id-ID')}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">✅ Selesai</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs text-slate-600 mb-2">
                <div>🚚 {record.kurir}</div>
                <div>📦 {record.totalPaket} pesanan ({record.skuCount || record.totalPaket} SKU)</div>
                <div>👤 {record.petugas}</div>
                <div>🕐 {new Date(record.handoverAt).toLocaleString('id-ID')}</div>
              </div>
              {/* SKU detail in archive */}
              {record.items && record.items.length > 0 && (
                <details className="mb-2" open>
                  <summary className="cursor-pointer text-[10px] text-slate-400 hover:text-slate-600">📦 {record.totalPaket} pesanan ({record.items.length} SKU) ▼</summary>
                  <div className="mt-2 space-y-2 max-h-52 overflow-y-auto bg-slate-50 rounded-lg p-2">
                    {(() => {
                      const byOrder = new Map<string, any[]>();
                      for (const item of record.items) {
                        const k = item.noPesanan;
                        if (!byOrder.has(k)) byOrder.set(k, []);
                        byOrder.get(k)!.push(item);
                      }
                      return Array.from(byOrder.entries()).map(([noPesanan, items]) => (
                        <div key={noPesanan} className="bg-white rounded-lg border border-slate-100 p-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono font-bold text-slate-700 text-[11px]">📦 {noPesanan}</span>
                            <span className="text-[10px] text-slate-400">{items.length} SKU</span>
                          </div>
                          <div className="text-[9px] text-slate-400 mb-1">Resi: {items[0].noResi || '-'} • {items[0].marketplace}</div>
                          {items.map((item: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] py-0.5 border-b border-slate-50 last:border-0">
                              <span className="font-mono text-indigo-500 w-16 truncate" title={item.sku}>{item.sku || '-'}</span>
                              <span className="text-slate-600 flex-1 truncate" title={item.namaProduk}>{item.namaProduk || '-'}</span>
                              <span className="text-slate-400">×{item.qty || 1}</span>
                            </div>
                          ))}
                        </div>
                      ));
                    })()}
                  </div>
                </details>
              )}
              {record.signature && <p className="text-[10px] text-slate-400">✍️ Bertanda tangan</p>}
              {record.photo && <p className="text-[10px] text-slate-400">📸 Ada foto bukti</p>}
              <button onClick={() => downloadHO(record)}
                className="mt-2 w-full rounded-lg bg-indigo-50 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition">
                📥 Download Bukti Handover
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LogistikPengantaran({ fleet }: { fleet: any[] }) {
  const [entries, setEntries] = useState<any[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const r = localStorage.getItem('mma_pengantaran_offline'); return r ? JSON.parse(r) : []; } catch { return []; }
  });
  const [form, setForm] = useState({ noNota: '', penerima: '', alamat: '', noHp: '', kendaraanId: '', catatan: '' });
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState(false);

  const save = () => {
    if (!form.noNota.trim() || !form.penerima.trim()) { setErr('No Nota & Penerima wajib.'); return; }
    const k = fleet.find((f: any) => f.id === form.kendaraanId);
    setEntries((prev: any[]) => [{ id: `del-${Date.now()}`, ...form, kendaraan: k?.nama || '-', platNomor: k?.platNomor || '-', tanggal: new Date().toISOString().slice(0, 10), jam: new Date().toLocaleTimeString('id-ID'), status: 'Diantar' }, ...prev]);
    setForm({ noNota: '', penerima: '', alamat: '', noHp: '', kendaraanId: '', catatan: '' });
    setErr(''); setSuccess(true); setTimeout(() => setSuccess(false), 3000);
  };

  useEffect(() => { try { localStorage.setItem('mma_pengantaran_offline', JSON.stringify(entries)); } catch {} }, [entries]);

  return (
    <div className="mt-4">
      {success && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">✅ Pengantaran tercatat.</p>}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-bold text-slate-700 mb-3">🧾 Input Pengantaran Offline</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input value={form.noNota} onChange={e => setForm({ ...form, noNota: e.target.value })} placeholder="No Nota / Invoice *" className="rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          <input value={form.penerima} onChange={e => setForm({ ...form, penerima: e.target.value })} placeholder="Nama Penerima *" className="rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          <input value={form.noHp} onChange={e => setForm({ ...form, noHp: e.target.value })} placeholder="No HP Penerima" className="rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          <input value={form.alamat} onChange={e => setForm({ ...form, alamat: e.target.value })} placeholder="Alamat Pengantaran" className="rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          <select value={form.kendaraanId} onChange={e => setForm({ ...form, kendaraanId: e.target.value })} className="rounded-xl border px-3 py-2 text-sm bg-white focus:border-brand-500 focus:outline-none">
            <option value="">Pilih Kendaraan</option>
            {fleet.map((f: any) => <option key={f.id} value={f.id}>{f.nama} ({f.platNomor})</option>)}
          </select>
          <input value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} placeholder="Catatan (opsional)" className="rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
        <button onClick={save} className="mt-3 rounded-xl bg-brand-500 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-700">💾 Catat Pengantaran</button>
      </div>
      {entries.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs"><thead><tr className="bg-blue-50 text-xs uppercase text-blue-600">{['No Nota','Penerima','Alamat','Kendaraan','Tanggal','Jam','Status'].map(c => <th key={c} className="px-2 py-3 font-semibold whitespace-nowrap">{c}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-50 bg-white">{entries.map((e: any) => (<tr key={e.id}><td className="px-2 py-2.5 font-mono font-semibold text-slate-700">{e.noNota}</td><td className="px-2 py-2.5">{e.penerima}</td><td className="px-2 py-2.5 text-slate-500 max-w-[120px] truncate">{e.alamat||'-'}</td><td className="px-2 py-2.5 text-[10px]">{e.kendaraan} <span className="text-slate-400">{e.platNomor}</span></td><td className="px-2 py-2.5">{e.tanggal}</td><td className="px-2 py-2.5">{e.jam}</td><td className="px-2 py-2.5"><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{e.status}</span></td></tr>))}</tbody></table></div>)}
    </div>);
}

function LogistikPO({ fleet }: { fleet: any[] }) {
  /* ── Tarik PO dari data HPP Purchasing (group by noPO) ── */
  const [poGroups, setPoGroups] = useState<any[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const hppRaw = localStorage.getItem('mma_hpp_purchases');
      if (!hppRaw) return [];
      const hppData = JSON.parse(hppRaw);
      // Group by noPO
      const map = new Map<string, any>();
      for (const p of hppData) {
        const g = map.get(p.noPO) || {
          id: p.noPO,
          noPO: p.noPO,
          supplierNama: p.supplierNama,
          supplierId: p.supplierId,
          tanggal: p.tanggal,
          items: [] as any[],
          totalQty: 0,
          total: 0,
          pickupStatus: (p.pickupStatus || 'belum') as string,
          petugasLogistik: p.petugasLogistik || '',
          kendaraanId: p.kendaraanId || '',
          kendaraanNama: p.kendaraanNama || '',
          platNomor: p.platNomor || '',
          metodeBayar: p.metodeBayar,
          lunas: true,
        };
        g.items.push({ sku: p.sku, namaSku: p.namaSku, qty: p.qty, hargaBeli: p.hargaBeli, subtotal: p.total });
        g.totalQty += p.qty;
        g.total += p.total;
        if (!p.lunas) g.lunas = false;
        // Gunakan status pickup tertinggi
        const statusOrder = ['belum', 'sedang', 'sampai'];
        const currentIdx = statusOrder.indexOf(g.pickupStatus);
        const newIdx = statusOrder.indexOf(p.pickupStatus || 'belum');
        if (newIdx > currentIdx) g.pickupStatus = p.pickupStatus || 'belum';
        if (p.petugasLogistik && !g.petugasLogistik) g.petugasLogistik = p.petugasLogistik;
        if ((p as any).kendaraanId && !g.kendaraanId) { g.kendaraanId = (p as any).kendaraanId; g.kendaraanNama = (p as any).kendaraanNama; g.platNomor = (p as any).platNomor; }
        map.set(p.noPO, g);
      }
      return Array.from(map.values()).sort((a: any, b: any) => b.noPO.localeCompare(a.noPO));
    } catch { return []; }
  });

  /* ── Supplier address lookup ── */
  const getSupplierAlamat = (supplierId: string, supplierNama: string): string => {
    try {
      const raw = localStorage.getItem('mma_supplier_master');
      if (!raw) return supplierNama;
      const suppliers = JSON.parse(raw);
      const found = suppliers.find((s: any) => s.id === supplierId);
      return found?.alamat || supplierNama;
    } catch { return supplierNama; }
  };

  /* ── Update HPP data di localStorage ── */
  const updateHppData = (noPO: string, updates: Record<string, any>) => {
    try {
      const raw = localStorage.getItem('mma_hpp_purchases');
      if (!raw) return;
      const hppData = JSON.parse(raw);
      const updated = hppData.map((p: any) =>
        p.noPO === noPO ? { ...p, ...updates } : p
      );
      localStorage.setItem('mma_hpp_purchases', JSON.stringify(updated));
    } catch {}
  };

  /* ── Reload dari localStorage ── */
  const reloadFromStorage = () => {
    try {
      const hppRaw = localStorage.getItem('mma_hpp_purchases');
      if (!hppRaw) { setPoGroups([]); return; }
      const hppData = JSON.parse(hppRaw);
      const map = new Map<string, any>();
      for (const p of hppData) {
        const g = map.get(p.noPO) || {
          id: p.noPO, noPO: p.noPO,
          supplierNama: p.supplierNama, supplierId: p.supplierId,
          tanggal: p.tanggal,
          items: [] as any[],
          totalQty: 0, total: 0,
          pickupStatus: 'belum',
          petugasLogistik: '', kendaraanId: '', kendaraanNama: '', platNomor: '',
          metodeBayar: p.metodeBayar, lunas: true,
        };
        g.items.push({ sku: p.sku, namaSku: p.namaSku, qty: p.qty, hargaBeli: p.hargaBeli, subtotal: p.total });
        g.totalQty += p.qty;
        g.total += p.total;
        if (!p.lunas) g.lunas = false;
        const statusOrder = ['belum', 'sedang', 'sampai'];
        const cur = statusOrder.indexOf(g.pickupStatus);
        const nxt = statusOrder.indexOf(p.pickupStatus || 'belum');
        if (nxt > cur) g.pickupStatus = p.pickupStatus || 'belum';
        if (p.petugasLogistik && !g.petugasLogistik) g.petugasLogistik = p.petugasLogistik;
        if ((p as any).kendaraanId && !g.kendaraanId) { g.kendaraanId = (p as any).kendaraanId; g.kendaraanNama = (p as any).kendaraanNama; g.platNomor = (p as any).platNomor; }
        map.set(p.noPO, g);
      }
      setPoGroups(Array.from(map.values()).sort((a: any, b: any) => b.noPO.localeCompare(a.noPO)));
    } catch {}
  };

  /* ── Assign kendaraan & petugas → pickupStatus: 'sedang' ── */
  const mulaiPickup = (noPO: string, kendaraanId: string, petugas: string) => {
    if (!petugas.trim()) return;
    const k = fleet.find((f: any) => f.id === kendaraanId);
    updateHppData(noPO, {
      pickupStatus: 'sedang',
      petugasLogistik: petugas.trim(),
      kendaraanId: kendaraanId,
      kendaraanNama: k?.nama || '',
      platNomor: k?.platNomor || '',
    });
    reloadFromStorage();
  };

  /* ── Konfirmasi Sampai → pickupStatus: 'sampai' + inventory check ── */
  const konfirmasiSampai = (noPO: string) => {
    const po = poGroups.find((p: any) => p.noPO === noPO);
    if (!po) return;

    // Update HPP data
    updateHppData(noPO, { pickupStatus: 'sampai' });

    // Push ke inventory checklist
    try {
      const existing = JSON.parse(localStorage.getItem('mma_po_inventory_check') || '[]');
      const items = po.items.map((item: any) => ({
        sku: item.sku,
        nama: item.namaSku,
        qty: item.qty,
        noPO: po.noPO,
        supplier: po.supplierNama,
        sampaiAt: new Date().toISOString(),
        checked: false,
        petugas: po.petugasLogistik || '-',
        kendaraan: po.kendaraanNama ? `${po.kendaraanNama} (${po.platNomor || '-'})` : '-',
      }));
      // Hapus duplikat noPO lama
      const filtered = existing.filter((e: any) => e.noPO !== noPO);
      localStorage.setItem('mma_po_inventory_check', JSON.stringify([...filtered, ...items]));
    } catch {}

    reloadFromStorage();
  };

  /* ── Stats ── */
  const stats = {
    total: poGroups.length,
    belum: poGroups.filter((p: any) => p.pickupStatus === 'belum').length,
    sedang: poGroups.filter((p: any) => p.pickupStatus === 'sedang').length,
    sampai: poGroups.filter((p: any) => p.pickupStatus === 'sampai').length,
  };

  const [selectedPO, setSelectedPO] = useState<string | null>(null);
  const [petugasInput, setPetugasInput] = useState('');
  const [kendaraanInput, setKendaraanInput] = useState('');

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      belum: 'bg-slate-100 text-slate-600',
      sedang: 'bg-blue-100 text-blue-700',
      sampai: 'bg-emerald-100 text-emerald-700',
    };
    const label: Record<string, string> = {
      belum: '🕐 Belum Dipickup',
      sedang: '🚛 Sedang Dipickup',
      sampai: '✅ Sampai di Gudang',
    };
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status] || ''}`}>{label[status] || status}</span>;
  };

  return (
    <div className="mt-4">
      {/* KPI */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl bg-slate-50 p-3 text-center border"><p className="text-xl font-bold text-slate-600">{stats.total}</p><p className="text-[10px] text-slate-500">Total PO</p></div>
        <div className="rounded-xl bg-amber-50 p-3 text-center border border-amber-200"><p className="text-xl font-bold text-amber-600">{stats.belum}</p><p className="text-[10px] text-amber-500">Belum Dipickup</p></div>
        <div className="rounded-xl bg-blue-50 p-3 text-center border border-blue-200"><p className="text-xl font-bold text-blue-600">{stats.sedang}</p><p className="text-[10px] text-blue-500">Sedang Dipickup</p></div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center border border-emerald-200"><p className="text-xl font-bold text-emerald-600">{stats.sampai}</p><p className="text-[10px] text-emerald-500">Sampai Gudang</p></div>
      </div>

      {poGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-10 text-center">
          <p className="text-3xl">🛒</p>
          <p className="mt-2 text-sm font-semibold text-slate-500">Belum ada PO untuk dipickup</p>
          <p className="text-xs text-slate-400 mt-1">PO akan muncul di sini setelah dibuat oleh Team Purchasing.</p>
          <button onClick={reloadFromStorage} className="mt-3 rounded-xl bg-brand-100 px-4 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-200">🔄 Refresh</button>
        </div>
      ) : (
        <div className="space-y-3">
          {poGroups.map((po: any) => {
            const alamat = getSupplierAlamat(po.supplierId, po.supplierNama);
            return (
              <div key={po.noPO} className={`rounded-xl border bg-white p-4 transition ${
                po.pickupStatus === 'sampai' ? 'border-emerald-200' :
                po.pickupStatus === 'sedang' ? 'border-blue-200' :
                'border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-mono font-bold text-slate-700">{po.noPO}</p>
                    <p className="text-xs text-slate-500">{po.supplierNama}</p>
                  </div>
                  {statusBadge(po.pickupStatus)}
                </div>

                {/* Info */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div><span className="text-slate-400">Alamat:</span> <span className="text-slate-600">{alamat}</span></div>
                  <div><span className="text-slate-400">Item:</span> <span className="text-slate-600 font-semibold">{po.totalQty} pcs ({po.items.length} SKU)</span></div>
                  <div><span className="text-slate-400">Total:</span> <span className="text-slate-700 font-semibold">Rp {po.total.toLocaleString('id-ID')}</span></div>
                  <div><span className="text-slate-400">Tgl PO:</span> <span className="text-slate-500">{po.tanggal}</span></div>
                </div>

                {/* Detail SKU */}
                <details className="mb-2">
                  <summary className="cursor-pointer text-[10px] text-slate-400">📦 {po.items.length} SKU ▼</summary>
                  <div className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                    {po.items.map((item: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-[10px] text-slate-600">
                        <span className="font-mono text-indigo-500 w-16 shrink-0">{item.sku}</span>
                        <span className="flex-1 truncate">{item.namaSku}</span>
                        <span className="shrink-0">×{item.qty}</span>
                        <span className="shrink-0 text-slate-400">Rp {item.subtotal.toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                  </div>
                </details>

                {/* Petugas & Kendaraan info */}
                {po.petugasLogistik && (
                  <p className="text-[10px] text-amber-600 mb-1">🛵 Petugas: <strong>{po.petugasLogistik}</strong></p>
                )}
                {po.kendaraanNama && (
                  <p className="text-[10px] text-slate-400 mb-1">🚛 {po.kendaraanNama} ({po.platNomor || '-'})</p>
                )}

                {/* ── Actions based on status ── */}
                {po.pickupStatus === 'belum' && (
                  <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={selectedPO === po.noPO ? kendaraanInput : ''}
                        onChange={e => { setSelectedPO(po.noPO); setKendaraanInput(e.target.value); }}
                        className="flex-1 rounded-lg border px-2 py-1.5 text-xs bg-white focus:border-brand-500 focus:outline-none"
                      >
                        <option value="">Pilih Kendaraan...</option>
                        {fleet.map((f: any) => <option key={f.id} value={f.id}>{f.nama} ({f.platNomor || '-'})</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={selectedPO === po.noPO ? petugasInput : ''}
                        onChange={e => { setSelectedPO(po.noPO); setPetugasInput(e.target.value); }}
                        placeholder="Nama petugas yang menjemput…"
                        className="flex-1 rounded-lg border px-2 py-1.5 text-xs bg-white focus:border-amber-500 focus:outline-none"
                      />
                      <button
                        onClick={() => { mulaiPickup(po.noPO, kendaraanInput, petugasInput); setSelectedPO(null); setPetugasInput(''); setKendaraanInput(''); }}
                        disabled={!petugasInput.trim()}
                        className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:bg-slate-300 whitespace-nowrap"
                      >
                        🚛 Mulai Pickup
                      </button>
                    </div>
                  </div>
                )}

                {po.pickupStatus === 'sedang' && (
                  <div className="mt-2 pt-2 border-t border-blue-100">
                    <button
                      onClick={() => konfirmasiSampai(po.noPO)}
                      className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600 transition"
                    >
                      ✅ Konfirmasi — PO Sudah Sampai di Gudang
                    </button>
                    <p className="mt-1 text-[10px] text-slate-400 text-center">
                      Klik setelah barang tiba di gudang. Inventory akan bisa cek SKU yang datang.
                    </p>
                  </div>
                )}

                {po.pickupStatus === 'sampai' && (
                  <div className="mt-2 pt-2 border-t border-emerald-100">
                    <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                      ✅ Barang sudah di gudang — <span className="text-slate-500 font-normal">siap dicek oleh Inventory</span>
                    </p>
                    {po.petugasLogistik && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        💡 Finance akan reimburse <strong>{po.petugasLogistik}</strong> untuk PO ini (jika metode Cash).
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Refresh button */}
      <div className="mt-4 text-center">
        <button onClick={reloadFromStorage} className="rounded-xl bg-slate-100 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200">
          🔄 Refresh Data PO
        </button>
      </div>
    </div>
  );
}
