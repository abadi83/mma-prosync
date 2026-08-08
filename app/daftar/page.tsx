'use client';

import React, { useState } from 'react';

export default function DaftarPage() {
  const [namaToko, setNamaToko] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [konfirmasi, setKonfirmasi] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!namaToko || !email || !password || !konfirmasi) { setError('Semua field wajib diisi.'); return; }
    if (password !== konfirmasi) { setError('Password dan konfirmasi tidak cocok.'); return; }
    if (password.length < 6) { setError('Password minimal 6 karakter.'); return; }

    setSuccess(true);
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
          <h2 className="text-lg font-bold text-slate-800">Daftar Akun Baru</h2>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">{error}</p>}
          {success && (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600" role="status">
              ✅ Registrasi berhasil!{' '}
              <a href="/login" className="font-semibold underline">Login sekarang</a>
            </div>
          )}

          {!success && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Nama Toko</span>
                <input value={namaToko} onChange={(e) => setNamaToko(e.target.value)} placeholder="Toko Berkah Abadi" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toko@email.com" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Password</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 karakter" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Konfirmasi Password</span>
                <input type="password" value={konfirmasi} onChange={(e) => setKonfirmasi(e.target.value)} placeholder="Ulangi password" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200" />
              </label>
              <button type="submit" className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-700">Daftar</button>
            </>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Sudah punya akun?{' '}
          <a href="/login" className="font-semibold text-brand-500 hover:underline">Masuk</a>
        </p>
      </div>
    </main>
  );
}
