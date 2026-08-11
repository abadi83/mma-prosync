'use client';

import React, { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Email dan password wajib diisi.'); return; }

    setLoading(true);
    // ── Default admin (selalu bisa) ──
    if (email === 'demo@mma.id' && password === 'demo123') {
      const nama = 'Administrator';
      const role = 'admin';
      const roles = ['admin', 'hr', 'finance', 'purchasing', 'warehouse', 'logistik', 'inventory', 'sales'];
      document.cookie = 'auth_token=demo_token;path=/;max-age=86400;SameSite=Lax';
      document.cookie = `user_name=${encodeURIComponent(nama)};path=/;max-age=86400;SameSite=Lax`;
      document.cookie = `user_role=${role};path=/;max-age=86400;SameSite=Lax`;
      document.cookie = `user_roles=${roles.join(',')};path=/;max-age=86400;SameSite=Lax`;
      document.cookie = 'user_pegawai_id=;path=/;max-age=86400;SameSite=Lax';
      try { localStorage.setItem('mma_user_session', JSON.stringify({ nama, role, roles, pegawaiId: '' })); } catch {}
      window.location.href = '/';
      return;
    }

    // ── Cek semua pegawai dari database (mma_pegawai_data) ──
    try {
      const pegawaiData: any[] = JSON.parse(localStorage.getItem('mma_pegawai_data') || '[]');
      const pwStore = JSON.parse(localStorage.getItem('mma_pegawai_passwords') || '{}');

      for (const p of pegawaiData) {
        // Match by email atau username
        const matchEmail = p.email && p.email.toLowerCase() === email.toLowerCase();
        const matchUsername = p.username && p.username.toLowerCase() === email.toLowerCase();
        if (!matchEmail && !matchUsername) continue;

        // Password: custom > default 'pegawai123'
        const customPw = pwStore[p.id] || pwStore[p.nik];
        const validPassword = (customPw && password === customPw) || password === 'pegawai123';

        if (!validPassword) {
          setError('Password salah untuk ' + (p.nama || email));
          setLoading(false);
          return;
        }

        // Login sukses!
        const role = p.roles?.includes('admin') ? 'admin' : 'pegawai';
        const roles = p.roles || ['pegawai'];
        document.cookie = 'auth_token=pegawai_token;path=/;max-age=86400;SameSite=Lax';
        document.cookie = `user_name=${encodeURIComponent(p.nama)};path=/;max-age=86400;SameSite=Lax`;
        document.cookie = `user_role=${role};path=/;max-age=86400;SameSite=Lax`;
        document.cookie = `user_roles=${roles.join(',')};path=/;max-age=86400;SameSite=Lax`;
        document.cookie = `user_pegawai_id=${p.id};path=/;max-age=86400;SameSite=Lax`;
        try { localStorage.setItem('mma_user_session', JSON.stringify({ nama: p.nama, role, roles, pegawaiId: p.id })); } catch {}
        window.location.href = '/';
        return;
      }
    } catch {}

    setError('Email atau password salah. Coba demo@mma.id / demo123');
    setLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl">
        <div className="text-center">
          <p className="text-4xl">📊</p>
          <h1 className="mt-3 text-2xl font-bold text-brand-700">MMA ProSync</h1>
          <p className="mt-1 text-sm text-slate-500">Grow Forever, Manage Smarter</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Masuk ke Akun</h2>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">{error}</p>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@toko.id"
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>

        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          Belum punya akun?{' '}
          <a href="/daftar" className="font-semibold text-brand-500 hover:underline">Daftar</a>
          <span className="mx-2">•</span>
          <a href="/lupa-password" className="text-brand-500 hover:underline">Lupa Password?</a>
        </div>
      </div>
    </main>
  );
}
