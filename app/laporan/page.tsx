'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ArusKasReport } from '@/app/laporan/components/ArusKasReport';
import { LabaRugiReport } from '@/app/laporan/components/LabaRugiReport';
import { LaporanStokReport } from '@/app/laporan/components/LaporanStokReport';
import { useAgregasi } from '@/app/context/AgregasiContext';
import { ExportButton } from '@/app/components/ExportButton';
import { fetchMpSummary } from '@/app/lib/marketplaceOrdersClient';
import { readTombstones, applyTombstones } from '@/app/lib/tombstones';

type JenisLaporan = 'laba-rugi' | 'arus-kas' | 'stok' | 'omset';
type Periode = 'minggu' | 'bulan' | 'tahun' | 'custom';

// Helper: baca data real dari localStorage
function getRealData() {
  if (typeof window === 'undefined') return { penjualan: [], payments: [], biaya: [], opex: [], modal: [], keuanganManual: [], mpIncome: [] };
  try {
    return {
      penjualan: JSON.parse(localStorage.getItem('mma_penjualan_transaksi') || '[]'),
      payments: applyTombstones('mma_payment_history', JSON.parse(localStorage.getItem('mma_payment_history') || '[]'), readTombstones()),
      biaya: JSON.parse(localStorage.getItem('mma_biaya_operasional') || '[]'),
      opex: JSON.parse(localStorage.getItem('mma_opex_purchases') || '[]'),
      modal: JSON.parse(localStorage.getItem('mma_modal') || '[]'),
      keuanganManual: JSON.parse(localStorage.getItem('mma_keuangan_manual') || '[]'),
      mpIncome: JSON.parse(localStorage.getItem('mma_marketplace_income') || '[]'),
    };
  } catch { return { penjualan: [], payments: [], biaya: [], opex: [], modal: [], keuanganManual: [], mpIncome: [] }; }
}

function filterByPeriode(list: any[], dateField: string, periode: Periode, customStart?: string, customEnd?: string): any[] {
  if (periode === 'custom' && customStart && customEnd) {
    return list.filter((item: any) => {
      const d = item[dateField] || item.tanggal || '';
      return d >= customStart && d <= customEnd;
    });
  }
  const now = new Date();
  let start: Date;
  if (periode === 'minggu') {
    // Minggu Ini: 7 hari terakhir
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  } else if (periode === 'bulan') {
    // Bulan Ini: dari tanggal 1 bulan berjalan (JULI TIDAK ikut)
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    // Tahun Ini: dari 1 Januari tahun berjalan
    start = new Date(now.getFullYear(), 0, 1);
  }
  // Format tanggal lokal (hindari selisih UTC yang bisa menggeser 1 hari)
  const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  return list.filter((item: any) => (item[dateField] || item.tanggal || '') >= startStr);
}

const PERIODE_LABELS: Record<Periode, string> = {
  minggu: 'Minggu Ini',
  bulan: 'Bulan Ini',
  tahun: 'Tahun Ini',
  custom: '📅 Custom',
};

