'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ArusKasReport } from '@/app/laporan/components/ArusKasReport';
import { LabaRugiReport } from '@/app/laporan/components/LabaRugiReport';
import { LaporanStokReport } from '@/app/laporan/components/LaporanStokReport';
import { ExportButton } from '@/app/components/ExportButton';

type JenisLaporan = 'laba-rugi' | 'arus-kas' | 'stok';
type Periode = 'minggu' | 'bulan' | 'tahun';

// Helper: baca data real dari localStorage
function getRealData() {
  if (typeof window === 'undefined') return { penjualan: [], payments: [], biaya: [], opex: [], modal: [] };
  try {
    return {
      penjualan: JSON.parse(localStorage.getItem('mma_penjualan_transaksi') || '[]'),
      payments: JSON.parse(localStorage.getItem('mma_payment_history') || '[]'),
      biaya: JSON.parse(localStorage.getItem('mma_biaya_operasional') || '[]'),
      opex: JSON.parse(localStorage.getItem('mma_opex_purchases') || '[]'),
      modal: JSON.parse(localStorage.getItem('mma_modal') || '[]'),
    };
  } catch { return { penjualan: [], payments: [], biaya: [], opex: [], modal: [] }; }
}

function filterByPeriode(list: any[], dateField: string, periode: Periode): any[] {
  const now = new Date();
  let start = new Date();
  if (periode === 'minggu') start.setDate(now.getDate() - 7);
  else if (periode === 'bulan') start.setMonth(now.getMonth() - 1);
  else start.setFullYear(now.getFullYear() - 1);
  const startStr = start.toISOString().slice(0, 10);
  return list.filter((item: any) => (item[dateField] || item.tanggal || '') >= startStr);
}

const PERIODE_LABELS: Record<Periode, string> = {
  minggu: 'Minggu Ini',
  bulan: 'Bulan Ini',
  tahun: 'Tahun Ini',
};

export default function LaporanPage() {
  const [jenis, setJenis] = useState<JenisLaporan>('laba-rugi');
  const [periode, setPeriode] = useState<Periode>('bulan');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const realData = useMemo(() => (mounted ? getRealData() : { penjualan: [], payments: [], biaya: [], opex: [], modal: [] }), [mounted]);

  const penjualanFiltered = useMemo(() => filterByPeriode(realData.penjualan, 'tanggal', periode), [realData, periode]);
  const paymentsFiltered = useMemo(() => filterByPeriode(realData.payments, 'tanggalBayar', periode), [realData, periode]);
  const biayaFiltered = useMemo(() => filterByPeriode(realData.biaya, 'tanggal', periode), [realData, periode]);
  const opexFiltered = useMemo(() => filterByPeriode(realData.opex, 'tanggal', periode), [realData, periode]);

  // Laba Rugi real
  const labaRugiData = useMemo(() => {
    const pendapatan = penjualanFiltered.reduce((s: number, t: any) => s + (t.total || 0), 0);
    const biayaOps = biayaFiltered.reduce((s: number, b: any) => s + (b.jumlah || 0), 0);
    const opexTotal = opexFiltered.reduce((s: number, o: any) => s + (o.total || 0), 0);
    const pembayaranPO = paymentsFiltered.reduce((s: number, p: any) => s + (p.jumlahDibayar || 0), 0);
    const labaKotor = pendapatan - pembayaranPO;
    const labaBersih = labaKotor - biayaOps - opexTotal;
    return { pendapatan, hargaPokok: pembayaranPO, biayaOperasional: biayaOps, biayaLain: opexTotal, labaKotor, labaBersih };
  }, [penjualanFiltered, biayaFiltered, opexFiltered, paymentsFiltered]);

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
        <ExportButton
          filename={`laporan-${jenis}-${periode}`}
          headers={exportHeaders}
          rows={exportRows}
        />
      </div>

      {/* Konten Laporan */}
      <section className="card-blue">
        {jenis === 'laba-rugi' && <LabaRugi periode={periode} />}
        {jenis === 'arus-kas' && <ArusKas periode={periode} />}
        {jenis === 'stok' && <LaporanStok periode={periode} />}
      </section>
    </main>
  );
}

/* ================================================================== */
/* Sub-komponen per jenis laporan                                     */
/* ================================================================== */

function LabaRugi({ periode }: { periode: Periode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const data = useMemo(() => {
    if (!mounted) return { pendapatan: 0, hargaPokok: 0, biayaOperasional: 0, biayaLain: 0, labaKotor: 0, labaBersih: 0 };
    const { penjualan, biaya, opex } = getRealData();
    const f = (list: any[], field: string) => filterByPeriode(list, field, periode);
    const filteredPenjualan = f(penjualan, 'tanggal');

    // Pendapatan kotor
    const p = filteredPenjualan.reduce((s: number, t: any) => s + (t.total || 0), 0);

    // HPP: dari Master Data SKU — pakai hargaBaru (harga beli terbaru per SKU)
    let hpp = 0;
    try {
      const skuData = JSON.parse(localStorage.getItem('mma_sku_data') || '[]');
      const hargaMap = new Map<string, number>();
      for (const s of skuData) {
        if (s.sku && s.hargaBaru > 0) hargaMap.set(s.sku, s.hargaBaru);
      }
      for (const t of filteredPenjualan) {
        const harga = hargaMap.get(t.sku) || 0;
        hpp += harga * (t.qty || 1);
      }
    } catch {}

    const b = f(biaya, 'tanggal').reduce((s: number, b2: any) => s + (b2.jumlah || 0), 0);
    const o = f(opex, 'tanggal').reduce((s: number, o2: any) => s + (o2.total || 0), 0);
    const labaKotor = p - hpp;
    const labaBersih = labaKotor - b - o;
    return { pendapatan: p, hargaPokok: hpp, biayaOperasional: b, biayaLain: o, labaKotor, labaBersih };
  }, [mounted, periode]);
  return <LabaRugiReport data={data} periode={PERIODE_LABELS[periode]} />;
}

function ArusKas({ periode }: { periode: Periode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const data = useMemo(() => {
    if (!mounted) return { saldoAwal: 0, pemasukan: [], pengeluaran: [] };
    const { penjualan, payments, biaya, opex, modal } = getRealData();
    const f = (list: any[], field: string) => filterByPeriode(list, field, periode);
    const saldoAwal = modal.reduce((s: number, m: any) => s + (m.jumlah || 0), 0);
    const kasKecil = (() => { try { const kk = JSON.parse(localStorage.getItem('mma_kas_kecil') || '[]'); return kk.reduce((s: number, e: any) => s + (e.jenis === 'masuk' ? e.jumlah : -e.jumlah), 0); } catch { return 0; } })();
    return {
      saldoAwal: saldoAwal + kasKecil,
      pemasukan: [{ sumber: 'Penjualan', jumlah: f(penjualan, 'tanggal').reduce((s: number, t: any) => s + (t.total || 0), 0) }],
      pengeluaran: [
        { sumber: 'Pembayaran PO', jumlah: f(payments, 'tanggalBayar').reduce((s: number, p2: any) => s + p2.jumlahDibayar, 0) },
        { sumber: 'Biaya Operasional', jumlah: f(biaya, 'tanggal').reduce((s: number, b2: any) => s + b2.jumlah, 0) },
        { sumber: 'OPEX', jumlah: f(opex, 'tanggal').reduce((s: number, o2: any) => s + o2.total, 0) },
      ],
    };
  }, [mounted, periode]);
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
