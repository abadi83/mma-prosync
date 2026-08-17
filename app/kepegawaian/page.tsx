'use client';

import React, { useState, useMemo, useEffect } from 'react';
import FaceAttendance from '@/app/components/FaceAttendance';
import { useUser, hasRole } from '@/app/hooks/useUser';

/* ── Types ── */
interface Pegawai {
  id: string;
  nama: string;
  nik: string;
  username: string;      // untuk login akun
  jabatan: string;
  departemen: string;
  tanggalMasuk: string;
  status: 'Aktif' | 'Nonaktif' | 'Cuti';
  noHp: string;
  email: string;
  roles: string[];  // multi-role: ['warehouse','logistik','inventory']
}

interface AbsensiRecord {
  id: string;
  pegawaiId: string;
  tanggal: string;
  jamMasuk: string;
  jamKeluar: string;
  status: 'Hadir' | 'Izin' | 'Sakit' | 'Alfa' | 'Terlambat' | 'Cuti';
  keterangan: string;
}

interface KpiRecord {
  id: string;
  pegawaiId: string;
  bulan: string;
  targetKerja: number;
  kualitasKerja: number;
  kedisiplinan: number;
  kerjasama: number;
  totalSkor: number;
  catatan: string;
}

interface IzinRecord {
  id: string;
  pegawaiId: string;
  pegawaiNama: string;
  jenis: 'cuti' | 'izin' | 'sakit';
  tanggalMulai: string;
  tanggalSelesai: string;
  alasan: string;
  status: 'pending' | 'disetujui' | 'ditolak';
  diajukanPada: string;
  diprosesOleh?: string;
  diprosesPada?: string;
}

const IZIN_STORAGE = 'mma_izin_records';

/* ── Gaji / Payroll ── */
interface GajiRecord {
  id: string;
  pegawaiId: string;
  pegawaiNama: string;
  nik: string;
  periode: string;        // YYYY-MM
  gajiPokok: number;
  tunjangan: number;
  potongan: number;
  lembur: number;
  bonus: number;
  totalGaji: number;      // gajiPokok + tunjangan + lembur + bonus - potongan
  status: 'draft' | 'dibayar';
  tanggalBayar: string;
  catatan: string;
}
const GAJI_STORAGE = 'mma_gaji_records';

/* ── Role Labels ── */
const ROLE_LABELS: Record<string, string> = {
  admin: '👑 Admin',
  hr: '👥 HR',
  finance: '💰 Finance',
  purchasing: '📦 Purchasing',
  warehouse: '🏭 Warehouse',
  logistik: '🚛 Logistik',
  inventory: '📋 Inventory',
  sales: '🛒 Sales',
  pegawai: '👤 Pegawai',
};

/* ── Tabs ── */
type Tab = 'daftar' | 'absensi' | 'rekap' | 'kpi' | 'face' | 'izin' | 'approval' | 'gaji';

const TABS_ADMIN: { key: Tab; label: string; icon: string }[] = [
  { key: 'daftar', label: 'Daftar Pegawai', icon: '👥' },
  { key: 'absensi', label: 'Absensi', icon: '📋' },
  { key: 'rekap', label: 'Rekap Absensi', icon: '📊' },
  { key: 'gaji', label: 'Gaji / Payroll', icon: '💰' },
  { key: 'approval', label: 'Approval Izin', icon: '✅' },
  { key: 'kpi', label: 'KPI Pegawai', icon: '🎯' },
  { key: 'face', label: 'Face Absensi', icon: '🤳' },
];

const TABS_PEGAWAI: { key: Tab; label: string; icon: string }[] = [
  { key: 'absensi', label: 'Absensi Saya', icon: '📋' },
  { key: 'izin', label: 'Izin / Cuti', icon: '📝' },
  { key: 'face', label: 'Face Absensi', icon: '🤳' },
  { key: 'kpi', label: 'KPI Saya', icon: '🎯' },
];

/* ── Mock Data ── */
const MOCK_PEGAWAI: Pegawai[] = [
  { id: 'pg-1', nama: 'Andi Pratama', nik: 'MMA-001', username: 'andi', jabatan: 'Kepala Gudang', departemen: 'Warehouse', tanggalMasuk: '2024-01-15', status: 'Aktif', noHp: '0812-3456-7890', email: 'andi@mma.id', roles: ['admin', 'hr', 'warehouse', 'logistik', 'inventory'] },
  { id: 'pg-2', nama: 'Siti Nurhaliza', nik: 'MMA-002', username: 'siti', jabatan: 'Admin Penjualan', departemen: 'Sales', tanggalMasuk: '2024-02-01', status: 'Aktif', noHp: '0812-3456-7891', email: 'siti@mma.id', roles: ['sales', 'pegawai'] },
  { id: 'pg-3', nama: 'Budi Santoso', nik: 'MMA-003', username: 'budi', jabatan: 'Staff Picking & Logistik', departemen: 'Warehouse', tanggalMasuk: '2024-03-10', status: 'Aktif', noHp: '0812-3456-7892', email: 'budi@mma.id', roles: ['warehouse', 'logistik', 'pegawai'] },
  { id: 'pg-4', nama: 'Rina Marlina', nik: 'MMA-004', username: 'rina', jabatan: 'Staff Packing', departemen: 'Warehouse', tanggalMasuk: '2024-03-15', status: 'Cuti', noHp: '0812-3456-7893', email: 'rina@mma.id', roles: ['warehouse', 'pegawai'] },
  { id: 'pg-5', nama: 'Doni Kusuma', nik: 'MMA-005', username: 'doni', jabatan: 'Driver & Logistik', departemen: 'Logistik', tanggalMasuk: '2024-04-01', status: 'Aktif', noHp: '0812-3456-7894', email: 'doni@mma.id', roles: ['logistik', 'pegawai'] },
  { id: 'pg-6', nama: 'Ayu Lestari', nik: 'MMA-006', username: 'ayu', jabatan: 'Kasir', departemen: 'Sales', tanggalMasuk: '2024-05-20', status: 'Aktif', noHp: '0812-3456-7895', email: 'ayu@mma.id', roles: ['sales', 'pegawai'] },
  { id: 'pg-7', nama: 'Eko Prasetyo', nik: 'MMA-007', username: 'eko', jabatan: 'Staff QC & Inventory', departemen: 'Warehouse', tanggalMasuk: '2024-06-01', status: 'Nonaktif', noHp: '0812-3456-7896', email: 'eko@mma.id', roles: ['warehouse', 'inventory'] },
  { id: 'pg-8', nama: 'Dewi Sartika', nik: 'MMA-008', username: 'dewi', jabatan: 'Admin Keuangan', departemen: 'Finance', tanggalMasuk: '2024-06-15', status: 'Aktif', noHp: '0812-3456-7897', email: 'dewi@mma.id', roles: ['finance', 'purchasing', 'pegawai'] },
];

function generateAbsensi(pegawai: Pegawai[]): AbsensiRecord[] {
  const today = new Date();
  const records: AbsensiRecord[] = [];
  for (const p of pegawai) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      if (date.getDay() === 0) continue; // skip Minggu
      const tgl = date.toISOString().slice(0, 10);
      const statuses: AbsensiRecord['status'][] = ['Hadir', 'Hadir', 'Hadir', 'Hadir', 'Hadir', 'Terlambat', 'Izin', 'Sakit'];
      const status = p.status !== 'Aktif' ? 'Cuti' : statuses[Math.floor(Math.random() * statuses.length)];
      records.push({
        id: `abs-${p.id}-${tgl}`,
        pegawaiId: p.id,
        tanggal: tgl,
        jamMasuk: status === 'Hadir' ? `0${7 + Math.floor(Math.random() * 2)}:${String(Math.floor(Math.random() * 30)).padStart(2, '0')}` : status === 'Terlambat' ? `0${8 + Math.floor(Math.random() * 2)}:${String(Math.floor(Math.random() * 30)).padStart(2, '0')}` : '-',
        jamKeluar: status === 'Hadir' || status === 'Terlambat' ? `${16 + Math.floor(Math.random() * 2)}:${String(Math.floor(Math.random() * 30)).padStart(2, '0')}` : '-',
        status,
        keterangan: status === 'Sakit' ? 'Surat dokter' : status === 'Izin' ? 'Keperluan keluarga' : status === 'Cuti' ? 'Cuti tahunan' : '',
      });
    }
  }
  return records;
}

