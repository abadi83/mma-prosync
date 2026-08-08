'use client';

import React, { useState, useMemo } from 'react';
import { useAkuntansi, type CoaAccount } from '@/app/context/AkuntansiContext';

/* ================================================================ */
/* Tab type                                                          */
/* ================================================================ */
type Tab = 'jurnal' | 'asetmodal' | 'laporan';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'jurnal', label: 'Jurnal Umum', icon: '📋' },
  { key: 'asetmodal', label: 'Aset & Modal', icon: '🏗️' },
  { key: 'laporan', label: 'Laba Rugi & Neraca', icon: '📊' },
];

/* ================================================================ */
/* Main Page                                                         */
/* ================================================================ */
export default function AkuntansiPage() {
  const [tab, setTab] = useState<Tab>('jurnal');

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-3xl bg-gradient-to-br from-violet-700 via-violet-500 to-violet-300 p-5 text-white shadow-lg sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-100 sm:text-sm">Akuntansi</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Akuntansi Akrual</h1>
        <p className="mt-1 text-sm text-violet-100 sm:text-base">Jurnal umum, COA, aset tetap, modal, laba rugi & neraca.</p>
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm" role="tablist">
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:px-5 sm:text-sm ${
              tab === t.key ? 'bg-violet-500 text-white shadow' : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
            }`}>
            <span className="text-base sm:text-lg">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </nav>

      <section className="card-blue">
        {tab === 'jurnal' && <JurnalUmumTab />}
        {tab === 'asetmodal' && <AsetModalTab />}
        {tab === 'laporan' && <LaporanTab />}
      </section>
    </main>
  );
}

/* ================================================================ */
/* Helper formatters                                                 */
/* ================================================================ */
function fmtRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function fmtRibuan(n: number) {
  if (Math.abs(n) >= 1000000) return `Rp ${(n/1000000).toFixed(1)}jt`;
  if (Math.abs(n) >= 1000) return `Rp ${(n/1000).toFixed(0)}rb`;
  return `Rp ${n}`;
}

/* ================================================================ */
/* TAB 1: Jurnal Umum                                                */
/* ================================================================ */
function JurnalUmumTab() {
  const { coa, jurnal, getCoaByKode, addJurnal, deleteJurnal } = useAkuntansi();

  /* Filter */
  const [dari, setDari] = useState('');
  const [sampai, setSampai] = useState('');
  const [search, setSearch] = useState('');

  /* Form tambah manual */
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState({ tanggal: new Date().toISOString().slice(0, 10), akunDebit: '', akunKredit: '', nominal: '', keterangan: '', referensi: '' });
  const [ferr, setFerr] = useState('');

  const filtered = useMemo(() => {
    return jurnal.filter(j => {
      if (dari && j.tanggal < dari) return false;
      if (sampai && j.tanggal > sampai) return false;
      if (search) {
        const q = search.toLowerCase();
        const akunD = getCoaByKode(j.akunDebitId);
        const akunK = getCoaByKode(j.akunKreditId);
        if (!j.keterangan.toLowerCase().includes(q) && !j.referensi.toLowerCase().includes(q) && !(akunD?.namaAkun.toLowerCase().includes(q)) && !(akunK?.namaAkun.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [jurnal, dari, sampai, search, getCoaByKode]);

  const totalDebit = filtered.reduce((s, j) => s + j.nominal, 0);

  const handleAdd = () => {
    setFerr('');
    if (!f.akunDebit || !f.akunKredit) { setFerr('Pilih akun debit dan kredit.'); return; }
    if (f.akunDebit === f.akunKredit) { setFerr('Akun debit dan kredit tidak boleh sama.'); return; }
    if (!f.nominal || +f.nominal <= 0) { setFerr('Nominal harus > 0.'); return; }

    addJurnal({
      tanggal: f.tanggal,
      akunDebitId: f.akunDebit,
      akunKreditId: f.akunKredit,
      nominal: +f.nominal,
      keterangan: f.keterangan.trim() || 'Jurnal manual',
      referensi: f.referensi.trim() || '-',
    });
    setF({ tanggal: new Date().toISOString().slice(0, 10), akunDebit: '', akunKredit: '', nominal: '', keterangan: '', referensi: '' });
    setShowForm(false);
  };

  const coaByTipe = useMemo(() => {
    const m: Record<string, CoaAccount[]> = {};
    coa.forEach(c => { if (!m[c.tipeAkun]) m[c.tipeAkun] = []; m[c.tipeAkun].push(c); });
    return m;
  }, [coa]);

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-violet-500 to-violet-300" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Jurnal Umum</h2>
          <p className="mt-1 text-sm text-slate-500">Double-entry journal. Semua transaksi tercatat dengan pasangan debit-kredit.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition">
          {showForm ? '✕ Tutup' : '➕ Entri Manual'}
        </button>
      </div>

      {/* Form Entri Manual */}
      {showForm && (
        <div className="mt-4 rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">📝 Jurnal Baru (Double-Entry)</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal</label>
              <input type="date" value={f.tanggal} onChange={e => setF(p => ({ ...p, tanggal: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Akun Debit</label>
              <select value={f.akunDebit} onChange={e => setF(p => ({ ...p, akunDebit: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none">
                <option value="">-- Pilih Akun Debit --</option>
                {Object.entries(coaByTipe).map(([tipe, akuns]) => (
                  <optgroup key={tipe} label={tipe}>
                    {akuns.map(a => <option key={a.kodeAkun} value={a.kodeAkun}>{a.kodeAkun} — {a.namaAkun}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Akun Kredit</label>
              <select value={f.akunKredit} onChange={e => setF(p => ({ ...p, akunKredit: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none">
                <option value="">-- Pilih Akun Kredit --</option>
                {Object.entries(coaByTipe).map(([tipe, akuns]) => (
                  <optgroup key={tipe} label={tipe}>
                    {akuns.map(a => <option key={a.kodeAkun} value={a.kodeAkun}>{a.kodeAkun} — {a.namaAkun}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nominal (Rp)</label>
              <input type="number" value={f.nominal} onChange={e => setF(p => ({ ...p, nominal: e.target.value }))} placeholder="0" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-center font-bold focus:border-violet-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Referensi</label>
              <input type="text" value={f.referensi} onChange={e => setF(p => ({ ...p, referensi: e.target.value }))} placeholder="No. PO / No. Faktur…" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Keterangan</label>
              <input type="text" value={f.keterangan} onChange={e => setF(p => ({ ...p, keterangan: e.target.value }))} placeholder="Deskripsi transaksi…" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none" />
            </div>
          </div>
          {ferr && <p className="mt-2 text-sm text-red-500">{ferr}</p>}
          <button onClick={handleAdd} className="mt-3 rounded-xl bg-violet-500 px-6 py-2 text-sm font-bold text-white hover:bg-violet-700 transition">✅ Simpan Jurnal</button>
        </div>
      )}

      {/* Filter */}
      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <div><label className="block text-xs text-slate-500 mb-1">Dari</label><input type="date" value={dari} onChange={e => setDari(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none" /></div>
        <div><label className="block text-xs text-slate-500 mb-1">Sampai</label><input type="date" value={sampai} onChange={e => setSampai(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none" /></div>
        <div className="flex-1 min-w-[160px]"><label className="block text-xs text-slate-500 mb-1">Cari</label><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Keterangan, referensi, akun…" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none" /></div>
      </div>

      {/* KPI */}
      <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
        <span><strong className="text-violet-700">{filtered.length}</strong> entri jurnal</span>
        <span>Total: <strong className="text-slate-700">{fmtRp(totalDebit)}</strong></span>
      </div>

      {/* Tabel Jurnal */}
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-violet-50 text-xs uppercase text-violet-600">
              <th className="px-3 py-3 font-semibold">Tanggal</th>
              <th className="px-3 py-3 font-semibold">Akun</th>
              <th className="px-3 py-3 font-semibold">Debit</th>
              <th className="px-3 py-3 font-semibold">Kredit</th>
              <th className="px-3 py-3 font-semibold hidden sm:table-cell">Keterangan</th>
              <th className="px-3 py-3 font-semibold hidden sm:table-cell">Ref</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">Belum ada entri jurnal.</td></tr>
            ) : filtered.map(j => {
              const akunD = getCoaByKode(j.akunDebitId);
              const akunK = getCoaByKode(j.akunKreditId);
              return (
                <tr key={j.id} className="hover:bg-slate-50 transition">
                  <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{j.tanggal}</td>
                  <td className="px-3 py-2.5 text-xs">
                    <div className="font-mono text-violet-700">{j.akunDebitId}</div>
                    <div className="font-mono text-violet-400">{j.akunKreditId}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold text-slate-700">{fmtRibuan(j.nominal)}</td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold text-slate-700">{fmtRibuan(j.nominal)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 max-w-[180px] truncate hidden sm:table-cell" title={j.keterangan}>{j.keterangan}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-400 font-mono hidden sm:table-cell">{j.referensi}</td>
                  <td className="px-3 py-2.5 text-center">
                    <button onClick={() => deleteJurnal(j.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
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

/* ================================================================ */
/* TAB 2: Aset Tetap & Modal                                        */
/* ================================================================ */
function AsetModalTab() {
  const { coa, aset, modal, addAset, addModal, addJurnal, updateDepresiasi, getCoaByKode } = useAkuntansi();

  /* ── Form Aset ── */
  const [showAset, setShowAset] = useState(false);
  const [a, setA] = useState({ namaAset: '', kategori: '', tanggalPerolehan: new Date().toISOString().slice(0, 10), hargaPerolehan: '', masaManfaat: '4', nilaiSisa: '', metodeBayar: 'kas' as 'kas' | 'utang' });
  const [aErr, setAErr] = useState('');

  const handleAddAset = () => {
    setAErr('');
    if (!a.namaAset.trim()) { setAErr('Nama aset wajib diisi.'); return; }
    if (!a.hargaPerolehan || +a.hargaPerolehan <= 0) { setAErr('Harga perolehan harus > 0.'); return; }
    const harga = +a.hargaPerolehan;
    const sisa = +a.nilaiSisa || 0;

    addAset({ namaAset: a.namaAset.trim(), kategori: a.kategori.trim() || 'Umum', tanggalPerolehan: a.tanggalPerolehan, hargaPerolehan: harga, masaManfaat: +a.masaManfaat || 4, nilaiSisa: sisa });

    // Jurnal perolehan aset
    addJurnal({
      tanggal: a.tanggalPerolehan,
      akunDebitId: '1-2000',  // Aset Tetap
      akunKreditId: a.metodeBayar === 'kas' ? '1-1000' : '2-1000', // Kas atau Utang
      nominal: harga,
      keterangan: `Perolehan aset: ${a.namaAset.trim()}`,
      referensi: '-',
    });

    setA({ namaAset: '', kategori: '', tanggalPerolehan: new Date().toISOString().slice(0, 10), hargaPerolehan: '', masaManfaat: '4', nilaiSisa: '', metodeBayar: 'kas' });
    setShowAset(false);
  };

  /* ── Hitung Depresiasi ── */
  const handleDepresiasi = (ast: typeof aset[0]) => {
    const depresiasiPerBulan = (ast.hargaPerolehan - ast.nilaiSisa) / (ast.masaManfaat * 12);
    if (depresiasiPerBulan <= 0) return;
    const today = new Date().toISOString().slice(0, 10);

    addJurnal({
      tanggal: today,
      akunDebitId: '5-3000',  // Beban Depresiasi
      akunKreditId: '1-2100', // Akumulasi Depresiasi
      nominal: Math.round(depresiasiPerBulan),
      keterangan: `Depresiasi bulanan: ${ast.namaAset}`,
      referensi: '-',
    });
    updateDepresiasi(ast.id, Math.round(depresiasiPerBulan));
  };

  /* ── Form Modal ── */
  const [showModal, setShowModal] = useState(false);
  const [m, setM] = useState({ jenis: 'AWAL' as 'AWAL' | 'TAMBAHAN', tanggal: new Date().toISOString().slice(0, 10), jumlah: '', keterangan: '' });
  const [mErr, setMErr] = useState('');

  const handleAddModal = () => {
    setMErr('');
    if (!m.jumlah || +m.jumlah <= 0) { setMErr('Jumlah modal harus > 0.'); return; }
    const jml = +m.jumlah;

    addModal({ jenis: m.jenis, tanggal: m.tanggal, jumlah: jml, keterangan: m.keterangan.trim() || '-' });

    // Jurnal setoran modal
    addJurnal({
      tanggal: m.tanggal,
      akunDebitId: '1-1000',  // Kas di Bank
      akunKreditId: '3-1000', // Modal Pemilik
      nominal: jml,
      keterangan: `Setoran modal ${m.jenis === 'AWAL' ? 'awal' : 'tambahan'}: ${m.keterangan.trim() || '-'}`,
      referensi: '-',
    });

    setM({ jenis: 'AWAL', tanggal: new Date().toISOString().slice(0, 10), jumlah: '', keterangan: '' });
    setShowModal(false);
  };

  const totalAset = aset.reduce((s, a) => s + a.hargaPerolehan, 0);
  const totalDepre = aset.reduce((s, a) => s + a.akumulasiDepresiasi, 0);
  const totalModal = modal.reduce((s, m) => s + m.jumlah, 0);

  return (
    <div className="space-y-6">
      {/* ══ Aset Tetap ══ */}
      <div>
        <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-violet-500 to-violet-300" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Aset Tetap</h2>
            <p className="mt-1 text-sm text-slate-500">Kelola aset tetap dan hitung depresiasi bulanan.</p>
          </div>
          <button onClick={() => setShowAset(!showAset)} className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition">
            {showAset ? '✕ Tutup' : '➕ Tambah Aset'}
          </button>
        </div>

        {showAset && (
          <div className="mt-3 rounded-2xl border border-violet-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2"><label className="block text-xs font-semibold text-slate-600 mb-1">Nama Aset *</label><input type="text" value={a.namaAset} onChange={e => setA(p => ({ ...p, namaAset: e.target.value }))} placeholder="Contoh: Laptop, Printer, Rak Gudang…" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none" /></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Kategori</label><input type="text" value={a.kategori} onChange={e => setA(p => ({ ...p, kategori: e.target.value }))} placeholder="Elektronik, Kendaraan…" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none" /></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Tgl Perolehan</label><input type="date" value={a.tanggalPerolehan} onChange={e => setA(p => ({ ...p, tanggalPerolehan: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none" /></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Harga Perolehan *</label><input type="number" value={a.hargaPerolehan} onChange={e => setA(p => ({ ...p, hargaPerolehan: e.target.value }))} placeholder="0" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-center font-bold focus:border-violet-500 focus:outline-none" /></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Masa Manfaat (thn)</label><input type="number" value={a.masaManfaat} onChange={e => setA(p => ({ ...p, masaManfaat: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-center focus:border-violet-500 focus:outline-none" /></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Nilai Sisa</label><input type="number" value={a.nilaiSisa} onChange={e => setA(p => ({ ...p, nilaiSisa: e.target.value }))} placeholder="0" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-center focus:border-violet-500 focus:outline-none" /></div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Dibayar Dengan</label>
                <select value={a.metodeBayar} onChange={e => setA(p => ({ ...p, metodeBayar: e.target.value as 'kas' | 'utang' }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none">
                  <option value="kas">💵 Kas / Tunai</option>
                  <option value="utang">📄 Utang / Kredit</option>
                </select>
              </div>
            </div>
            {aErr && <p className="mt-2 text-sm text-red-500">{aErr}</p>}
            <button onClick={handleAddAset} className="mt-3 rounded-xl bg-violet-500 px-6 py-2 text-sm font-bold text-white hover:bg-violet-700 transition">✅ Simpan Aset</button>
          </div>
        )}

        {/* KPI Aset */}
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-violet-50 p-3 text-center"><p className="text-lg font-bold text-violet-700">{aset.length}</p><p className="text-xs text-violet-500">Jumlah Aset</p></div>
          <div className="rounded-xl bg-blue-50 p-3 text-center"><p className="text-lg font-bold text-blue-700">{fmtRibuan(totalAset)}</p><p className="text-xs text-blue-500">Nilai Perolehan</p></div>
          <div className="rounded-xl bg-amber-50 p-3 text-center"><p className="text-lg font-bold text-amber-700">{fmtRibuan(totalDepre)}</p><p className="text-xs text-amber-500">Akum. Depresiasi</p></div>
        </div>

        {/* Tabel Aset */}
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead><tr className="bg-violet-50 text-xs uppercase text-violet-600">
              <th className="px-3 py-3 font-semibold">Nama Aset</th>
              <th className="px-3 py-3 font-semibold hidden sm:table-cell">Kategori</th>
              <th className="px-3 py-3 text-right font-semibold">Harga</th>
              <th className="px-3 py-3 text-right font-semibold hidden sm:table-cell">Depre/Bln</th>
              <th className="px-3 py-3 text-right font-semibold">Nilai Buku</th>
              <th className="px-3 py-3 text-center font-semibold">Aksi</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {aset.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-400">Belum ada aset tetap.</td></tr>
              ) : aset.map(ast => {
                const deprePerBulan = Math.round((ast.hargaPerolehan - ast.nilaiSisa) / (ast.masaManfaat * 12));
                const nilaiBuku = ast.hargaPerolehan - ast.akumulasiDepresiasi;
                return (
                  <tr key={ast.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-sm font-medium text-slate-800">{ast.namaAset}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 hidden sm:table-cell">{ast.kategori}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-semibold">{fmtRibuan(ast.hargaPerolehan)}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-slate-500 hidden sm:table-cell">{fmtRibuan(deprePerBulan)}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-bold text-slate-700">{fmtRibuan(nilaiBuku)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={() => handleDepresiasi(ast)} className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200 transition" title="Hitung depresiasi 1 bulan">📉 Depresiasi</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ Modal ══ */}
      <div className="border-t border-slate-100 pt-6">
        <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-violet-500 to-violet-300" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Modal Pemilik</h2>
            <p className="mt-1 text-sm text-slate-500">Catat setoran modal awal dan tambahan.</p>
          </div>
          <button onClick={() => setShowModal(!showModal)} className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition">
            {showModal ? '✕ Tutup' : '➕ Tambah Modal'}
          </button>
        </div>

        {showModal && (
          <div className="mt-3 rounded-2xl border border-violet-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Jenis</label><select value={m.jenis} onChange={e => setM(p => ({ ...p, jenis: e.target.value as 'AWAL' | 'TAMBAHAN' }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"><option value="AWAL">Modal Awal</option><option value="TAMBAHAN">Modal Tambahan</option></select></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal</label><input type="date" value={m.tanggal} onChange={e => setM(p => ({ ...p, tanggal: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none" /></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Jumlah (Rp) *</label><input type="number" value={m.jumlah} onChange={e => setM(p => ({ ...p, jumlah: e.target.value }))} placeholder="0" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-center font-bold focus:border-violet-500 focus:outline-none" /></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Keterangan</label><input type="text" value={m.keterangan} onChange={e => setM(p => ({ ...p, keterangan: e.target.value }))} placeholder="Opsional…" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none" /></div>
            </div>
            {mErr && <p className="mt-2 text-sm text-red-500">{mErr}</p>}
            <button onClick={handleAddModal} className="mt-3 rounded-xl bg-violet-500 px-6 py-2 text-sm font-bold text-white hover:bg-violet-700 transition">✅ Simpan Modal</button>
          </div>
        )}

        <div className="mt-3 rounded-xl bg-violet-50 p-3 text-center">
          <p className="text-2xl font-bold text-violet-700">{fmtRibuan(totalModal)}</p>
          <p className="text-xs text-violet-500">Total Modal Disetor</p>
        </div>

        {modal.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-violet-50 text-xs uppercase text-violet-600">
                <th className="px-3 py-3 font-semibold">Tanggal</th>
                <th className="px-3 py-3 font-semibold">Jenis</th>
                <th className="px-3 py-3 text-right font-semibold">Jumlah</th>
                <th className="px-3 py-3 font-semibold hidden sm:table-cell">Keterangan</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50 bg-white">
                {modal.map(md => (
                  <tr key={md.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-xs text-slate-500">{md.tanggal}</td>
                    <td className="px-3 py-2.5 text-xs"><span className={`rounded-full px-2 py-0.5 font-semibold ${md.jenis === 'AWAL' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{md.jenis === 'AWAL' ? 'Modal Awal' : 'Tambahan'}</span></td>
                    <td className="px-3 py-2.5 text-right text-xs font-bold text-emerald-600">{fmtRibuan(md.jumlah)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 hidden sm:table-cell">{md.keterangan}</td>
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
/* TAB 3: Laba Rugi & Neraca                                        */
/* ================================================================ */
function LaporanTab() {
  const { getLabaRugi, getNeraca, jurnal } = useAkuntansi();
  const [dari, setDari] = useState('');
  const [sampai, setSampai] = useState('');

  const lr = useMemo(() => getLabaRugi(dari || undefined, sampai || undefined), [getLabaRugi, dari, sampai]);
  const neraca = useMemo(() => getNeraca(sampai || undefined), [getNeraca, sampai]);

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-violet-500 to-violet-300" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Laba Rugi & Neraca</h2>
          <p className="mt-1 text-sm text-slate-500">Laporan keuangan berdasarkan data jurnal umum (akrual).</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dari} onChange={e => setDari(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Dari" />
          <span className="text-slate-400 text-sm">s/d</span>
          <input type="date" value={sampai} onChange={e => setSampai(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Sampai" />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* ══ LABA RUGI ══ */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-base font-bold text-slate-800 mb-4">📊 Laporan Laba Rugi</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-sm font-semibold text-emerald-600">Pendapatan Usaha</span>
              <span className="text-lg font-bold text-emerald-700">{fmtRp(lr.pendapatan)}</span>
            </div>
            <div className="space-y-2 pl-4">
              <div className="flex justify-between text-sm"><span className="text-slate-500">HPP</span><span className="text-red-600">({fmtRp(lr.beban.hpp)})</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Beban Operasional</span><span className="text-red-600">({fmtRp(lr.beban.operasional)})</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Beban Depresiasi</span><span className="text-red-600">({fmtRp(lr.beban.depresiasi)})</span></div>
              <div className="flex justify-between text-sm font-semibold border-t border-slate-100 pt-2"><span className="text-slate-600">Total Beban</span><span className="text-red-600">({fmtRp(lr.totalBeban)})</span></div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t-2 border-slate-200">
              <span className="text-base font-bold text-slate-800">Laba / Rugi Bersih</span>
              <span className={`text-xl font-bold ${lr.labaBersih >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {lr.labaBersih >= 0 ? fmtRp(lr.labaBersih) : `(${fmtRp(Math.abs(lr.labaBersih))})`}
              </span>
            </div>
          </div>
        </div>

        {/* ══ NERACA ══ */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-800">📋 Neraca</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${neraca.seimbang ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
              {neraca.seimbang ? '✅ Seimbang' : '⚠️ Tidak Seimbang'}
            </span>
          </div>
          <div className="space-y-4">
            {/* ASET */}
            <div>
              <p className="text-xs font-semibold uppercase text-violet-500 mb-2">Aset</p>
              <div className="space-y-1 pl-3 text-sm">
                <div className="flex justify-between"><span>Kas di Bank</span><span className="font-semibold">{fmtRp(neraca.aset.kas)}</span></div>
                <div className="flex justify-between"><span>Piutang Usaha</span><span className="font-semibold">{fmtRp(neraca.aset.piutang)}</span></div>
                <div className="flex justify-between"><span>Persediaan Barang</span><span className="font-semibold">{fmtRp(neraca.aset.persediaan)}</span></div>
                <div className="flex justify-between"><span>Aset Tetap</span><span className="font-semibold">{fmtRp(neraca.aset.asetTetap)}</span></div>
                <div className="flex justify-between text-slate-400"><span>Akum. Depresiasi</span><span>({fmtRp(neraca.aset.akumDepre)})</span></div>
                <div className="flex justify-between font-bold border-t border-slate-100 pt-1"><span>Total Aset</span><span className="text-violet-700">{fmtRp(neraca.totalAset)}</span></div>
              </div>
            </div>
            {/* KEWAJIBAN */}
            <div>
              <p className="text-xs font-semibold uppercase text-amber-500 mb-2">Kewajiban</p>
              <div className="space-y-1 pl-3 text-sm">
                <div className="flex justify-between"><span>Utang Usaha (SKU)</span><span className="font-semibold">{fmtRp(neraca.kewajiban.utangSku)}</span></div>
                <div className="flex justify-between"><span>Utang Beban (OPEX)</span><span className="font-semibold">{fmtRp(neraca.kewajiban.utangOpex)}</span></div>
                <div className="flex justify-between font-bold border-t border-slate-100 pt-1"><span>Total Kewajiban</span><span className="text-amber-600">{fmtRp(neraca.totalKewajiban)}</span></div>
              </div>
            </div>
            {/* EKUITAS */}
            <div>
              <p className="text-xs font-semibold uppercase text-emerald-500 mb-2">Ekuitas</p>
              <div className="space-y-1 pl-3 text-sm">
                <div className="flex justify-between"><span>Modal Pemilik</span><span className="font-semibold">{fmtRp(neraca.ekuitas.modal)}</span></div>
                <div className="flex justify-between"><span>Laba Ditahan</span><span className="font-semibold">{fmtRp(neraca.ekuitas.labaDitahan)}</span></div>
                <div className="flex justify-between font-bold border-t border-slate-100 pt-1"><span>Total Ekuitas</span><span className="text-emerald-600">{fmtRp(neraca.totalEkuitas)}</span></div>
              </div>
            </div>
            {/* Total Pasiva */}
            <div className="flex justify-between items-center pt-2 border-t-2 border-slate-200">
              <span className="text-sm font-bold text-slate-800">Total Kewajiban + Ekuitas</span>
              <span className="text-lg font-bold text-slate-800">{fmtRp(neraca.totalKewajiban + neraca.totalEkuitas)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
