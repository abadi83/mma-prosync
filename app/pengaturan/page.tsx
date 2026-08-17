'use client';

import React, { useState, useEffect } from 'react';
import { useUser, hasRole } from '@/app/hooks/useUser';

type Tab = 'profil' | 'password' | 'toko' | 'akun' | 'data';

const TABS = [
  { key: 'profil' as const, label: 'Profil', icon: '👤' },
  { key: 'akun' as const, label: 'Akun & Role', icon: '🔑' },
  { key: 'password' as const, label: 'Ubah Password', icon: '🔒' },
  { key: 'toko' as const, label: 'Info Toko', icon: '🏪' },
  { key: 'data' as const, label: 'Reset Data', icon: '🗑️' },
];

export default function PengaturanPage() {
  const user = useUser();
  const [tab, setTab] = useState<Tab>('akun');

  // 🔒 Pengaturan khusus Admin saja
  if (!hasRole(user, 'admin')) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <div className="text-6xl">🔒</div>
        <h1 className="text-2xl font-bold text-slate-800">Akses Ditolak</h1>
        <p className="max-w-sm text-sm text-slate-500">
          Halaman Pengaturan hanya bisa diakses oleh <strong>Admin</strong>.
          Silakan hubungi administrator toko Anda.
        </p>
        <a href="/" className="rounded-xl bg-brand-500 px-5 py-2 text-sm font-semibold text-white no-underline hover:bg-brand-700 transition">← Kembali ke Beranda</a>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="rounded-3xl bg-gradient-to-br from-brand-700 via-brand-500 to-brand-300 p-5 text-white shadow-lg sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-100 sm:text-sm">Pengaturan</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Pengaturan</h1>
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:px-5 sm:text-sm ${tab === t.key ? 'bg-brand-500 text-white shadow' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'}`}>
            <span className="text-base sm:text-lg">{t.icon}</span><span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </nav>

      <section className="card-blue">
        {tab === 'profil' && <ProfilTab />}
        {tab === 'akun' && <AkunTab />}
        {tab === 'password' && <PasswordTab />}
        {tab === 'toko' && <TokoTab />}
        {tab === 'data' && <DataTab />}
      </section>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* AKUN & ROLE — Disamakan dengan Daftar Pegawai (HR)               */
/* ═══════════════════════════════════════════════════════════════════ */

interface PegawaiAkun {
  id: string; nama: string; nik: string; username: string;
  jabatan: string; departemen: string; status: string; roles: string[];
}

const ROLE_LABELS_AKUN: Record<string, string> = {
  admin: '👑 Admin', hr: '👥 HR', finance: '💰 Finance', purchasing: '📦 Purchasing',
  warehouse: '🏭 Warehouse', logistik: '🚛 Logistik', inventory: '📋 Inventory',
  sales: '🛒 Sales', pegawai: '👤 Pegawai',
};

function AkunTab() {
  const [pegawaiList, setPegawaiList] = useState<PegawaiAkun[]>([]);
  const [resetPwId, setResetPwId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [search, setSearch] = useState('');

  // Load dari localStorage yg sama dengan Daftar Pegawai (HR)
  useEffect(() => {
    const load = () => {
      try {
        const stored = localStorage.getItem('mma_pegawai_data');
        if (stored) { setPegawaiList(JSON.parse(stored)); return; }
      } catch { }
      setPegawaiList([]);
    };
    load();
    window.addEventListener('storage', load);
    window.addEventListener('refresh-akun', load);
    return () => {
      window.removeEventListener('storage', load);
      window.removeEventListener('refresh-akun', load);
    };
  }, []);

  const toggleAktif = (id: string) => {
    setPegawaiList(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, status: p.status === 'Aktif' ? 'Nonaktif' : 'Aktif' } : p);
      try { localStorage.setItem('mma_pegawai_data', JSON.stringify(updated)); } catch { }
      return updated;
    });
  };

  const handleResetPassword = () => {
    setPwErr('');
    if (!newPassword || newPassword.length < 4) { setPwErr('Password minimal 4 karakter.'); return; }
    try {
      const existing = JSON.parse(localStorage.getItem('mma_pegawai_passwords') || '{}');
      existing[resetPwId!] = newPassword;
      localStorage.setItem('mma_pegawai_passwords', JSON.stringify(existing));
      setPwSuccess(true);
      setTimeout(() => { setResetPwId(null); setNewPassword(''); setPwSuccess(false); }, 2000);
    } catch { setPwErr('Gagal menyimpan password.'); }
  };

  const filtered = pegawaiList.filter(p =>
    !search || p.nama.toLowerCase().includes(search.toLowerCase()) || p.nik.toLowerCase().includes(search.toLowerCase())
  );
  const totalAktif = pegawaiList.filter(p => p.status === 'Aktif').length;

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🔑 Akun & Hak Akses</h2>
          <p className="mt-1 text-sm text-slate-500">{pegawaiList.length} akun • {totalAktif} aktif</p>
          <p className="text-xs text-purple-500 mt-0.5">📌 Data dari Daftar Pegawai (HR) — edit di tab Kepegawaian</p>
        </div>
      </div>

      <div className="mt-3"><input type="text" placeholder="🔍 Cari nama / NIK..." value={search} onChange={e => setSearch(e.target.value)} className="rounded-xl border px-3 py-1.5 text-xs text-slate-600 focus:border-brand-500 focus:outline-none w-56" /></div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {Object.entries(ROLE_LABELS_AKUN).map(([key, label]) => (<span key={key} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{label}</span>))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead><tr className="bg-brand-50 text-xs uppercase text-brand-500">{['NIK','Nama','Username','Jabatan','Roles','Status','Aksi'].map(c => <th key={c} className="px-3 py-3 font-semibold">{c}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {filtered.map(p => (
              <tr key={p.id} className={p.status !== 'Aktif' ? 'opacity-50' : ''}>
                <td className="px-3 py-3 font-mono text-xs text-slate-500">{p.nik}</td>
                <td className="px-3 py-3 font-medium text-slate-800">{p.nama}</td>
                <td className="px-3 py-3 text-slate-600 font-mono text-xs">{p.username || '-'}</td>
                <td className="px-3 py-3 text-xs text-slate-600">{p.jabatan}</td>
                <td className="px-3 py-3"><div className="flex flex-wrap gap-0.5 max-w-[180px]">{p.roles?.slice(0,3).map(r => (<span key={r} className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-semibold text-purple-700">{ROLE_LABELS_AKUN[r]||r}</span>))}{p.roles?.length>3&&<span className="text-[9px] text-slate-400">+{p.roles.length-3}</span>}</div></td>
                <td className="px-3 py-3"><button onClick={() => toggleAktif(p.id)} className={`rounded-full px-2 py-0.5 text-xs font-semibold transition ${p.status==='Aktif'?'bg-emerald-100 text-emerald-700 hover:bg-red-100 hover:text-red-700':'bg-red-100 text-red-700 hover:bg-emerald-100 hover:text-emerald-700'}`}>{p.status==='Aktif'?'✅ Aktif':'❌ Nonaktif'}</button></td>
                <td className="px-3 py-3"><button onClick={() => { setResetPwId(p.id); setNewPassword(''); setPwErr(''); setPwSuccess(false); }} className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200">🔒 Reset PW</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetPwId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setResetPwId(null)}>
          <div className="w-80 rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="text-lg font-bold text-slate-800">🔒 Reset Password</p>
            <p className="mt-1 text-sm text-slate-500">{pegawaiList.find(p => p.id === resetPwId)?.nama}</p>
            {pwSuccess ? (
              <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-center"><p className="text-emerald-700 font-semibold">✅ Password berhasil direset!</p><p className="text-xs text-emerald-500 mt-1">Password: <strong className="font-mono">{newPassword}</strong></p><button onClick={() => { setResetPwId(null); setNewPassword(''); setPwSuccess(false); }} className="mt-3 rounded-xl bg-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-700">Tutup</button></div>
            ) : (
              <>
                <div className="mt-3"><label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Password Baru</span><input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimal 4 karakter" className="w-full rounded-xl border px-3 py-2 text-sm font-mono focus:border-amber-500 focus:outline-none" /></label>{pwErr && <p className="text-sm text-red-500 mt-1">{pwErr}</p>}</div>
                <div className="mt-4 flex justify-end gap-2"><button onClick={() => { setResetPwId(null); setNewPassword(''); }} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button><button onClick={handleResetPassword} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">💾 Simpan</button></div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfilTab() {
  const [nama, setNama] = useState(() => {
    if (typeof window === 'undefined') return 'Bapak Arif';
    return localStorage.getItem('mma_profil_nama') || 'Bapak Arif';
  });
  const [email, setEmail] = useState(() => {
    if (typeof window === 'undefined') return 'demo@mma.id';
    return localStorage.getItem('mma_profil_email') || 'demo@mma.id';
  });
  const [telp, setTelp] = useState(() => {
    if (typeof window === 'undefined') return '0812-3456-7890';
    return localStorage.getItem('mma_profil_telp') || '0812-3456-7890';
  });
  const [avatar, setAvatar] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('mma_profil_avatar') || '';
  });
  const [saved, setSaved] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 200;
        let w = img.width, h = img.height;
        if (w > maxW) { h = (h * maxW) / w; w = maxW; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.7);
        setAvatar(compressed);
        localStorage.setItem('mma_profil_avatar', compressed);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    localStorage.setItem('mma_profil_nama', nama);
    localStorage.setItem('mma_profil_email', email);
    localStorage.setItem('mma_profil_telp', telp);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">👤 Profil</h2>

      <div className="mt-4 flex items-center gap-4">
        <div className="h-20 w-20 overflow-hidden rounded-full bg-brand-100 flex items-center justify-center text-3xl shrink-0">
          {avatar ? <img src={avatar} alt="Avatar" className="h-full w-full object-cover" /> : '👤'}
        </div>
        <div>
          <label className="cursor-pointer inline-block rounded-xl bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition">
            📷 Upload Foto
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </label>
        </div>
      </div>

      <div className="mt-5 space-y-3 max-w-md">
        <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Nama</span><input value={nama} onChange={e => setNama(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
        <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Email</span><input value={email} onChange={e => setEmail(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
        <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-600">Telepon</span><input value={telp} onChange={e => setTelp(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none" /></label>
        <button onClick={handleSave} className={`rounded-xl px-6 py-2.5 text-sm font-bold text-white transition ${saved ? 'bg-emerald-500' : 'bg-brand-500 hover:bg-brand-700'}`}>
          {saved ? '✅ Tersimpan!' : '💾 Simpan'}
        </button>
      </div>
    </div>
  );
}

function PasswordTab() {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!oldPw || !newPw || !confirmPw) { setError('Semua field wajib diisi.'); return; }
    if (oldPw !== 'demo123') { setError('Password lama salah.'); return; }
    if (newPw.length < 6) { setError('Password baru minimal 6 karakter.'); return; }
    if (newPw !== confirmPw) { setError('Password baru tidak cocok.'); return; }
    if (newPw === oldPw) { setError('Password baru tidak boleh sama dengan password lama.'); return; }
    setSuccess(true);
  };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🔒 Ubah Password</h2>

      <form onSubmit={handleSubmit} className="mt-4 max-w-sm space-y-3">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">{error}</p>}
        {success && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600" role="status">✅ Password berhasil diubah!</p>}

        <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} placeholder="Password lama" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
        <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Password baru (min. 6 karakter)" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
        <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Konfirmasi password baru" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
        <button type="submit" className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Ubah Password</button>
      </form>
    </div>
  );
}

function TokoTab() {
  const [namaToko, setNamaToko] = useState(() => {
    if (typeof window === 'undefined') return 'Toko Berkah Abadi';
    return localStorage.getItem('mma_nama_toko') || 'Toko Berkah Abadi';
  });
  const [alamat, setAlamat] = useState(() => {
    if (typeof window === 'undefined') return 'Jl. Merdeka No. 10, Jakarta';
    return localStorage.getItem('mma_alamat_toko') || 'Jl. Merdeka No. 10, Jakarta';
  });
  const [telepon, setTelepon] = useState(() => {
    if (typeof window === 'undefined') return '0812-3456-7890';
    return localStorage.getItem('mma_telepon_toko') || '0812-3456-7890';
  });
  const [logo, setLogo] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('mma_logo_toko') || '';
  });
  const [saved, setSaved] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Kompresi ringan
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 300;
        let w = img.width, h = img.height;
        if (w > maxW) { h = (h * maxW) / w; w = maxW; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/png');
        setLogo(compressed);
        localStorage.setItem('mma_logo_toko', compressed);
        setSaved(false);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    localStorage.setItem('mma_nama_toko', namaToko);
    localStorage.setItem('mma_alamat_toko', alamat);
    localStorage.setItem('mma_telepon_toko', telepon);
    if (logo) localStorage.setItem('mma_logo_toko', logo);
    // Broadcast agar header di tab/user lain ikut berubah
    try {
      window.dispatchEvent(new Event('refresh-toko-info'));
      window.dispatchEvent(new CustomEvent('shared-data-updated', { detail: { key: 'mma_nama_toko' } }));
    } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🏪 Info Toko</h2>
      <p className="mt-1 text-sm text-slate-500">Data toko akan tersimpan permanen dan muncul di seluruh aplikasi.</p>

      {/* Logo */}
      <div className="mt-4 flex items-center gap-4">
        <div className="h-20 w-20 overflow-hidden rounded-xl bg-brand-100 flex items-center justify-center text-3xl font-bold text-brand-500 shrink-0">
          {logo ? <img src={logo} alt="Logo" className="h-full w-full object-cover" /> : '🏪'}
        </div>
        <div className="space-y-2">
          <label className="cursor-pointer inline-block rounded-xl bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition">
            📷 Upload Logo
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </label>
          {logo && (
            <button onClick={() => { setLogo(''); localStorage.removeItem('mma_logo_toko'); }} className="block text-xs text-red-500 hover:text-red-700">
              ✕ Hapus Logo
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="mt-5 space-y-3 max-w-md">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-600">Nama Toko</span>
          <input value={namaToko} onChange={e => setNamaToko(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-600">Alamat</span>
          <textarea value={alamat} onChange={e => setAlamat(e.target.value)} rows={2} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-600">Telepon</span>
          <input value={telepon} onChange={e => setTelepon(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
        </label>
        <button onClick={handleSave} className={`rounded-xl px-6 py-2.5 text-sm font-bold text-white transition ${saved ? 'bg-emerald-500' : 'bg-brand-500 hover:bg-brand-700'}`}>
          {saved ? '✅ Tersimpan!' : '💾 Simpan'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <input defaultValue={value} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
    </label>
  );
}

/* ================================================================ */
/* RESET DATA TAB                                                    */
/* ================================================================ */
const DATA_GROUPS = [
  {
    label: '🧹 Inventory & Opname',
    desc: 'Hapus sesi stok opname (data fisik, status simpan). Stok master TIDAK terpengaruh.',
    keys: ['mma_opname_session', 'mma_opname_saved'],
  },
  {
    label: '📦 Stok Master (SKU)',
    desc: '⚠️ Reset semua SKU ke default (12 item). Upload & edit manual akan hilang.',
    keys: ['mma_sku_data'],
    dangerous: true,
  },
  {
    label: '🛒 Pembelian & Biaya',
    desc: 'Hapus semua PO, pembelian OPEX, dan biaya operasional.',
    keys: ['mma_hpp_purchases', 'mma_opex_purchases', 'mma_biaya_operasional', 'mma_koreksi_po', 'mma_koreksi_refund'],
  },
  {
    label: '💳 Keuangan',
    desc: 'Hapus riwayat pembayaran, refund, kas kecil, dan bukti bayar.',
    keys: ['mma_payment_history', 'mma_koreksi_refund', 'mma_kas_kecil', 'mma_bukti_bayar'],
  },
  {
    label: '📊 Akuntansi',
    desc: 'Hapus jurnal umum, aset tetap, dan modal.',
    keys: ['mma_jurnal_umum', 'mma_aset_tetap', 'mma_modal'],
  },
  {
    label: '🏭 Operasional Gudang',
    desc: 'Hapus data agregasi, handover, PO pickup, inventory check, fleet, face absensi.',
    keys: ['mma_agregasi_data', 'mma_ho_archive', 'mma_po_pickup', 'mma_po_inventory_check', 'mma_fleet_master', 'mma_absensi_face', 'mma_face_data'],
  },
  {
    label: '👥 Kepegawaian',
    desc: 'Hapus data pegawai, absensi, KPI, izin/cuti, dan password pegawai.',
    keys: ['mma_pegawai_data', 'mma_izin_records', 'mma_pegawai_passwords'],
  },
  {
    label: '🧾 Penjualan',
    desc: 'Hapus riwayat transaksi penjualan.',
    keys: ['mma_penjualan_transaksi'],
  },
];

function DataTab() {
  const [confirmKey, setConfirmKey] = useState('');
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const handleReset = (group: typeof DATA_GROUPS[0]) => {
    if (group.dangerous && confirmKey !== 'RESET') {
      setStatus({ type: 'err', msg: 'Ketik "RESET" untuk konfirmasi penghapusan data SKU.' });
      return;
    }
    try {
      group.keys.forEach(k => localStorage.removeItem(k));
      setStatus({ type: 'ok', msg: `✅ ${group.label} berhasil direset. Refresh halaman untuk melihat perubahan.` });
      setConfirmKey('');
    } catch {
      setStatus({ type: 'err', msg: 'Gagal mereset data.' });
    }
  };

  const handleResetAll = () => {
    if (confirmKey !== 'RESET ALL') {
      setStatus({ type: 'err', msg: 'Ketik "RESET ALL" untuk konfirmasi reset SEMUA data (kecuali supplier).' });
      return;
    }
    try {
      DATA_GROUPS.forEach(g => g.keys.forEach(k => localStorage.removeItem(k)));
      setStatus({ type: 'ok', msg: '✅ Semua data berhasil direset. Refresh halaman (F5) untuk memulai dari awal.' });
      setConfirmKey('');
    } catch {
      setStatus({ type: 'err', msg: 'Gagal mereset data.' });
    }
  };

  // Hitung item di localStorage
  const storageInfo = typeof window !== 'undefined'
    ? DATA_GROUPS.map(g => ({
        ...g,
        count: g.keys.reduce((s, k) => {
          try { const raw = localStorage.getItem(k); return s + (raw ? JSON.parse(raw).length : 0); } catch { return s; }
        }, 0),
      }))
    : [];

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🗑️ Reset Data</h2>
      <p className="mt-1 text-sm text-slate-500">Bersihkan data transaksi untuk uji coba berulang. Data Master (supplier) TIDAK terpengaruh.</p>

      {status && (
        <div className={`mt-3 rounded-xl px-4 py-2 text-sm font-semibold ${status.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {status.msg}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {storageInfo.map(group => (
          <div key={group.label} className={`rounded-2xl border p-4 ${group.dangerous ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {group.dangerous && '⚠️ '}{group.label}
                  {group.count > 0 && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{group.count} item</span>}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{group.desc}</p>
              </div>
              <button
                onClick={() => handleReset(group)}
                className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold text-white transition ${group.dangerous ? 'bg-red-500 hover:bg-red-700' : 'bg-slate-500 hover:bg-slate-700'}`}
              >
                Reset
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Konfirmasi */}
      <div className="mt-4 rounded-2xl border-2 border-red-300 bg-red-50 p-4">
        <p className="text-sm font-bold text-red-700">⚠️ Reset SEMUA Data</p>
        <p className="text-xs text-red-500 mt-1">Ini akan menghapus SEMUA data di atas sekaligus. Supplier tetap aman.</p>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={confirmKey}
            onChange={e => setConfirmKey(e.target.value)}
            placeholder='Ketik "RESET ALL"'
            className="rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-bold text-red-700 placeholder:text-red-300 focus:border-red-500 focus:outline-none"
          />
          <button
            onClick={handleResetAll}
            disabled={confirmKey !== 'RESET ALL'}
            className="shrink-0 rounded-xl bg-red-500 px-6 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:bg-slate-300 transition"
          >
            💣 Reset All
          </button>
        </div>
      </div>
    </div>
  );
}
