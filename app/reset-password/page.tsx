'use client';

import React, { useState } from 'react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [konfirmasi, setKonfirmasi] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password || !konfirmasi) { setError('Semua field wajib diisi.'); return; }
    if (password !== konfirmasi) { setError('Password tidak cocok.'); return; }
    if (password.length < 6) { setError('Password minimal 6 karakter.'); return; }
    setSuccess(true);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl">
        <p className="text-center text-4xl">🔐</p>
        <h1 className="mt-3 text-center text-2xl font-bold text-brand-700">Reset Password</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Buat password baru untuk akun Anda</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">{error}</p>}
          {success ? (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600" role="status">
              ✅ Password berhasil direset!{' '}
              <a href="/login" className="font-semibold underline">Login sekarang</a>
            </div>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Password Baru</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 karakter" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Konfirmasi Password</span>
                <input type="password" value={konfirmasi} onChange={(e) => setKonfirmasi(e.target.value)} placeholder="Ulangi password" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200" />
              </label>
              <button type="submit" className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-700">Reset Password</button>
            </>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <a href="/login" className="font-semibold text-brand-500 hover:underline">← Kembali ke Login</a>
        </p>
      </div>
    </main>
  );
}
