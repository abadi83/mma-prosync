'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useSkus } from '@/app/context/SkuContext';
import { recordActivity } from '@/app/lib/recordActivity';

type Tab = 'kasir' | 'daftar' | 'ringkasan';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'kasir', label: 'Kasir', icon: '🧾' },
  { key: 'daftar', label: 'Daftar Transaksi', icon: '📃' },
  { key: 'ringkasan', label: 'Ringkasan Harian', icon: '📊' },
];

interface CartItem { id: string; produk: string; harga: number; qty: number; }
interface TransaksiEntry { id: string; produk: string; jumlah: number; hargaSatuan: number; total: number; pelanggan: string; tanggal: string; }

export default function PenjualanPage() {
  const [tab, setTab] = useState<Tab>('kasir');
  const [transaksi, setTransaksi] = useState<TransaksiEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch transaksi dari API
  const fetchTransaksi = useCallback(async () => {
    try {
      const res = await fetch('/api/transaksi');
      if (res.ok) {
        const data = await res.json();
        setTransaksi(Array.isArray(data) ? data : []);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTransaksi(); }, [fetchTransaksi]);

  const handleCheckout = useCallback(async (items: CartItem[], pelanggan: string) => {
    // Simpan ke API per item
    for (const item of items) {
      try {
        await fetch('/api/transaksi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            produk: item.produk,
            jumlah: item.qty,
            hargaSatuan: item.harga,
            pelanggan: pelanggan.trim() || 'Umum',
          }),
        });
      } catch {}
    }
    // ── Rekam aktivitas kasir (KPI) ──
    recordActivity([{
      modul: 'transaksi', aksi: 'tambah',
      refLabel: `${items.length} item kasir`,
      detail: {
        jumlahItem: items.length,
        total: items.reduce((s, i) => s + i.harga * i.qty, 0),
        pelanggan: pelanggan.trim() || 'Umum',
      },
    }]);
    // Refresh daftar
    fetchTransaksi();
  }, [fetchTransaksi]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-500 to-brand-300 p-5 text-white shadow-lg sm:p-7">
        <div className="absolute right-4 top-4 text-5xl opacity-20 sm:text-7xl">💰</div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-100 sm:text-sm">Operasional</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Penjualan</h1>
        <p className="mt-1 max-w-xl text-sm text-brand-100 sm:text-base">Kasir offline lengkap — pilih produk, atur jumlah, bayar, cetak struk.</p>
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
        {tab==='kasir' && <KasirTab onCheckout={handleCheckout} />}
        {tab==='daftar' && <DaftarTransaksi data={transaksi} />}
        {tab==='ringkasan' && <RingkasanHarian data={transaksi} />}
      </section>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* KASIR TAB — POS lengkap                                           */
/* ═══════════════════════════════════════════════════════════════════ */
function KasirTab({ onCheckout }: { onCheckout: (items: CartItem[], pelanggan: string) => void }) {
  const { skus } = useSkus();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [gambarMap, setGambarMap] = useState<Record<string, string>>({});

  // Katalog: SEMUA SKU aktif dengan harga jual (bukan cuma 50 pertama)
  const katalogProduk = useMemo(() => skus.filter(s => s.aktif === 1 && s.hargaJual > 0).map(s => ({
    id: s.sku, nama: s.nama, harga: s.hargaJual, icon: '📦'
  })), [skus]);

  // Pencarian: cocokkan NAMA atau KODE SKU (case-insensitive)
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = q
      ? katalogProduk.filter(p => p.nama.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
      : katalogProduk;
    return list.slice(0, 100);
  }, [katalogProduk, search]);

  // ── Muat foto SKU yang sedang tampil (biar tidak salah ambil barang) ──
  useEffect(() => {
    const ids = filtered.map(p => p.id);
    if (ids.length === 0) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/sku-gambar?sku=${encodeURIComponent(ids.join(','))}`);
        if (res.ok && active) {
          const map = await res.json();
          setGambarMap(prev => {
            const next = { ...prev };
            for (const [k, v] of Object.entries(map || {})) if (v) next[k] = v as string;
            return next;
          });
        }
      } catch {}
    })();
    return () => { active = false; };
  }, [filtered]);

  const [pelanggan, setPelanggan] = useState('Umum');
  const [showBayar, setShowBayar] = useState(false);
  const [jumlahBayar, setJumlahBayar] = useState('');
  const [metodeBayar, setMetodeBayar] = useState<'cash' | 'transfer'>('cash');
  const [struk, setStruk] = useState<{ items: CartItem[]; total: number; bayar: number; kembali: number; pelanggan: string; waktu: string; metode: string } | null>(null);

  /* ── Cart ops ── */
  const addToCart = (p: typeof katalogProduk[0]) => {
    setCart(prev => {
      const exist = prev.find(c => c.id === p.id);
      if (exist) return prev.map(c => c.id === p.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { id: p.id, produk: p.nama, harga: p.harga, qty: 1 }];
    });
  };
  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.id !== id) return c;
      const next = c.qty + delta;
      return next <= 0 ? null : { ...c, qty: next };
    }).filter(Boolean) as CartItem[]);
  };
  const removeItem = (id: string) => setCart(prev => prev.filter(c => c.id !== id));
  const clearCart = () => { setCart([]); setPelanggan('Umum'); };

  const subtotal = cart.reduce((s, c) => s + c.harga * c.qty, 0);
  const totalItem = cart.reduce((s, c) => s + c.qty, 0);

  /* ── Bayar ── */
  const openBayar = () => {
    if (cart.length === 0) return;
    setJumlahBayar(String(subtotal));
    setShowBayar(true);
  };
  const prosesBayar = () => {
    const bayar = +jumlahBayar || 0;
    if (bayar < subtotal) return;
    const kembali = bayar - subtotal;
    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const today = new Date().toISOString().slice(0, 10);
    setStruk({ items: [...cart], total: subtotal, bayar, kembali, pelanggan: pelanggan.trim() || 'Umum', waktu: now, metode: metodeBayar });
    onCheckout(cart, pelanggan);

    // Simpan ke localStorage untuk laporan
    try {
      const existing = JSON.parse(localStorage.getItem('mma_penjualan_transaksi') || '[]');
      const newTx = cart.map(item => ({
        id: `tx-${Date.now()}-${item.id}`,
        produk: item.produk,
        sku: item.id,
        qty: item.qty,
        hargaSatuan: item.harga,
        total: item.harga * item.qty,
        pelanggan: pelanggan.trim() || 'Umum',
        tanggal: today,
        jam: new Date().toLocaleTimeString('id-ID'),
        metode: metodeBayar,
      }));
      localStorage.setItem('mma_penjualan_transaksi', JSON.stringify([...newTx, ...existing]));
    } catch {}

    // Auto-record ke Kas: Cash → Kas Kecil, Transfer → Kas Besar
    try {
      const nilai = subtotal;
      if (metodeBayar === 'cash') {
        const kk = JSON.parse(localStorage.getItem('mma_kas_kecil') || '[]');
        kk.unshift({
          id: `kk-jual-${Date.now()}`,
          tanggal: today,
          jumlah: nilai,
          jenis: 'masuk',
          keterangan: `Penjualan cash - ${cart.length} item (${pelanggan || 'Umum'})`,
          sumber: 'penjualan',
        });
        localStorage.setItem('mma_kas_kecil', JSON.stringify(kk));
      }
      // Transfer: otomatis masuk Kas Besar (via perhitungan saldo)
    } catch {}

    setCart([]);
    setPelanggan('Umum');
    setShowBayar(false);
    setMetodeBayar('cash');
  };

  const cetakStruk = () => {
    window.print();
    setStruk(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && showBayar) { prosesBayar(); }
  };

  return (
    <div onKeyDown={handleKeyDown}>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🧾 Kasir</h2>
      <p className="mt-1 text-sm text-slate-500">Pilih produk → atur jumlah → bayar. Cocok untuk transaksi offline.</p>

      {/* ── Struk / receipt ── */}
      {struk && (
        <div className="mt-4 rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold text-emerald-700">✅ Pembayaran Berhasil</p>
            <button onClick={() => setStruk(null)} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
          <div className="mt-3 rounded-xl bg-white p-4 text-sm font-mono border border-dashed border-emerald-200">
            {/* ── HEADER TOKO ── */}
            <div className="text-center mb-2">
              {typeof window !== 'undefined' && localStorage.getItem('mma_logo_toko') && (
                <img src={localStorage.getItem('mma_logo_toko')!} alt="Logo" className="mx-auto h-12 w-12 rounded-lg object-cover mb-1" />
              )}
              <p className="font-bold text-slate-800 text-base">
                {typeof window !== 'undefined' ? (localStorage.getItem('mma_nama_toko') || 'Toko Berkah Abadi') : 'Toko Berkah Abadi'}
              </p>
              <p className="text-[10px] text-slate-400 leading-tight">
                {typeof window !== 'undefined' ? (localStorage.getItem('mma_alamat_toko') || 'Jl. Merdeka No. 10, Jakarta') : 'Jl. Merdeka No. 10, Jakarta'}
              </p>
              <p className="text-[10px] text-slate-400">
                Telp: {typeof window !== 'undefined' ? (localStorage.getItem('mma_telepon_toko') || '0812-3456-7890') : '0812-3456-7890'}
              </p>
            </div>
            <hr className="my-2 border-dashed border-slate-200" />
            <p className="text-center font-bold text-slate-800">🧾 STRUK PENJUALAN</p>
            <p className="text-center text-xs text-slate-400">{new Date().toLocaleDateString('id-ID')} • {struk.waktu}</p>
            <p className="text-center text-xs text-slate-500">Pelanggan: {struk.pelanggan}</p>
            <p className="text-center text-xs text-slate-500">Metode: {struk.metode === 'cash' ? '💵 Cash' : '🏦 Transfer'}</p>
            <hr className="my-2 border-dashed border-slate-200" />
            {struk.items.map(item => (
              <div key={item.id} className="flex justify-between">
                <span>{item.produk} <span className="text-slate-400">x{item.qty}</span></span>
                <span>Rp {(item.harga * item.qty).toLocaleString('id-ID')}</span>
              </div>
            ))}
            <hr className="my-2 border-dashed border-slate-200" />
            <div className="flex justify-between font-bold"><span>Total</span><span>Rp {struk.total.toLocaleString('id-ID')}</span></div>
            <div className="flex justify-between text-slate-600"><span>Bayar</span><span>Rp {struk.bayar.toLocaleString('id-ID')}</span></div>
            <div className="flex justify-between font-bold text-emerald-600"><span>Kembali</span><span>Rp {struk.kembali.toLocaleString('id-ID')}</span></div>
          </div>
          <button onClick={cetakStruk} className="mt-3 w-full rounded-xl bg-emerald-500 py-2 text-sm font-semibold text-white hover:bg-emerald-600">🖨️ Cetak Struk & Selesai</button>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* ── LEFT: Katalog Produk ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cari produk..." className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            {search && <button onClick={() => setSearch('')} className="text-xs text-slate-400">✕ reset</button>}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4">
            {filtered.map(p => (
              <button key={p.id} onClick={() => addToCart(p)} className="flex flex-col items-center gap-1 rounded-2xl border border-slate-100 bg-white p-3 text-center shadow-sm transition active:scale-95 hover:border-brand-300 hover:shadow-md">
                {gambarMap[p.id] ? <img src={gambarMap[p.id]} alt={p.nama} className="h-14 w-14 rounded-lg object-contain" /> : <span className="text-2xl">{p.icon}</span>}
                <span className="text-xs font-medium text-slate-700 leading-tight line-clamp-2">{p.nama}</span>
                <span className="text-xs font-bold text-brand-600">Rp {p.harga.toLocaleString('id-ID')}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-8 text-center text-sm text-slate-400">
                <p className="text-3xl mb-2">🔍</p>
                <p>Tidak ada produk cocok dengan "{search}".</p>
                <p className="text-xs mt-1">Cari pakai nama produk atau kode SKU.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Keranjang + Checkout ── */}
        <div className="flex flex-col rounded-2xl border border-brand-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-800">🛒 Keranjang ({totalItem} item)</p>
            {cart.length > 0 && <button onClick={clearCart} className="text-xs text-red-400 hover:text-red-600">🗑️ Kosongkan</button>}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2" style={{ maxHeight: '320px' }}>
            {cart.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-300">Keranjang kosong.<br/>Klik produk untuk menambah.</p>
            ) : (
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2">
                    {gambarMap[item.id] && <img src={gambarMap[item.id]} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-slate-100 object-contain bg-white" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.produk}</p>
                      <p className="text-xs text-slate-400">Rp {item.harga.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-300">−</button>
                      <span className="w-8 text-center text-sm font-bold text-slate-800">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-sm font-bold text-brand-700 hover:bg-brand-200">+</button>
                    </div>
                    <p className="w-20 text-right text-sm font-bold text-brand-700">Rp {(item.harga * item.qty).toLocaleString('id-ID')}</p>
                    <button onClick={() => removeItem(item.id)} className="ml-1 text-xs text-slate-300 hover:text-red-400">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkout footer */}
          <div className="border-t border-slate-100 px-4 py-3 space-y-2">
            <label className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 w-20">Pelanggan</span>
              <input type="text" value={pelanggan} onChange={e => setPelanggan(e.target.value)} placeholder="Nama pelanggan" className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
            </label>
            <div className="flex items-center justify-between border-t border-slate-100 pt-2">
              <div>
                <p className="text-xs text-slate-400">Subtotal</p>
                <p className="text-xl font-bold text-brand-700">Rp {subtotal.toLocaleString('id-ID')}</p>
              </div>
              <button onClick={openBayar} disabled={cart.length===0} className={`rounded-xl px-6 py-2.5 text-sm font-bold text-white transition ${cart.length===0?'bg-slate-300 cursor-not-allowed':'bg-brand-500 hover:bg-brand-700 shadow-lg hover:shadow-xl active:scale-95'}`}>
                💰 Bayar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal Bayar ── */}
      {showBayar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-lg font-bold text-slate-800">💰 Pembayaran</p>
            <p className="mt-1 text-sm text-slate-500">{totalItem} item • Pelanggan: {pelanggan || 'Umum'}</p>

            <div className="mt-4 space-y-3">
              <div className="flex justify-between rounded-xl bg-slate-50 px-4 py-2">
                <span className="text-sm text-slate-600">Total</span>
                <span className="text-lg font-bold text-brand-700">Rp {subtotal.toLocaleString('id-ID')}</span>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Jumlah Bayar</span>
                <input type="number" value={jumlahBayar} onChange={e => setJumlahBayar(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') prosesBayar(); }} className="w-full rounded-xl border-2 border-brand-300 bg-white px-4 py-3 text-lg font-bold text-slate-800 focus:border-brand-500 focus:outline-none" autoFocus />
              </label>

              {/* Quick nominal */}
              <div className="flex flex-wrap gap-1">
                {[5000, 10000, 20000, 50000, 100000].map(n => (
                  <button key={n} onClick={() => setJumlahBayar(String(n))} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-brand-50 hover:text-brand-700">Rp {n.toLocaleString('id-ID')}</button>
                ))}
                <button onClick={() => setJumlahBayar(String(subtotal))} className="rounded-lg border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">💳 Pas</button>
              </div>

              {(+jumlahBayar || 0) >= subtotal && (
                <div className="flex justify-between rounded-xl bg-emerald-50 px-4 py-2">
                  <span className="text-sm text-emerald-600">Kembalian</span>
                  <span className="text-lg font-bold text-emerald-700">Rp {((+jumlahBayar || 0) - subtotal).toLocaleString('id-ID')}</span>
                </div>
              )}
              {(+jumlahBayar || 0) > 0 && (+jumlahBayar || 0) < subtotal && (
                <p className="text-xs text-red-500 text-center">Kurang Rp {(subtotal - (+jumlahBayar || 0)).toLocaleString('id-ID')}</p>
              )}

              {/* Metode Bayar */}
              <div className="flex gap-2">
                <button onClick={() => setMetodeBayar('cash')}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${metodeBayar === 'cash' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  💵 Cash
                </button>
                <button onClick={() => setMetodeBayar('transfer')}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${metodeBayar === 'transfer' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  🏦 Transfer
                </button>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowBayar(false)} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200">Batal</button>
              <button onClick={prosesBayar} disabled={(+jumlahBayar || 0) < subtotal} className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition ${(+jumlahBayar || 0) < subtotal ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600'}`}>✅ Bayar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* DAFTAR TRANSAKSI                                                   */
/* ═══════════════════════════════════════════════════════════════════ */
function DaftarTransaksi({ data }: { data: TransaksiEntry[] }) {
  const [search, setSearch] = useState('');
  const filtered = data.filter(t =>
    t.produk.toLowerCase().includes(search.toLowerCase()) ||
    t.pelanggan.toLowerCase().includes(search.toLowerCase())
  );
  const grandTotal = filtered.reduce((s, t) => s + t.total, 0);

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Daftar Transaksi</h2>
          <p className="mt-1 text-sm text-slate-500">{filtered.length} transaksi • Total: <strong className="text-brand-700">Rp {grandTotal.toLocaleString('id-ID')}</strong></p>
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cari..." className="w-40 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-brand-50 text-xs uppercase text-brand-500">
              {['Produk','Jml','Harga','Total','Pelanggan','Tanggal'].map(c => <th key={c} className="px-3 py-3 font-semibold">{c}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400">Belum ada transaksi.</td></tr>
            ) : (
              filtered.map((t, i) => (
                <tr key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                  <td className="px-3 py-3 font-medium text-slate-800">{t.produk}</td>
                  <td className="px-3 py-3">{t.jumlah}</td>
                  <td className="px-3 py-3 text-slate-600">Rp {t.hargaSatuan.toLocaleString('id-ID')}</td>
                  <td className="px-3 py-3 font-semibold text-brand-700">Rp {t.total.toLocaleString('id-ID')}</td>
                  <td className="px-3 py-3 text-slate-600">{t.pelanggan}</td>
                  <td className="px-3 py-3 text-slate-500">{t.tanggal}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* RINGKASAN HARIAN                                                   */
/* ═══════════════════════════════════════════════════════════════════ */
function RingkasanHarian({ data }: { data: TransaksiEntry[] }) {
  const hariIni = new Date().toISOString().slice(0, 10);
  const todayTx = data.filter(t => t.tanggal === hariIni);
  const totalPenjualan = todayTx.reduce((s, t) => s + t.total, 0);
  const jumlahTransaksi = todayTx.length;
  const rataRata = jumlahTransaksi > 0 ? Math.round(totalPenjualan / jumlahTransaksi) : 0;

  const produkMap = new Map<string, number>();
  todayTx.forEach(t => produkMap.set(t.produk, (produkMap.get(t.produk) || 0) + t.jumlah));
  const topProduk = Array.from(produkMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Ringkasan Harian</h2>
      <p className="mt-1 text-sm text-slate-500">{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 p-5 text-center shadow-sm">
          <p className="text-3xl">💰</p>
          <p className="mt-1 text-xs font-semibold uppercase text-brand-500">Total Penjualan</p>
          <p className="mt-1 text-xl font-bold text-brand-700">Rp {totalPenjualan.toLocaleString('id-ID')}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 p-5 text-center shadow-sm">
          <p className="text-3xl">📃</p>
          <p className="mt-1 text-xs font-semibold uppercase text-emerald-600">Jml Transaksi</p>
          <p className="mt-1 text-xl font-bold text-emerald-700">{jumlahTransaksi}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 p-5 text-center shadow-sm">
          <p className="text-3xl">📊</p>
          <p className="mt-1 text-xs font-semibold uppercase text-amber-600">Rata-Rata</p>
          <p className="mt-1 text-xl font-bold text-amber-700">Rp {rataRata.toLocaleString('id-ID')}</p>
        </div>
      </div>

      {topProduk.length > 0 && (
        <div className="mt-4 rounded-2xl border border-brand-100 bg-white p-4">
          <p className="text-sm font-bold text-slate-700">🏆 Produk Terlaris Hari Ini</p>
          <div className="mt-2 space-y-1">
            {topProduk.map(([nama, qty], i) => (
              <div key={nama} className="flex items-center gap-2 text-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
                <span className="flex-1 text-slate-700">{nama}</span>
                <span className="font-semibold text-brand-600">{qty} terjual</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
