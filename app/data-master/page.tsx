'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useSkus, type SkuItem } from '@/app/context/SkuContext';
import TaskHargaTab from '@/app/components/TaskHargaTab';

type Tab = 'sku' | 'supplier' | 'toko' | 'pelanggan' | 'fleet' | 'taskharga';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'sku', label: 'Master SKU', icon: '📦' },
  { key: 'supplier', label: 'Daftar Supplier', icon: '🏭' },
  { key: 'toko', label: 'Toko per Marketplace', icon: '🛒' },
  { key: 'taskharga', label: 'Task Harga Jual', icon: '📋' },
  { key: 'pelanggan', label: 'Daftar Pelanggan', icon: '👥' },
  { key: 'fleet', label: 'Manajemen Fleet', icon: '🚛' },
];

/* ── helper untuk ekstrak marketplace dari status upload ── */
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

/* ── helper untuk warna persentase perubahan ── */
function perubahanColor(p: string): string {
  if (!p || p.startsWith('??')) return 'text-slate-400';
  const num = parseFloat(p.replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return 'text-slate-400';
  if (num > 0) return 'text-red-500';
  if (num < 0) return 'text-emerald-500';
  return 'text-slate-400';
}

interface SupplierItem { id: string; nama: string; kontak: string; alamat: string; }
const INITIAL_SUPPLIER: SupplierItem[] = [
  { id:'s-1',nama:'PT Sinar Jaya Steel',kontak:'021-5555-1234',alamat:'Jl. Industri Raya No. 45, Cikarang, Bekasi' },
  { id:'s-2',nama:'UD Sumber Bangunan',kontak:'0813-9876-5432',alamat:'Jl. Raya Bogor KM 12, Cibinong' },
  { id:'s-3',nama:'CV Teknik Makmur',kontak:'0811-2233-4455',alamat:'Jl. Pangeran Jayakarta No. 88, Jakarta Pusat' },
  { id:'s-4',nama:'PT Plasma Pack Indonesia',kontak:'021-8888-7777',alamat:'Kawasan Industri Pulogadung Blok C-12, Jakarta Timur' },
  { id:'s-5',nama:'Toko Listrik Jaya',kontak:'0856-1111-2222',alamat:'Jl. Kenari No. 25, Pasar Baru, Jakarta Pusat' },
  { id:'s-6',nama:'PT Cat Maju Jaya',kontak:'021-6666-9999',alamat:'Jl. Daan Mogot KM 8, Jakarta Barat' },
  { id:'s-7',nama:'UD Aluminium Sejahtera',kontak:'0815-4444-8888',alamat:'Jl. Raya Serpong No. 120, Tangerang Selatan' },
  { id:'s-8',nama:'CV Baut Nusantara',kontak:'0812-7777-3333',alamat:'Jl. Kramat Jaya No. 56, Senen, Jakarta Pusat' },
  { id:'s-9',nama:'Toko ATK & Packing',kontak:'0857-2222-1111',alamat:'Jl. Mangga Dua Raya No. 30, Jakarta Utara' },
  { id:'s-10',nama:'PT Sanitary Utama',kontak:'021-3333-5555',alamat:'Jl. Taman Sari No. 15, Jakarta Barat' },
];

interface TokoItem { id: string; nama: string; marketplace: string; link: string; }
const INITIAL_TOKO: TokoItem[] = [
  { id:'t-1',nama:'Toko Berkah Abadi',marketplace:'Shopee',link:'https://shopee.co.id/berkah_abadi' },
  { id:'t-2',nama:'Berkah Abadi Official',marketplace:'Tokopedia',link:'https://tokopedia.com/berkah_abadi' },
  { id:'t-3',nama:'Toko Berkah Abadi',marketplace:'Lazada',link:'https://lazada.co.id/berkah_abadi' },
];

interface PelangganItem { id: string; nama: string; kontak: string; marketplace?: string; totalTransaksi: number; }
const INITIAL_PELANGGAN: PelangganItem[] = [
  { id:'pl-1',nama:'Budi Santoso',kontak:'0812-3456-7890',marketplace:'Shopee',totalTransaksi:12 },
  { id:'pl-2',nama:'Siti Aminah',kontak:'0856-7890-1234',marketplace:'Tokopedia',totalTransaksi:8 },
  { id:'pl-3',nama:'Pelanggan Umum',kontak:'-',totalTransaksi:45 },
];

export default function DataMasterPage() {
  const [tab, setTab] = useState<Tab>('sku');

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-3xl bg-gradient-to-br from-brand-700 via-brand-500 to-brand-300 p-5 text-white shadow-lg sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-100 sm:text-sm">Master Data</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Data Master</h1>
        <p className="mt-1 text-sm text-brand-100 sm:text-base">Kelola SKU, supplier, toko marketplace, pelanggan, dan armada kendaraan.</p>
      </header>
      <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm" role="tablist">
        {TABS.map(t=>(<button key={t.key} role="tab" aria-selected={tab===t.key} onClick={()=>setTab(t.key)} className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:px-5 sm:text-sm ${tab===t.key?'bg-brand-500 text-white shadow':'text-slate-600 hover:bg-brand-50 hover:text-brand-700'}`}><span className="text-base sm:text-lg">{t.icon}</span><span className="hidden sm:inline">{t.label}</span></button>))}
      </nav>
      <section className="card-blue">
        {tab==='sku' && <SkuTab />}
        {tab==='supplier' && <SupplierTab />}
        {tab==='toko' && <TokoTab />}
        {tab==='taskharga' && <TaskHargaTab />}
        {tab==='pelanggan' && <PelangganTab />}
        {tab==='fleet' && <FleetTab />}
      </section>
    </main>
  );
}

/* ================================================================ */
/* SKU TAB — 16 kolom, editable + upload Excel massal              */
/* ================================================================ */
function SkuTab() {
  const { skus, setSkus } = useSkus();
  /* Gunakan skus langsung dari context, bukan state lokal terpisah */
  const [search,setSearch]=useState('');
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState<string|null>(null);
  const [deleteId,setDeleteId]=useState<string|null>(null);
  const [detailId,setDetailId]=useState<string|null>(null);
  const [f,setF]=useState({sku:'',nama:'',grade:'',kodeSupplierVarian:'',statusEditGambar:'',statusUploadToko:'',supplier:'',kategori:'',satuan:'pcs',hargaModalLama:'',hargaBaru:'',hargaJual:'',minStok:'',aktif:1});
  const [ferr,setFerr]=useState('');
  const [uploading,setUploading]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);
  const hargaBaruManual=useRef(false);

  /* ── Purchase History ── */
  interface PurchaseHistory {
    id: string; sku: string; supplier: string; hargaLama: number; hargaBaru: number;
    persentase: string; tanggal: string;
  }
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory[]>([]);

  /* ── Hitung persentase perubahan ── */
  const calcPersentase = (lama: number, baru: number): string => {
    if (!lama || lama===0) return baru>0?'+100.00%':'0.00%';
    const pct = ((baru-lama)/lama)*100;
    return `${pct>=0?'+':''}${pct.toFixed(2)}%`;
  };

  /* ── Auto‑sync: Harga Modal Lama → Harga Baru ── */
  const setHargaModalLama=(val:string)=>{
    setF(p=>{
      const newVal={...p,hargaModalLama:val};
      if(!hargaBaruManual.current&&val&&(+val>0)) newVal.hargaBaru=val;
      return newVal;
    });
  };
  const setHargaBaru=(val:string)=>{
    hargaBaruManual.current=true;
    setF(p=>({...p,hargaBaru:val}));
  };

  /* ── Kalkulator Harga Jual ── */
  const [calc,setCalc]=useState({potonganMarketplace:'',biayaTetap:'1250',ekspetasiKeuntungan:''});
  const [showCalc,setShowCalc]=useState(false);

  const hitungHargaJual=()=>{
    const hb=+f.hargaBaru||0; const pm=+calc.potonganMarketplace||0; const bt=+calc.biayaTetap||0; const ek=+calc.ekspetasiKeuntungan||0;
    if(!hb||!pm||!ek){setFerr('Isi Harga Baru, Potongan Marketplace %, dan Ekspetasi Keuntungan % terlebih dahulu.');return;}
    if(pm>=100){setFerr('Potongan Marketplace tidak boleh ≥ 100%.');return;}
    const hj=Math.round((hb*(1+ek/100)+bt)/(1-pm/100));
    setF(p=>({...p,hargaJual:String(hj)}));setFerr('');
  };

  const filtered=skus.filter(i=>i.nama.toLowerCase().includes(search.toLowerCase())||i.sku.toLowerCase().includes(search.toLowerCase()));

  const blank=()=>({sku:'',nama:'',grade:'',kodeSupplierVarian:'',statusEditGambar:'',statusUploadToko:'',supplier:'',kategori:'',satuan:'pcs',hargaModalLama:'',hargaBaru:'',hargaJual:'',minStok:'',aktif:1});
  const openAdd=()=>{setF(blank());setFerr('');setShowForm(true);setEditId(null);hargaBaruManual.current=false;};
  const openEdit=(i:SkuItem)=>{setF({sku:i.sku,nama:i.nama,grade:i.grade,kodeSupplierVarian:i.kodeSupplierVarian,statusEditGambar:i.statusEditGambar,statusUploadToko:i.statusUploadToko,supplier:i.supplier,kategori:i.kategori,satuan:i.satuan,hargaModalLama:i.hargaModalLama?String(i.hargaModalLama):'',hargaBaru:String(i.hargaBaru),hargaJual:String(i.hargaJual),minStok:String(i.minStok),aktif:i.aktif});setFerr('');setEditId(i.id);setShowForm(true);};

  const save=()=>{
    if(!f.sku||!f.nama){setFerr('SKU dan Nama wajib diisi.');return;}
    const hargaBaruFinal=+f.hargaBaru||+f.hargaModalLama||0;
    const hargaModalFinal=+f.hargaModalLama||0;
    const pct=calcPersentase(editId?(skus.find(x=>x.id===editId)?.hargaBaru??hargaModalFinal):hargaModalFinal, hargaBaruFinal);

    // Record purchase history jika ada perubahan harga dari supplier
    const oldItem=editId?skus.find(x=>x.id===editId):null;
    if(f.supplier&&hargaBaruFinal>0&&(!oldItem||oldItem.hargaBaru!==hargaBaruFinal)){
      setPurchaseHistory(prev=>[{
        id:`ph-${Date.now()}`,sku:f.sku,supplier:f.supplier,
        hargaLama:oldItem?.hargaBaru||hargaModalFinal,hargaBaru:hargaBaruFinal,
        persentase:pct,tanggal:new Date().toISOString().slice(0,10),
      },...prev]);
    }

    const item:SkuItem={
      id:editId||`p-${Date.now()}`,
      sku:f.sku,nama:f.nama,grade:f.grade,kodeSupplierVarian:f.kodeSupplierVarian,statusEditGambar:f.statusEditGambar,statusUploadToko:f.statusUploadToko,supplier:f.supplier,kategori:f.kategori,satuan:f.satuan||'pcs',hargaModalLama:hargaModalFinal,hargaBaru:hargaBaruFinal,hargaJual:+f.hargaJual||0,stok:editId?(skus.find(x=>x.id===editId)?.stok??0):0,minStok:+f.minStok||0,aktif:f.aktif,perubahanHargaBeli:pct};
    if(editId){setSkus(skus.map(x=>x.id===editId?item:x));}
    else{setSkus([item,...skus]);}
    setShowForm(false);
    // ── Trigger Task Harga: auto-buat task hanya untuk SKU ini ──
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sku-saved', { detail: { sku: f.sku } }));
    }
  };
  const del=()=>{if(deleteId){setSkus(skus.filter(x=>x.id!==deleteId));setDeleteId(null);}};

  /* ── upload Excel / CSV 16‑kolom — UPSERT ── */
  const [upsertMode,setUpsertMode]=useState<'insert'|'upsert'>('upsert');

  const uploadFile=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];if(!file)return;
    setUploading(true);setFerr('');
    const ext=file.name.split('.').pop()?.toLowerCase();
    const parseRow=(row:string[],baseIdx:number):SkuItem|null=>{
      if(row.length<12)return null;
      const sku=String(row[0]??'').trim();if(!sku)return null;
      return {
        id:`up-${Date.now()}-${baseIdx}`,
        sku,
        nama: String(row[1]??'').trim(),
        grade: String(row[2]??'').trim(),
        kodeSupplierVarian: String(row[3]??'').trim(),
        statusEditGambar: String(row[4]??'').trim(),
        statusUploadToko: String(row[5]??'').trim(),
        supplier: String(row[6]??'').trim(),
        kategori: String(row[7]??'').trim(),
        satuan: String(row[8]??'').trim()||'pcs',
        hargaModalLama: +String(row[9]??'').replace(/[^0-9.-]/g,'')||0,
        hargaBaru: +String(row[10]??'').replace(/[^0-9.-]/g,'')||0,
        hargaJual: +String(row[11]??'').replace(/[^0-9.-]/g,'')||0,
        stok: +String(row[12]??'').replace(/[^0-9.-]/g,'')||0,
        minStok: +String(row[13]??'').replace(/[^0-9.-]/g,'')||0,
        aktif: +String(row[14]??'1').replace(/[^0-9]/g,'')||1,
        perubahanHargaBeli: String(row[15]??'').trim(),
      };
    };

    const processRows=(rows:string[][])=>{
      if(rows.length<2){setFerr('File butuh minimal 1 header + 1 data.');setUploading(false);return;}
      const incoming:SkuItem[]=[];
      for(let i=1;i<rows.length;i++){
        const item=parseRow(rows[i],i);if(item)incoming.push(item);
      }
      if(incoming.length===0){setFerr('Tidak ada data valid di file.');setUploading(false);return;}

      let inserted=0, updated=0, skipped=0;
      const skuMap=new Map(skus.map(p=>[p.sku,p]));
      for(const item of incoming){
        const existing=skuMap.get(item.sku);
        if(existing){
          if(upsertMode==='upsert'){
            const modalLamaBaru=item.hargaModalLama||existing.hargaModalLama;
            const hargaBaruFinal=item.hargaBaru||existing.hargaBaru||modalLamaBaru;
            skuMap.set(item.sku,{
              ...existing,
              nama: item.nama||existing.nama, grade: item.grade||existing.grade,
              kodeSupplierVarian: item.kodeSupplierVarian||existing.kodeSupplierVarian,
              statusEditGambar: item.statusEditGambar||existing.statusEditGambar,
              statusUploadToko: item.statusUploadToko||existing.statusUploadToko,
              supplier: item.supplier||existing.supplier, kategori: item.kategori||existing.kategori,
              satuan: item.satuan||existing.satuan, hargaModalLama: modalLamaBaru,
              hargaBaru: hargaBaruFinal, hargaJual: item.hargaJual||existing.hargaJual,
              stok: item.stok, minStok: item.minStok||existing.minStok,
              aktif: item.aktif, perubahanHargaBeli: item.perubahanHargaBeli||existing.perubahanHargaBeli,
            });
            updated++;
          }else{skipped++;}
        }else{
          skuMap.set(item.sku,item); inserted++;
        }
      }
      setSkus(Array.from(skuMap.values()));

      // ── Trigger Task Harga untuk setiap SKU yang diupload ──
      if (typeof window !== 'undefined') {
        const triggeredSkus = new Set<string>();
        for (const item of incoming) {
          if (!triggeredSkus.has(item.sku)) {
            triggeredSkus.add(item.sku);
            window.dispatchEvent(new CustomEvent('sku-saved', { detail: { sku: item.sku } }));
          }
        }
      }

      const parts:string[]=[];
      if(updated>0)parts.push(`${updated} diupdate`);
      if(inserted>0)parts.push(`${inserted} baru`);
      if(skipped>0)parts.push(`${skipped} dilewati (sudah ada)`);
      setFerr('');
      setUploading(false);
      alert(`✅ Upload selesai: ${parts.join(', ')}. Total ${incoming.length} baris diproses.`);
    };

    if(ext==='csv'){
      const r=new FileReader();
      r.onload=ev=>{
        const txt=ev.target?.result as string;
        const rows=txt.split('\n').filter(l=>l.trim()).map(l=>l.split(',').map(c=>c.trim().replace(/"/g,'')));
        processRows(rows);
      };
      r.onerror=()=>{setFerr('Gagal membaca file CSV.');setUploading(false);};
      r.readAsText(file);
    }else{
      const r=new FileReader();
      r.onload=ev=>{
        try{
          const data=new Uint8Array(ev.target?.result as ArrayBuffer);
          const wb=XLSX.read(data,{type:'array'});
          const sheet=wb.Sheets[wb.SheetNames[0]];
          const rows=XLSX.utils.sheet_to_json<string[]>(sheet,{header:1});
          processRows(rows.map(r=>r.map(c=>String(c??''))));
        }catch{setFerr('Gagal membaca file Excel. Pastikan format .xlsx atau .xls.');setUploading(false);}
      };
      r.onerror=()=>{setFerr('Gagal membaca file.');setUploading(false);};
      r.readAsArrayBuffer(file);
    }
  };

  const detailItem=detailId?skus.find(x=>x.id===detailId):null;

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold text-slate-800 sm:text-xl">📦 Master SKU</h2><p className="text-sm text-slate-500">{filtered.length} dari {skus.length} SKU {skus.length>13&&<span className="text-emerald-500 text-xs ml-1">💾 tersimpan</span>}</p></div>
        <div className="flex gap-2">
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari SKU / Nama..." className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none sm:max-w-[180px]" />
          <button onClick={openAdd} className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">+ Tambah</button>
          <select value={upsertMode} onChange={e=>setUpsertMode(e.target.value as 'insert'|'upsert')} className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 focus:border-brand-500 focus:outline-none" title="Mode Upload">
            <option value="upsert">🔄 Upsert</option>
            <option value="insert">➕ Insert Only</option>
          </select>
          <label className={`cursor-pointer rounded-xl px-3 py-1.5 text-sm font-semibold text-white transition ${uploading?'bg-slate-400':'bg-emerald-500 hover:bg-emerald-600'}`}>{uploading?'⏳ Memproses...':'📥 Upload Excel'}<input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={uploadFile} className="hidden" disabled={uploading} /></label>
        </div>
      </div>
      {ferr&&<p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{ferr}</p>}

      {/* ── Form modal ── */}
      {showForm&&(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 overflow-y-auto py-8"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl mx-4">
        <p className="text-lg font-bold text-slate-800">{editId?'✏️ Ubah SKU':'➕ Tambah SKU'}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">SKU *</span><input value={f.sku} onChange={e=>setF({...f,sku:e.target.value})} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Grade</span><input value={f.grade} onChange={e=>setF({...f,grade:e.target.value})} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1 col-span-2"><span className="text-xs font-semibold text-slate-600">Nama *</span><input value={f.nama} onChange={e=>setF({...f,nama:e.target.value})} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Kategori</span><input value={f.kategori} onChange={e=>setF({...f,kategori:e.target.value})} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Satuan</span><input value={f.satuan} onChange={e=>setF({...f,satuan:e.target.value})} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Supplier</span><input value={f.supplier} onChange={e=>setF({...f,supplier:e.target.value})} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Kode Supplier Varian</span><input value={f.kodeSupplierVarian} onChange={e=>setF({...f,kodeSupplierVarian:e.target.value})} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Harga Modal Lama</span><input type="number" value={f.hargaModalLama} onChange={e=>setHargaModalLama(e.target.value)} placeholder="Kosong = belum upload" className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Harga Baru (Beli) {!hargaBaruManual.current&&f.hargaModalLama&&f.hargaBaru===f.hargaModalLama&&<span className="text-amber-500 text-[10px]">↳ auto dari Modal</span>}{f.hargaModalLama&&f.hargaBaru&&+f.hargaModalLama>0&&+f.hargaBaru!==+f.hargaModalLama&&<span className={`text-[10px] ml-1 font-bold ${+f.hargaBaru>+f.hargaModalLama?'text-red-500':'text-emerald-500'}`}>Δ {calcPersentase(+f.hargaModalLama,+f.hargaBaru)}</span>}</span><input type="number" value={f.hargaBaru} onChange={e=>setHargaBaru(e.target.value)} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>

          {/* ── Kalkulator Harga Jual ── */}
          <div className="col-span-2 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-3">
            <button type="button" onClick={()=>setShowCalc(!showCalc)} className="flex w-full items-center justify-between text-left">
              <span className="text-xs font-bold text-amber-700">🧮 Kalkulator Harga Jual</span>
              <span className="text-xs text-amber-500">{showCalc?'▲ Sembunyikan':'▼ Buka'}</span>
            </button>
            {showCalc&&<div className="mt-3 grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Potongan Marketplace (%)</span><input type="number" step="0.1" value={calc.potonganMarketplace} onChange={e=>setCalc({...calc,potonganMarketplace:e.target.value})} placeholder="cth: 10" className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none" /></label>
              <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Biaya Tetap (Rp)</span><input type="number" value={calc.biayaTetap} onChange={e=>setCalc({...calc,biayaTetap:e.target.value})} className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none" /></label>
              <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Keuntungan Bersih (%)</span><input type="number" step="0.1" value={calc.ekspetasiKeuntungan} onChange={e=>setCalc({...calc,ekspetasiKeuntungan:e.target.value})} placeholder="cth: 20" className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none" /></label>
              <div className="col-span-3 flex items-end gap-2">
                <button type="button" onClick={hitungHargaJual} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600">🪄 Hitung Harga Jual</button>
                {f.hargaJual&&<span className="text-xs text-slate-400">Hasil: <strong className="text-brand-600">Rp {(+f.hargaJual).toLocaleString('id-ID')}</strong></span>}
              </div>
              <div className="col-span-3 text-[10px] text-slate-400 leading-relaxed">Rumus: HJ = (Harga Baru × (1 + Keuntungan%) + Biaya Tetap) ÷ (1 − Potongan Marketplace%)</div>
            </div>}
          </div>

          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Harga Jual {f.hargaJual&&<span className="text-emerald-500">✓ Auto</span>}</span><input type="number" value={f.hargaJual} onChange={e=>setF({...f,hargaJual:e.target.value})} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Min Stok</span><input type="number" value={f.minStok} onChange={e=>setF({...f,minStok:e.target.value})} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Status Edit Gambar</span><input value={f.statusEditGambar} onChange={e=>setF({...f,statusEditGambar:e.target.value})} className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1 col-span-2"><span className="text-xs font-semibold text-slate-600">Status Upload Toko</span><input value={f.statusUploadToko} onChange={e=>setF({...f,statusUploadToko:e.target.value})} placeholder="Shopee — Nama Toko | Lazada — Nama Toko" className="rounded-xl border px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.aktif===1} onChange={e=>setF({...f,aktif:e.target.checked?1:0})} className="rounded" /><span className="text-xs font-semibold text-slate-600">Aktif</span></label>
        </div>
        <div className="mt-5 flex justify-end gap-2"><button onClick={()=>setShowForm(false)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button><button onClick={save} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white">{editId?'Update':'Simpan'}</button></div>
      </div></div>)}

      {/* ── Detail modal ── */}
      {detailItem&&(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 overflow-y-auto py-8"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl mx-4">
        <div className="flex items-center justify-between"><p className="text-lg font-bold text-slate-800">📋 Detail SKU</p><button onClick={()=>setDetailId(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button></div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {[['SKU',detailItem.sku],['Nama',detailItem.nama],['Grade',detailItem.grade],['Kategori',detailItem.kategori],['Satuan',detailItem.satuan],['Supplier',detailItem.supplier||'-'],['Kode Supplier Varian',detailItem.kodeSupplierVarian||'-'],['Status Edit Gambar',detailItem.statusEditGambar||'-'],['Harga Modal Lama',detailItem.hargaModalLama?`Rp ${detailItem.hargaModalLama.toLocaleString('id-ID')}`:'⚠ Belum ada'],['Harga Baru',`Rp ${detailItem.hargaBaru.toLocaleString('id-ID')}`],['Harga Jual',`Rp ${detailItem.hargaJual.toLocaleString('id-ID')}`],['Stok',String(detailItem.stok)],['Min Stok',String(detailItem.minStok)],['Aktif',detailItem.aktif===1?'✅ Ya':'❌ Tidak'],['Perubahan Harga Beli',detailItem.perubahanHargaBeli||'-']].map(([label,val])=>(<div key={label} className="flex flex-col"><span className="text-xs text-slate-400">{label}</span><span className="font-medium text-slate-800">{val}</span></div>))}
        </div>
        <div className="mt-3"><span className="text-xs text-slate-400">Status Upload Toko</span><div className="mt-1 flex flex-wrap gap-1">{extractMarketplaces(detailItem.statusUploadToko).length>0?extractMarketplaces(detailItem.statusUploadToko).map((mp,i)=><span key={i} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${mp.color}`}>{mp.name}</span>):<span className="text-sm text-slate-400">-</span>}</div></div>

        {/* ── Riwayat Pembelian ── */}
        {purchaseHistory.filter(h=>h.sku===detailItem.sku).length>0&&(
          <div className="mt-4 border-t pt-3">
            <p className="text-sm font-bold text-slate-700">📜 Riwayat Perubahan Harga Beli</p>
            <div className="mt-2 max-h-[200px] overflow-y-auto space-y-1">
              {purchaseHistory.filter(h=>h.sku===detailItem.sku).map(h=>(
                <div key={h.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-700">{h.supplier||'Supplier'}</span>
                    <span className="text-slate-400 mx-1">•</span>
                    <span className="text-slate-500">{h.tanggal}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Rp {h.hargaLama.toLocaleString('id-ID')} →</span>
                    <span className="font-bold text-slate-800">Rp {h.hargaBaru.toLocaleString('id-ID')}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${h.persentase.startsWith('+')?'bg-red-100 text-red-600':h.persentase==='0.00%'?'bg-slate-100 text-slate-500':'bg-emerald-100 text-emerald-600'}`}>{h.persentase}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end"><button onClick={()=>setDetailId(null)} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white">Tutup</button></div>
      </div></div>)}

      {/* ── Tabel utama ── */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full table-fixed text-left text-xs" style={{minWidth:'800px'}}>
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
            {filtered.length===0?<tr><td colSpan={10} className="py-10 text-center text-slate-400">Tidak ada SKU. Upload file Excel atau tambah manual.</td></tr>
            :filtered.map((item,i)=>(<tr key={item.id} className={`${i%2===0?'bg-white':'bg-slate-50/30'} ${item.stok<item.minStok?'border-l-4 border-l-red-400':''} cursor-pointer hover:bg-brand-50/50`} onClick={()=>setDetailId(item.id)}>
              <td className="px-1.5 py-1.5 font-mono text-[11px] text-brand-700 truncate" title={item.sku}>{item.sku}</td>
              <td className="px-1.5 py-1.5 truncate text-[11px] font-medium text-slate-800" title={item.nama}>{item.nama}</td>
              <td className="px-1.5 py-1.5"><span className={`rounded-full px-1 py-0.5 text-[10px] font-semibold ${item.grade==='A'?'bg-emerald-100 text-emerald-700':item.grade==='B'?'bg-amber-100 text-amber-700':item.grade==='C'?'bg-red-100 text-red-700':'bg-slate-100 text-slate-600'}`}>{item.grade||'-'}</span></td>
              <td className="px-1.5 py-1.5 text-[10px] text-slate-600 truncate" title={item.kategori}>{item.kategori||'-'}</td>
              <td className="px-1.5 py-1.5 text-[11px] text-slate-700 whitespace-nowrap">Rp {item.hargaBaru.toLocaleString('id-ID')}</td>
              <td className="px-1.5 py-1.5 text-[11px] font-semibold text-brand-700 whitespace-nowrap">Rp {item.hargaJual.toLocaleString('id-ID')}</td>
              <td className="px-1.5 py-1.5"><span className={`text-[11px] font-semibold ${item.stok<item.minStok?'text-red-500':item.stok===0?'text-slate-400':'text-slate-700'}`}>{item.stok}{item.stok<item.minStok&&' ⚠'}</span></td>
              <td className="px-1.5 py-1.5"><div className="flex flex-wrap gap-0.5">{extractMarketplaces(item.statusUploadToko).slice(0,2).map((mp,j)=><span key={j} className={`rounded-full px-1 py-0.5 text-[10px] font-semibold leading-none ${mp.color}`}>{mp.name}</span>)}{extractMarketplaces(item.statusUploadToko).length>2&&<span className="text-[10px] text-slate-400">+{extractMarketplaces(item.statusUploadToko).length-2}</span>}</div></td>
              <td className={`px-1.5 py-1.5 text-[10px] font-semibold whitespace-nowrap ${perubahanColor(item.perubahanHargaBeli)}`}>{item.perubahanHargaBeli||'-'}</td>
              <td className="px-1.5 py-1.5" onClick={e=>e.stopPropagation()}><div className="flex gap-0.5"><button onClick={()=>openEdit(item)} className="rounded-md bg-brand-100 px-1.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-200">✏️</button><button onClick={()=>setDeleteId(item.id)} className="rounded-md bg-red-100 px-1.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-200">🗑️</button></div></td>
            </tr>))}
          </tbody>
        </table>
      </div>
      {deleteId&&<ModalConfirm title="Konfirmasi Hapus" msg="Yakin hapus SKU ini?" onCancel={()=>setDeleteId(null)} onConfirm={del} />}
    </div>
  );
}

/* ================================================================ */
/* SUPPLIER TAB                                                     */
/* ================================================================ */
function SupplierTab(){const[l,setL]=useState<SupplierItem[]>(()=>{if(typeof window==='undefined')return INITIAL_SUPPLIER;try{const r=localStorage.getItem('mma_supplier_master');return r?JSON.parse(r):INITIAL_SUPPLIER}catch{return INITIAL_SUPPLIER}});const[sh,setSh]=useState(false);const[eid,setEid]=useState<string|null>(null);const[did,setDid]=useState<string|null>(null);const[n,setN]=useState('');const[k,setK]=useState('');const[p,setP]=useState('');const[err,setErr]=useState('');const oa=()=>{setN('');setK('');setP('');setErr('');setSh(true);setEid(null)};const oe=(s:SupplierItem)=>{setN(s.nama);setK(s.kontak);setP(s.alamat);setEid(s.id);setSh(true)};const sv=()=>{if(!n.trim()){setErr('Nama wajib.');return};eid?setL(x=>x.map(s=>s.id===eid?{...s,nama:n.trim(),kontak:k.trim()||'-',alamat:p.trim()||''}:s)):setL(x=>[...x,{id:`s-${Date.now()}`,nama:n.trim(),kontak:k.trim()||'-',alamat:p.trim()||''}]);setSh(false)};const dl=()=>{if(did){setL(x=>x.filter(s=>s.id!==did));setDid(null)}};useEffect(()=>{try{localStorage.setItem('mma_supplier_master',JSON.stringify(l))}catch{}},[l]);const {skus}=useSkus();const extr=()=>{const en=new Set(l.map(s=>s.nama.toLowerCase()));const ns:SupplierItem[]=[];skus.forEach(sku=>{if(sku.supplier&&sku.supplier.trim()&&!en.has(sku.supplier.toLowerCase().trim())){en.add(sku.supplier.toLowerCase().trim());ns.push({id:`s-${Date.now()}-${ns.length}`,nama:sku.supplier.trim(),kontak:'-',alamat:''})}});if(ns.length>0){setL(x=>[...x,...ns]);alert(`✅ ${ns.length} supplier baru dari SKU.`)}else{alert('Tidak ada supplier baru.')}};
  return(<div><div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" /><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-800 sm:text-xl">🏭 Daftar Supplier</h2><p className="text-sm text-slate-500">{l.length} supplier</p></div><div className="flex gap-2"><button onClick={extr} className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">📥 Dari SKU</button><button onClick={oa} className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">+ Tambah</button></div></div>{sh&&<ModalForm title={eid?'✏️ Ubah Supplier':'➕ Tambah Supplier'} error={err} onCancel={()=>setSh(false)} onSave={sv}><input value={n} onChange={e=>setN(e.target.value)} placeholder="Nama supplier" className="w-full rounded-xl border px-3 py-2 text-sm mb-2 focus:border-brand-500 focus:outline-none" /><input value={k} onChange={e=>setK(e.target.value)} placeholder="Kontak" className="w-full rounded-xl border px-3 py-2 text-sm mb-2 focus:border-brand-500 focus:outline-none" /><input value={p} onChange={e=>setP(e.target.value)} placeholder="Alamat" className="w-full rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /></ModalForm>}<div className="mt-4 overflow-x-auto rounded-xl border border-slate-100"><table className="w-full text-left text-sm"><thead><tr className="bg-brand-50 text-xs uppercase text-brand-500">{['Nama','Kontak','Alamat','Aksi'].map(c=><th key={c} className="px-3 py-3 font-semibold">{c}</th>)}</tr></thead><tbody className="divide-y divide-slate-50 bg-white">{l.map((s,i)=>(<tr key={s.id} className={i%2===0?'bg-white':'bg-slate-50/30'}><td className="px-3 py-3 font-medium text-slate-800">{s.nama}</td><td className="px-3 py-3 text-slate-600">{s.kontak}</td><td className="px-3 py-3 text-slate-600">{s.alamat||'-'}</td><td className="px-3 py-3"><div className="flex gap-1"><button onClick={()=>oe(s)} className="rounded-lg bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-700">✏️</button><button onClick={()=>setDid(s.id)} className="rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-600">🗑️</button></div></td></tr>))}</tbody></table></div>{did&&<ModalConfirm title="Konfirmasi Hapus" msg="Yakin hapus supplier?" onCancel={()=>setDid(null)} onConfirm={dl} />}</div>);
}

/* ================================================================ */
/* TOKO PER MARKETPLACE TAB                                         */
/* ================================================================ */
function TokoTab(){const[l,setL]=useState<TokoItem[]>(()=>{if(typeof window==='undefined')return INITIAL_TOKO;try{const r=localStorage.getItem('mma_toko_master');return r?JSON.parse(r):INITIAL_TOKO}catch{return INITIAL_TOKO}});const[sh,setSh]=useState(false);const[eid,setEid]=useState<string|null>(null);const[did,setDid]=useState<string|null>(null);const[n,setN]=useState('');const[m,setM]=useState('Shopee');const[lk,setLk]=useState('');const[err,setErr]=useState('');const MP=['Shopee','Tokopedia','Lazada','Bukalapak','Blibli','TikTok Shop','Lainnya'];const oa=()=>{setN('');setM('Shopee');setLk('');setErr('');setSh(true);setEid(null)};const oe=(t:TokoItem)=>{setN(t.nama);setM(t.marketplace);setLk(t.link);setEid(t.id);setSh(true)};const sv=()=>{if(!n.trim()){setErr('Nama toko wajib.');return};eid?setL(x=>x.map(t=>t.id===eid?{...t,nama:n.trim(),marketplace:m,link:lk.trim()||'-'}:t)):setL(x=>[...x,{id:`t-${Date.now()}`,nama:n.trim(),marketplace:m,link:lk.trim()||'-'}]);setSh(false)};const dl=()=>{if(did){setL(x=>x.filter(t=>t.id!==did));setDid(null)}};useEffect(()=>{try{localStorage.setItem('mma_toko_master',JSON.stringify(l))}catch{}},[l]);const {skus}=useSkus();const extr=()=>{const en=new Set(l.map(t=>`${t.marketplace}|${t.nama}`.toLowerCase()));const nt:TokoItem[]=[];skus.forEach(sku=>{if(!sku.statusUploadToko||sku.statusUploadToko==='nan')return;sku.statusUploadToko.split('|').forEach(part=>{const trimmed=part.trim();if(!trimmed)return;const idx=trimmed.indexOf('—');if(idx===-1)return;const mp=trimmed.slice(0,idx).trim();const nama=trimmed.slice(idx+1).trim();if(!mp||!nama)return;const key=`${mp}|${nama}`.toLowerCase();if(!en.has(key)){en.add(key);nt.push({id:`t-${Date.now()}-${nt.length}`,nama,marketplace:mp,link:'-'})}})});if(nt.length>0){setL(x=>[...x,...nt]);alert(`✅ ${nt.length} toko baru dari SKU.`)}else{alert('Tidak ada toko baru.')}};
  return(<div><div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" /><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-800 sm:text-xl">🛒 Toko per Marketplace</h2><p className="text-sm text-slate-500">{l.length} toko</p></div><div className="flex gap-2"><button onClick={extr} className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">📥 Dari SKU</button><button onClick={oa} className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">+ Tambah</button></div></div>{sh&&<ModalForm title={eid?'✏️ Ubah Toko':'➕ Tambah Toko'} error={err} onCancel={()=>setSh(false)} onSave={sv}><input value={n} onChange={e=>setN(e.target.value)} placeholder="Nama toko" className="w-full rounded-xl border px-3 py-2 text-sm mb-2 focus:border-brand-500 focus:outline-none" /><select value={m} onChange={e=>setM(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2 text-sm mb-2 focus:border-brand-500 focus:outline-none">{MP.map(x=><option key={x} value={x}>{x}</option>)}</select><input value={lk} onChange={e=>setLk(e.target.value)} placeholder="Link toko (opsional)" className="w-full rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /></ModalForm>}<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{l.map(t=>(<div key={t.id} className="card-blue-inner border-l-4 border-l-brand-500"><div className="flex items-start justify-between"><div><p className="font-semibold text-slate-800">{t.nama}</p><p className="mt-1"><span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">{t.marketplace}</span></p>{t.link!=='-'&&<a href={t.link} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-brand-500 underline break-all">{t.link}</a>}</div><div className="flex gap-1"><button onClick={()=>oe(t)} className="rounded-lg bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-700">✏️</button><button onClick={()=>setDid(t.id)} className="rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-600">🗑️</button></div></div></div>))}</div>{did&&<ModalConfirm title="Konfirmasi Hapus" msg="Yakin hapus toko?" onCancel={()=>setDid(null)} onConfirm={dl} />}</div>);
}

/* ================================================================ */
/* PELANGGAN TAB                                                    */
/* ================================================================ */
function PelangganTab(){const[l,setL]=useState<PelangganItem[]>(()=>{if(typeof window==='undefined')return INITIAL_PELANGGAN;try{const r=localStorage.getItem('mma_pelanggan_master');return r?JSON.parse(r):INITIAL_PELANGGAN}catch{return INITIAL_PELANGGAN}});const[sh,setSh]=useState(false);const[eid,setEid]=useState<string|null>(null);const[did,setDid]=useState<string|null>(null);const[n,setN]=useState('');const[k,setK]=useState('');const[mp,setMp]=useState('');const[err,setErr]=useState('');const oa=()=>{setN('');setK('');setMp('');setErr('');setSh(true);setEid(null)};const oe=(p:PelangganItem)=>{setN(p.nama);setK(p.kontak);setMp(p.marketplace||'');setEid(p.id);setSh(true)};const sv=()=>{if(!n.trim()){setErr('Nama wajib.');return};eid?setL(x=>x.map(p=>p.id===eid?{...p,nama:n.trim(),kontak:k.trim()||'-',marketplace:mp.trim()||undefined}:p)):setL(x=>[...x,{id:`pl-${Date.now()}`,nama:n.trim(),kontak:k.trim()||'-',marketplace:mp.trim()||undefined,totalTransaksi:0}]);setSh(false)};const dl=()=>{if(did){setL(x=>x.filter(p=>p.id!==did));setDid(null)}};useEffect(()=>{try{localStorage.setItem('mma_pelanggan_master',JSON.stringify(l))}catch{}},[l]);
  return(<div><div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" /><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-800 sm:text-xl">👥 Daftar Pelanggan</h2><p className="text-sm text-slate-500">{l.length} pelanggan</p></div><button onClick={oa} className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">+ Tambah</button></div>{sh&&<ModalForm title={eid?'✏️ Ubah Pelanggan':'➕ Tambah Pelanggan'} error={err} onCancel={()=>setSh(false)} onSave={sv}><input value={n} onChange={e=>setN(e.target.value)} placeholder="Nama pelanggan" className="w-full rounded-xl border px-3 py-2 text-sm mb-2 focus:border-brand-500 focus:outline-none" /><input value={k} onChange={e=>setK(e.target.value)} placeholder="Kontak" className="w-full rounded-xl border px-3 py-2 text-sm mb-2 focus:border-brand-500 focus:outline-none" /><input value={mp} onChange={e=>setMp(e.target.value)} placeholder="Marketplace asal (opsional)" className="w-full rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /></ModalForm>}<div className="mt-4 overflow-x-auto rounded-xl border border-slate-100"><table className="w-full text-left text-sm"><thead><tr className="bg-brand-50 text-xs uppercase text-brand-500">{['Nama','Kontak','Marketplace','Transaksi','Aksi'].map(c=><th key={c} className="px-3 py-3 font-semibold">{c}</th>)}</tr></thead><tbody className="divide-y divide-slate-50 bg-white">{l.map((p,i)=>(<tr key={p.id} className={i%2===0?'bg-white':'bg-slate-50/30'}><td className="px-3 py-3 font-medium text-slate-800">{p.nama}</td><td className="px-3 py-3 text-slate-600">{p.kontak}</td><td className="px-3 py-3 text-slate-600">{p.marketplace||'-'}</td><td className="px-3 py-3 font-semibold text-brand-700">{p.totalTransaksi}</td><td className="px-3 py-3"><div className="flex gap-1"><button onClick={()=>oe(p)} className="rounded-lg bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-700">✏️</button><button onClick={()=>setDid(p.id)} className="rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-600">🗑️</button></div></td></tr>))}</tbody></table></div>{did&&<ModalConfirm title="Konfirmasi Hapus" msg="Yakin hapus pelanggan?" onCancel={()=>setDid(null)} onConfirm={dl} />}</div>);
}

/* ================================================================ */
/* FLEET TAB                                                        */
/* ================================================================ */
interface FleetItem { id: string; nama: string; platNomor: string; tipe: 'Motor' | 'Mobil Pickup' | 'Mobil Box' | 'Truk Engkel' | 'Truk Double'; kapasitas: string; status: 'Tersedia' | 'Digunakan' | 'Servis' | 'Nonaktif'; driver?: string; tahun: string; catatan: string; }
const INITIAL_FLEET: FleetItem[] = [
  { id:'fl-1',nama:'Mio M3',platNomor:'B 4521 ABC',tipe:'Motor',kapasitas:'50 kg',status:'Tersedia',driver:'Budi Santoso',tahun:'2023',catatan:'Motor operasional harian' },
  { id:'fl-2',nama:'Grand Max Pickup',platNomor:'B 8891 XYZ',tipe:'Mobil Pickup',kapasitas:'1 ton',status:'Digunakan',driver:'Doni Kusuma',tahun:'2022',catatan:'Pickup rutin 2x/hari' },
  { id:'fl-3',nama:'L300 Box',platNomor:'B 1234 CDE',tipe:'Mobil Box',kapasitas:'1.5 ton',status:'Tersedia',tahun:'2021',catatan:'Box tertutup, cocok hujan' },
  { id:'fl-4',nama:'Hino Dutro 130',platNomor:'B 5678 FGH',tipe:'Truk Engkel',kapasitas:'5 ton',status:'Servis',tahun:'2020',catatan:'Servis rutin 10/08' },
  { id:'fl-5',nama:'Colt Diesel Double',platNomor:'B 9999 IJK',tipe:'Truk Double',kapasitas:'10 ton',status:'Tersedia',tahun:'2019',catatan:'Untuk pengiriman besar' },
  { id:'fl-6',nama:'Vario 150',platNomor:'B 3456 LMN',tipe:'Motor',kapasitas:'40 kg',status:'Nonaktif',tahun:'2024',catatan:'Baru, belum STNK' },
  { id:'fl-7',nama:'Carry Pickup',platNomor:'B 7890 OPQ',tipe:'Mobil Pickup',kapasitas:'1 ton',status:'Tersedia',tahun:'2023',catatan:'' },
];
const TIPE_COLORS: Record<string, string> = { Motor:'bg-slate-100 text-slate-600','Mobil Pickup':'bg-blue-100 text-blue-700','Mobil Box':'bg-indigo-100 text-indigo-700','Truk Engkel':'bg-amber-100 text-amber-700','Truk Double':'bg-orange-100 text-orange-700' };
const STATUS_FLEET: Record<string, string> = { Tersedia:'bg-emerald-100 text-emerald-700',Digunakan:'bg-blue-100 text-blue-700',Servis:'bg-amber-100 text-amber-700',Nonaktif:'bg-red-100 text-red-700' };
function FleetTab(){
  const[fleet,setFleet]=useState<FleetItem[]>(()=>{if(typeof window==='undefined')return INITIAL_FLEET;try{const r=localStorage.getItem('mma_fleet_master');return r?JSON.parse(r):INITIAL_FLEET}catch{return INITIAL_FLEET}});
  const[sf,setSf]=useState(false);const[eid,setEid]=useState<string|null>(null);const[did,setDid]=useState<string|null>(null);
  const[ft,setFt]=useState('semua');const[fs,setFs]=useState('semua');
  const[f,setF]=useState({nama:'',platNomor:'',tipe:'Motor' as FleetItem['tipe'],kapasitas:'',status:'Tersedia' as FleetItem['status'],driver:'',tahun:'',catatan:''});
  const[err,setErr]=useState('');
  useEffect(()=>{try{localStorage.setItem('mma_fleet_master',JSON.stringify(fleet))}catch{}},[fleet]);
  const tp=['semua',...Array.from(new Set(fleet.map(x=>x.tipe)))];
  const flt=fleet.filter(x=>(ft==='semua'||x.tipe===ft)&&(fs==='semua'||x.status===fs));
  const st={total:fleet.length,tersedia:fleet.filter(x=>x.status==='Tersedia').length,digunakan:fleet.filter(x=>x.status==='Digunakan').length,servis:fleet.filter(x=>x.status==='Servis').length};
  const oa=()=>{setF({nama:'',platNomor:'',tipe:'Motor',kapasitas:'',status:'Tersedia',driver:'',tahun:'',catatan:''});setErr('');setEid(null);setSf(true)};
  const oe=(x:FleetItem)=>{setF({nama:x.nama,platNomor:x.platNomor,tipe:x.tipe,kapasitas:x.kapasitas,status:x.status,driver:x.driver||'',tahun:x.tahun,catatan:x.catatan});setEid(x.id);setSf(true)};
  const sv=()=>{if(!f.nama.trim()||!f.platNomor.trim()){setErr('Nama & Plat Nomor wajib.');return};eid?setFleet(p=>p.map(x=>x.id===eid?{...x,...f,nama:f.nama.trim(),platNomor:f.platNomor.trim().toUpperCase()}:x)):setFleet(p=>[{id:`fl-${Date.now()}`,...f,nama:f.nama.trim(),platNomor:f.platNomor.trim().toUpperCase()},...p]);setSf(false)};
  const dl=()=>{if(did){setFleet(p=>p.filter(x=>x.id!==did));setDid(null)}};
  return(<div><div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" /><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-800 sm:text-xl">🚛 Manajemen Fleet</h2><p className="text-sm text-slate-500">{fleet.length} kendaraan terdaftar</p></div><button onClick={oa} className="rounded-xl bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">+ Tambah</button></div>
  <div className="mt-4 grid grid-cols-4 gap-3"><div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-2xl font-bold text-slate-600">{st.total}</p><p className="text-xs text-slate-500">Total</p></div><div className="rounded-xl bg-emerald-50 p-3 text-center"><p className="text-2xl font-bold text-emerald-600">{st.tersedia}</p><p className="text-xs text-emerald-500">Tersedia</p></div><div className="rounded-xl bg-blue-50 p-3 text-center"><p className="text-2xl font-bold text-blue-600">{st.digunakan}</p><p className="text-xs text-blue-500">Digunakan</p></div><div className="rounded-xl bg-amber-50 p-3 text-center"><p className="text-2xl font-bold text-amber-600">{st.servis}</p><p className="text-xs text-amber-500">Servis</p></div></div>
  <div className="mt-4 flex flex-wrap gap-2"><select value={ft} onChange={e=>setFt(e.target.value)} className="rounded-xl border bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">{tp.map(t=><option key={t} value={t}>{t==='semua'?'🚛 Semua Tipe':t}</option>)}</select><select value={fs} onChange={e=>setFs(e.target.value)} className="rounded-xl border bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"><option value="semua">📋 Semua Status</option><option value="Tersedia">✅ Tersedia</option><option value="Digunakan">🔵 Digunakan</option><option value="Servis">🔧 Servis</option><option value="Nonaktif">❌ Nonaktif</option></select></div>
  {sf&&<ModalForm title={eid?'✏️ Ubah Kendaraan':'➕ Tambah Kendaraan'} error={err} onCancel={()=>setSf(false)} onSave={sv}><div className="grid gap-2"><input value={f.nama} onChange={e=>setF({...f,nama:e.target.value})} placeholder="Nama kendaraan" className="w-full rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /><input value={f.platNomor} onChange={e=>setF({...f,platNomor:e.target.value})} placeholder="Plat Nomor (B 1234 XYZ)" className="w-full rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /><select value={f.tipe} onChange={e=>setF({...f,tipe:e.target.value as FleetItem['tipe']})} className="w-full rounded-xl border px-3 py-2 text-sm bg-white focus:border-brand-500 focus:outline-none"><option value="Motor">🏍️ Motor</option><option value="Mobil Pickup">🛻 Mobil Pickup</option><option value="Mobil Box">🚐 Mobil Box</option><option value="Truk Engkel">🚛 Truk Engkel</option><option value="Truk Double">🚚 Truk Double</option></select><input value={f.kapasitas} onChange={e=>setF({...f,kapasitas:e.target.value})} placeholder="Kapasitas (1 ton / 50 kg)" className="w-full rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /><select value={f.status} onChange={e=>setF({...f,status:e.target.value as FleetItem['status']})} className="w-full rounded-xl border px-3 py-2 text-sm bg-white focus:border-brand-500 focus:outline-none"><option value="Tersedia">✅ Tersedia</option><option value="Digunakan">🔵 Digunakan</option><option value="Servis">🔧 Servis</option><option value="Nonaktif">❌ Nonaktif</option></select><input value={f.driver} onChange={e=>setF({...f,driver:e.target.value})} placeholder="Driver (opsional)" className="w-full rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /><input value={f.tahun} onChange={e=>setF({...f,tahun:e.target.value})} placeholder="Tahun" className="w-full rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /><input value={f.catatan} onChange={e=>setF({...f,catatan:e.target.value})} placeholder="Catatan" className="w-full rounded-xl border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /></div></ModalForm>}
  {did&&<ModalConfirm title="🗑️ Hapus Kendaraan" msg="Yakin hapus kendaraan ini?" onCancel={()=>setDid(null)} onConfirm={dl} />}
  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100"><table className="w-full text-left text-sm"><thead><tr className="bg-brand-50 text-xs uppercase text-brand-500">{['Nama','Plat Nomor','Tipe','Kapasitas','Driver','Tahun','Status','Aksi'].map(c=><th key={c} className="px-3 py-3 font-semibold whitespace-nowrap">{c}</th>)}</tr></thead><tbody className="divide-y divide-slate-50 bg-white">{flt.map((x,i)=>(<tr key={x.id} className={i%2===0?'bg-white':'bg-slate-50/30'}><td className="px-3 py-3 font-medium text-slate-800">{x.nama}</td><td className="px-3 py-3 font-mono text-xs text-slate-600">{x.platNomor}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TIPE_COLORS[x.tipe]}`}>{x.tipe}</span></td><td className="px-3 py-3 text-slate-600">{x.kapasitas}</td><td className="px-3 py-3 text-slate-600">{x.driver||'-'}</td><td className="px-3 py-3 text-slate-500">{x.tahun}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_FLEET[x.status]}`}>{x.status}</span></td><td className="px-3 py-3"><div className="flex gap-1"><button onClick={()=>oe(x)} className="rounded-lg bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-200">✏️</button><button onClick={()=>setDid(x.id)} className="rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-200">🗑️</button></div></td></tr>))}</tbody></table></div>{flt.length===0&&<p className="mt-4 text-center text-sm text-slate-400">Tidak ada kendaraan.</p>}</div>);
}

/* ================================================================ */
/* REUSABLE MODALS                                                   */
/* ================================================================ */
function ModalConfirm({title,msg,onCancel,onConfirm}:{title:string;msg:string;onCancel:()=>void;onConfirm:()=>void}){return(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"><div className="w-80 rounded-2xl bg-white p-6 shadow-xl"><p className="text-lg font-bold text-slate-800">{title}</p><p className="mt-2 text-sm text-slate-600">{msg}</p><div className="mt-4 flex justify-end gap-2"><button onClick={onCancel} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button><button onClick={onConfirm} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white">Hapus</button></div></div></div>);}
function ModalForm({title,error,onCancel,onSave,children}:{title:string;error:string;onCancel:()=>void;onSave:()=>void;children:React.ReactNode}){return(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"><div className="w-80 rounded-2xl bg-white p-6 shadow-xl"><p className="text-lg font-bold text-slate-800">{title}</p>{error&&<p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}<div className="mt-3">{children}</div><div className="mt-4 flex justify-end gap-2"><button onClick={onCancel} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button><button onClick={onSave} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white">Simpan</button></div></div></div>);}
