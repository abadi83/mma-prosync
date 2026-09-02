'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useSkus, type SkuItem } from '@/app/context/SkuContext';
import { recordActivity } from '@/app/lib/recordActivity';
import { addTombstones } from '@/app/lib/tombstones';

type Tab = 'kasir' | 'daftar' | 'ringkasan' | 'perbaikan';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'kasir', label: 'Kasir', icon: '🧾' },
  { key: 'daftar', label: 'Daftar Transaksi', icon: '📃' },
  { key: 'ringkasan', label: 'Ringkasan Penjualan', icon: '📊' },
  { key: 'perbaikan', label: 'Perbaikan Data', icon: '🛠️' },
];

interface CartItem { id: string; produk: string; harga: number; hargaAsli: number; hargaModal: number; qty: number; }
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

  const handleCheckout = useCallback(async (items: CartItem[], pelanggan: string, tanggal: string, diskon: number) => {
    const subtotal = items.reduce((s, i) => s + i.harga * i.qty, 0);
    const shareDiskon = (itemSub: number) => (subtotal > 0 ? diskon * (itemSub / subtotal) : 0);
    // Simpan ke API per item (dengan tanggal backdate & diskon share per item)
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
            tanggal,
            diskon: Math.round(shareDiskon(item.harga * item.qty)),
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
        total: subtotal - diskon,
        diskon,
        pelanggan: pelanggan.trim() || 'Umum',
        tanggal,
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
        {tab==='daftar' && <DaftarTransaksi onChanged={fetchTransaksi} />}
        {tab==='ringkasan' && <RingkasanHarian data={transaksi} />}
        {tab==='perbaikan' && <PerbaikanDataTab />}
      </section>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* KASIR TAB — POS lengkap                                           */
/* ═══════════════════════════════════════════════════════════════════ */
function KasirTab({ onCheckout }: { onCheckout: (items: CartItem[], pelanggan: string, tanggal: string, diskon: number) => void }) {
  const { skus } = useSkus();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [gambarMap, setGambarMap] = useState<Record<string, string>>({});
  // 📅 Tanggal transaksi — bisa di-backdate untuk input data offline (mis. Juli)
  const [tanggalTx, setTanggalTx] = useState(() => new Date().toISOString().slice(0, 10));
  // 🎁 Diskon (Rp) — otomatis mengurangi total
  const [diskonStr, setDiskonStr] = useState('');

  // Katalog: SEMUA SKU aktif dengan harga jual (bukan cuma 50 pertama)
  const katalogProduk = useMemo(() => skus.filter(s => s.aktif === 1 && s.hargaJual > 0).map(s => ({
    id: s.sku, nama: s.nama, harga: s.hargaJual, hargaModal: s.hargaBaru || s.hargaModalLama || 0, icon: '📦'
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
  const [struk, setStruk] = useState<{ items: CartItem[]; total: number; diskon: number; bayar: number; kembali: number; pelanggan: string; waktu: string; metode: string; tanggal: string } | null>(null);

  /* ── Cart ops ── */
  const addToCart = (p: typeof katalogProduk[0]) => {
    setCart(prev => {
      const exist = prev.find(c => c.id === p.id);
      if (exist) return prev.map(c => c.id === p.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { id: p.id, produk: p.nama, harga: p.harga, hargaAsli: p.harga, hargaModal: p.hargaModal, qty: 1 }];
    });
  };
  /* ── Intervensi harga jual per item (kasir bebas menentukan) ── */
  const setHargaItem = (id: string, val: string) => {
    const h = Math.max(0, Math.round(+val || 0));
    setCart(prev => prev.map(c => c.id === id ? { ...c, harga: h } : c));
  };
  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.id !== id) return c;
      const next = c.qty + delta;
      return next <= 0 ? null : { ...c, qty: next };
    }).filter(Boolean) as CartItem[]);
  };
  const removeItem = (id: string) => setCart(prev => prev.filter(c => c.id !== id));
  const clearCart = () => { setCart([]); setPelanggan('Umum'); setDiskonStr(''); };

  const subtotal = cart.reduce((s, c) => s + c.harga * c.qty, 0);
  // Diskon otomatis: angka Rp, dibatasi 0 s.d. subtotal
  const diskon = Math.min(Math.max(0, +diskonStr || 0), subtotal);
  const totalBayar = subtotal - diskon;
  // Estimasi laba kotor: (harga override − harga modal) × qty, dikurangi diskon flat
  const estLaba = cart.reduce((s, c) => s + (c.harga - c.hargaModal) * c.qty, 0) - diskon;
  const totalItem = cart.reduce((s, c) => s + c.qty, 0);

  /* ── Bayar ── */
  const openBayar = () => {
    if (cart.length === 0) return;
    setJumlahBayar(String(totalBayar));
    setShowBayar(true);
  };
  const prosesBayar = () => {
    const bayar = +jumlahBayar || 0;
    if (bayar < totalBayar) return;
    const kembali = bayar - totalBayar;
    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const checkoutId = `ck-${Date.now()}`; // id checkout — untuk sinkron hapus/edit ke kas & laporan
    setStruk({ items: [...cart], total: totalBayar, diskon, bayar, kembali, pelanggan: pelanggan.trim() || 'Umum', waktu: now, metode: metodeBayar, tanggal: tanggalTx });
    onCheckout(cart, pelanggan, tanggalTx, diskon);

    // Simpan ke localStorage untuk laporan (diskon dibagi proporsional per item)
    try {
      const existing = JSON.parse(localStorage.getItem('mma_penjualan_transaksi') || '[]');
      const newTx = cart.map(item => {
        const itemSub = item.harga * item.qty;
        const share = subtotal > 0 ? Math.round(diskon * (itemSub / subtotal)) : 0;
        return {
          id: `tx-${Date.now()}-${item.id}`,
          checkoutId,
          produk: item.produk,
          sku: item.id,
          qty: item.qty,
          hargaSatuan: item.harga,
          hargaAsli: item.hargaAsli,
          total: itemSub - share,
          diskon: share,
          pelanggan: pelanggan.trim() || 'Umum',
          tanggal: tanggalTx,
          jam: now,
          metode: metodeBayar,
        };
      });
      localStorage.setItem('mma_penjualan_transaksi', JSON.stringify([...newTx, ...existing]));
    } catch {}

    // Auto-record ke Kas: Cash → Kas Kecil, Transfer → Kas Besar
    try {
      const nilai = totalBayar;
      if (metodeBayar === 'cash') {
        const kk = JSON.parse(localStorage.getItem('mma_kas_kecil') || '[]');
        kk.unshift({
          id: `kk-jual-${Date.now()}`,
          checkoutId,
          tanggal: tanggalTx,
          jumlah: nilai,
          jenis: 'masuk',
          keterangan: `Penjualan cash - ${cart.length} item (${pelanggan || 'Umum'})`,
          sumber: 'penjualan',
        });
        localStorage.setItem('mma_kas_kecil', JSON.stringify(kk));
      } else {
        // Transfer → catat eksplisit ke Kas Besar (riwayat uang masuk)
        const kb = JSON.parse(localStorage.getItem('mma_kas_besar_masuk') || '[]');
        kb.unshift({
          id: `kb-jual-${Date.now()}`,
          checkoutId,
          tanggal: tanggalTx,
          jumlah: nilai,
          sumber: 'penjualan',
          keterangan: `Penjualan transfer - ${cart.length} item (${pelanggan || 'Umum'})`,
        });
        localStorage.setItem('mma_kas_besar_masuk', JSON.stringify(kb));
      }
    } catch {}

    setCart([]);
    setPelanggan('Umum');
    setDiskonStr('');
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
            <p className="text-center text-xs text-slate-400">{struk.tanggal} • {struk.waktu}</p>
            <p className="text-center text-xs text-slate-500">Pelanggan: {struk.pelanggan}</p>
            <p className="text-center text-xs text-slate-500">Metode: {struk.metode === 'cash' ? '💵 Cash' : '🏦 Transfer'}</p>
            <hr className="my-2 border-dashed border-slate-200" />
            {struk.items.map(item => (
              <div key={item.id}>
                <div className="flex justify-between">
                  <span>{item.produk} <span className="text-slate-400">x{item.qty}</span></span>
                  <span>Rp {(item.harga * item.qty).toLocaleString('id-ID')}</span>
                </div>
                {item.harga !== item.hargaAsli && (
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Harga normal @Rp {item.hargaAsli.toLocaleString('id-ID')}</span>
                    <span>{item.harga < item.hargaAsli ? 'Diskon' : 'Naik'} Rp {Math.abs(item.hargaAsli - item.harga).toLocaleString('id-ID')}/pcs</span>
                  </div>
                )}
              </div>
            ))}
            <hr className="my-2 border-dashed border-slate-200" />
            {struk.diskon > 0 && (
              <div className="flex justify-between text-red-500"><span>Diskon</span><span>−Rp {struk.diskon.toLocaleString('id-ID')}</span></div>
            )}
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
                {cart.map(item => {
                  const selisih = item.hargaAsli - item.harga;
                  const labaItem = (item.harga - item.hargaModal) * item.qty;
                  return (
                  <div key={item.id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2">
                    {gambarMap[item.id] && <img src={gambarMap[item.id]} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-slate-100 object-contain bg-white" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.produk}</p>
                      <div className="mt-0.5 flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">Rp</span>
                        <input
                          type="number"
                          min={0}
                          value={item.harga}
                          onChange={e => setHargaItem(item.id, e.target.value)}
                          className="w-24 rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-semibold text-slate-700 focus:border-brand-500 focus:outline-none"
                          title="Ubah harga jual item ini"
                        />
                        {selisih !== 0 && (
                          <button onClick={() => setHargaItem(item.id, String(item.hargaAsli))} className="text-[9px] text-slate-400 underline hover:text-brand-600" title="Kembalikan ke harga asli">reset</button>
                        )}
                      </div>
                      <p className="text-[10px] leading-tight">
                        {selisih > 0 && <span className="text-emerald-600 font-semibold">↓ Diskon Rp {selisih.toLocaleString('id-ID')}</span>}
                        {selisih < 0 && <span className="text-blue-600 font-semibold">↑ Naik Rp {Math.abs(selisih).toLocaleString('id-ID')}</span>}
                        {selisih !== 0 && ' · '}
                        {item.hargaModal > 0 && <span className={labaItem >= 0 ? 'text-slate-500' : 'text-red-500'}>{labaItem >= 0 ? 'Laba' : 'Rugi'} Rp {Math.abs(labaItem).toLocaleString('id-ID')}</span>}
                        {item.hargaModal === 0 && <span className="text-amber-500">⚠ HPP belum diisi</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-300">−</button>
                      <span className="w-8 text-center text-sm font-bold text-slate-800">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-sm font-bold text-brand-700 hover:bg-brand-200">+</button>
                    </div>
                    <p className="w-20 text-right text-sm font-bold text-brand-700">Rp {(item.harga * item.qty).toLocaleString('id-ID')}</p>
                    <button onClick={() => removeItem(item.id)} className="ml-1 text-xs text-slate-300 hover:text-red-400">✕</button>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Checkout footer */}
          <div className="border-t border-slate-100 px-4 py-3 space-y-2">
            <label className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 w-20">Pelanggan</span>
              <input type="text" value={pelanggan} onChange={e => setPelanggan(e.target.value)} placeholder="Nama pelanggan" className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 w-20">📅 Tanggal</span>
              <input type="date" value={tanggalTx} onChange={e => e.target.value && setTanggalTx(e.target.value)} className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 w-20">🎁 Diskon</span>
              <input type="number" min={0} value={diskonStr} onChange={e => setDiskonStr(e.target.value)} placeholder="Rp 0" className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div className="flex flex-wrap gap-1">
              {[5, 10, 15, 20].map(p => (
                <button key={p} onClick={() => setDiskonStr(String(Math.round(subtotal * p / 100)))} className="rounded-lg border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-500 hover:bg-red-100">
                  −{p}%
                </button>
              ))}
              {diskonStr && <button onClick={() => setDiskonStr('')} className="rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-400 hover:bg-slate-100">✕ reset</button>}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-2">
              <div>
                <p className="text-xs text-slate-400">Subtotal</p>
                <p className="text-xl font-bold text-brand-700">Rp {subtotal.toLocaleString('id-ID')}</p>
                <p className={`text-xs font-semibold ${estLaba >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {estLaba >= 0 ? '📈 Est. Laba' : '📉 Est. Rugi'} Rp {Math.abs(estLaba).toLocaleString('id-ID')}
                </p>
                {diskon > 0 && (
                  <p className="text-xs font-semibold text-red-500">Diskon −Rp {diskon.toLocaleString('id-ID')} • Total <span className="text-base font-bold">Rp {totalBayar.toLocaleString('id-ID')}</span></p>
                )}
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
                <span className="text-lg font-bold text-brand-700">Rp {totalBayar.toLocaleString('id-ID')}</span>
              </div>
              {diskon > 0 && (
                <p className="px-1 text-xs text-red-500">Subtotal Rp {subtotal.toLocaleString('id-ID')} − Diskon Rp {diskon.toLocaleString('id-ID')}</p>
              )}

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Jumlah Bayar</span>
                <input type="number" value={jumlahBayar} onChange={e => setJumlahBayar(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') prosesBayar(); }} className="w-full rounded-xl border-2 border-brand-300 bg-white px-4 py-3 text-lg font-bold text-slate-800 focus:border-brand-500 focus:outline-none" autoFocus />
              </label>

              {/* Quick nominal */}
              <div className="flex flex-wrap gap-1">
                {[5000, 10000, 20000, 50000, 100000].map(n => (
                  <button key={n} onClick={() => setJumlahBayar(String(n))} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-brand-50 hover:text-brand-700">Rp {n.toLocaleString('id-ID')}</button>
                ))}
                <button onClick={() => setJumlahBayar(String(totalBayar))} className="rounded-lg border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">💳 Pas</button>
              </div>

              {(+jumlahBayar || 0) >= totalBayar && (
                <div className="flex justify-between rounded-xl bg-emerald-50 px-4 py-2">
                  <span className="text-sm text-emerald-600">Kembalian</span>
                  <span className="text-lg font-bold text-emerald-700">Rp {((+jumlahBayar || 0) - totalBayar).toLocaleString('id-ID')}</span>
                </div>
              )}
              {(+jumlahBayar || 0) > 0 && (+jumlahBayar || 0) < totalBayar && (
                <p className="text-xs text-red-500 text-center">Kurang Rp {(totalBayar - (+jumlahBayar || 0)).toLocaleString('id-ID')}</p>
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
              <button onClick={prosesBayar} disabled={(+jumlahBayar || 0) < totalBayar} className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition ${(+jumlahBayar || 0) < totalBayar ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600'}`}>✅ Bayar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* DAFTAR TRANSAKSI — sumber data = mma_penjualan_transaksi (JSON      */
/* tersinkron) + bisa EDIT & HAPUS (otomatis ke laporan & keuangan)    */
/* ═══════════════════════════════════════════════════════════════════ */
interface TxRow {
  id: string;
  checkoutId?: string;
  produk: string;
  sku: string;
  qty: number;
  hargaSatuan: number;
  hargaAsli?: number;
  total: number;
  diskon?: number;
  pelanggan: string;
  tanggal: string;
  jam?: string;
  metode?: string;
}

function DaftarTransaksi({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<TxRow[]>([]);
  const [search, setSearch] = useState('');
  const [editGroup, setEditGroup] = useState<TxRow[] | null>(null);
  const [editTanggal, setEditTanggal] = useState('');
  const [editPelanggan, setEditPelanggan] = useState('');
  const [editCheckoutId, setEditCheckoutId] = useState<string | undefined>(undefined);
  const [editMetode, setEditMetode] = useState('');
  const [editJam, setEditJam] = useState('');
  const [editKey, setEditKey] = useState('');

  const load = useCallback(() => {
    try { setRows(JSON.parse(localStorage.getItem('mma_penjualan_transaksi') || '[]')); }
    catch { setRows([]); }
  }, []);
  useEffect(() => {
    load();
    window.addEventListener('storage', load);
    window.addEventListener('refresh-laporan', load);
    return () => {
      window.removeEventListener('storage', load);
      window.removeEventListener('refresh-laporan', load);
    };
  }, [load]);

  const groupKey = (r: TxRow) => r.checkoutId || `${r.tanggal}||${r.jam || ''}`;

  const groups = useMemo(() => {
    const m = new Map<string, { items: TxRow[]; tanggal: string; pelanggan: string; metode: string; checkoutId?: string; total: number }>();
    for (const r of rows) {
      const key = groupKey(r);
      const g = m.get(key) || { items: [], tanggal: r.tanggal, pelanggan: r.pelanggan, metode: r.metode || '', checkoutId: r.checkoutId, total: 0 };
      g.items.push(r);
      g.total += r.total || 0;
      m.set(key, g);
    }
    return Array.from(m.entries()).map(([key, g]) => ({ key, ...g }));
  }, [rows]);

  const filtered = groups
    .filter(g => g.items.some(i => i.produk.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase())) || g.pelanggan.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  const grandTotal = filtered.reduce((s, g) => s + g.total, 0);

  /* ── Hapus satu transaksi (checkout) — sinkron ke JSON, kas & DB ── */
  const hapus = async (g: { key: string; items: TxRow[]; total: number; tanggal: string; checkoutId?: string; metode: string }) => {
    if (!window.confirm(`Hapus transaksi ${g.tanggal} (${g.items.length} item, Rp ${g.total.toLocaleString('id-ID')})?\n\nLaporan penjualan, kas (keuangan), dan riwayat DB ikut disesuaikan.`)) return;

    // 1. JSON laporan
    const next = rows.filter(r => groupKey(r) !== g.key);
    setRows(next);
    localStorage.setItem('mma_penjualan_transaksi', JSON.stringify(next));

    // 2. Kas (keuangan) — hapus entry terkait + tombstone
    if (g.checkoutId) {
      try {
        if (g.metode === 'cash') {
          const kk = JSON.parse(localStorage.getItem('mma_kas_kecil') || '[]');
          const rem = kk.filter((e: any) => e.checkoutId === g.checkoutId);
          if (rem.length > 0) {
            localStorage.setItem('mma_kas_kecil', JSON.stringify(kk.filter((e: any) => e.checkoutId !== g.checkoutId)));
            addTombstones(rem.map((e: any) => ({ id: e.id, kind: 'kaskecil' as const })));
          }
        } else {
          const kb = JSON.parse(localStorage.getItem('mma_kas_besar_masuk') || '[]');
          const rem = kb.filter((e: any) => e.checkoutId === g.checkoutId);
          if (rem.length > 0) {
            localStorage.setItem('mma_kas_besar_masuk', JSON.stringify(kb.filter((e: any) => e.checkoutId !== g.checkoutId)));
            addTombstones(rem.map((e: any) => ({ id: e.id, kind: 'kasbesar' as const })));
          }
        }
      } catch {}
    } else {
      alert('⚠ Transaksi lama tanpa link kas — entry kas tidak otomatis dihapus. Cek Keuangan → Riwayat Uang Masuk.');
    }

    // 3. DB riwayat (satu baris per item)
    for (const it of g.items) {
      try {
        await fetch('/api/transaksi', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tanggal: it.tanggal, produk: it.produk, total: it.total }),
        });
      } catch {}
    }

    // 4. Refresh semua pemakai data
    window.dispatchEvent(new Event('refresh-laporan'));
    window.dispatchEvent(new Event('kas-kecil-updated'));
    onChanged?.();
  };

  /* ── Edit transaksi ── */
  const openEdit = (g: { key: string; items: TxRow[]; tanggal: string; pelanggan: string; metode: string; checkoutId?: string }) => {
    setEditKey(g.key);
    setEditCheckoutId(g.checkoutId);
    setEditTanggal(g.tanggal);
    setEditPelanggan(g.pelanggan);
    setEditMetode(g.metode);
    setEditJam(g.items[0]?.jam || '');
    setEditGroup(g.items.map(i => ({ ...i })));
  };

  const simpanEdit = async () => {
    if (!editGroup) return;
    const items = editGroup
      .map(i => ({ ...i, qty: Math.max(0, Math.round(+i.qty || 0)), hargaSatuan: Math.max(0, Math.round(+i.hargaSatuan || 0)) }))
      .filter(i => i.qty > 0);
    if (items.length === 0) { alert('Minimal 1 item dengan qty > 0.'); return; }
    const newTotal = items.reduce((s, i) => s + i.qty * i.hargaSatuan, 0);

    // 1. JSON laporan — update baris checkout ini
    const updatedRows = rows.map(r => {
      if (groupKey(r) !== editKey) return r;
      const it = items.find(x => x.id === r.id);
      if (!it) return null; // item dihapus dari edit
      return { ...r, qty: it.qty, hargaSatuan: it.hargaSatuan, total: it.qty * it.hargaSatuan, diskon: 0, tanggal: editTanggal, pelanggan: editPelanggan.trim() || 'Umum' };
    }).filter(Boolean) as TxRow[];
    setRows(updatedRows);
    localStorage.setItem('mma_penjualan_transaksi', JSON.stringify(updatedRows));

    // 2. Kas (keuangan) — update jumlah entry terkait
    if (editCheckoutId) {
      try {
        if (editMetode === 'cash') {
          const kk = JSON.parse(localStorage.getItem('mma_kas_kecil') || '[]');
          localStorage.setItem('mma_kas_kecil', JSON.stringify(kk.map((e: any) => e.checkoutId === editCheckoutId ? { ...e, jumlah: newTotal, tanggal: editTanggal } : e)));
        } else {
          const kb = JSON.parse(localStorage.getItem('mma_kas_besar_masuk') || '[]');
          localStorage.setItem('mma_kas_besar_masuk', JSON.stringify(kb.map((e: any) => e.checkoutId === editCheckoutId ? { ...e, jumlah: newTotal, tanggal: editTanggal } : e)));
        }
      } catch {}
    }

    // 3. DB riwayat — hapus baris lama & insert ulang
    for (const old of editGroup) {
      try {
        await fetch('/api/transaksi', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tanggal: old.tanggal, produk: old.produk, total: old.total }),
        });
      } catch {}
    }
    for (const it of items) {
      try {
        await fetch('/api/transaksi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ produk: it.produk, jumlah: it.qty, hargaSatuan: it.hargaSatuan, pelanggan: editPelanggan.trim() || 'Umum', tanggal: editTanggal, diskon: 0 }),
        });
      } catch {}
    }

    // 4. Refresh semua pemakai data
    window.dispatchEvent(new Event('refresh-laporan'));
    window.dispatchEvent(new Event('kas-kecil-updated'));
    onChanged?.();
    setEditGroup(null);
  };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Daftar Transaksi</h2>
          <p className="mt-1 text-sm text-slate-500">{filtered.length} transaksi • Total: <strong className="text-brand-700">Rp {grandTotal.toLocaleString('id-ID')}</strong></p>
          <p className="text-[11px] text-slate-400">Sumber sama dengan Laporan — hapus/edit di sini otomatis sinkron ke laporan penjualan & keuangan.</p>
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cari produk / pelanggan..." className="w-44 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
      </div>

      <div className="mt-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-100 py-10 text-center text-slate-400">Belum ada transaksi.</div>
        ) : (
          filtered.map(g => (
            <div key={g.key} className="rounded-xl border border-slate-100 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">{g.tanggal} {g.items[0]?.jam ? g.items[0].jam : ''}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${g.metode === 'cash' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                    {g.metode === 'cash' ? '💵 Cash' : '🏦 Transfer'}
                  </span>
                  <span className="text-xs text-slate-500">· {g.pelanggan}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-brand-700">Rp {g.total.toLocaleString('id-ID')}</span>
                  <button onClick={() => openEdit(g)} className="rounded-lg bg-brand-100 px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-200">✏️ Edit</button>
                  <button onClick={() => hapus(g)} className="rounded-lg bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-200">🗑 Hapus</button>
                </div>
              </div>
              <div className="mt-2 divide-y divide-slate-50">
                {g.items.map(i => (
                  <div key={i.id} className="flex items-center justify-between py-1 text-xs">
                    <span className="flex-1 text-slate-700 truncate pr-2">{i.produk} <span className="text-slate-400">x{i.qty} @Rp {i.hargaSatuan.toLocaleString('id-ID')}</span></span>
                    <span className="font-semibold text-slate-800">Rp {i.total.toLocaleString('id-ID')}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Modal Edit ── */}
      {editGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditGroup(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-slate-800">✏️ Edit Transaksi</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1"><span className="text-[10px] font-semibold text-slate-500">Tanggal</span><input type="date" value={editTanggal} onChange={e => setEditTanggal(e.target.value)} className="rounded-lg border px-2 py-1 text-xs" /></label>
              <label className="flex flex-col gap-1"><span className="text-[10px] font-semibold text-slate-500">Pelanggan</span><input value={editPelanggan} onChange={e => setEditPelanggan(e.target.value)} className="rounded-lg border px-2 py-1 text-xs" /></label>
            </div>
            <div className="mt-3 space-y-2">
              {editGroup.map(i => (
                <div key={i.id} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2">
                  <span className="flex-1 truncate text-xs text-slate-700">{i.produk}</span>
                  <input type="number" min={1} value={i.qty} onChange={e => setEditGroup(prev => (prev || []).map(x => x.id === i.id ? { ...x, qty: +e.target.value } : x))} className="w-14 rounded-lg border px-1 py-1 text-center text-xs font-bold" title="Qty" />
                  <input type="number" min={0} value={i.hargaSatuan} onChange={e => setEditGroup(prev => (prev || []).map(x => x.id === i.id ? { ...x, hargaSatuan: +e.target.value } : x))} className="w-24 rounded-lg border px-1 py-1 text-right text-xs font-bold" title="Harga jual" />
                  <span className="w-20 text-right text-xs font-semibold text-brand-700">Rp {((+i.qty || 0) * (+i.hargaSatuan || 0)).toLocaleString('id-ID')}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-400">Item dengan qty 0 akan dihapus. Total otomatis dihitung ulang & disinkronkan ke laporan + kas + DB.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setEditGroup(null)} className="flex-1 rounded-xl bg-slate-100 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200">Batal</button>
              <button onClick={simpanEdit} className="flex-1 rounded-xl bg-brand-500 py-2 text-sm font-bold text-white hover:bg-brand-700">💾 Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════ */
/* PERBAIKAN DATA — SKU tanpa HPP & Produk tanpa SKU                   */
/* ═══════════════════════════════════════════════════════════════════ */
interface ProdukRow { id: string; nama: string; kategoriNama: string; hargaBeli: number; hargaJual: number; stokMin: number; }

function PerbaikanDataTab() {
  const { skus, forceSync } = useSkus();
  const [produkList, setProdukList] = useState<ProdukRow[]>([]);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Edit SKU (tambah HPP / nama) ──
  const [editSku, setEditSku] = useState<SkuItem | null>(null);
  const [fNama, setFNama] = useState('');
  const [fHpp, setFHpp] = useState('');
  const [fJual, setFJual] = useState('');
  const [fSatuan, setFSatuan] = useState('pcs');

  // ── Daftarkan Produk transaksi → Master Data ──
  const [editProduk, setEditProduk] = useState<ProdukRow | null>(null);
  const [pSku, setPSku] = useState('');
  const [pNama, setPNama] = useState('');
  const [pHpp, setPHpp] = useState('');
  const [pJual, setPJual] = useState('');
  const [pSatuan, setPSatuan] = useState('pcs');

  const loadProduk = useCallback(async () => {
    try {
      const res = await fetch('/api/produk');
      if (res.ok) setProdukList(await res.json());
    } catch {}
  }, []);

  useEffect(() => { loadProduk(); }, [loadProduk]);

  /* SKU tanpa HPP (harga modal 0) ATAU tanpa nama */
  const skusBermasalah = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return skus
      .filter(s => {
        const hpp = Number(s.hargaBaru) || Number(s.hargaModalLama) || 0;
        if (hpp > 0 && s.nama.trim()) return false;
        if (!qq) return true;
        return s.nama.toLowerCase().includes(qq) || s.sku.toLowerCase().includes(qq);
      })
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [skus, q]);

  /* Nama-nama yang sudah ada di Master Data (case-insensitive) */
  const masterNama = useMemo(() => {
    const set = new Set<string>();
    for (const s of skus) if (s.nama) set.add(s.nama.trim().toLowerCase());
    return set;
  }, [skus]);

  /* Produk transaksi yang belum terdaftar di Master Data */
  const produkTanpaSku = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return produkList
      .filter(p => {
        if (masterNama.has(p.nama.trim().toLowerCase())) return false;
        if (!qq) return true;
        return p.nama.toLowerCase().includes(qq);
      })
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [produkList, masterNama, q]);

  const fmt = (n: number) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

  const openEditSku = (s: SkuItem) => {
    setEditSku(s);
    setFNama(s.nama || '');
    setFHpp(String(Number(s.hargaBaru) || 0));
    setFJual(String(Number(s.hargaJual) || 0));
    setFSatuan(s.satuan || 'pcs');
    setMsg(''); setErr('');
  };

  const saveSku = async () => {
    if (!editSku) return;
    setSaving(true); setErr(''); setMsg('');
    try {
      const res = await fetch('/api/sku-master', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editSku.id,
          nama: fNama.trim() || editSku.nama,
          hargaBaru: Number(fHpp) || 0,
          hargaJual: Number(fJual) || 0,
          satuan: fSatuan.trim() || 'pcs',
        }),
      });
      if (!res.ok) throw new Error('gagal');
      await forceSync();
      setEditSku(null);
      setMsg(`✅ "${fNama.trim() || editSku.nama}" berhasil diupdate di Master Data.`);
    } catch {
      setErr('Gagal update SKU. Coba lagi.');
    }
    setSaving(false);
  };

  const openEditProduk = (p: ProdukRow) => {
    setEditProduk(p);
    setPSku('');
    setPNama(p.nama);
    setPHpp(String(Number(p.hargaBeli) || 0));
    setPJual(String(Number(p.hargaJual) || 0));
    setPSatuan('pcs');
    setMsg(''); setErr('');
  };

  const saveProduk = async () => {
    if (!editProduk) return;
    if (!pSku.trim()) { setErr('Kode SKU wajib diisi.'); return; }
    if (!pNama.trim()) { setErr('Nama produk wajib diisi.'); return; }
    setSaving(true); setErr(''); setMsg('');
    try {
      const res = await fetch('/api/sku-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: pSku.trim(), nama: pNama.trim(),
          hargaBaru: Number(pHpp) || 0,
          hargaJual: Number(pJual) || 0,
          satuan: pSatuan.trim() || 'pcs',
          aktif: 1,
        }),
      });
      if (!res.ok) throw new Error('gagal');
      await forceSync();
      await loadProduk();
      setEditProduk(null);
      setMsg(`✅ "${pNama.trim()}" otomatis masuk Master Data (SKU: ${pSku.trim()}).`);
    } catch {
      setErr('Gagal simpan ke Master Data. Coba lagi.');
    }
    setSaving(false);
  };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🛠️ Perbaikan Data Produk</h2>
          <p className="mt-1 text-sm text-slate-500">SKU tanpa HPP & produk transaksi tanpa SKU — edit di sini, otomatis tersimpan di Master Data.</p>
        </div>
        <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Cari nama / SKU…"
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none" />
      </div>
      {msg && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
      {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}

      {/* ── 1. SKU tanpa HPP / tanpa Nama ── */}
      <div className="mt-4 rounded-2xl border border-amber-200 bg-white p-4">
        <p className="text-sm font-bold text-amber-700">📦 SKU tanpa HPP / tanpa Nama ({skusBermasalah.length})</p>
        <p className="text-xs text-slate-400">Harga modal 0 → laba di kasir tidak terhitung dengan benar.</p>
        <div className="mt-2 max-h-80 overflow-y-auto divide-y divide-slate-50">
          {skusBermasalah.length === 0 && <p className="py-3 text-center text-sm text-slate-400">🎉 Semua SKU sudah punya HPP & nama.</p>}
          {skusBermasalah.slice(0, 200).map(s => {
            const hpp = Number(s.hargaBaru) || Number(s.hargaModalLama) || 0;
            return (
              <div key={s.id} className="flex items-center gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-700">{s.nama || '— tanpa nama —'}</p>
                  <p className="text-xs text-slate-400">{s.sku || 'tanpa kode'} • HPP: {fmt(hpp)} • Jual: {fmt(s.hargaJual)}</p>
                </div>
                {!s.nama.trim() && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">TANPA NAMA</span>}
                {hpp <= 0 && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600">TANPA HPP</span>}
                <button onClick={() => openEditSku(s)} className="shrink-0 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600">✏️ Edit</button>
              </div>
            );
          })}
          {skusBermasalah.length > 200 && <p className="py-2 text-center text-xs text-slate-400">+{skusBermasalah.length - 200} lainnya — persempit pencarian</p>}
        </div>
      </div>

      {/* ── 2. Produk tanpa SKU ── */}
      <div className="mt-4 rounded-2xl border border-red-200 bg-white p-4">
        <p className="text-sm font-bold text-red-600">🛒 Produk Transaksi Tanpa SKU ({produkTanpaSku.length})</p>
        <p className="text-xs text-slate-400">Produk dari kasir / barang masuk yang belum terdaftar di Master Data.</p>
        <div className="mt-2 max-h-80 overflow-y-auto divide-y divide-slate-50">
          {produkTanpaSku.length === 0 && <p className="py-3 text-center text-sm text-slate-400">🎉 Semua produk transaksi sudah terdaftar di Master Data.</p>}
          {produkTanpaSku.map(p => (
            <div key={p.id} className="flex items-center gap-2 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-700">{p.nama}</p>
                <p className="text-xs text-slate-400">Beli: {fmt(p.hargaBeli)} • Jual: {fmt(p.hargaJual)}</p>
              </div>
              <button onClick={() => openEditProduk(p)} className="shrink-0 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-600">✏️ Daftarkan SKU</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modal: Update SKU ── */}
      {editSku && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-slate-800">✏️ Update SKU di Master Data</h3>
            <p className="mt-1 text-xs text-slate-400">Kode: {editSku.sku || '—'}</p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Produk</label>
                <input type="text" value={fNama} onChange={e => setFNama(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Harga Modal (HPP) *</label>
                  <input type="number" value={fHpp} onChange={e => setFHpp(e.target.value)} placeholder="0" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Harga Jual</label>
                  <input type="number" value={fJual} onChange={e => setFJual(e.target.value)} placeholder="0" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Satuan</label>
                <input type="text" value={fSatuan} onChange={e => setFSatuan(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditSku(null)} disabled={saving} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button>
              <button onClick={saveSku} disabled={saving} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">{saving ? '⏳ Menyimpan…' : '💾 Simpan'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Daftarkan Produk ke Master Data ── */}
      {editProduk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-slate-800">🛒 Daftarkan ke Master Data</h3>
            <p className="mt-1 text-xs text-slate-400">Produk otomatis masuk Master Data setelah disimpan.</p>
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Kode SKU *</label>
                  <input type="text" value={pSku} onChange={e => setPSku(e.target.value)} placeholder="mis. BESI-5MM" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Satuan</label>
                  <input type="text" value={pSatuan} onChange={e => setPSatuan(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Produk *</label>
                <input type="text" value={pNama} onChange={e => setPNama(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Harga Modal (HPP)</label>
                  <input type="number" value={pHpp} onChange={e => setPHpp(e.target.value)} placeholder="0" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Harga Jual</label>
                  <input type="number" value={pJual} onChange={e => setPJual(e.target.value)} placeholder="0" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditProduk(null)} disabled={saving} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button>
              <button onClick={saveProduk} disabled={saving} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">{saving ? '⏳ Menyimpan…' : '💾 Simpan'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* RINGKASAN HARIAN + RIWAYAT BULANAN & TAHUNAN                          */
/* ═══════════════════════════════════════════════════════════════════ */
function RingkasanHarian({ data }: { data: TransaksiEntry[] }) {
  type Periode = 'hari' | 'bulan' | 'tahun';
  const [periode, setPeriode] = useState<Periode>('hari');
  const [bulanStr, setBulanStr] = useState(() => new Date().toISOString().slice(0, 7));
  const tahunSekarang = new Date().getFullYear();
  const [tahunStr, setTahunStr] = useState(String(tahunSekarang));

  const fmtRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  /* ── Hari Ini (flow existing, tidak diubah) ── */
  const hariIni = new Date().toISOString().slice(0, 10);
  const todayTx = data.filter(t => t.tanggal === hariIni);
  const totalPenjualan = todayTx.reduce((s, t) => s + t.total, 0);
  const jumlahTransaksi = todayTx.length;
  const rataRata = jumlahTransaksi > 0 ? Math.round(totalPenjualan / jumlahTransaksi) : 0;

  const produkMap = new Map<string, number>();
  todayTx.forEach(t => produkMap.set(t.produk, (produkMap.get(t.produk) || 0) + t.jumlah));
  const topProduk = Array.from(produkMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  /* ── Bulanan ── */
  const bulanTx = useMemo(() => data.filter(t => (t.tanggal || '').startsWith(bulanStr)), [data, bulanStr]);
  const totalBulan = bulanTx.reduce((s, t) => s + t.total, 0);
  const jmlBulan = bulanTx.length;
  const hariAktif = new Set(bulanTx.map(t => t.tanggal)).size;
  const rataHarian = hariAktif > 0 ? Math.round(totalBulan / hariAktif) : 0;
  const topProdukBulan = useMemo(() => {
    const m = new Map<string, number>();
    bulanTx.forEach(t => m.set(t.produk, (m.get(t.produk) || 0) + t.jumlah));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [bulanTx]);
  const perHari = useMemo(() => {
    const m = new Map<number, { total: number; jml: number }>();
    bulanTx.forEach(t => {
      const d = Number((t.tanggal || '').slice(8, 10));
      if (!d) return;
      const cur = m.get(d) || { total: 0, jml: 0 };
      cur.total += t.total; cur.jml += 1;
      m.set(d, cur);
    });
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
  }, [bulanTx]);
  const maxHarian = Math.max(...perHari.map(([, v]) => v.total), 1);

  /* ── Tahunan ── */
  const tahunTx = useMemo(() => data.filter(t => (t.tanggal || '').startsWith(tahunStr)), [data, tahunStr]);
  const totalTahun = tahunTx.reduce((s, t) => s + t.total, 0);
  const jmlTahun = tahunTx.length;
  const bulanAktif = new Set(tahunTx.map(t => (t.tanggal || '').slice(0, 7))).size;
  const rataBulanan = bulanAktif > 0 ? Math.round(totalTahun / bulanAktif) : 0;
  const topProdukTahun = useMemo(() => {
    const m = new Map<string, number>();
    tahunTx.forEach(t => m.set(t.produk, (m.get(t.produk) || 0) + t.jumlah));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [tahunTx]);
  const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const perBulan = useMemo(() => {
    const m = new Map<number, { total: number; jml: number }>();
    tahunTx.forEach(t => {
      const mo = Number((t.tanggal || '').slice(5, 7));
      if (!mo) return;
      const cur = m.get(mo) || { total: 0, jml: 0 };
      cur.total += t.total; cur.jml += 1;
      m.set(mo, cur);
    });
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
  }, [tahunTx]);
  const maxBulanan = Math.max(...perBulan.map(([, v]) => v.total), 1);

  /* Daftar tahun yang ada di data (untuk pilihan dropdown tahun) */
  const tahunOptions = useMemo(() => {
    const set = new Set<number>([tahunSekarang]);
    data.forEach(t => { const y = Number((t.tanggal || '').slice(0, 4)); if (y) set.add(y); });
    return Array.from(set).sort((a, b) => b - a);
  }, [data, tahunSekarang]);

  const labelTanggal = periode === 'hari'
    ? new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : periode === 'bulan'
      ? `Riwayat ${new Date(bulanStr + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`
      : `Riwayat Tahun ${tahunStr}`;

  const cards = periode === 'hari' ? [
    { icon: '💰', label: 'Total Penjualan', value: fmtRp(totalPenjualan), grad: 'from-brand-50 to-brand-100', lbl: 'text-brand-500', val: 'text-brand-700' },
    { icon: '📃', label: 'Jml Transaksi', value: String(jumlahTransaksi), grad: 'from-emerald-50 to-emerald-100', lbl: 'text-emerald-600', val: 'text-emerald-700' },
    { icon: '📊', label: 'Rata-Rata', value: fmtRp(rataRata), grad: 'from-amber-50 to-amber-100', lbl: 'text-amber-600', val: 'text-amber-700' },
  ] : periode === 'bulan' ? [
    { icon: '💰', label: 'Total Bulan Ini', value: fmtRp(totalBulan), grad: 'from-brand-50 to-brand-100', lbl: 'text-brand-500', val: 'text-brand-700' },
    { icon: '📃', label: 'Jml Transaksi', value: String(jmlBulan), grad: 'from-emerald-50 to-emerald-100', lbl: 'text-emerald-600', val: 'text-emerald-700' },
    { icon: '📅', label: 'Rata-Rata / Hari Aktif', value: fmtRp(rataHarian), grad: 'from-amber-50 to-amber-100', lbl: 'text-amber-600', val: 'text-amber-700' },
  ] : [
    { icon: '💰', label: 'Total Tahun Ini', value: fmtRp(totalTahun), grad: 'from-brand-50 to-brand-100', lbl: 'text-brand-500', val: 'text-brand-700' },
    { icon: '📃', label: 'Jml Transaksi', value: String(jmlTahun), grad: 'from-emerald-50 to-emerald-100', lbl: 'text-emerald-600', val: 'text-emerald-700' },
    { icon: '📅', label: 'Rata-Rata / Bulan Aktif', value: fmtRp(rataBulanan), grad: 'from-amber-50 to-amber-100', lbl: 'text-amber-600', val: 'text-amber-700' },
  ];

  const topList = periode === 'hari' ? topProduk : periode === 'bulan' ? topProdukBulan : topProdukTahun;
  const topTitle = periode === 'hari' ? '🏆 Produk Terlaris Hari Ini' : periode === 'bulan' ? '🏆 Produk Terlaris Bulan Ini' : '🏆 Produk Terlaris Tahun Ini';

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Ringkasan Penjualan</h2>
          <p className="mt-1 text-sm text-slate-500">{labelTanggal}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {(['hari', 'bulan', 'tahun'] as Periode[]).map(p => (
              <button key={p} onClick={() => setPeriode(p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${periode === p ? 'bg-brand-500 text-white shadow' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'}`}>
                {p === 'hari' ? 'Hari Ini' : p === 'bulan' ? 'Bulanan' : 'Tahunan'}
              </button>
            ))}
          </div>
          {periode === 'bulan' && (
            <input type="month" value={bulanStr} onChange={e => setBulanStr(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none" />
          )}
          {periode === 'tahun' && (
            <select value={tahunStr} onChange={e => setTahunStr(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none">
              {tahunOptions.map(y => <option key={y} value={String(y)}>{y}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {cards.map(c => (
          <div key={c.label} className={`rounded-2xl bg-gradient-to-br ${c.grad} p-5 text-center shadow-sm`}>
            <p className="text-3xl">{c.icon}</p>
            <p className={`mt-1 text-xs font-semibold uppercase ${c.lbl}`}>{c.label}</p>
            <p className={`mt-1 text-xl font-bold ${c.val}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* ── Riwayat per hari (mode bulanan) ── */}
      {periode === 'bulan' && (
        <div className="mt-4 rounded-2xl border border-brand-100 bg-white p-4">
          <p className="text-sm font-bold text-slate-700">📅 Riwayat per Hari</p>
          {perHari.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              {perHari.map(([d, v]) => (
                <div key={d} className="flex items-center gap-2 text-xs">
                  <span className="w-6 shrink-0 text-right font-semibold text-slate-500">{d}</span>
                  <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300" style={{ width: `${Math.max((v.total / maxHarian) * 100, 3)}%` }} />
                  </div>
                  <span className="w-28 shrink-0 text-right font-semibold text-brand-700">{fmtRp(v.total)}</span>
                  <span className="w-14 shrink-0 text-slate-400">{v.jml} trx</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-center text-sm text-slate-400">Belum ada transaksi di bulan ini.</p>
          )}
        </div>
      )}

      {/* ── Riwayat per bulan (mode tahunan) ── */}
      {periode === 'tahun' && (
        <div className="mt-4 rounded-2xl border border-brand-100 bg-white p-4">
          <p className="text-sm font-bold text-slate-700">🗓️ Riwayat per Bulan</p>
          {perBulan.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              {perBulan.map(([mo, v]) => (
                <div key={mo} className="flex items-center gap-2 text-xs">
                  <span className="w-9 shrink-0 font-semibold text-slate-500">{NAMA_BULAN[mo - 1]}</span>
                  <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300" style={{ width: `${Math.max((v.total / maxBulanan) * 100, 3)}%` }} />
                  </div>
                  <span className="w-28 shrink-0 text-right font-semibold text-brand-700">{fmtRp(v.total)}</span>
                  <span className="w-14 shrink-0 text-slate-400">{v.jml} trx</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-center text-sm text-slate-400">Belum ada transaksi di tahun ini.</p>
          )}
        </div>
      )}

      {topList.length > 0 && (
        <div className="mt-4 rounded-2xl border border-brand-100 bg-white p-4">
          <p className="text-sm font-bold text-slate-700">{topTitle}</p>
          <div className="mt-2 space-y-1">
            {topList.map(([nama, qty], i) => (
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
