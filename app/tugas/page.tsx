'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useUser } from '@/app/hooks/useUser';
import { TugasItem, TugasProgressItem, TugasStatus, TugasPrioritas } from '@/app/services/tugasService';
import { buildGantt, shortDate, todayMidnight } from '@/app/lib/gantt';

type Tab = 'daftar' | 'gantt' | 'laporan';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'daftar', label: 'Daftar Tugas', icon: '📋' },
  { key: 'gantt', label: 'Gantt Chart', icon: '📊' },
  { key: 'laporan', label: 'Laporan Selesai', icon: '📝' },
];

const STATUS_LABEL: Record<TugasStatus, string> = { todo: 'Todo', proses: 'Proses', review: 'Review', selesai: 'Selesai' };
const STATUS_BADGE: Record<TugasStatus, string> = {
  todo: 'bg-slate-100 text-slate-600',
  proses: 'bg-blue-100 text-blue-700',
  review: 'bg-amber-100 text-amber-700',
  selesai: 'bg-emerald-100 text-emerald-700',
};
const PRIORITAS_BADGE: Record<TugasPrioritas, string> = {
  rendah: 'bg-slate-100 text-slate-500',
  normal: 'bg-sky-100 text-sky-700',
  tinggi: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

interface PegawaiDb { id: string; nama: string; jabatan?: string; status?: string; }

function fmtDate(s: string | null): string {
  if (!s) return '—';
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return s;
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function todayISO(): string {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

/* ═══════════════════════════════════════════════════════════════ */
export default function TugasPage() {
  const [tab, setTab] = useState<Tab>('daftar');

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-500 to-brand-300 p-5 text-white shadow-lg sm:p-7">
        <div className="absolute right-4 top-4 text-5xl opacity-20 sm:text-7xl">📋</div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-100 sm:text-sm">Manajemen</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Tugas Pekerjaan</h1>
        <p className="mt-1 max-w-xl text-sm text-brand-100 sm:text-base">Beri tugas ke pegawai, pantau progress, terima laporan selesai, dan lihat timeline Gantt.</p>
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm" role="tablist">
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:px-5 sm:text-sm ${tab === t.key ? 'bg-brand-500 text-white shadow' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'}`}>
            <span className="text-base sm:text-lg">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </nav>

      <section className="card-blue">
        {tab === 'daftar' && <DaftarTugasTab />}
        {tab === 'gantt' && <GanttTab />}
        {tab === 'laporan' && <LaporanTab />}
      </section>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/* Tab 1: Daftar Tugas                                             */
/* ═══════════════════════════════════════════════════════════════ */
function DaftarTugasTab() {
  const { nama, roles } = useUser();
  // Admin & Pengawas bisa membuat, edit, assign & hapus tugas
  const canKelola = roles.includes('admin') || roles.includes('pengawas');
  const [tasks, setTasks] = useState<TugasItem[]>([]);
  const [pegawai, setPegawai] = useState<PegawaiDb[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fPetugas, setFPetugas] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<TugasItem | null>(null);
  const [detail, setDetail] = useState<{ item: TugasItem; riwayat: TugasProgressItem[] } | null>(null);
  const [hapusTask, setHapusTask] = useState<TugasItem | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/tugas');
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : []);
      }
    } catch {} finally { setLoading(false); }
  }, []);

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

  const openDetail = async (id: string) => {
    const d = await fetchDetail(id);
    if (d) setDetail(d);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tasks.filter(t => {
      if (fStatus && t.status !== fStatus) return false;
      if (fPetugas && !t.petugas.some(p => p.id === fPetugas)) return false;
      if (q && !(`${t.judul} ${t.petugas.map(p => p.nama).join(' ')} ${t.pemberiNama || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [tasks, search, fStatus, fPetugas]);

  const stat = (s: string) => tasks.filter(t => t.status === s).length;

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📋 Daftar Tugas</h2>
          <p className="text-sm text-slate-500">{tasks.length} tugas • {stat('selesai')} selesai</p>
        </div>
        <button onClick={() => { setEditTask(null); setShowForm(true); }} className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">+ Tugas Baru</button>
      </div>

      {/* Statistik */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['todo', 'proses', 'review', 'selesai'] as TugasStatus[]).map(s => (
          <div key={s} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
            <p className={`text-xs font-semibold ${STATUS_BADGE[s].split(' ')[1]}`}>{STATUS_LABEL[s]}</p>
            <p className="text-xl font-bold text-slate-800">{stat(s)}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="mt-3 flex flex-wrap gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cari judul / petugas / pemberi…" className="min-w-44 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm">
          <option value="">Semua status</option>
          {(['todo', 'proses', 'review', 'selesai'] as TugasStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select value={fPetugas} onChange={e => setFPetugas(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm">
          <option value="">Semua petugas</option>
          {pegawai.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
        </select>
        <button onClick={refresh} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-brand-50">🔄</button>
      </div>

      {/* Tabel */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead><tr className="bg-brand-50 text-xs uppercase text-brand-500">
            {['Tugas', 'Petugas', 'Pemberi', 'Prioritas', 'Status', 'Progress', 'Tenggat', 'Aksi'].map(c => <th key={c} className="px-3 py-3 font-semibold">{c}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {loading && <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">Memuat…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">Belum ada tugas. Klik "+ Tugas Baru" untuk mulai.</td></tr>}
            {filtered.map((t, i) => {
              const lewat = t.status !== 'selesai' && t.tenggat && t.tenggat < todayISO();
              return (
                <tr key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-slate-800">{t.judul}</p>
                    {t.deskripsi && <p className="max-w-56 truncate text-xs text-slate-400">{t.deskripsi}</p>}
                  </td>
                  <td className="px-3 py-3">
                    {t.petugas.length === 0 ? <span className="text-slate-400">Belum di-assign</span> : (
                      <div className="flex flex-wrap gap-1">
                        {t.petugas.map(p => <span key={p.id} className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700">{p.nama}</span>)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-600">{t.pemberiNama || '—'}</td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PRIORITAS_BADGE[t.prioritas]}`}>{t.prioritas}</span></td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[t.status]}`}>{STATUS_LABEL[t.status]}</span></td>
                  <td className="px-3 py-3 w-32">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${t.progress >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${t.progress}%` }} /></div>
                      <span className="w-9 text-right text-xs font-semibold text-slate-600">{t.progress}%</span>
                    </div>
                  </td>
                  <td className={`px-3 py-3 ${lewat ? 'font-bold text-red-600' : 'text-slate-600'}`}>{fmtDate(t.tenggat)}{lewat && ' ⚠'}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openDetail(t.id)} title="Detail & update progress" className="rounded-lg bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-200">📄</button>
                      {canKelola && <button onClick={() => { setEditTask(t); setShowForm(true); }} title="Edit / assign ulang" className="rounded-lg bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-200">✏️</button>}
                      {canKelola && <button onClick={() => setHapusTask(t)} title="Hapus" className="rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-200">🗑️</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && <FormTugas
        pegawai={pegawai}
        edit={editTask}
        pemberiNama={nama}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); refresh(); }}
      />}
      {detail && <DetailTugas
        item={detail.item}
        riwayat={detail.riwayat}
        pegawai={pegawai}
        canKelola={canKelola}
        onClose={() => setDetail(null)}
        onSaved={async () => { await refresh(); const d = await fetchDetail(detail.item.id); setDetail(d); }}
      />}
      {hapusTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-80 rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-lg font-bold text-slate-800">🗑️ Hapus Tugas</p>
            <p className="mt-2 text-sm text-slate-600">Yakin hapus "{hapusTask.judul}"? Seluruh riwayat progress ikut terhapus.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setHapusTask(null)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button>
              <button onClick={async () => { await fetch(`/api/tugas?id=${encodeURIComponent(hapusTask.id)}`, { method: 'DELETE' }); setHapusTask(null); refresh(); }} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function fetchDetail(id: string): Promise<{ item: TugasItem; riwayat: TugasProgressItem[] } | null> {
  try {
    const res = await fetch(`/api/tugas?id=${encodeURIComponent(id)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.id) return { item: data, riwayat: Array.isArray(data.riwayat) ? data.riwayat : [] };
    }
  } catch {}
  return null;
}

/* ── Form buat / edit tugas ── */
function FormTugas({ pegawai, edit, pemberiNama, onClose, onSaved }: {
  pegawai: PegawaiDb[];
  edit: TugasItem | null;
  pemberiNama: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState(() => ({
    judul: edit?.judul || '',
    deskripsi: edit?.deskripsi || '',
    petugasIds: (edit?.petugas || []).map(p => p.id),
    prioritas: (edit?.prioritas || 'normal') as TugasPrioritas,
    tanggalMulai: edit?.tanggalMulai || todayISO(),
    tenggat: edit?.tenggat || '',
  }));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const togglePetugas = (id: string) => {
    setF(prev => ({
      ...prev,
      petugasIds: prev.petugasIds.includes(id) ? prev.petugasIds.filter(x => x !== id) : [...prev.petugasIds, id],
    }));
  };

  const save = async () => {
    if (!f.judul.trim()) { setErr('Judul tugas wajib diisi.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/tugas', {
        method: edit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edit ? { id: edit.id, ...f } : f),
      });
      if (res.ok) onSaved();
      else setErr('Gagal menyimpan tugas.');
    } catch { setErr('Gagal terhubung ke server.'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-lg font-bold text-slate-800">{edit ? '✏️ Edit Tugas' : '➕ Tugas Baru'}</p>
        <p className="text-xs text-slate-400">Pemberi tugas: {pemberiNama}</p>
        {err && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
        <div className="mt-3 space-y-2">
          <input value={f.judul} onChange={e => setF({ ...f, judul: e.target.value })} placeholder="Judul tugas *" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          <textarea value={f.deskripsi} onChange={e => setF({ ...f, deskripsi: e.target.value })} placeholder="Deskripsi / instruksi pekerjaan…" rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500">Petugas (bisa lebih dari 1) — klik untuk pilih</span>
            <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
              {pegawai.length === 0 && <span className="text-xs text-slate-400">Belum ada pegawai aktif di Kepegawaian.</span>}
              {pegawai.map(p => {
                const on = f.petugasIds.includes(p.id);
                return (
                  <button key={p.id} onClick={() => togglePetugas(p.id)} type="button"
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${on ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {on ? '✓ ' : ''}{p.nama}{p.jabatan ? ` · ${p.jabatan}` : ''}
                  </button>
                );
              })}
            </div>
            {f.petugasIds.length > 0 && <p className="text-[10px] text-brand-600">{f.petugasIds.length} petugas dipilih</p>}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500">Prioritas</span>
            <div className="flex gap-1.5">
              {(['rendah', 'normal', 'tinggi', 'urgent'] as TugasPrioritas[]).map(p => (
                <button key={p} onClick={() => setF({ ...f, prioritas: p })}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold capitalize ${f.prioritas === p ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{p}</button>
              ))}
            </div>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-500">📅 Mulai</span>
              <input type="date" value={f.tanggalMulai} onChange={e => setF({ ...f, tanggalMulai: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-500">⏰ Tenggat</span>
              <input type="date" value={f.tenggat} onChange={e => setF({ ...f, tenggat: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button>
          <button onClick={save} disabled={busy} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">{busy ? 'Menyimpan…' : '💾 Simpan'}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Detail + update progress & laporan selesai ── */
function DetailTugas({ item, riwayat, pegawai, canKelola, onClose, onSaved }: {
  item: TugasItem;
  riwayat: TugasProgressItem[];
  pegawai: PegawaiDb[];
  canKelola: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [progress, setProgress] = useState(item.progress);
  const [status, setStatus] = useState<TugasStatus>(item.status);
  const [catatan, setCatatan] = useState('');
  const [laporan, setLaporan] = useState(item.laporanSelesai);
  const [petugasIds, setPetugasIds] = useState<string[]>((item.petugas || []).map(p => p.id));
  const [judul, setJudul] = useState(item.judul);
  const [deskripsi, setDeskripsi] = useState(item.deskripsi);
  const [tenggat, setTenggat] = useState(item.tenggat || '');
  const [tanggalMulai, setTanggalMulai] = useState(item.tanggalMulai || '');
  const [prioritas, setPrioritas] = useState<TugasPrioritas>(item.prioritas);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const togglePetugas = (id: string) => {
    setPetugasIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const simpan = async () => {
    if (status === 'selesai' && !laporan.trim()) { setErr('Laporan selesai wajib diisi sebelum menandai selesai.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/tugas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id, judul, deskripsi, petugasIds, prioritas, tanggalMulai, tenggat,
          progress: status === 'selesai' ? 100 : progress, status,
          laporanSelesai: status === 'selesai' ? laporan : item.laporanSelesai,
          catatan,
        }),
      });
      if (res.ok) { setCatatan(''); await onSaved(); }
      else setErr('Gagal menyimpan perubahan.');
    } catch { setErr('Gagal terhubung ke server.'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-bold text-slate-800">📄 Detail Tugas</p>
            <p className="text-sm text-slate-500">diberikan oleh {item.pemberiNama || '—'} • dibuat {item.createdAt}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {/* Info inti */}
        <div className="mt-3 space-y-2">
          {canKelola ? (
            <>
              <input value={judul} onChange={e => setJudul(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold" />
              <textarea value={deskripsi} onChange={e => setDeskripsi(e.target.value)} rows={2} placeholder="Deskripsi…" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-slate-800">{judul}</p>
              {deskripsi && <p className="text-sm text-slate-600">{deskripsi}</p>}
            </>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="col-span-2 rounded-xl bg-slate-50 px-3 py-2"><p className="text-slate-400">Petugas ({item.petugas.length})</p>
              {canKelola ? (
                <div className="mt-1 flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                  {pegawai.map(p => {
                    const on = petugasIds.includes(p.id);
                    return (
                      <button key={p.id} onClick={() => togglePetugas(p.id)} type="button"
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${on ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
                        {on ? '✓ ' : ''}{p.nama}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-1 flex flex-wrap gap-1">
                  {item.petugas.length === 0 && <span className="text-slate-400">Belum di-assign</span>}
                  {item.petugas.map(p => <span key={p.id} className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">{p.nama}</span>)}
                </div>
              )}
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-slate-400">Prioritas</p>
              {canKelola
                ? <select value={prioritas} onChange={e => setPrioritas(e.target.value as TugasPrioritas)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">{(['rendah', 'normal', 'tinggi', 'urgent'] as TugasPrioritas[]).map(p => <option key={p} value={p}>{p}</option>)}</select>
                : <p className="font-semibold text-slate-700 capitalize">{prioritas}</p>}
            </div>
            {canKelola ? (
              <>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-slate-400">Mulai</p><input type="date" value={tanggalMulai} onChange={e => setTanggalMulai(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs" /></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-slate-400">Tenggat</p><input type="date" value={tenggat} onChange={e => setTenggat(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs" /></div>
              </>
            ) : (
              <>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-slate-400">Mulai</p><p className="font-semibold text-slate-700">{fmtDate(tanggalMulai)}</p></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-slate-400">Tenggat</p><p className="font-semibold text-slate-700">{fmtDate(tenggat)}</p></div>
              </>
            )}
          </div>
        </div>

        {/* Update progress */}
        <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/50 p-3">
          <p className="text-sm font-bold text-slate-700">📈 Update Progress</p>
          <div className="mt-2 flex items-center gap-3">
            <input type="range" min={0} max={100} step={5} value={progress} onChange={e => setProgress(+e.target.value)} className="flex-1" disabled={status === 'selesai'} />
            <span className="w-12 text-right text-sm font-bold text-brand-700">{progress}%</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select value={status} onChange={e => setStatus(e.target.value as TugasStatus)} className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm">
              {(['todo', 'proses', 'review', 'selesai'] as TugasStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            {status === 'selesai' && <p className="text-xs font-bold text-emerald-600 self-center">✅ Tandai selesai + laporan</p>}
          </div>
          <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2} placeholder="Catatan progress (opsional)…" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          {status === 'selesai' && (
            <textarea value={laporan} onChange={e => setLaporan(e.target.value)} rows={3} placeholder="✍️ Laporan tugas selesai (wajib) — apa yang dikerjakan & hasilnya…" className="mt-2 w-full rounded-xl border-2 border-emerald-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
          )}
          {err && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
          <div className="mt-3 flex justify-end">
            <button onClick={simpan} disabled={busy} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">{busy ? 'Menyimpan…' : '💾 Simpan Update'}</button>
          </div>
        </div>

        {/* Riwayat progress */}
        <div className="mt-4">
          <p className="text-sm font-bold text-slate-700">🕓 Riwayat Progress</p>
          {riwayat.length === 0 ? (
            <p className="mt-2 rounded-xl bg-slate-50 px-4 py-4 text-center text-xs text-slate-400">Belum ada update progress.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {riwayat.map(r => (
                <li key={r.id} className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs">
                  <p className="font-semibold text-slate-700">{r.userNama || 'User'} → {r.progress}% {r.status ? `• ${STATUS_LABEL[r.status as TugasStatus] || r.status}` : ''}</p>
                  {r.catatan && <p className="mt-0.5 text-slate-500">{r.catatan}</p>}
                  <p className="mt-0.5 text-[10px] text-slate-400">{r.tanggal}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Laporan selesai (read-only display) */}
        {item.status === 'selesai' && item.laporanSelesai && status !== 'selesai' && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
            <p className="font-bold text-emerald-700">✅ Laporan selesai ({item.selesaiAt || ''})</p>
            <p className="mt-1 text-emerald-800">{item.laporanSelesai}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/* Tab 2: Gantt Chart                                             */
/* ═══════════════════════════════════════════════════════════════ */
function GanttTab() {
  const [tasks, setTasks] = useState<TugasItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fStatus, setFStatus] = useState('');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/tugas${fStatus ? `?status=${encodeURIComponent(fStatus)}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : []);
      }
    } catch {} finally { setLoading(false); }
  }, [fStatus]);

  useEffect(() => { refresh(); const t = setInterval(refresh, 30000); return () => clearInterval(t); }, [refresh]);

  const now = todayMidnight();
  const layout = useMemo(() => buildGantt(tasks.map(t => ({
    id: t.id, judul: t.judul, status: t.status, progress: t.progress,
    petugas: (t.petugas || []).map(p => p.nama),
    tanggalMulai: t.tanggalMulai, tenggat: t.tenggat,
    createdAt: t.createdAt,
  })), now), [tasks, now]);

  const BAR_COLOR: Record<string, string> = {
    todo: 'bg-slate-400', proses: 'bg-brand-500', review: 'bg-amber-500', selesai: 'bg-emerald-500',
  };

  // Ticks hari: maksimal ~40 label
  const ticks: { date: Date; left: number }[] = [];
  const step = Math.max(1, Math.ceil(layout.totalDays / 40));
  for (let d = 0; d <= layout.totalDays; d += step) {
    ticks.push({ date: new Date(layout.range.start.getTime() + d * 86400000), left: (d / layout.totalDays) * 100 });
  }
  const todayOffset = (now.getTime() - layout.range.start.getTime()) / 86400000;
  const todayLeft = todayOffset >= 0 && todayOffset <= layout.totalDays ? (todayOffset / layout.totalDays) * 100 : null;

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📊 Gantt Chart Tugas</h2>
          <p className="text-sm text-slate-500">Timeline {shortDate(layout.range.start)} – {shortDate(layout.range.end)} • {tasks.length} tugas</p>
        </div>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm">
          <option value="">Semua status</option>
          {(['todo', 'proses', 'review', 'selesai'] as TugasStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      <div className="mb-2 mt-3 flex flex-wrap gap-2 text-[10px] font-semibold">
        {(['todo', 'proses', 'review', 'selesai'] as TugasStatus[]).map(s => (
          <span key={s} className="flex items-center gap-1 text-slate-500"><span className={`inline-block h-2.5 w-2.5 rounded-sm ${BAR_COLOR[s]}`} />{STATUS_LABEL[s]}</span>
        ))}
        <span className="flex items-center gap-1 text-red-500"><span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-red-500 bg-white" />Lewat tenggat</span>
        <span className="flex items-center gap-1 text-brand-600">│ Hari ini</span>
      </div>

      {loading ? (
        <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">Memuat…</p>
      ) : layout.bars.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">Belum ada tugas. Buat tugas dengan tanggal mulai & tenggat agar muncul di Gantt.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <div className="min-w-[720px]">
            {/* Header tanggal */}
            <div className="flex border-b border-slate-100 bg-brand-50">
              <div className="w-44 shrink-0 px-3 py-2 text-xs font-bold uppercase text-brand-500">Petugas / Tugas</div>
              <div className="relative flex-1">
                <div className="flex h-8 items-center">
                  {ticks.map((tk, i) => (
                    <span key={i} className="absolute top-1 text-[9px] font-semibold text-slate-500" style={{ left: `${Math.min(tk.left, 97)}%` }}>{shortDate(tk.date)}</span>
                  ))}
                </div>
              </div>
            </div>
            {/* Baris */}
            {layout.rows.map((rowLabel, r) => {
              const rowBars = layout.bars.filter(b => b.row === r);
              return (
                <div key={r} className="flex border-b border-slate-50">
                  <div className="w-44 shrink-0 px-3 py-2 text-xs font-semibold text-slate-700">{rowLabel}</div>
                  <div className="relative flex-1">
                    {/* grid hari */}
                    <div className="absolute inset-0 flex">
                      {Array.from({ length: Math.min(layout.totalDays, 60) }).map((_, d) => (
                        <div key={d} className="h-full flex-1 border-r border-slate-50" />
                      ))}
                    </div>
                    {todayLeft !== null && <div className="absolute inset-y-0 z-10 w-px bg-brand-500" style={{ left: `${todayLeft}%` }} />}
                    {/* bars */}
                    {rowBars.map(b => {
                      const leftPct = (b.offsetDays / layout.totalDays) * 100;
                      const widthPct = (b.lengthDays / layout.totalDays) * 100;
                      return (
                        <div key={b.id} title={`${b.judul} — ${shortDate(b.start)} → ${shortDate(b.end)} • progress ${b.progress}%${b.isLate ? ' • LEWAT TENGGAT' : ''}`}
                          className={`absolute top-1 z-10 h-6 overflow-hidden rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm ${BAR_COLOR[b.status] || 'bg-slate-400'} ${b.isLate ? 'ring-2 ring-red-500' : ''}`}
                          style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 1.5)}%` }}>
                          <span className="block truncate">{b.progress}% {b.judul}</span>
                        </div>
                      );
                    })}
                    <div className="h-8" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/* Tab 3: Laporan Tugas Selesai                                   */
/* ═══════════════════════════════════════════════════════════════ */
function LaporanTab() {
  const [tasks, setTasks] = useState<TugasItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/tugas?status=selesai');
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : []);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); const t = setInterval(refresh, 30000); return () => clearInterval(t); }, [refresh]);

  const durasiHari = (t: TugasItem): number | null => {
    if (!t.tanggalMulai || !t.selesaiAt) return null;
    const mulai = new Date(t.tanggalMulai).getTime();
    const selesai = new Date(t.selesaiAt.slice(0, 10)).getTime();
    if (isNaN(mulai) || isNaN(selesai)) return null;
    return Math.max(0, Math.round((selesai - mulai) / 86400000));
  };

  const perPetugas = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tasks) {
      if (!t.petugas || t.petugas.length === 0) {
        m.set('Tanpa petugas', (m.get('Tanpa petugas') || 0) + 1);
        continue;
      }
      for (const p of t.petugas) m.set(p.nama, (m.get(p.nama) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [tasks]);

  const durasiList = tasks.map(durasiHari).filter((d): d is number => d !== null);
  const rataDurasi = durasiList.length ? Math.round(durasiList.reduce((s, d) => s + d, 0) / durasiList.length) : null;

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div>
        <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📝 Laporan Tugas Selesai</h2>
        <p className="text-sm text-slate-500">Semua tugas yang sudah ditandai selesai + laporan pengerjaannya.</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2"><p className="text-xs font-semibold text-emerald-700">Total selesai</p><p className="text-xl font-bold text-slate-800">{tasks.length}</p></div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2"><p className="text-xs font-semibold text-sky-700">Rata-rata durasi</p><p className="text-xl font-bold text-slate-800">{rataDurasi !== null ? `${rataDurasi} hari` : '—'}</p></div>
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 sm:col-span-2"><p className="text-xs font-semibold text-brand-700">Petugas paling produktif</p><p className="text-lg font-bold text-slate-800">{perPetugas.length ? `${perPetugas[0][0]} • ${perPetugas[0][1]} tugas` : '—'}</p></div>
      </div>

      {loading ? (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">Memuat…</p>
      ) : tasks.length === 0 ? (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">Belum ada tugas selesai. Tandai tugas dengan status "Selesai" + laporan untuk melihatnya di sini.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {tasks.map(t => (
            <div key={t.id} className="rounded-xl border border-slate-100 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800">✅ {t.judul}</p>
                  <p className="text-xs text-slate-500">
                    {t.petugas.length === 0 ? 'Tanpa petugas' : t.petugas.map(p => p.nama).join(', ')} • diberikan {t.pemberiNama || '—'} • selesai {t.selesaiAt || ''}
                    {durasiHari(t) !== null && <> • <span className="font-semibold text-slate-600">{durasiHari(t)} hari</span></>}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Selesai</span>
              </div>
              {t.laporanSelesai && (
                <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm text-slate-700">
                  <p className="text-[10px] font-bold uppercase text-emerald-600">✍️ Laporan</p>
                  <p className="mt-0.5 whitespace-pre-wrap">{t.laporanSelesai}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