export default function LaporanPage() {
  const [jenis, setJenis] = useState<JenisLaporan>('laba-rugi');
  const [periode, setPeriode] = useState<Periode>('bulan');
  const [mounted, setMounted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [customStart, setCustomStart] = useState(new Date().toISOString().slice(0, 10));
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => { setMounted(true); }, []);

  // ── Auto-refresh saat ada perubahan localStorage ──
  useEffect(() => {
    const onStorage = () => setRefreshKey(k => k + 1);
    window.addEventListener('storage', onStorage);
    // Juga listen custom refresh event
    window.addEventListener('refresh-laporan', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('refresh-laporan', onStorage);
    };
  }, []);

  const realData = useMemo(() => (mounted ? getRealData() : { penjualan: [], payments: [], biaya: [], opex: [], modal: [], keuanganManual: [], mpIncome: [] }), [mounted, refreshKey]);

  // ── Order marketplace dari PostgreSQL (API ringkasan) — fallback ke localStorage ──
  const [mpOrdersApi, setMpOrdersApi] = useState<any[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const list = await fetchMpSummary();
      if (active) setMpOrdersApi(list);
    };
    load();
    window.addEventListener('refresh-laporan', load);
    window.addEventListener('storage', load);
    return () => {
      active = false;
      window.removeEventListener('refresh-laporan', load);
      window.removeEventListener('storage', load);
    };
  }, []);

  const penjualanFiltered = useMemo(() => filterByPeriode(realData.penjualan, 'tanggal', periode, customStart, customEnd), [realData, periode, customStart, customEnd]);
  const paymentsFiltered = useMemo(() => filterByPeriode(realData.payments, 'tanggalBayar', periode, customStart, customEnd), [realData, periode, customStart, customEnd]);
  const biayaFiltered = useMemo(() => filterByPeriode(realData.biaya, 'tanggal', periode, customStart, customEnd), [realData, periode, customStart, customEnd]);
  const opexFiltered = useMemo(() => filterByPeriode(realData.opex, 'tanggal', periode, customStart, customEnd), [realData, periode, customStart, customEnd]);

  // ── Data Omset Marketplace dari Agregasi (Operasional Gudang) ──
  const { allRows } = useAgregasi();
  const omsetData = useMemo(() => {
    // Hanya order yang sudah selesai (Dikirim / Selesai / delivered)
    const selesai = allRows.filter(r =>
      r.statusPesanan === 'Selesai' || r.statusPesanan === 'delivered' ||
      r.statusProses === 'Dikirim'
    );
    // Group by marketplace
    const byMp = new Map<string, { total: number; count: number }>();
    for (const r of selesai) {
      const mp = r.marketplace || 'Lainnya';
      const exist = byMp.get(mp) || { total: 0, count: 0 };
      exist.total += (r.hargaJual * r.kuantity) || r.hargaJual || 0;
      exist.count += r.kuantity || 1;
      byMp.set(mp, exist);
    }
    const list = Array.from(byMp.entries()).map(([mp, d]) => ({ marketplace: mp, total: d.total, items: d.count }));
    const grandTotal = list.reduce((s, l) => s + l.total, 0);
    const masukSaldo = selesai.filter(r => r.statusKeuangan === 'Masuk Saldo').length;
    return { list, grandTotal, orderCount: selesai.length, masukSaldo };
  }, [allRows]);

  // Laba Rugi (untuk ekspor) — SAMA rumus dengan tampilan: Kasir + MP Kotor − HPP − Fee − Biaya − OPEX
  const labaRugiData = useMemo(() => {
    const kasirTotal = penjualanFiltered.reduce((s: number, t: any) => s + (t.total || 0), 0);
    let mpKotor = 0, mpHpp = 0, mpFee = 0;
    try {
      const mpFiltered = filterByPeriode(mpOrdersApi, 'tanggal', periode, customStart, customEnd);
      mpKotor = mpFiltered.reduce((s: number, o: any) => s + (o.pendapatanKotor || 0), 0);
      mpHpp = mpFiltered.reduce((s: number, o: any) => s + (o.totalHPP || 0), 0);
      mpFee = mpFiltered.reduce((s: number, o: any) => s + (o.totalBiaya || 0), 0);
      // Manual + ringkasan income ikut dihitung (sama seperti tampilan)
      const manual = filterByPeriode(realData.keuanganManual, 'tanggal', periode, customStart, customEnd);
      mpKotor += manual.reduce((s: number, e: any) => s + (e.pendapatanKotor || 0), 0);
      mpFee += manual.reduce((s: number, e: any) => s + (e.feeMarketplace || 0), 0);
      const inc = filterByPeriode(realData.mpIncome, 'tanggal', periode, customStart, customEnd);
      mpKotor += inc.reduce((s: number, e: any) => s + (e.pendapatanKotor || 0), 0);
      mpFee += inc.reduce((s: number, e: any) => s + (e.feeMarketplace || 0), 0);
    } catch { }
    // HPP Kasir dari Master SKU (harga modal × qty) — sama dengan tampilan
    let hppKasir = 0;
    try {
      const skuData = JSON.parse(localStorage.getItem('mma_sku_data') || '[]');
      const hargaMap = new Map<string, number>();
      for (const s of skuData) { if (s.sku && s.hargaBaru > 0) hargaMap.set(s.sku, s.hargaBaru); }
      for (const t of penjualanFiltered) { hppKasir += (hargaMap.get(t.sku) || 0) * (t.qty || 1); }
    } catch { }
    const biayaOps = biayaFiltered.reduce((s: number, b: any) => s + (b.jumlah || 0), 0);
    const opexTotal = opexFiltered.reduce((s: number, o: any) => s + (o.total || 0), 0);
    const totalPendapatan = kasirTotal + mpKotor;
    const totalHPP = hppKasir + mpHpp;
    const labaKotor = totalPendapatan - totalHPP - mpFee;
    const labaBersih = labaKotor - biayaOps - opexTotal;
    return { pendapatan: totalPendapatan, hargaPokok: totalHPP, biayaOperasional: biayaOps, biayaLain: opexTotal + mpFee, labaKotor, labaBersih };
  }, [penjualanFiltered, biayaFiltered, opexFiltered, periode, realData, mpOrdersApi, customStart, customEnd]);

  // Arus Kas real
  const arusKasData = useMemo(() => {
    const saldoAwal = realData.modal.reduce((s: number, m: any) => s + (m.jumlah || 0), 0);
    const pendapatan = penjualanFiltered.reduce((s: number, t: any) => s + (t.total || 0), 0);
    const kasKecil = (() => {
      try { const kk = JSON.parse(localStorage.getItem('mma_kas_kecil') || '[]'); return kk.reduce((s: number, e: any) => s + (e.jenis === 'masuk' ? e.jumlah : -e.jumlah), 0); } catch { return 0; }
    })();
    return {
      saldoAwal: saldoAwal + kasKecil,
      pemasukan: [{ sumber: 'Penjualan', jumlah: pendapatan }],
      pengeluaran: [
        { sumber: 'Pembayaran PO', jumlah: paymentsFiltered.reduce((s: number, p: any) => s + p.jumlahDibayar, 0) },
        { sumber: 'Biaya Operasional', jumlah: biayaFiltered.reduce((s: number, b: any) => s + b.jumlah, 0) },
        { sumber: 'OPEX', jumlah: opexFiltered.reduce((s: number, o: any) => s + o.total, 0) },
      ],
    };
  }, [realData, penjualanFiltered, paymentsFiltered, biayaFiltered, opexFiltered]);

  const exportRows = useMemo(() => {
    if (jenis === 'laba-rugi') {
      return [
        ['Pendapatan', String(labaRugiData.pendapatan)],
        ['HPP (Pembayaran PO)', String(labaRugiData.hargaPokok)],
        ['Biaya Operasional', String(labaRugiData.biayaOperasional)],
        ['Biaya Lain (OPEX)', String(labaRugiData.biayaLain)],
        ['Laba Kotor', String(labaRugiData.labaKotor)],
        ['Laba Bersih', String(labaRugiData.labaBersih)],
      ];
    }
    if (jenis === 'arus-kas') {
      return [
        ['Saldo Awal', String(arusKasData.saldoAwal)],
        ...arusKasData.pemasukan.map((p) => [p.sumber, String(p.jumlah)]),
        ...arusKasData.pengeluaran.map((p) => [p.sumber, String(p.jumlah)]),
      ];
    }
    return [];
  }, [jenis, labaRugiData, arusKasData]);

  const exportHeaders =
    jenis === 'stok' ? ['Produk', 'Kategori', 'Stok', 'Nilai'] : ['Komponen', 'Jumlah (Rp)'];

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="rounded-3xl bg-gradient-to-br from-brand-700 via-brand-500 to-brand-300 p-5 text-white shadow-lg sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-100 sm:text-sm">Finance</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Laporan</h1>
        <p className="mt-1 text-sm text-brand-100 sm:text-base">
          Lihat laporan laba rugi, arus kas, dan stok dalam periode pilihan.
        </p>
      </header>

      {/* Pemilih Jenis + Periode */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
        <span className="text-xs font-semibold text-slate-500">Jenis:</span>
        {([
          { key: 'laba-rugi' as const, label: '📈 Laba Rugi' },
          { key: 'omset' as const, label: '💰 Omset' },
          { key: 'arus-kas' as const, label: '💵 Arus Kas' },
          { key: 'stok' as const, label: '📦 Stok' },
        ]).map((j) => (
          <button
            key={j.key}
            onClick={() => setJenis(j.key)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
              jenis === j.key ? 'bg-brand-500 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-brand-50'
            }`}
          >
            {j.label}
          </button>
        ))}

        <span className="ml-4 text-xs font-semibold text-slate-500">Periode:</span>
        {(Object.entries(PERIODE_LABELS) as [Periode, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPeriode(key)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
              periode === key ? 'bg-brand-500 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-brand-50'
            }`}
          >
            {label}
          </button>
        ))}
        {periode === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="rounded-xl border px-2 py-1 text-xs text-slate-600" />
            <span className="text-xs text-slate-400">s/d</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="rounded-xl border px-2 py-1 text-xs text-slate-600" />
          </div>
        )}
        <ExportButton
          filename={`laporan-${jenis}-${periode}`}
          headers={exportHeaders}
          rows={exportRows}
        />
      </div>

      {/* Konten Laporan */}
      <section className="card-blue">
        {jenis === 'laba-rugi' && <LabaRugi periode={periode} customStart={customStart} customEnd={customEnd} orders={mpOrdersApi} />}
        {jenis === 'omset' && <OmsetTab data={omsetData} />}
        {jenis === 'arus-kas' && <ArusKas periode={periode} customStart={customStart} customEnd={customEnd} mpOrders={mpOrdersApi} />}
        {jenis === 'stok' && <LaporanStok periode={periode} />}
      </section>
    </main>
  );
}