function generateKpi(pegawai: Pegawai[]): KpiRecord[] {
  const now = new Date();
  const months = [
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`,
    `${now.getFullYear()}-${String(now.getMonth() - 1).padStart(2, '0')}`,
  ].filter(m => /^\d{4}-\d{2}$/.test(m));
  const records: KpiRecord[] = [];
  for (const p of pegawai.filter(p => p.status === 'Aktif')) {
    for (const bln of months) {
      const t = 60 + Math.floor(Math.random() * 35);
      const k = 60 + Math.floor(Math.random() * 35);
      const d = 60 + Math.floor(Math.random() * 35);
      const s = 60 + Math.floor(Math.random() * 35);
      records.push({
        id: `kpi-${p.id}-${bln}`,
        pegawaiId: p.id,
        bulan: bln,
        targetKerja: t,
        kualitasKerja: k,
        kedisiplinan: d,
        kerjasama: s,
        totalSkor: Math.round((t + k + d + s) / 4),
        catatan: '',
      });
    }
  }
  return records;
}

const STATUS_ABSEN: Record<string, { color: string; label: string }> = {
  Hadir: { color: 'bg-emerald-100 text-emerald-700', label: 'Hadir' },
  Terlambat: { color: 'bg-amber-100 text-amber-700', label: 'Terlambat' },
  Izin: { color: 'bg-blue-100 text-blue-700', label: 'Izin' },
  Sakit: { color: 'bg-purple-100 text-purple-700', label: 'Sakit' },
  Alfa: { color: 'bg-red-100 text-red-700', label: 'Alfa' },
  Cuti: { color: 'bg-slate-100 text-slate-600', label: 'Cuti' },
};

const STATUS_PEGAWAI: Record<string, string> = {
  Aktif: 'bg-emerald-100 text-emerald-700',
  Nonaktif: 'bg-red-100 text-red-700',
  Cuti: 'bg-amber-100 text-amber-700',
};

/* ═══════════════════════════════════════════════════════════════════ */
export default function KepegawaianPage() {
  const user = useUser();
  const isAdmin = hasRole(user, 'admin', 'hr');
  const [tab, setTab] = useState<Tab>(isAdmin ? 'daftar' : 'absensi');
  const [pegawai, setPegawai] = useState<Pegawai[]>(() => {
    // Load dari localStorage, fallback ke MOCK
    if (typeof window === 'undefined') return MOCK_PEGAWAI;
    try {
      const saved = localStorage.getItem('mma_pegawai_data');
      return saved ? JSON.parse(saved) : MOCK_PEGAWAI;
    } catch { return MOCK_PEGAWAI; }
  });

  // Simpan ke localStorage setiap kali pegawai berubah
  useEffect(() => { try { localStorage.setItem('mma_pegawai_data', JSON.stringify(pegawai)); window.dispatchEvent(new Event('refresh-akun')); } catch {} }, [pegawai]);

  // ══ Sync 2 arah dengan PostgreSQL (login membaca dari DB) ══
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/pegawai');
        if (!res.ok) return;
        const dbList = await res.json();
        if (!Array.isArray(dbList) || cancelled) return;

        // 1) Tarik pegawai dari DB yang belum ada di lokal
        setPegawai(prev => {
          const merged = [...prev];
          const existingIds = new Set(prev.map(p => p.id));
          const existingNiks = new Set(prev.map(p => p.nik));
          for (const dbP of dbList) {
            const mapped: Pegawai = {
              id: dbP.id,
              nama: dbP.nama,
              nik: dbP.nik || '',
              username: dbP.username || '',
              jabatan: dbP.jabatan || '',
              departemen: dbP.departemen || '',
              tanggalMasuk: dbP.tanggal_masuk ? String(dbP.tanggal_masuk).slice(0, 10) : '',
              status: (dbP.status as Pegawai['status']) || 'Aktif',
              noHp: dbP.no_hp || '',
              email: dbP.email || '',
              roles: Array.isArray(dbP.roles) ? dbP.roles : ['pegawai'],
            };
            if (!existingIds.has(mapped.id) && !existingNiks.has(mapped.nik)) merged.push(mapped);
          }
          return merged;
        });

        // 2) Push pegawai lokal (id sementara pg-*) yang belum ada di DB
        const dbNiks = new Set(dbList.map((p: any) => p.nik));
        for (const p of pegawai) {
          if (p.id.startsWith('pg-') && !dbNiks.has(p.nik)) {
            fetch('/api/pegawai', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nama: p.nama, nik: p.nik, username: p.username, jabatan: p.jabatan,
                departemen: p.departemen, tanggalMasuk: p.tanggalMasuk, status: p.status,
                noHp: p.noHp, email: p.email, roles: p.roles,
              }),
            }).catch(() => {});
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);
  const [absensi, setAbsensi] = useState<AbsensiRecord[]>(() => generateAbsensi(MOCK_PEGAWAI));
  const [kpi] = useState<KpiRecord[]>(() => generateKpi(MOCK_PEGAWAI));
  const [izinList, setIzinList] = useState<IzinRecord[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const r = localStorage.getItem(IZIN_STORAGE); return r ? JSON.parse(r) : []; } catch { return []; }
  });

  // Simpan izinList ke localStorage
  useEffect(() => { try { localStorage.setItem(IZIN_STORAGE, JSON.stringify(izinList)); } catch {} }, [izinList]);

  // Filter data untuk pegawai biasa
  const myPegawai = useMemo(() => {
    if (isAdmin) return pegawai;
    if (!user.pegawaiId) return [];
    return pegawai.filter(p =>
      p.nama.toLowerCase() === user.nama.toLowerCase() ||
      p.nik === user.pegawaiId ||
      p.id === user.pegawaiId
    );
  }, [isAdmin, user.pegawaiId, user.nama, pegawai]);

  // ── Auto Alfa: hari kerja tanpa absensi + tanpa izin disetujui = Alfa ──
  const absensiWithAlfa = useMemo(() => {
    const today = new Date();
    const result = [...absensi];
    const existingDates = new Set(absensi.map(a => a.pegawaiId + '|' + a.tanggal));

    // Cek 30 hari terakhir untuk setiap pegawai aktif
    for (const p of pegawai.filter(p => p.status === 'Aktif')) {
      for (let d = 30; d >= 0; d--) {
        const date = new Date(today);
        date.setDate(date.getDate() - d);
        if (date.getDay() === 0) continue; // skip Minggu
        const tgl = date.toISOString().slice(0, 10);
        const key = p.id + '|' + tgl;
        if (existingDates.has(key)) continue; // sudah ada record

        // Cek apakah ada izin disetujui untuk tanggal ini
        const hasIzin = izinList.some(iz =>
          iz.pegawaiId === p.id &&
          iz.status === 'disetujui' &&
          tgl >= iz.tanggalMulai && tgl <= iz.tanggalSelesai
        );
        if (hasIzin) continue;

        // Tidak ada absensi & tidak ada izin → Alfa
        result.push({
          id: `alfa-${p.id}-${tgl}`,
          pegawaiId: p.id,
          tanggal: tgl,
          jamMasuk: '-',
          jamKeluar: '-',
          status: 'Alfa' as const,
          keterangan: 'Tanpa keterangan',
        });
      }
    }
    return result;
  }, [absensi, pegawai, izinList]);

  const myAbsensi = useMemo(() => {
    const data = isAdmin ? absensiWithAlfa : absensiWithAlfa.filter(a => {
      return myPegawai.some(mp => mp.id === a.pegawaiId);
    });
    return data;
  }, [isAdmin, absensiWithAlfa, myPegawai]);

  const myKpi = useMemo(() => {
    if (isAdmin) return kpi;
    const myIds = myPegawai.map(p => p.id);
    return kpi.filter(k => myIds.includes(k.pegawaiId));
  }, [isAdmin, kpi, myPegawai]);

  const myIzin = useMemo(() => {
    if (isAdmin) return izinList;
    const myIds = myPegawai.map(p => p.id);
    return izinList.filter(iz => myIds.includes(iz.pegawaiId));
  }, [isAdmin, izinList, myPegawai]);

  // Tab yang terlihat
  const visibleTabs = isAdmin ? TABS_ADMIN : TABS_PEGAWAI;

  // Hitung pending approval
  const pendingApproval = izinList.filter(iz => iz.status === 'pending').length;

  const headerTitle = isAdmin ? 'Manajemen Pegawai' : 'Dashboard Pegawai';
  const headerDesc = isAdmin
    ? 'Kelola data pegawai, absensi, approval izin/cuti, rekap kehadiran, dan penilaian KPI.'
    : `Selamat datang, ${user.nama}! Absensi, ajukan izin/cuti, dan lihat KPI Anda.`;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-3xl bg-gradient-to-br from-purple-700 via-purple-500 to-pink-400 p-5 text-white shadow-lg sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-purple-100 sm:text-sm">
          {isAdmin ? 'HR / Kepegawaian' : 'Pegawai'}
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{headerTitle}</h1>
        <p className="mt-1 text-sm text-purple-100 sm:text-base">{headerDesc}</p>
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm" role="tablist">
        {visibleTabs.map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:px-5 sm:text-sm ${tab === t.key ? 'bg-purple-500 text-white shadow' : 'text-slate-600 hover:bg-purple-50 hover:text-purple-700'}`}>
            <span className="text-base sm:text-lg">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
            {t.key === 'approval' && pendingApproval > 0 && (
              <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{pendingApproval}</span>
            )}
          </button>
        ))}
      </nav>

      <section className="card-blue">
        {tab === 'daftar' && isAdmin && <DaftarPegawai pegawai={pegawai} setPegawai={setPegawai} />}
        {tab === 'absensi' && <AbsensiHarian pegawai={isAdmin ? pegawai : myPegawai} absensi={myAbsensi} isAdmin={isAdmin} />}
        {tab === 'rekap' && isAdmin && <RekapAbsensi pegawai={pegawai} absensi={absensiWithAlfa} />}
        {tab === 'approval' && isAdmin && <ApprovalIzin izinList={izinList} setIzinList={setIzinList} pegawai={pegawai} />}
        {tab === 'gaji' && isAdmin && <GajiTab pegawai={pegawai} />}
        {tab === 'izin' && !isAdmin && <FormIzin pegawai={myPegawai[0]} izinList={myIzin} setIzinList={setIzinList} />}
        {tab === 'kpi' && <KpiPegawai pegawai={isAdmin ? pegawai : myPegawai} kpi={isAdmin ? kpi : myKpi} />}
        {tab === 'face' && <FaceAttendance pegawai={(isAdmin ? pegawai : myPegawai).filter(p => p.status === 'Aktif').map(p => ({ id: p.id, nama: p.nama, nik: p.nik }))} isAdmin={isAdmin} />}
      </section>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* DAFTAR PEGAWAI                                                    */
