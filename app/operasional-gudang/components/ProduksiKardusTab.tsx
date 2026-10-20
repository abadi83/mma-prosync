'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KARDUS_KATEGORI, kategoriLabel, ProduksiKardusItem, RingkasanRow } from '@/app/lib/produksiKardus';

function todayISO(): string {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

const PERIODE = [
  { key: 'hari' as const, label: 'Hari Ini', icon: '☀️', color: 'text-emerald-600 border-emerald-200 bg-emerald-50' },
  { key: 'minggu' as const, label: 'Minggu Ini', icon: '📅', color: 'text-sky-600 border-sky-200 bg-sky-50' },
  { key: 'bulan' as const, label: 'Bulan Ini', icon: '🗓️', color: 'text-brand-600 border-brand-200 bg-brand-50' },
  { key: 'tahun' as const, label: 'Tahun Ini', icon: '📆', color: 'text-amber-600 border-amber-200 bg-amber-50' },
];

export function ProduksiKardusTab() {
  const [ringkasan, setRingkasan] = useState<RingkasanRow[]>([]);
  const [riwayat, setRiwayat] = useState<ProduksiKardusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fKategori, setFKategori] = useState('');
  const [sukses, setSukses] = useState('');
  const [editItem, setEditItem] = useState<ProduksiKardusItem | null>(null);
  const [hapusItem, setHapusItem] = useState<ProduksiKardusItem | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/produksi-kardus?ringkasan=1').then(r => r.json()).catch(() => []),
        fetch(`/api/produksi-kardus?limit=100${fKategori ? `&kategori=${encodeURIComponent(fKategori)}` : ''}`).then(r => r.json()).catch(() => []),
      ]);
      setRingkasan(Array.isArray(r1) ? r1 : []);
      setRiwayat(Array.isArray(r2) ? r2 : []);
    } catch {} finally { setLoading(false); }
  }, [fKategori]);

  useEffect(() => { refresh(); const t = setInterval(refresh, 30000); return () => clearInterval(t); }, [refresh]);

  // ── Ringkasan per kategori ──
  const perKategori = useMemo(() => {
    const map = new Map<string, RingkasanRow[]>();
    for (const r of ringkasan) {
      if (!map.has(r.kategori)) map.set(r.kategori, []);
      map.get(r.kategori)!.push(r);
    }
    return KARDUS_KATEGORI.map(k => ({ def: k, rows: map.get(k.key) || [] })).filter(k => k.rows.length > 0);
  }, [ringkasan]);

  const totalPeriode = (key: 'hari' | 'minggu' | 'bulan' | 'tahun') => ringkasan.reduce((s, r) => s + r[key], 0);

  const flash = (msg: string) => {
    setSukses(msg);
    setTimeout(() => setSukses(''), 2500);
  };

  const onSaved = () => {
    refresh();
    flash('✅ Data produksi tersimpan');
  };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🗃️ Produksi Kardus & Packing Kayu</h2>
          <p className="text-sm text-slate-500">Input harian pembuatan kardus — rekap otomatis per kategori.</p>
        </div>
        {sukses && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{sukses}</span>}
      </div>

      {/* ── Input cepat ── */}
      <FormProduksi onSaved={onSaved} />

      {/* ── Rekap otomatis ── */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PERIODE.map(p => (
          <div key={p.key} className={`rounded-xl border px-3 py-2 ${p.color}`}>
            <p className="text-xs font-semibold">{p.icon} {p.label}</p>
            <p className="text-xl font-bold text-slate-800">{totalPeriode(p.key).toLocaleString('id-ID')}</p>
            <p className="text-[10px] text-slate-500">total unit</p>
          </div>
        ))}
      </div>

      {/* ── Tabel rekap per kategori & ukuran ── */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead><tr className="bg-brand-50 text-xs uppercase text-brand-500">
            {['Kategori / Ukuran', '☀️ Hari', '📅 Minggu', '🗓️ Bulan', '📆 Tahun'].map((c, i) => (
              <th key={c} className={`px-3 py-3 font-semibold ${i > 0 ? 'text-right' : ''}`}>{c}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {!loading && perKategori.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">Belum ada data produksi. Isi form di atas untuk mulai.</td></tr>
            )}
            {perKategori.map(({ def, rows }) => {
              const total = (k: 'hari' | 'minggu' | 'bulan' | 'tahun') => rows.reduce((s, r) => s + r[k], 0);
              return (
                <React.Fragment key={def.key}>
                  {rows.map((r, i) => (
                    <tr key={`${def.key}-${r.ukuran || 'x'}`} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                      <td className="px-3 py-2.5">
                        <span className="font-semibold text-slate-700">{def.label}</span>
                        {r.ukuran && <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{r.ukuran} cm</span>}
                        {!r.ukuran && def.ukuranBebas && <span className="ml-1.5 text-[10px] text-slate-400">(bebas)</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-emerald-700">{r.hari}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-sky-700">{r.minggu}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-brand-700">{r.bulan}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-amber-700">{r.tahun}</td>
                    </tr>
                  ))}
                  {rows.length > 1 && (
                    <tr className="bg-brand-50/40">
                      <td className="px-3 py-2 text-xs font-bold text-brand-600">Total {def.label}</td>
                      <td className="px-3 py-2 text-right text-xs font-bold text-emerald-700">{total('hari')}</td>
                      <td className="px-3 py-2 text-right text-xs font-bold text-sky-700">{total('minggu')}</td>
                      <td className="px-3 py-2 text-right text-xs font-bold text-brand-700">{total('bulan')}</td>
                      <td className="px-3 py-2 text-right text-xs font-bold text-amber-700">{total('tahun')}</td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Riwayat input ── */}
      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-700">🕓 Riwayat Input ({riwayat.length})</h3>
          <select value={fKategori} onChange={e => setFKategori(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm">
            <option value="">Semua kategori</option>
            {KARDUS_KATEGORI.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
        </div>
        <div className="mt-2 overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead><tr className="bg-brand-50 text-xs uppercase text-brand-500">
              {['Tanggal', 'Kategori', 'Ukuran', 'Qty', 'Petugas', 'Catatan', 'Aksi'].map(c => <th key={c} className="px-3 py-2.5 font-semibold">{c}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {riwayat.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Belum ada riwayat.</td></tr>}
              {riwayat.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                  <td className="px-3 py-2 text-slate-600">{r.tanggal}</td>
                  <td className="px-3 py-2 font-medium text-slate-700">{kategoriLabel(r.kategori)}</td>
                  <td className="px-3 py-2 text-slate-600">{r.ukuran ? `${r.ukuran} cm` : '—'}</td>
                  <td className="px-3 py-2 font-bold text-brand-700">{r.qty}</td>
                  <td className="px-3 py-2 text-slate-600">{r.pegawaiNama || '—'}</td>
                  <td className="max-w-40 truncate px-3 py-2 text-xs text-slate-400">{r.catatan || '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => setEditItem(r)} className="rounded-lg bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-200">✏️</button>
                      <button onClick={() => setHapusItem(r)} className="rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-200">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editItem && <FormProduksi edit={editItem} onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); onSaved(); }} />}
      {hapusItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-80 rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-lg font-bold text-slate-800">🗑️ Hapus Input</p>
            <p className="mt-2 text-sm text-slate-600">Yakin hapus {hapusItem.qty} × {kategoriLabel(hapusItem.kategori)}{hapusItem.ukuran ? ` ${hapusItem.ukuran} cm` : ''} tanggal {hapusItem.tanggal}? Rekap otomatis ikut menyesuaikan.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setHapusItem(null)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button>
              <button onClick={async () => { await fetch(`/api/produksi-kardus?id=${encodeURIComponent(hapusItem.id)}`, { method: 'DELETE' }); setHapusItem(null); refresh(); flash('🗑️ Input dihapus'); }} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Form input / edit ── */
function FormProduksi({ edit, onSaved, onClose }: {
  edit?: ProduksiKardusItem | null;
  onSaved: () => void;
  onClose?: () => void;
}) {
  const [kategori, setKategori] = useState(edit?.kategori || 'kardus-kecil');
  const [ukuran, setUkuran] = useState(edit?.ukuran || '');
  const [qty, setQty] = useState(edit ? String(edit.qty) : '');
  const [tanggal, setTanggal] = useState(edit?.tanggal || todayISO());
  const [catatan, setCatatan] = useState(edit?.catatan || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const def = KARDUS_KATEGORI.find(k => k.key === kategori)!;

  const gantiKategori = (key: string) => {
    setKategori(key);
    const d = KARDUS_KATEGORI.find(k => k.key === key)!;
    if (!d.ukuranBebas) setUkuran(d.ukuran[0]?.value || '');
    else setUkuran('');
  };

  const save = async () => {
    const q = +qty;
    if (!q || q <= 0) { setErr('Jumlah (qty) wajib diisi dan lebih dari 0.'); return; }
    if (def.ukuran.length > 0 && !ukuran) { setErr('Pilih ukuran dulu.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/produksi-kardus', {
        method: edit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edit ? { id: edit.id, kategori, ukuran, qty: q, tanggal, catatan } : { kategori, ukuran, qty: q, tanggal, catatan }),
      });
      if (res.ok) {
        setQty('');
        setCatatan('');
        onSaved();
      } else {
        const j = await res.json().catch(() => null);
        setErr(j?.error || 'Gagal menyimpan.');
      }
    } catch { setErr('Gagal terhubung ke server.'); } finally { setBusy(false); }
  };

  return (
    <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
      {onClose ? (
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-700">✏️ Edit Input Produksi</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      ) : (
        <p className="text-sm font-bold text-slate-700">➕ Input Produksi Hari Ini</p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-500">Kategori</span>
          <select value={kategori} onChange={e => gantiKategori(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            {KARDUS_KATEGORI.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-500">Ukuran</span>
          {def.ukuran.length > 0 ? (
            <select value={ukuran} onChange={e => setUkuran(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              {def.ukuran.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          ) : def.ukuranBebas ? (
            <input value={ukuran} onChange={e => setUkuran(e.target.value)} placeholder="cth: 45x30 cm" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
          ) : (
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-400">—</div>
          )}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-500">Jumlah</span>
          <input type="number" min={1} value={qty} onChange={e => setQty(e.target.value)} placeholder="0" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-500">📅 Tanggal</span>
          <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
        </label>
      </div>
      <input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan (opsional)…" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
      {err && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
      <div className="mt-3 flex justify-end">
        <button onClick={save} disabled={busy} className="rounded-xl bg-brand-500 px-5 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:bg-slate-300">
          {busy ? 'Menyimpan…' : edit ? '💾 Simpan Perubahan' : '💾 Simpan Produksi'}
        </button>
      </div>
    </div>
  );
}