/* ================================================================== */
/* Sub-komponen per jenis laporan                                     */
/* ================================================================== */

function LabaRugi({ periode, customStart, customEnd, orders }: { periode: Periode; customStart?: string; customEnd?: string; orders: any[] }) {
  const [mounted, setMounted] = useState(false);
  const [filterToko, setFilterToko] = useState<string>('semua');
  const [localRefresh, setLocalRefresh] = useState(0);
  useEffect(() => { setMounted(true); }, []);

  // ── Auto-refresh saat ada perubahan data ──
  useEffect(() => {
    const onRefresh = () => setLocalRefresh(k => k + 1);
    window.addEventListener('storage', onRefresh);
    window.addEventListener('refresh-laporan', onRefresh);
    return () => {
      window.removeEventListener('storage', onRefresh);
      window.removeEventListener('refresh-laporan', onRefresh);
    };
  }, []);

  const data = useMemo(() => {
    if (!mounted) return { pendapatan: 0, hargaPokok: 0, biayaOperasional: 0, biayaLain: 0, labaKotor: 0, labaBersih: 0, feeMarketplace: 0, hppMarketplace: 0, breakdownPerToko: [] as any[], tokoList: [] as string[] };
    const { penjualan, biaya, opex } = getRealData();
    const f = (list: any[], field: string) => filterByPeriode(list, field, periode, customStart, customEnd);

    // Pendapatan Kasir
    const filteredPenjualan = f(penjualan, 'tanggal');
    const kasirTotal = filteredPenjualan.reduce((s: number, t: any) => s + (t.total || 0), 0);

    // Marketplace: detail per order — pendapatanBersih sekarang = LABA/RUGI final
    let marketplaceLaba = 0;       // sudah = Kotor - Fee - BiayaProses - HPP
    let marketplaceHpp = 0;
    let marketplaceFee = 0;
    let marketplaceKotor = 0;
    let marketplaceBiayaProses = 0;
    const breakdownPerToko: any[] = [];
    const tokoSet = new Set<string>();

    try {
      const mpOrders = orders;
      const mpFiltered = f(mpOrders, 'tanggal');

      // ── Juga baca input keuangan MANUAL ──
      const manualEntries: any[] = JSON.parse(localStorage.getItem('mma_keuangan_manual') || '[]');
      const manualFiltered = f(manualEntries, 'tanggal');

      // ── Juga baca marketplace_income (ringkasan kompatibilitas) ──
      const mpIncome: any[] = JSON.parse(localStorage.getItem('mma_marketplace_income') || '[]');
      const mpIncomeFiltered = f(mpIncome, 'tanggal');

      // Group per marketplace + toko (Shopee-TokoA ≠ Lazada-TokoA)
      interface TokoAgg { label: string; marketplace: string; tokoNama: string; laba: number; hpp: number; fee: number; kotor: number; biayaProses: number; count: number; }
      const byToko = new Map<string, TokoAgg>();
      const upsert = (mp: string, toko: string, delta: { laba?: number; hpp?: number; fee?: number; kotor?: number; biayaProses?: number }) => {
        const key = `${mp}||${toko}`;
        const label = `${mp} — ${toko}`;
        const exist = byToko.get(key) || { label, marketplace: mp, tokoNama: toko, laba: 0, hpp: 0, fee: 0, kotor: 0, biayaProses: 0, count: 0 };
        exist.kotor += delta.kotor || 0;
        exist.fee += delta.fee || 0;
        exist.biayaProses += delta.biayaProses || 0;
        exist.hpp += delta.hpp || 0;
        exist.laba += delta.laba || 0;
        exist.count++;
        byToko.set(key, exist);
        tokoSet.add(label);
      };
      for (const o of mpFiltered) {
        upsert(o.marketplace || 'Marketplace', o.tokoNama || 'Unknown', { kotor: o.pendapatanKotor || 0, fee: o.totalBiaya || 0, biayaProses: o.biayaPemrosesan || 0, hpp: o.totalHPP || 0, laba: o.pendapatanBersih || 0 });
      }

      // ── Tambahin input keuangan MANUAL ke byToko ──
      for (const e of manualFiltered) {
        const mp = e.marketplaceNama?.split('—')[0]?.trim() || 'Lainnya';
        const namaToko = e.marketplaceNama?.split('—')[1]?.trim() || e.marketplaceNama || 'Manual';
        upsert(mp, namaToko, { kotor: e.pendapatanKotor || 0, fee: e.feeMarketplace || 0, laba: e.pendapatanBersih || 0 });
      }

      // ── Tambahin marketplace_income (ringkasan) ke byToko ──
      for (const inc of mpIncomeFiltered) {
        const mp = inc.marketplaceNama?.split('—')[0]?.trim() || 'Lainnya';
        const namaToko = inc.marketplaceNama?.split('—')[1]?.trim() || inc.marketplaceNama || 'Ringkasan';
        const key = `${mp}||${namaToko}`;
        // Skip kalau duplikat dengan data detail
        if (!byToko.has(key)) {
          upsert(mp, namaToko, { kotor: inc.pendapatanKotor || 0, fee: inc.feeMarketplace || 0, laba: inc.pendapatanBersih || 0, hpp: inc.totalHPP || 0, biayaProses: inc.biayaProses || 0 });
        }
      }

      // Filter by toko (label "Marketplace — Toko")
      const allToko = Array.from(byToko.values());
      const filteredByToko = filterToko === 'semua'
        ? allToko
        : allToko.filter(t => t.label === filterToko);

      marketplaceKotor = filteredByToko.reduce((s, t) => s + t.kotor, 0);
      marketplaceFee = filteredByToko.reduce((s, t) => s + t.fee, 0);
      marketplaceBiayaProses = filteredByToko.reduce((s, t) => s + t.biayaProses, 0);
      marketplaceHpp = filteredByToko.reduce((s, t) => s + t.hpp, 0);
      marketplaceLaba = filteredByToko.reduce((s, t) => s + t.laba, 0);

      for (const t of allToko) {
        breakdownPerToko.push({
          tokoNama: t.tokoNama,
          marketplace: t.marketplace,
          pendapatanKotor: t.kotor,
          fee: t.fee,
          pendapatanBersih: t.laba,          // ← laba/rugi final
          hpp: t.hpp,
          labaKotor: t.laba,                 // ← sama, udah net
          orderCount: t.count,
        });
      }
    } catch { }

    // ── Final Laba Rugi ──
    // Pendapatan = Kasir + Marketplace GROSS
    const totalPendapatan = kasirTotal + marketplaceKotor;
    // HPP: dari Master SKU untuk Kasir + HPP Marketplace
    let hppKasir = 0;
    try {
      const skuData = JSON.parse(localStorage.getItem('mma_sku_data') || '[]');
      const hargaMap = new Map<string, number>();
      for (const s of skuData) { if (s.sku && s.hargaBaru > 0) hargaMap.set(s.sku, s.hargaBaru); }
      for (const t of filteredPenjualan) { hppKasir += (hargaMap.get(t.sku) || 0) * (t.qty || 1); }
    } catch {}
    const totalHppAll = hppKasir + marketplaceHpp;
    // Biaya = operasional + opex + fee marketplace (fee + biaya proses)
    const b = f(biaya, 'tanggal').reduce((s: number, b2: any) => s + (b2.jumlah || 0), 0);
    const o = f(opex, 'tanggal').reduce((s: number, o2: any) => s + (o2.total || 0), 0);
    const totalBiaya = b + o + marketplaceFee;
    // Laba/Rugi = Pendapatan Gross - HPP - Biaya
    const labaKotor = totalPendapatan - totalHppAll - marketplaceFee;
    const labaBersih = labaKotor - b - o;
    return {
      pendapatan: totalPendapatan, hargaPokok: totalHppAll, biayaOperasional: b, biayaLain: o + marketplaceFee,
      labaKotor, labaBersih,
      feeMarketplace: marketplaceFee, hppMarketplace: marketplaceHpp,
      breakdownPerToko, tokoList: Array.from(tokoSet).sort(),
    };
  }, [mounted, periode, filterToko, localRefresh, customStart, customEnd, orders]);

  return (
    <div>
      {/* Filter Toko */}
      {data.tokoList.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">🏪 Toko:</span>
          <button
            onClick={() => setFilterToko('semua')}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${filterToko === 'semua' ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-brand-50'}`}
          >
            Semua Toko
          </button>
          {data.tokoList.map(toko => (
            <button
              key={toko}
              onClick={() => setFilterToko(toko)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${filterToko === toko ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-brand-50'}`}
            >
              {toko}
            </button>
          ))}
        </div>
      )}
      <LabaRugiReport
        data={{
          pendapatan: data.pendapatan,
          hargaPokok: data.hargaPokok,
          biayaOperasional: data.biayaOperasional,
          biayaLain: data.biayaLain,
          labaKotor: data.labaKotor,
          labaBersih: data.labaBersih,
        }}
        periode={PERIODE_LABELS[periode]}
        extra={{
          feeMarketplace: data.feeMarketplace,
          hppMarketplace: data.hppMarketplace,
          breakdownPerToko: data.breakdownPerToko,
          filterToko: filterToko,
        }}
      />
    </div>
  );
}

function ArusKas({ periode, customStart, customEnd, mpOrders }: { periode: Periode; customStart?: string; customEnd?: string; mpOrders: any[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const data = useMemo(() => {
    if (!mounted) return { saldoAwal: 0, pemasukan: [], pengeluaran: [], info: [] };
    const { penjualan, payments, biaya, opex, modal } = getRealData();
    const f = (list: any[], field: string) => filterByPeriode(list, field, periode, customStart, customEnd);
    const saldoAwal = modal.reduce((s: number, m: any) => s + (m.jumlah || 0), 0);
    const kasKecil = (() => { try { const kk = JSON.parse(localStorage.getItem('mma_kas_kecil') || '[]'); return kk.reduce((s: number, e: any) => s + (e.jenis === 'masuk' ? e.jumlah : -e.jumlah), 0); } catch { return 0; } })();
    // Pencairan saldo marketplace → uang masuk kas besar (per periode)
    let pencairanPeriode = 0;
    let totalPencairanAll = 0;
    try {
      const pencairan = JSON.parse(localStorage.getItem('mma_pencairan') || '[]');
      pencairanPeriode = f(pencairan, 'tanggal').reduce((s: number, p: any) => s + (p.jumlah || 0), 0);
      totalPencairanAll = pencairan.reduce((s: number, p: any) => s + (p.jumlah || 0), 0);
    } catch { }
    // Saldo MP belum dicairkan = Σ (Pendapatan Kotor − Fee) semua order − Σ pencairan (semua)
    const saldoMP = mpOrders.reduce((s: number, o: any) => s + ((o.pendapatanKotor || 0) - (o.totalBiaya || 0)), 0) - totalPencairanAll;
    return {
      saldoAwal: saldoAwal + kasKecil,
      pemasukan: [
        { sumber: 'Penjualan Kasir', jumlah: f(penjualan, 'tanggal').reduce((s: number, t: any) => s + (t.total || 0), 0) },
        { sumber: 'Pencairan Marketplace', jumlah: pencairanPeriode },
      ],
      pengeluaran: [
        { sumber: 'Pembayaran PO', jumlah: f(payments, 'tanggalBayar').reduce((s: number, p2: any) => s + p2.jumlahDibayar, 0) },
        { sumber: 'Biaya Operasional', jumlah: f(biaya, 'tanggal').reduce((s: number, b2: any) => s + b2.jumlah, 0) },
        { sumber: 'OPEX', jumlah: f(opex, 'tanggal').reduce((s: number, o2: any) => s + o2.total, 0) },
      ],
      info: [
        { sumber: 'Saldo Marketplace (Belum Dicairkan)', jumlah: saldoMP },
      ],
    };
  }, [mounted, periode, customStart, customEnd, mpOrders]);
  return <ArusKasReport data={data} periode={PERIODE_LABELS[periode]} />;
}

function LaporanStok({ periode }: { periode: Periode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const data = useMemo(() => {
    if (!mounted) return { totalItem: 0, totalNilai: 0, items: [] };
    try {
      const skus = JSON.parse(localStorage.getItem('mma_sku_data') || '[]');
      const items = skus
        .filter((s: any) => s.aktif === 1)
        .map((s: any) => ({
          nama: s.nama || '',
          stok: s.stok || 0,
          nilai: (s.stok || 0) * (s.hargaBaru || 0),
          kategori: s.kategori || '',
        }));
      return {
        totalItem: items.length,
        totalNilai: items.reduce((s: number, i: any) => s + i.nilai, 0),
        items,
      };
    } catch { return { totalItem: 0, totalNilai: 0, items: [] }; }
  }, [mounted]);
  return <LaporanStokReport data={data} periode={PERIODE_LABELS[periode]} />;
}

/* ── Omset Tab: Gross Revenue dari Marketplace (Operasional Gudang) ── */
function OmsetTab({ data }: { data: { list: { marketplace: string; total: number; items: number }[]; grandTotal: number; orderCount: number; masukSaldo: number } }) {
  // Warna per marketplace
  const mpColors: Record<string, string> = {
    Shopee: 'border-l-orange-500 bg-orange-50',
    'TikTok Shop': 'border-l-slate-500 bg-slate-50',
    Lazada: 'border-l-blue-500 bg-blue-50',
    Tokopedia: 'border-l-emerald-500 bg-emerald-50',
  };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">💰 Gross Omset Marketplace</h2>
      <p className="mt-1 text-sm text-slate-500">Pendapatan kotor dari pesanan marketplace yang sudah selesai / terkirim (belum dikurangi fee, HPP, dll)</p>

      {/* Grand Total */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <CardReport label="Total Omset Kotor" value={data.grandTotal} color="brand" highlight />
        <CardReport label="Total Order Selesai" value={data.orderCount} color="slate" isCurrency={false} />
        <CardReport label="Sudah Masuk Saldo" value={data.masukSaldo} color="emerald" isCurrency={false} />
      </div>

      {/* Per Marketplace */}
      {data.list.length > 0 ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {data.list.map(mp => (
            <div key={mp.marketplace} className={`rounded-xl border-l-4 p-4 ${mpColors[mp.marketplace] || 'border-l-slate-300 bg-slate-50'}`}>
              <p className="text-xs font-semibold text-slate-500">{mp.marketplace}</p>
              <p className="mt-1 text-lg font-bold text-slate-800">Rp {mp.total.toLocaleString('id-ID')}</p>
              <p className="text-xs text-slate-400">{mp.items} item terjual</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 text-center py-12 text-slate-400">
          <p className="text-4xl mb-2">💰</p>
          <p className="font-semibold">Belum ada data omset marketplace.</p>
          <p className="text-sm mt-1">Order yang sudah Dikirim/Selesai dari Operasional Gudang akan muncul di sini.</p>
        </div>
      )}

      {/* Note */}
      <div className="mt-5 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
        ⚠️ <strong>Catatan:</strong> Ini adalah <strong>Gross Omset</strong> (pendapatan kotor marketplace) — <strong>tidak dihitung ke Laba Rugi</strong> (keuangan & operasional sengaja dipisah biar tidak dobel hitung). Kartu <strong>💰 Sudah Masuk Saldo</strong> hanya penanda: resi pesanan ini sudah muncul di laporan Input Keuangan (uang masuk saldo marketplace) — statusnya diupdate otomatis, angkanya tetap dari keuangan.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Kartu laporan reusable                                            */
/* ------------------------------------------------------------------ */

function CardReport({
  label,
  value,
  color,
  highlight,
  isCurrency = true,
}: {
  label: string;
  value: number;
  color: 'brand' | 'emerald' | 'red' | 'slate';
  highlight?: boolean;
  isCurrency?: boolean;
}) {
  const palettes = {
    brand: { bg: 'from-brand-50 to-brand-100', text: 'text-brand-700', sub: 'text-brand-500' },
    emerald: { bg: 'from-emerald-50 to-emerald-100', text: 'text-emerald-700', sub: 'text-emerald-500' },
    red: { bg: 'from-red-50 to-red-100', text: 'text-red-600', sub: 'text-red-400' },
    slate: { bg: 'from-slate-50 to-slate-100', text: 'text-slate-700', sub: 'text-slate-500' },
  };
  const p = palettes[color];

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${p.bg} p-4 text-center shadow-sm transition hover:shadow-md ${highlight ? 'ring-2 ring-brand-300' : ''}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${p.sub}`}>{label}</p>
      <p className={`mt-1 text-xl font-bold sm:text-2xl ${p.text}`}>
        {isCurrency ? `Rp ${value.toLocaleString('id-ID')}` : value.toLocaleString('id-ID')}
      </p>
    </div>
  );
}