/* ═══════════════════════════════════════════════════════════════════ */
function DaftarPegawai({ pegawai, setPegawai }: { pegawai: Pegawai[]; setPegawai: React.Dispatch<React.SetStateAction<Pegawai[]>> }) {
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('semua');
  const [filterStatus, setFilterStatus] = useState('semua');
  const [selected, setSelected] = useState<Pegawai | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [savedMsg, setSavedMsg] = useState(false);
  const [resetPwId, setResetPwId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editPegawaiId, setEditPegawaiId] = useState<string | null>(null);
  const [pegawaiForm, setPegawaiForm] = useState({ nama: '', nik: '', username: '', jabatan: '', departemen: 'Warehouse', noHp: '', email: '', status: 'Aktif' as Pegawai['status'], roles: ['pegawai'] as string[], tanggalMasuk: new Date().toISOString().slice(0, 10) });
  const [formErr, setFormErr] = useState('');

  // All available roles
  const ALL_ROLES = ['admin', 'hr', 'finance', 'purchasing', 'warehouse', 'logistik', 'inventory', 'sales', 'pegawai'];

  // Reset password handler
  const handleResetPassword = () => {
    setPwErr('');
    if (!newPassword || newPassword.length < 4) {
      setPwErr('Password minimal 4 karakter.');
      return;
    }
    // Ambil data pegawai untuk payload PUT (wajib ada nama & nik)
    const target = pegawai.find(p => p.id === resetPwId);
    if (!target) { setPwErr('Pegawai tidak ditemukan.'); return; }

    // 1) Simpan di localStorage (fallback / kompatibilitas)
    try {
      const existing = JSON.parse(localStorage.getItem('mma_pegawai_passwords') || '{}');
      existing[resetPwId!] = newPassword;
      localStorage.setItem('mma_pegawai_passwords', JSON.stringify(existing));
    } catch {}

    // 2) Update ke PostgreSQL via API (sumber login sebenarnya)
    fetch('/api/pegawai', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: target.id,
        nama: target.nama,
        nik: target.nik,
        username: target.username,
        jabatan: target.jabatan,
        departemen: target.departemen,
        tanggalMasuk: target.tanggalMasuk,
        status: target.status,
        noHp: target.noHp,
        email: target.email,
        roles: target.roles,
        password: newPassword,
      }),
    })
      .then(r => {
        if (!r.ok) { setPwErr('Gagal menyimpan ke server.'); return; }
        setPwSuccess(true);
        setTimeout(() => { setResetPwId(null); setNewPassword(''); setPwSuccess(false); }, 2000);
      })
      .catch(() => setPwErr('Gagal menyimpan ke server.'));
  };

  const departments = ['semua', ...Array.from(new Set(pegawai.map(p => p.departemen)))];
  const filtered = pegawai.filter(p => {
    if (filterDept !== 'semua' && p.departemen !== filterDept) return false;
    if (filterStatus !== 'semua' && p.status !== filterStatus) return false;
    if (search && !p.nama.toLowerCase().includes(search.toLowerCase()) && !p.nik.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalAktif = pegawai.filter(p => p.status === 'Aktif').length;
  const totalNonaktif = pegawai.filter(p => p.status === 'Nonaktif').length;
  const totalCuti = pegawai.filter(p => p.status === 'Cuti').length;

  const openAddPegawai = () => {
    setPegawaiForm({ nama: '', nik: `MMA-${String(pegawai.length + 1).padStart(3, '0')}`, username: '', jabatan: '', departemen: 'Warehouse', noHp: '', email: '', status: 'Aktif', roles: ['pegawai'], tanggalMasuk: new Date().toISOString().slice(0, 10) });
    setFormErr(''); setShowAddForm(true); setEditPegawaiId(null);
  };
  const openEditPegawai = (p: Pegawai) => {
    setPegawaiForm({ nama: p.nama, nik: p.nik, username: p.username || '', jabatan: p.jabatan, departemen: p.departemen, noHp: p.noHp, email: p.email, status: p.status, roles: [...p.roles], tanggalMasuk: p.tanggalMasuk });
    setFormErr(''); setEditPegawaiId(p.id); setShowAddForm(true);
  };
  const savePegawai = () => {
    if (!pegawaiForm.nama || !pegawaiForm.nik) { setFormErr('Nama & NIK wajib diisi.'); return; }
    const payload = {
      nama: pegawaiForm.nama.trim(),
      nik: pegawaiForm.nik.trim(),
      username: pegawaiForm.username.trim(),
      jabatan: pegawaiForm.jabatan,
      departemen: pegawaiForm.departemen,
      tanggalMasuk: pegawaiForm.tanggalMasuk,
      status: pegawaiForm.status,
      noHp: pegawaiForm.noHp,
      email: pegawaiForm.email,
      roles: pegawaiForm.roles.length > 0 ? pegawaiForm.roles : ['pegawai'],
    };

    if (editPegawaiId) {
      setPegawai(prev => prev.map(p => p.id === editPegawaiId ? { ...p, ...pegawaiForm } : p));
      // Sync ke PostgreSQL (login membaca dari DB)
      fetch('/api/pegawai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editPegawaiId, ...payload }),
      }).catch(() => {});
    } else {
      setPegawai(prev => [{ id: `pg-${Date.now()}`, ...pegawaiForm }, ...prev]);
      // Sync ke PostgreSQL (login membaca dari DB)
      fetch('/api/pegawai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async r => {
        const created = await r.json().catch(() => null);
        if (created?.id) {
          // Pakai id asli dari DB agar konsisten (password, login, dll)
          setPegawai(prev => prev.map(p => p.id.startsWith('pg-') && p.nama === created.nama && p.nik === created.nik ? { ...p, id: created.id } : p));
        }
      }).catch(() => {});
    }
    setShowAddForm(false);
  };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-400" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">👥 Daftar Pegawai</h2>
      <div className="flex items-center justify-between mt-1">
        <p className="text-sm text-slate-500">{pegawai.length} pegawai terdaftar</p>
        <button onClick={openAddPegawai} className="rounded-xl bg-purple-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-purple-700">+ Tambah Pegawai</button>
      </div>

      {/* Stats mini */}
      <div className="mt-4 grid grid-cols-4 gap-3">
        <div className="rounded-xl bg-purple-50 p-3 text-center">
          <p className="text-2xl font-bold text-purple-600">{pegawai.length}</p>
          <p className="text-xs text-purple-500">Total</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{totalAktif}</p>
          <p className="text-xs text-emerald-500">Aktif</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{totalCuti}</p>
          <p className="text-xs text-amber-500">Cuti</p>
        </div>
        <div className="rounded-xl bg-red-50 p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{totalNonaktif}</p>
          <p className="text-xs text-red-500">Nonaktif</p>
        </div>
      </div>

      {/* Filter */}
      <div className="mt-4 flex flex-wrap gap-2">
        <input type="text" placeholder="🔍 Cari nama / NIK..." value={search} onChange={e => setSearch(e.target.value)}
          className="rounded-xl border px-3 py-1.5 text-xs text-slate-600 focus:border-purple-500 focus:outline-none w-48" />
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="rounded-xl border bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
          {departments.map(d => <option key={d} value={d}>{d === 'semua' ? '🏢 Semua Dept' : d}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="rounded-xl border bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
          <option value="semua">📋 Semua Status</option>
          <option value="Aktif">✅ Aktif</option>
          <option value="Cuti">🏖️ Cuti</option>
          <option value="Nonaktif">❌ Nonaktif</option>
        </select>
      </div>

      {/* Tabel */}
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-xs">
          <thead><tr className="bg-purple-50 text-xs uppercase text-purple-500">
            {['NIK','Nama','Jabatan','Departemen','Tgl Masuk','Status','Kontak'].map(c => <th key={c} className="px-3 py-3 font-semibold whitespace-nowrap">{c}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {filtered.map(p => (
              <tr key={p.id} className="cursor-pointer hover:bg-purple-50/30 transition" onClick={() => setSelected(selected?.id === p.id ? null : p)}>
                <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">{p.nik}</td>
                <td className="px-3 py-2.5 font-semibold text-slate-700">{p.nama}</td>
                <td className="px-3 py-2.5 text-slate-600">
                  {p.jabatan}
                  {p.roles && p.roles.length > 1 && (
                    <span className="ml-1 text-[10px] text-purple-500">({p.roles.length} role)</span>
                  )}
                </td>
                <td className="px-3 py-2.5"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{p.departemen}</span></td>
                <td className="px-3 py-2.5 text-slate-500">{p.tanggalMasuk}</td>
                <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_PEGAWAI[p.status]}`}>{p.status}</span></td>
                <td className="px-3 py-2.5 text-[10px] text-slate-400">{p.noHp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail pegawai */}
      {selected && (
        <div className="mt-4 rounded-2xl border-2 border-purple-200 bg-purple-50 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-purple-800">{selected.nama}</h3>
            <div className="flex gap-2">
              {!editMode && (
                <>
                  <button onClick={() => openEditPegawai(selected)}
                    className="rounded-lg bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200">✏️ Edit</button>
                  <button
                    onClick={() => { setEditMode(true); setEditRoles([...selected.roles]); }}
                    className="rounded-lg bg-purple-200 px-3 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-300"
                  >
                    ✏️ Edit Role
                  </button>
                  <button
                    onClick={() => { setResetPwId(selected.id); setNewPassword(''); setPwErr(''); setPwSuccess(false); }}
                    className="rounded-lg bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200"
                    title="Reset password pegawai"
                  >
                    🔒 Reset PW
                  </button>
                  <button
                    onClick={() => setDeleteId(selected.id)}
                    className="rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-200"
                    title="Hapus pegawai"
                  >
                    🗑️ Hapus
                  </button>
                </>
              )}
              <button onClick={() => { setSelected(null); setEditMode(false); }} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><span className="text-slate-400 text-xs">NIK</span><p className="font-semibold">{selected.nik}</p></div>
            <div><span className="text-slate-400 text-xs">Username</span><p className="font-mono text-xs text-purple-600">{selected.username || '-'}</p></div>
            <div><span className="text-slate-400 text-xs">Jabatan</span><p className="font-semibold">{selected.jabatan}</p></div>
            <div><span className="text-slate-400 text-xs">Departemen</span><p className="font-semibold">{selected.departemen}</p></div>
            <div><span className="text-slate-400 text-xs">Status</span><p className={`font-semibold ${selected.status === 'Aktif' ? 'text-emerald-600' : selected.status === 'Cuti' ? 'text-amber-600' : 'text-red-600'}`}>{selected.status}</p></div>
            <div><span className="text-slate-400 text-xs">Tanggal Masuk</span><p>{selected.tanggalMasuk}</p></div>
            <div><span className="text-slate-400 text-xs">No. HP</span><p>{selected.noHp}</p></div>
            <div><span className="text-slate-400 text-xs">Email</span><p>{selected.email}</p></div>
          </div>

          {/* Role badges / Edit */}
          <div className="mt-3 pt-3 border-t border-purple-200">
            {editMode ? (
              <div>
                <span className="text-xs font-semibold text-slate-600">Edit Hak Akses:</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ALL_ROLES.map(role => {
                    const checked = editRoles.includes(role);
                    return (
                      <label
                        key={role}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer transition border ${
                          checked
                            ? 'bg-purple-200 border-purple-400 text-purple-800'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-purple-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setEditRoles(prev =>
                              prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
                            );
                          }}
                          className="rounded accent-purple-500 w-3.5 h-3.5"
                        />
                        {ROLE_LABELS[role] || role}
                      </label>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      // Save roles
                      setPegawai(prev => prev.map(p =>
                        p.id === selected.id ? { ...p, roles: editRoles } : p
                      ));
                      setSelected(prev => prev ? { ...prev, roles: editRoles } : null);
                      setEditMode(false);
                      setSavedMsg(true);
                      setTimeout(() => setSavedMsg(false), 2000);
                    }}
                    className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                  >
                    💾 Simpan Role
                  </button>
                  <button
                    onClick={() => { setEditMode(false); }}
                    className="rounded-lg bg-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-300"
                  >
                    Batal
                  </button>
                </div>
                {savedMsg && (
                  <p className="mt-2 text-xs text-emerald-600">✅ Role berhasil disimpan!</p>
                )}
              </div>
            ) : (
              <div>
                <span className="text-xs text-slate-400">Hak Akses:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selected.roles.map(r => (
                    <span key={r} className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">{ROLE_LABELS[r] || r}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Reset Password */}
      {resetPwId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setResetPwId(null)}>
          <div className="w-80 rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="text-lg font-bold text-slate-800">🔒 Reset Password</p>
            <p className="mt-1 text-sm text-slate-500">
              {selected?.nama} ({selected?.nik})
            </p>
            {pwSuccess ? (
              <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-center">
                <p className="text-emerald-700 font-semibold">✅ Password berhasil direset!</p>
                <p className="text-xs text-emerald-500 mt-1">Password baru: <strong className="font-mono">{newPassword}</strong></p>
                <button onClick={() => { setResetPwId(null); setNewPassword(''); setPwSuccess(false); }}
                  className="mt-3 rounded-xl bg-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-700">Tutup</button>
              </div>
            ) : (
              <>
                <div className="mt-3 space-y-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-slate-600">Password Baru</span>
                    <input
                      type="text"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Minimal 4 karakter"
                      className="w-full rounded-xl border px-3 py-2 text-sm font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </label>
                  {pwErr && <p className="text-sm text-red-500">{pwErr}</p>}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => { setResetPwId(null); setNewPassword(''); }}
                    className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button>
                  <button onClick={handleResetPassword}
                    className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">💾 Simpan</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal Tambah/Edit Pegawai */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 overflow-y-auto py-8">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl mx-4">
            <p className="text-lg font-bold text-slate-800">{editPegawaiId ? '✏️ Edit Pegawai' : '➕ Tambah Pegawai'}</p>
            {formErr && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formErr}</p>}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">NIK *</span><input value={pegawaiForm.nik} onChange={e => setPegawaiForm({ ...pegawaiForm, nik: e.target.value })} className="rounded-xl border px-2 py-1.5 text-sm focus:border-purple-500 focus:outline-none" /></label>
              <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Nama *</span><input value={pegawaiForm.nama} onChange={e => setPegawaiForm({ ...pegawaiForm, nama: e.target.value })} className="rounded-xl border px-2 py-1.5 text-sm focus:border-purple-500 focus:outline-none" /></label>
              <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Username</span><input value={pegawaiForm.username} onChange={e => setPegawaiForm({ ...pegawaiForm, username: e.target.value })} className="rounded-xl border px-2 py-1.5 text-sm focus:border-purple-500 focus:outline-none" /></label>
              <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Jabatan</span><input value={pegawaiForm.jabatan} onChange={e => setPegawaiForm({ ...pegawaiForm, jabatan: e.target.value })} className="rounded-xl border px-2 py-1.5 text-sm focus:border-purple-500 focus:outline-none" /></label>
              <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Departemen</span><select value={pegawaiForm.departemen} onChange={e => setPegawaiForm({ ...pegawaiForm, departemen: e.target.value })} className="rounded-xl border px-2 py-1.5 text-sm bg-white focus:border-purple-500 focus:outline-none"><option>Warehouse</option><option>Sales</option><option>Finance</option><option>Logistik</option><option>HR</option><option>Purchasing</option></select></label>
              <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">No HP</span><input value={pegawaiForm.noHp} onChange={e => setPegawaiForm({ ...pegawaiForm, noHp: e.target.value })} className="rounded-xl border px-2 py-1.5 text-sm focus:border-purple-500 focus:outline-none" /></label>
              <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Email</span><input value={pegawaiForm.email} onChange={e => setPegawaiForm({ ...pegawaiForm, email: e.target.value })} className="rounded-xl border px-2 py-1.5 text-sm focus:border-purple-500 focus:outline-none" /></label>
              <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Tanggal Masuk</span><input type="date" value={pegawaiForm.tanggalMasuk} onChange={e => setPegawaiForm({ ...pegawaiForm, tanggalMasuk: e.target.value })} className="rounded-xl border px-2 py-1.5 text-sm focus:border-purple-500 focus:outline-none" /></label>
              <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Status</span><select value={pegawaiForm.status} onChange={e => setPegawaiForm({ ...pegawaiForm, status: e.target.value as Pegawai['status'] })} className="rounded-xl border px-2 py-1.5 text-sm bg-white focus:border-purple-500 focus:outline-none"><option>Aktif</option><option>Cuti</option><option>Nonaktif</option></select></label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowAddForm(false)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button>
              <button onClick={savePegawai} className="rounded-xl bg-purple-500 px-4 py-2 text-sm font-semibold text-white">{editPegawaiId ? 'Update' : 'Simpan'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-80 rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-lg font-bold text-slate-800">🗑️ Hapus Pegawai</p>
            <p className="mt-2 text-sm text-slate-600">
              Yakin hapus <strong>{pegawai.find(p => p.id === deleteId)?.nama}</strong>?
            </p>
            <p className="text-xs text-slate-400 mt-1">Data absensi & KPI pegawai ini akan tetap tersimpan.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button>
              <button onClick={() => {
                // Hitung array baru tanpa pegawai yang dihapus
                const next = pegawai.filter(p => p.id !== deleteId);
                setPegawai(next);
                if (selected?.id === deleteId) setSelected(null);
                setDeleteId(null);
                // ⚠️ Push langsung ke server: cegah "resurrect" oleh sync union
                // (tanpa ini, data hapus akan balik dari server dalam ±5 detik)
                try {
                  localStorage.setItem('mma_pegawai_data', JSON.stringify(next));
                  fetch('/api/data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'mma_pegawai_data', data: next }),
                  }).catch(() => {});
                } catch {}
                // Hapus juga dari PostgreSQL (login membaca dari DB)
                fetch(`/api/pegawai?id=${deleteId}`, { method: 'DELETE' }).catch(() => {});
              }}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* ABSENSI HARIAN                                                    */
/* ═══════════════════════════════════════════════════════════════════ */
function AbsensiHarian({ pegawai, absensi, isAdmin = true }: { pegawai: Pegawai[]; absensi: AbsensiRecord[]; isAdmin?: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const [tgl, setTgl] = useState(today);
  const [form, setForm] = useState({ pegawaiId: pegawai[0]?.id || '', status: 'Hadir' as AbsensiRecord['status'], jamMasuk: '08:00', jamKeluar: '17:00', keterangan: '' });
  const [localAbsen, setLocalAbsen] = useState<AbsensiRecord[]>([]);
  const [success, setSuccess] = useState(false);

  const allAbsen = [...absensi, ...localAbsen];
  const todayAbsen = allAbsen.filter(a => a.tanggal === tgl);
  const pegawaiMap = new Map(pegawai.map(p => [p.id, p]));

  const rekapHariIni = {
    hadir: todayAbsen.filter(a => a.status === 'Hadir').length,
    terlambat: todayAbsen.filter(a => a.status === 'Terlambat').length,
    izin: todayAbsen.filter(a => a.status === 'Izin').length,
    sakit: todayAbsen.filter(a => a.status === 'Sakit').length,
    alfa: todayAbsen.filter(a => a.status === 'Alfa').length,
  };

  const save = () => {
    if (!form.pegawaiId) return;
    const p = pegawaiMap.get(form.pegawaiId);
    if (!p) return;
    setLocalAbsen(prev => [{
      id: `local-${Date.now()}`,
      pegawaiId: form.pegawaiId,
      tanggal: tgl,
      jamMasuk: form.jamMasuk,
      jamKeluar: form.jamKeluar,
      status: form.status,
      keterangan: form.keterangan,
    }, ...prev]);
    setForm({ pegawaiId: pegawai[0]?.id || '', status: 'Hadir', jamMasuk: '08:00', jamKeluar: '17:00', keterangan: '' });
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-400" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📋 Absensi Harian</h2>
          <p className="mt-1 text-sm text-slate-500">Catat kehadiran pegawai per tanggal.</p>
        </div>
        <input type="date" value={tgl} onChange={e => setTgl(e.target.value)}
          className="rounded-xl border px-3 py-1.5 text-xs font-semibold text-slate-600 focus:border-purple-500 focus:outline-none" />
      </div>

      {success && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">✅ Absensi berhasil dicatat.</p>}

      {/* Rekap hari ini */}
      <div className="mt-4 grid grid-cols-5 gap-2">
        <div className="rounded-xl bg-emerald-50 p-2 text-center"><p className="text-lg font-bold text-emerald-600">{rekapHariIni.hadir}</p><p className="text-[10px] text-emerald-500">Hadir</p></div>
        <div className="rounded-xl bg-amber-50 p-2 text-center"><p className="text-lg font-bold text-amber-600">{rekapHariIni.terlambat}</p><p className="text-[10px] text-amber-500">Terlambat</p></div>
        <div className="rounded-xl bg-blue-50 p-2 text-center"><p className="text-lg font-bold text-blue-600">{rekapHariIni.izin}</p><p className="text-[10px] text-blue-500">Izin</p></div>
        <div className="rounded-xl bg-purple-50 p-2 text-center"><p className="text-lg font-bold text-purple-600">{rekapHariIni.sakit}</p><p className="text-[10px] text-purple-500">Sakit</p></div>
        <div className="rounded-xl bg-red-50 p-2 text-center"><p className="text-lg font-bold text-red-600">{rekapHariIni.alfa}</p><p className="text-[10px] text-red-500">Alfa</p></div>
      </div>

      {/* Form input — hanya Admin/HR */}
      {isAdmin && (
      <div className="mt-4 rounded-2xl border border-purple-100 bg-white p-4 shadow-sm">
        <p className="text-sm font-bold text-slate-700 mb-3">➕ Input Absensi (Manual)</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Pegawai</span>
            <select value={form.pegawaiId} onChange={e => setForm({ ...form, pegawaiId: e.target.value })}
              className="rounded-xl border px-3 py-2 text-sm focus:border-purple-500 focus:outline-none">
              {pegawai.filter(p => p.status === 'Aktif').map(p => <option key={p.id} value={p.id}>{p.nama} ({p.nik})</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Status</span>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as AbsensiRecord['status'] })}
              className="rounded-xl border px-3 py-2 text-sm focus:border-purple-500 focus:outline-none">
              <option value="Hadir">✅ Hadir</option>
              <option value="Terlambat">⏰ Terlambat</option>
              <option value="Izin">📝 Izin</option>
              <option value="Sakit">🏥 Sakit</option>
              <option value="Alfa">❌ Alfa</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Jam Masuk</span>
            <input type="time" value={form.jamMasuk} onChange={e => setForm({ ...form, jamMasuk: e.target.value })}
              className="rounded-xl border px-3 py-2 text-sm focus:border-purple-500 focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Jam Keluar</span>
            <input type="time" value={form.jamKeluar} onChange={e => setForm({ ...form, jamKeluar: e.target.value })}
              className="rounded-xl border px-3 py-2 text-sm focus:border-purple-500 focus:outline-none" />
          </label>
        </div>
        <label className="flex flex-col gap-1 mt-3">
          <span className="text-xs font-semibold text-slate-600">Keterangan</span>
          <input type="text" value={form.keterangan} onChange={e => setForm({ ...form, keterangan: e.target.value })} placeholder="Opsional..."
            className="rounded-xl border px-3 py-2 text-sm focus:border-purple-500 focus:outline-none" />
        </label>
        <button onClick={save} className="mt-4 rounded-xl bg-purple-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-purple-700">💾 Simpan Absensi</button>
      </div>
      )}

      {/* Keterangan auto-alfa */}
      {!isAdmin && (
        <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          ⚠️ Jika tidak ada absensi dan tidak mengajukan izin/cuti/sakit, status akan otomatis <strong>Alfa</strong>.
        </div>
      )}

      {/* Tabel absensi hari ini */}
      {todayAbsen.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead><tr className="bg-purple-50 text-xs uppercase text-purple-500">
              {['Nama','NIK','Jam Masuk','Jam Keluar','Status','Keterangan'].map(c => <th key={c} className="px-3 py-3 font-semibold whitespace-nowrap">{c}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {todayAbsen.map(a => {
                const p = pegawaiMap.get(a.pegawaiId);
                const st = STATUS_ABSEN[a.status];
                return (
                  <tr key={a.id} className="hover:bg-purple-50/20">
                    <td className="px-3 py-2.5 font-semibold text-slate-700">{p?.nama || '-'}</td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-slate-500">{p?.nik || '-'}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px]">{a.jamMasuk}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px]">{a.jamKeluar}</td>
                    <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.color}`}>{st.label}</span></td>
                    <td className="px-3 py-2.5 text-slate-400 text-[10px]">{a.keterangan || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {todayAbsen.length === 0 && (
        <div className="mt-6 text-center py-8 text-slate-400">
          <p className="text-4xl mb-2">📋</p>
          <p className="text-sm">Belum ada data absensi untuk tanggal ini.</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* REKAP ABSENSI                                                     */
/* ═══════════════════════════════════════════════════════════════════ */
function RekapAbsensi({ pegawai, absensi }: { pegawai: Pegawai[]; absensi: AbsensiRecord[] }) {
  const [bulan, setBulan] = useState(() => new Date().toISOString().slice(0, 7));
  const [viewMode, setViewMode] = useState<'semua' | 'per-pegawai'>('semua');

  const absenBulan = absensi.filter(a => a.tanggal.startsWith(bulan));
  const pegawaiAktif = pegawai.filter(p => p.status === 'Aktif');

  // Rekap per pegawai
  const rekapPegawai = pegawaiAktif.map(p => {
    const absenP = absenBulan.filter(a => a.pegawaiId === p.id);
    const hadir = absenP.filter(a => a.status === 'Hadir').length;
    const terlambat = absenP.filter(a => a.status === 'Terlambat').length;
    const izin = absenP.filter(a => a.status === 'Izin').length;
    const sakit = absenP.filter(a => a.status === 'Sakit').length;
    const alfa = absenP.filter(a => a.status === 'Alfa').length;
    const total = absenP.length;
    const persentase = total > 0 ? Math.round((hadir / total) * 100) : 0;
    return { pegawai: p, hadir, terlambat, izin, sakit, alfa, total, persentase };
  }).sort((a, b) => b.persentase - a.persentase);

  // Total bulanan
  const totalBulan = {
    hadir: rekapPegawai.reduce((s, r) => s + r.hadir, 0),
    terlambat: rekapPegawai.reduce((s, r) => s + r.terlambat, 0),
    izin: rekapPegawai.reduce((s, r) => s + r.izin, 0),
    sakit: rekapPegawai.reduce((s, r) => s + r.sakit, 0),
    alfa: rekapPegawai.reduce((s, r) => s + r.alfa, 0),
  };
  const totalSemua = totalBulan.hadir + totalBulan.terlambat + totalBulan.izin + totalBulan.sakit + totalBulan.alfa;
  const maxHadir = Math.max(...rekapPegawai.map(r => r.hadir), 1);

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-400" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📊 Rekap Absensi</h2>
          <p className="mt-1 text-sm text-slate-500">Ringkasan kehadiran bulanan seluruh pegawai.</p>
        </div>
        <div className="flex gap-2">
          <input type="month" value={bulan} onChange={e => setBulan(e.target.value)}
            className="rounded-xl border px-3 py-1.5 text-xs font-semibold text-slate-600 focus:border-purple-500 focus:outline-none" />
        </div>
      </div>

      {/* Ringkasan bulanan */}
      <div className="mt-4 grid grid-cols-6 gap-2">
        <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-xl font-bold text-slate-600">{totalSemua}</p><p className="text-[10px] text-slate-500">Total</p></div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center"><p className="text-xl font-bold text-emerald-600">{totalBulan.hadir}</p><p className="text-[10px] text-emerald-500">Hadir</p></div>
        <div className="rounded-xl bg-amber-50 p-3 text-center"><p className="text-xl font-bold text-amber-600">{totalBulan.terlambat}</p><p className="text-[10px] text-amber-500">Terlambat</p></div>
        <div className="rounded-xl bg-blue-50 p-3 text-center"><p className="text-xl font-bold text-blue-600">{totalBulan.izin}</p><p className="text-[10px] text-blue-500">Izin</p></div>
        <div className="rounded-xl bg-purple-50 p-3 text-center"><p className="text-xl font-bold text-purple-600">{totalBulan.sakit}</p><p className="text-[10px] text-purple-500">Sakit</p></div>
        <div className="rounded-xl bg-red-50 p-3 text-center"><p className="text-xl font-bold text-red-600">{totalBulan.alfa}</p><p className="text-[10px] text-red-500">Alfa</p></div>
      </div>

      {/* Persentase kehadiran bar chart */}
      <div className="mt-5 space-y-3">
        <p className="text-sm font-bold text-slate-700">📈 Tingkat Kehadiran (%)</p>
        {rekapPegawai.map(r => (
          <div key={r.pegawai.id} className="flex items-center gap-3">
            <span className="w-28 text-xs font-semibold text-slate-600 truncate" title={r.pegawai.nama}>{r.pegawai.nama}</span>
            <div className="h-5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${r.persentase >= 90 ? 'bg-emerald-400' : r.persentase >= 75 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${Math.max(r.persentase, 2)}%` }}
              />
            </div>
            <span className={`w-10 text-xs font-bold text-right ${r.persentase >= 90 ? 'text-emerald-600' : r.persentase >= 75 ? 'text-amber-600' : 'text-red-600'}`}>{r.persentase}%</span>
          </div>
        ))}
      </div>

      {/* Detail per pegawai */}
      <div className="mt-5">
        <p className="text-sm font-bold text-slate-700 mb-2">📋 Detail Per Pegawai</p>
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead><tr className="bg-purple-50 text-xs uppercase text-purple-500">
              {['Nama','Hadir','Terlambat','Izin','Sakit','Alfa','% Kehadiran'].map(c => <th key={c} className="px-3 py-3 font-semibold whitespace-nowrap">{c}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {rekapPegawai.map(r => (
                <tr key={r.pegawai.id} className="hover:bg-purple-50/20">
                  <td className="px-3 py-2.5 font-semibold text-slate-700">{r.pegawai.nama}<br /><span className="text-[10px] text-slate-400">{r.pegawai.nik} • {r.pegawai.jabatan}</span></td>
                  <td className="px-3 py-2.5 font-semibold text-emerald-600">{r.hadir}</td>
                  <td className="px-3 py-2.5 text-amber-600">{r.terlambat || '-'}</td>
                  <td className="px-3 py-2.5 text-blue-600">{r.izin || '-'}</td>
                  <td className="px-3 py-2.5 text-purple-600">{r.sakit || '-'}</td>
                  <td className="px-3 py-2.5 text-red-600">{r.alfa || '-'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.persentase >= 90 ? 'bg-emerald-100 text-emerald-700' : r.persentase >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{r.persentase}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* KPI PEGAWAI                                                       */
/* ═══════════════════════════════════════════════════════════════════ */
function KpiPegawai({ pegawai, kpi }: { pegawai: Pegawai[]; kpi: KpiRecord[] }) {
  const [bulan, setBulan] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedPegawai, setSelectedPegawai] = useState(pegawai[0]?.id || '');

  const pegawaiAktif = pegawai.filter(p => p.status === 'Aktif');
  const kpiBulan = kpi.filter(k => k.bulan === bulan);
  const pegawaiKpi = kpiBulan.filter(k => k.pegawaiId === selectedPegawai);

  // Rata-rata KPI bulan ini
  const avgKpi = kpiBulan.length > 0
    ? Math.round(kpiBulan.reduce((s, k) => s + k.totalSkor, 0) / kpiBulan.length)
    : 0;

  const selectedP = pegawaiAktif.find(p => p.id === selectedPegawai);
  const latestKpi = pegawaiKpi[0];

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-400" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🎯 KPI Pegawai</h2>
          <p className="mt-1 text-sm text-slate-500">Penilaian kinerja bulanan berdasarkan 4 indikator.</p>
        </div>
        <input type="month" value={bulan} onChange={e => setBulan(e.target.value)}
          className="rounded-xl border px-3 py-1.5 text-xs font-semibold text-slate-600 focus:border-purple-500 focus:outline-none" />
      </div>

      {/* Rata-rata KPI */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 p-5 text-white shadow-sm">
          <p className="text-xs opacity-80">Rata-rata KPI Bulan Ini</p>
          <p className="mt-1 text-4xl font-bold">{avgKpi}</p>
          <p className="text-xs mt-1 opacity-70">dari skala 100</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${avgKpi}%` }} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-400">Pilih Pegawai</p>
          <select value={selectedPegawai} onChange={e => setSelectedPegawai(e.target.value)}
            className="mt-2 w-full rounded-xl border px-3 py-2 text-sm font-semibold text-slate-700 focus:border-purple-500 focus:outline-none">
            {pegawaiAktif.map(p => <option key={p.id} value={p.id}>{p.nama} — {p.jabatan}</option>)}
          </select>
        </div>
      </div>

      {/* Detail KPI pegawai terpilih */}
      {latestKpi ? (
        <div className="mt-5">
          <p className="text-sm font-bold text-slate-700 mb-3">📊 {selectedP?.nama} — {bulan}</p>
          <div className="space-y-4">
            {[
              { label: 'Target Kerja', value: latestKpi.targetKerja, color: 'bg-blue-400' },
              { label: 'Kualitas Kerja', value: latestKpi.kualitasKerja, color: 'bg-emerald-400' },
              { label: 'Kedisiplinan', value: latestKpi.kedisiplinan, color: 'bg-amber-400' },
              { label: 'Kerjasama Tim', value: latestKpi.kerjasama, color: 'bg-purple-400' },
            ].map(indicator => (
              <div key={indicator.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-600">{indicator.label}</span>
                  <span className="text-xs font-bold text-slate-700">{indicator.value}/100</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${indicator.color} transition-all duration-500`}
                    style={{ width: `${indicator.value}%` }} />
                </div>
              </div>
            ))}
          </div>
          {/* Total Skor */}
          <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-center">
            <p className="text-xs text-slate-400">Total Skor KPI</p>
            <p className={`text-3xl font-bold mt-1 ${latestKpi.totalSkor >= 85 ? 'text-emerald-600' : latestKpi.totalSkor >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
              {latestKpi.totalSkor}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {latestKpi.totalSkor >= 85 ? '🌟 Performa Sangat Baik' : latestKpi.totalSkor >= 70 ? '👍 Performa Baik' : '⚠️ Perlu Improvement'}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 text-center py-8 text-slate-400">
          <p className="text-4xl mb-2">🎯</p>
          <p className="text-sm">Belum ada data KPI untuk periode ini.</p>
        </div>
      )}

      {/* Tabel semua KPI */}
      <div className="mt-5">
        <p className="text-sm font-bold text-slate-700 mb-2">📋 Semua KPI — {bulan}</p>
        {kpiBulan.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead><tr className="bg-purple-50 text-xs uppercase text-purple-500">
                {['Nama','Target','Kualitas','Disiplin','Tim','Total','Grade'].map(c => <th key={c} className="px-2 py-3 font-semibold whitespace-nowrap">{c}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-50 bg-white">
                {kpiBulan.sort((a, b) => b.totalSkor - a.totalSkor).map(k => {
                  const p = pegawaiAktif.find(pp => pp.id === k.pegawaiId);
                  return (
                    <tr key={k.id} className="hover:bg-purple-50/20">
                      <td className="px-2 py-2.5 font-semibold text-slate-700 text-[11px]">{p?.nama || '-'}</td>
                      <td className="px-2 py-2.5 text-center">{k.targetKerja}</td>
                      <td className="px-2 py-2.5 text-center">{k.kualitasKerja}</td>
                      <td className="px-2 py-2.5 text-center">{k.kedisiplinan}</td>
                      <td className="px-2 py-2.5 text-center">{k.kerjasama}</td>
                      <td className="px-2 py-2.5 font-bold text-center">{k.totalSkor}</td>
                      <td className="px-2 py-2.5 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${k.totalSkor >= 85 ? 'bg-emerald-100 text-emerald-700' : k.totalSkor >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {k.totalSkor >= 85 ? '🌟 A' : k.totalSkor >= 70 ? '👍 B' : '⚠️ C'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-3 text-center py-6 text-slate-400 text-sm">Belum ada data KPI.</div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* FORM IZIN / CUTI / SAKIT (untuk Pegawai)                          */
/* ═══════════════════════════════════════════════════════════════════ */
function FormIzin({ pegawai, izinList, setIzinList }: { pegawai: Pegawai | undefined; izinList: IzinRecord[]; setIzinList: React.Dispatch<React.SetStateAction<IzinRecord[]>> }) {
  const [jenis, setJenis] = useState<IzinRecord['jenis']>('izin');
  const [tanggalMulai, setTanggalMulai] = useState(new Date().toISOString().slice(0, 10));
  const [tanggalSelesai, setTanggalSelesai] = useState(new Date().toISOString().slice(0, 10));
  const [alasan, setAlasan] = useState('');
  const [success, setSuccess] = useState(false);
  const [ferr, setFerr] = useState('');

  const handleSubmit = () => {
    setFerr('');
    if (!pegawai) { setFerr('Data pegawai tidak ditemukan.'); return; }
    if (!alasan.trim()) { setFerr('Alasan wajib diisi.'); return; }
    if (tanggalSelesai < tanggalMulai) { setFerr('Tanggal selesai tidak boleh sebelum tanggal mulai.'); return; }

    const record: IzinRecord = {
      id: `izin-${Date.now()}`,
      pegawaiId: pegawai.id,
      pegawaiNama: pegawai.nama,
      jenis,
      tanggalMulai,
      tanggalSelesai,
      alasan: alasan.trim(),
      status: 'pending',
      diajukanPada: new Date().toISOString(),
    };

    setIzinList(prev => [record, ...prev]);
    setAlasan('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const statusBadge = (status: IzinRecord['status']) => {
    const map: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700',
      disetujui: 'bg-emerald-100 text-emerald-700',
      ditolak: 'bg-red-100 text-red-700',
    };
    const label: Record<string, string> = {
      pending: '⏳ Menunggu',
      disetujui: '✅ Disetujui',
      ditolak: '❌ Ditolak',
    };
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status]}`}>{label[status]}</span>;
  };

  const myIzin = izinList;

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-400" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📝 Izin / Cuti / Sakit</h2>
      <p className="mt-1 text-sm text-slate-500">Ajukan izin, cuti, atau sakit. HR akan me-review dan menyetujui/menolak.</p>

      {success && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">✅ Pengajuan berhasil dikirim. Menunggu approval HR.</p>}

      <div className="mt-4 rounded-2xl border border-purple-100 bg-white p-4 shadow-sm">
        <p className="text-sm font-bold text-slate-700 mb-3">➕ Ajukan Izin/Cuti</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Jenis</span>
            <select value={jenis} onChange={e => setJenis(e.target.value as IzinRecord['jenis'])}
              className="rounded-xl border px-3 py-2 text-sm focus:border-purple-500 focus:outline-none">
              <option value="izin">📝 Izin</option>
              <option value="sakit">🏥 Sakit</option>
              <option value="cuti">🏖️ Cuti</option>
            </select>
          </label>
          <div />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Tanggal Mulai</span>
            <input type="date" value={tanggalMulai} onChange={e => setTanggalMulai(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm focus:border-purple-500 focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Tanggal Selesai</span>
            <input type="date" value={tanggalSelesai} onChange={e => setTanggalSelesai(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm focus:border-purple-500 focus:outline-none" />
          </label>
        </div>
        <label className="flex flex-col gap-1 mt-3">
          <span className="text-xs font-semibold text-slate-600">Alasan *</span>
          <textarea value={alasan} onChange={e => setAlasan(e.target.value)} placeholder="Tulis alasan izin/cuti/sakit..."
            rows={3} className="rounded-xl border px-3 py-2 text-sm focus:border-purple-500 focus:outline-none" />
        </label>
        {ferr && <p className="mt-2 text-sm text-red-500">{ferr}</p>}
        <button onClick={handleSubmit} disabled={!pegawai}
          className="mt-4 rounded-xl bg-purple-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:bg-slate-300">
          📤 Kirim Pengajuan
        </button>
      </div>

      <div className="mt-4">
        <p className="text-sm font-bold text-slate-700 mb-2">📋 Riwayat Pengajuan Saya</p>
        {myIzin.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Belum ada pengajuan.</p>
        ) : (
          <div className="space-y-2">
            {myIzin.map(iz => (
              <div key={iz.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    {iz.jenis === 'cuti' ? '🏖️ Cuti' : iz.jenis === 'sakit' ? '🏥 Sakit' : '📝 Izin'}
                  </span>
                  {statusBadge(iz.status)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {iz.tanggalMulai} {iz.tanggalSelesai !== iz.tanggalMulai ? `s/d ${iz.tanggalSelesai}` : ''}
                </p>
                <p className="text-xs text-slate-600 mt-1">{iz.alasan}</p>
                <p className="text-[10px] text-slate-400 mt-1">Diajukan: {new Date(iz.diajukanPada).toLocaleString('id-ID')}</p>
                {iz.status !== 'pending' && (
                  <p className="text-[10px] text-slate-400">
                    {iz.status === 'disetujui' ? '✅' : '❌'} Diproses pada {iz.diprosesPada ? new Date(iz.diprosesPada).toLocaleString('id-ID') : '-'}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* APPROVAL IZIN (untuk Admin/HR)                                    */
/* ═══════════════════════════════════════════════════════════════════ */
function ApprovalIzin({ izinList, setIzinList, pegawai }: { izinList: IzinRecord[]; setIzinList: React.Dispatch<React.SetStateAction<IzinRecord[]>>; pegawai: Pegawai[] }) {
  const pending = izinList.filter(iz => iz.status === 'pending');
  const history = izinList.filter(iz => iz.status !== 'pending');

  const handleApprove = (id: string) => {
    setIzinList(prev => prev.map(iz =>
      iz.id === id ? { ...iz, status: 'disetujui' as const, diprosesOleh: 'HR', diprosesPada: new Date().toISOString() } : iz
    ));
  };

  const handleReject = (id: string) => {
    setIzinList(prev => prev.map(iz =>
      iz.id === id ? { ...iz, status: 'ditolak' as const, diprosesOleh: 'HR', diprosesPada: new Date().toISOString() } : iz
    ));
  };

  const statusBadge = (status: IzinRecord['status']) => {
    const map: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700',
      disetujui: 'bg-emerald-100 text-emerald-700',
      ditolak: 'bg-red-100 text-red-700',
    };
    const label: Record<string, string> = {
      pending: '⏳ Menunggu',
      disetujui: '✅ Disetujui',
      ditolak: '❌ Ditolak',
    };
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status]}`}>{label[status]}</span>;
  };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-400" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">✅ Approval Izin / Cuti</h2>
      <p className="mt-1 text-sm text-slate-500">Setujui atau tolak pengajuan izin, cuti, dan sakit dari pegawai.</p>

      <div className="mt-4">
        <p className="text-sm font-bold text-slate-700 mb-2">
          ⏳ Menunggu Approval ({pending.length})
        </p>
        {pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-6 text-center">
            <p className="text-sm text-slate-400">Tidak ada pengajuan yang menunggu.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map(iz => (
              <div key={iz.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{iz.pegawaiNama}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {iz.jenis === 'cuti' ? '🏖️ Cuti' : iz.jenis === 'sakit' ? '🏥 Sakit' : '📝 Izin'}
                      {' · '}{iz.tanggalMulai}{iz.tanggalSelesai !== iz.tanggalMulai ? ` s/d ${iz.tanggalSelesai}` : ''}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">{iz.alasan}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Diajukan: {new Date(iz.diajukanPada).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleReject(iz.id)}
                      className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200">
                      ❌ Tolak
                    </button>
                    <button onClick={() => handleApprove(iz.id)}
                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600">
                      ✅ Setujui
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-bold text-slate-700 mb-2">📋 Riwayat Approval ({history.length})</p>
          <div className="space-y-2">
            {history.slice(0, 20).map(iz => (
              <div key={iz.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">{iz.pegawaiNama} — {iz.jenis === 'cuti' ? '🏖️ Cuti' : iz.jenis === 'sakit' ? '🏥 Sakit' : '📝 Izin'}</span>
                  {statusBadge(iz.status)}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{iz.tanggalMulai} {iz.tanggalSelesai !== iz.tanggalMulai ? `s/d ${iz.tanggalSelesai}` : ''}</p>
                <p className="text-xs text-slate-600 mt-0.5">{iz.alasan}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* GAJI / PAYROLL                                                     */
/* ═══════════════════════════════════════════════════════════════════ */
function GajiTab({ pegawai }: { pegawai: Pegawai[] }) {
  const pegawaiAktif = pegawai.filter(p => p.status === 'Aktif');
  const [gajiList, setGajiList] = useState<GajiRecord[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const raw = localStorage.getItem(GAJI_STORAGE); return raw ? JSON.parse(raw) : []; }
    catch { return []; }
  });
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterPeriode, setFilterPeriode] = useState(new Date().toISOString().slice(0, 7));
  const [filterPegawai, setFilterPegawai] = useState('semua');
  const [form, setForm] = useState({
    pegawaiId: '', periode: new Date().toISOString().slice(0, 7),
    gajiPokok: '', tunjangan: '', potongan: '', lembur: '', bonus: '', catatan: ''
  });
  const [err, setErr] = useState('');

  useEffect(() => { try { localStorage.setItem(GAJI_STORAGE, JSON.stringify(gajiList)); } catch { } }, [gajiList]);

  const filtered = gajiList.filter(g => {
    if (filterPeriode && g.periode !== filterPeriode) return false;
    if (filterPegawai !== 'semua' && g.pegawaiId !== filterPegawai) return false;
    return true;
  });

  const openAdd = () => {
    setForm({ pegawaiId: pegawaiAktif[0]?.id || '', periode: new Date().toISOString().slice(0, 7), gajiPokok: '', tunjangan: '', potongan: '', lembur: '', bonus: '', catatan: '' });
    setErr(''); setShowForm(true); setEditId(null);
  };
  const openEdit = (g: GajiRecord) => {
    setForm({ pegawaiId: g.pegawaiId, periode: g.periode, gajiPokok: String(g.gajiPokok), tunjangan: String(g.tunjangan), potongan: String(g.potongan), lembur: String(g.lembur), bonus: String(g.bonus), catatan: g.catatan });
    setErr(''); setEditId(g.id); setShowForm(true);
  };

  const save = () => {
    if (!form.pegawaiId || !form.periode) { setErr('Pegawai & Periode wajib diisi.'); return; }
    const gp = +form.gajiPokok || 0;
    const tj = +form.tunjangan || 0;
    const pt = +form.potongan || 0;
    const lb = +form.lembur || 0;
    const bn = +form.bonus || 0;
    const total = gp + tj + lb + bn - pt;
    const p = pegawai.find(x => x.id === form.pegawaiId);
    const item: GajiRecord = {
      id: editId || `gaji-${Date.now()}`,
      pegawaiId: form.pegawaiId, pegawaiNama: p?.nama || '', nik: p?.nik || '',
      periode: form.periode, gajiPokok: gp, tunjangan: tj, potongan: pt, lembur: lb, bonus: bn,
      totalGaji: total, status: 'draft', tanggalBayar: '', catatan: form.catatan,
    };
    if (editId) setGajiList(prev => prev.map(x => x.id === editId ? item : x));
    else setGajiList(prev => [item, ...prev]);
    setShowForm(false);
  };

  const bayarGaji = (id: string) => {
    setGajiList(prev => prev.map(g => g.id === id ? { ...g, status: 'dibayar' as const, tanggalBayar: new Date().toISOString().slice(0, 10) } : g));
  };

  const hapusGaji = (id: string) => {
    if (!confirm('Hapus data gaji ini?')) return;
    setGajiList(prev => prev.filter(g => g.id !== id));
  };

  const rekapPeriode = useMemo(() => {
    const map = new Map<string, { totalGaji: number; totalPokok: number; totalTunjangan: number; totalLembur: number; totalBonus: number; totalPotongan: number; jmlPegawai: number; dibayar: number }>();
    for (const g of gajiList) {
      const exist = map.get(g.periode) || { totalGaji: 0, totalPokok: 0, totalTunjangan: 0, totalLembur: 0, totalBonus: 0, totalPotongan: 0, jmlPegawai: 0, dibayar: 0 };
      exist.totalGaji += g.totalGaji;
      exist.totalPokok += g.gajiPokok;
      exist.totalTunjangan += g.tunjangan;
      exist.totalLembur += g.lembur;
      exist.totalBonus += g.bonus;
      exist.totalPotongan += g.potongan;
      exist.jmlPegawai++;
      if (g.status === 'dibayar') exist.dibayar++;
      map.set(g.periode, exist);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [gajiList]);

  const totalAll = gajiList.reduce((s, g) => s + g.totalGaji, 0);
  const totalDibayar = gajiList.filter(g => g.status === 'dibayar').reduce((s, g) => s + g.totalGaji, 0);
  const allPeriods = Array.from(new Set(gajiList.map(g => g.periode))).sort().reverse();

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold text-slate-800 sm:text-xl">💰 Gaji / Payroll</h2><p className="text-sm text-slate-500">{gajiList.length} record • {pegawaiAktif.length} pegawai aktif</p></div>
        <button onClick={openAdd} className="rounded-xl bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">+ Input Gaji</button>
      </div>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-2xl font-bold text-slate-700">{gajiList.length}</p><p className="text-xs text-slate-500">Record</p></div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center"><p className="text-2xl font-bold text-emerald-600">Rp {totalAll.toLocaleString('id-ID')}</p><p className="text-xs text-emerald-500">Total Gaji</p></div>
        <div className="rounded-xl bg-blue-50 p-3 text-center"><p className="text-2xl font-bold text-blue-600">Rp {totalDibayar.toLocaleString('id-ID')}</p><p className="text-xs text-blue-500">Sudah Dibayar</p></div>
        <div className="rounded-xl bg-amber-50 p-3 text-center"><p className="text-2xl font-bold text-amber-600">Rp {(totalAll-totalDibayar).toLocaleString('id-ID')}</p><p className="text-xs text-amber-500">Belum Dibayar</p></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <select value={filterPeriode} onChange={e => setFilterPeriode(e.target.value)} className="rounded-xl border bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
          <option value="">📅 Semua Periode</option>
          {allPeriods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterPegawai} onChange={e => setFilterPegawai(e.target.value)} className="rounded-xl border bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
          <option value="semua">👥 Semua Pegawai</option>
          {pegawaiAktif.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
        </select>
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-[10px]">
          <thead><tr className="bg-emerald-50 text-[10px] uppercase text-emerald-600">
            {['Periode','NIK','Nama','Pokok','Tunjangan','Lembur','Bonus','Potongan','TOTAL','Status','Aksi'].map(c => <th key={c} className="px-1.5 py-2 font-semibold whitespace-nowrap">{c}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {filtered.length===0 ? <tr><td colSpan={11} className="py-10 text-center text-slate-400">Belum ada data gaji. Klik "+ Input Gaji".</td></tr> :
            filtered.map(g => (
              <tr key={g.id} className={`hover:bg-emerald-50/30 ${g.status==='dibayar'?'bg-emerald-50/20':''}`}>
                <td className="px-1.5 py-2 font-mono">{g.periode}</td>
                <td className="px-1.5 py-2 text-slate-500">{g.nik}</td>
                <td className="px-1.5 py-2 font-semibold text-slate-700">{g.pegawaiNama}</td>
                <td className="px-1.5 py-2">Rp {g.gajiPokok.toLocaleString('id-ID')}</td>
                <td className="px-1.5 py-2 text-blue-600">{g.tunjangan>0?`+${g.tunjangan.toLocaleString('id-ID')}`:'-'}</td>
                <td className="px-1.5 py-2 text-amber-600">{g.lembur>0?`+${g.lembur.toLocaleString('id-ID')}`:'-'}</td>
                <td className="px-1.5 py-2 text-purple-600">{g.bonus>0?`+${g.bonus.toLocaleString('id-ID')}`:'-'}</td>
                <td className="px-1.5 py-2 text-red-500">{g.potongan>0?`-${g.potongan.toLocaleString('id-ID')}`:'-'}</td>
                <td className="px-1.5 py-2 font-bold">Rp {g.totalGaji.toLocaleString('id-ID')}</td>
                <td className="px-1.5 py-2"><span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${g.status==='dibayar'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{g.status==='dibayar'?`✅ ${g.tanggalBayar}`:'📝 Draft'}</span></td>
                <td className="px-1.5 py-2"><div className="flex gap-0.5">
                  {g.status==='draft'&&<button onClick={()=>bayarGaji(g.id)} className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 hover:bg-emerald-200">✅ Bayar</button>}
                  <button onClick={()=>openEdit(g)} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 hover:bg-slate-200">✏️</button>
                  <button onClick={()=>hapusGaji(g.id)} className="rounded-md bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-500 hover:bg-red-100">🗑️</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm&&(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 overflow-y-auto py-8"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl mx-4">
        <p className="text-lg font-bold text-slate-800">{editId?'✏️ Edit Gaji':'💰 Input Gaji Baru'}</p>
        {err&&<p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 col-span-2"><span className="text-xs font-semibold text-slate-600">Pegawai</span>
            <select value={form.pegawaiId} onChange={e=>setForm({...form,pegawaiId:e.target.value})} className="rounded-xl border px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none bg-white">{pegawaiAktif.map(p=><option key={p.id} value={p.id}>{p.nama} ({p.nik})</option>)}</select></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Periode</span><input type="month" value={form.periode} onChange={e=>setForm({...form,periode:e.target.value})} className="rounded-xl border px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Gaji Pokok</span><input type="number" value={form.gajiPokok} onChange={e=>setForm({...form,gajiPokok:e.target.value})} className="rounded-xl border px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Tunjangan</span><input type="number" value={form.tunjangan} onChange={e=>setForm({...form,tunjangan:e.target.value})} className="rounded-xl border px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Lembur</span><input type="number" value={form.lembur} onChange={e=>setForm({...form,lembur:e.target.value})} className="rounded-xl border px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Bonus</span><input type="number" value={form.bonus} onChange={e=>setForm({...form,bonus:e.target.value})} className="rounded-xl border px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Potongan</span><input type="number" value={form.potongan} onChange={e=>setForm({...form,potongan:e.target.value})} className="rounded-xl border px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none" /></label>
          <label className="flex flex-col gap-1 col-span-2"><span className="text-xs font-semibold text-slate-600">Catatan</span><input type="text" value={form.catatan} onChange={e=>setForm({...form,catatan:e.target.value})} placeholder="THR, bonus, dll" className="rounded-xl border px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none" /></label>
        </div>
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs"><p className="text-slate-500">Preview Total:</p><p className="text-lg font-bold text-emerald-600">Rp {((+form.gajiPokok||0)+(+form.tunjangan||0)+(+form.lembur||0)+(+form.bonus||0)-(+form.potongan||0)).toLocaleString('id-ID')}</p></div>
        <div className="mt-4 flex justify-end gap-2"><button onClick={()=>setShowForm(false)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button><button onClick={save} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white">{editId?'Update':'Simpan'}</button></div>
      </div></div>)}
      {rekapPeriode.length>0&&(<div className="mt-5"><h3 className="text-sm font-bold text-slate-700 mb-2">📊 Rekap Payroll per Periode</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-100"><table className="w-full text-left text-[10px]">
          <thead><tr className="bg-slate-100 text-slate-500">{['Periode','Pegawai','Pokok','Tunjangan','Lembur','Bonus','Potongan','Total','Dibayar'].map(c=><th key={c} className="px-2 py-2 font-semibold whitespace-nowrap">{c}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-50 bg-white">{rekapPeriode.map(([periode,d])=>(
            <tr key={periode} className="hover:bg-slate-50"><td className="px-2 py-2 font-mono font-semibold">{periode}</td><td className="px-2 py-2">{d.jmlPegawai} org</td><td className="px-2 py-2">Rp {d.totalPokok.toLocaleString('id-ID')}</td><td className="px-2 py-2 text-blue-600">Rp {d.totalTunjangan.toLocaleString('id-ID')}</td><td className="px-2 py-2 text-amber-600">Rp {d.totalLembur.toLocaleString('id-ID')}</td><td className="px-2 py-2 text-purple-600">Rp {d.totalBonus.toLocaleString('id-ID')}</td><td className="px-2 py-2 text-red-500">−Rp {d.totalPotongan.toLocaleString('id-ID')}</td><td className="px-2 py-2 font-bold">Rp {d.totalGaji.toLocaleString('id-ID')}</td><td className="px-2 py-2"><span className="text-emerald-600">{d.dibayar}/{d.jmlPegawai}</span></td></tr>
          ))}</tbody></table></div></div>
      )}
    </div>
  );
}
