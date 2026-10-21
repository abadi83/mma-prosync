'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KATEGORI_BERITA, kategoriBeritaDef, kategoriBeritaLabel, BeritaInternalItem } from '@/app/lib/beritaInternal';
import { compressImageFile } from '@/app/lib/imageUtils';

interface PegawaiDb { id: string; nama: string; status?: string; }

function nowLocal(): string {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T${p(t.getHours())}:${p(t.getMinutes())}`;
}

function fmtWaktu(w: string): string {
  if (!w) return '—';
  const d = new Date(w.includes('T') ? w : w.replace(' ', 'T'));
  if (isNaN(d.getTime())) return w;
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function NewsMmaTab() {
  const [list, setList] = useState<BeritaInternalItem[]>([]);
  const [pegawai, setPegawai] = useState<PegawaiDb[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<BeritaInternalItem | null>(null);
  const [hapusItem, setHapusItem] = useState<BeritaInternalItem | null>(null);
  const [sukses, setSukses] = useState('');
  const [fKategori, setFKategori] = useState('');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/berita-internal?limit=100${fKategori ? `&kategori=${encodeURIComponent(fKategori)}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setList(Array.isArray(data) ? data : []);
      }
    } catch {} finally { setLoading(false); }
  }, [fKategori]);

  useEffect(() => { refresh(); const t = setInterval(refresh, 30000); return () => clearInterval(t); }, [refresh]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/pegawai');
        if (res.ok && active) {
          const data = await res.json();
          setPegawai(Array.isArray(data) ? data.filter((p: PegawaiDb) => p.status === 'Aktif') : []);
        }
      } catch {}
    })();
    return () => { active = false; };
  }, []);

  const grouped = useMemo(() => {
    return KATEGORI_BERITA.map(def => ({
      def,
      items: list.filter(b => b.kategori === def.key),
    })).filter(g => fKategori ? g.def.key === fKategori : true);
  }, [list, fKategori]);

  const flash = (msg: string) => { setSukses(msg); setTimeout(() => setSukses(''), 2500); };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📰 News MMA Entry</h2>
          <p className="text-sm text-slate-500">Berita internal: Morning Briefing, Operational News & Klaim News — tampil di dashboard.</p>
        </div>
        <div className="flex items-center gap-2">
          {sukses && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{sukses}</span>}
          <button onClick={() => { setEditItem(null); setShowForm(true); }} className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">+ Buat Berita</button>
        </div>
      </div>

      {/* Filter */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500">Filter kategori:</span>
        <button onClick={() => setFKategori('')} className={`rounded-full px-3 py-1 text-xs font-semibold ${fKategori === '' ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Semua</button>
        {KATEGORI_BERITA.map(k => (
          <button key={k.key} onClick={() => setFKategori(k.key)} className={`rounded-full px-3 py-1 text-xs font-semibold ${fKategori === k.key ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {k.icon} {k.label}
          </button>
        ))}
      </div>

      {/* Daftar per kategori */}
      {loading ? (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">Memuat…</p>
      ) : list.length === 0 ? (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">Belum ada berita internal. Klik "+ Buat Berita" untuk mulai.</p>
      ) : (
        grouped.map(g => (
          <div key={g.def.key} className="mt-4">
            <p className="text-sm font-bold text-slate-700">{g.def.icon} {g.def.label} <span className="text-slate-400">({g.items.length})</span></p>
            <div className="mt-2 space-y-2">
              {g.items.map(b => (
                <div key={b.id} className="flex gap-3 rounded-xl border border-slate-100 bg-white p-3">
                  {b.gambarBg ? (
                    <img src={b.gambarBg} alt="" className="h-16 w-24 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className={`h-16 w-24 shrink-0 rounded-lg bg-gradient-to-br ${g.def.gradien}`} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800">{b.judul}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      ✍️ {b.penulisNama || '—'} · 🕐 {fmtWaktu(b.waktu)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{b.isi || '—'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col justify-center gap-1">
                    <button onClick={() => { setEditItem(b); setShowForm(true); }} className="rounded-lg bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-200">✏️</button>
                    <button onClick={() => setHapusItem(b)} className="rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-200">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {showForm && <FormBerita
        pegawai={pegawai}
        edit={editItem}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); refresh(); flash('✅ Berita tersimpan'); }}
      />}

      {hapusItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-80 rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-lg font-bold text-slate-800">🗑️ Hapus Berita</p>
            <p className="mt-2 text-sm text-slate-600">Yakin hapus "{hapusItem.judul}"?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setHapusItem(null)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button>
              <button onClick={async () => { await fetch(`/api/berita-internal?id=${encodeURIComponent(hapusItem.id)}`, { method: 'DELETE' }); setHapusItem(null); refresh(); flash('🗑️ Berita dihapus'); }} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Form buat / edit berita ── */
function FormBerita({ pegawai, edit, onSaved, onClose }: {
  pegawai: PegawaiDb[];
  edit: BeritaInternalItem | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [kategori, setKategori] = useState(edit?.kategori || 'morning');
  const [judul, setJudul] = useState(edit?.judul || '');
  const [isi, setIsi] = useState(edit?.isi || '');
  const [penulisId, setPenulisId] = useState(edit?.penulisId || '');
  const [waktu, setWaktu] = useState(edit?.waktu ? edit.waktu.slice(0, 16) : nowLocal());
  const [gambarBg, setGambarBg] = useState(edit?.gambarBg || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const def = kategoriBeritaDef(kategori);

  const pilihGambar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Hanya file gambar (JPG/PNG).'); return; }
    setBusy(true);
    try {
      const b64 = await compressImageFile(file, 1200, 1200, 0.72);
      setGambarBg(b64);
    } catch { setErr('Gagal memproses gambar.'); }
    setBusy(false);
    e.target.value = '';
  };

  const save = async () => {
    if (!judul.trim()) { setErr('Judul wajib diisi.'); return; }
    const penulis = pegawai.find(p => p.id === penulisId);
    setBusy(true);
    try {
      const res = await fetch('/api/berita-internal', {
        method: edit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(edit ? { id: edit.id } : {}),
          kategori, judul, isi,
          penulisId: penulisId || null,
          penulisNama: penulis?.nama || edit?.penulisNama || '',
          waktu, gambarBg,
        }),
      });
      if (res.ok) onSaved();
      else {
        const j = await res.json().catch(() => null);
        setErr(j?.error || 'Gagal menyimpan berita.');
      }
    } catch { setErr('Gagal terhubung ke server.'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-bold text-slate-800">{edit ? '✏️ Edit Berita' : '➕ Buat Berita'}</p>
            <p className="text-xs text-slate-400">{def.icon} {def.label} — {def.deskripsi}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        {err && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}

        <div className="mt-3 space-y-2">
          {/* Latar belakang gambar (pemanis) */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500">🖼️ Latar belakang gambar (opsional)</span>
            {gambarBg ? (
              <div className="relative h-32 overflow-hidden rounded-xl">
                <img src={gambarBg} alt="Latar" className="h-full w-full object-cover" />
                <button onClick={() => setGambarBg('')} className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">✕ Hapus</button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} className="rounded-xl border-2 border-dashed border-slate-200 px-3 py-4 text-sm text-slate-400 hover:border-brand-400 hover:text-brand-600">
                {busy ? 'Memproses gambar…' : '➕ Klik untuk pilih gambar'}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pilihGambar} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500">Kategori</span>
            <select value={kategori} onChange={e => setKategori(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              {KATEGORI_BERITA.map(k => <option key={k.key} value={k.key}>{k.icon} {k.label}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500">Judul *</span>
            <input value={judul} onChange={e => setJudul(e.target.value)} placeholder="Judul berita…" className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500">Isi berita</span>
            <textarea value={isi} onChange={e => setIsi(e.target.value)} rows={4} placeholder="Tulis isi berita…" className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-500">✍️ Penulis</span>
              <select value={penulisId} onChange={e => setPenulisId(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <option value="">— Pilih pegawai —</option>
                {pegawai.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-500">🕐 Waktu penulisan</span>
              <input type="datetime-local" value={waktu} onChange={e => setWaktu(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button>
          <button onClick={save} disabled={busy} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">{busy ? 'Menyimpan…' : '💾 Simpan Berita'}</button>
        </div>
      </div>
    </div>
  );
}
