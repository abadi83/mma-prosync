'use client';

import React, { useState } from 'react';

export default function LupaPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('Email wajib diisi.'); return; }
    setSent(true);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl">
        <div className="text-center">
          <p className="text-4xl">🔑</p>
          <h1 className="mt-3 text-2xl font-bold text-brand-700">Lupa Password</h1>
          <p className="mt-1 text-sm text-slate-500">Reset password akun Anda</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">{error}</p>}
          {sent ? (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600" role="status">
              ✅ Link reset password telah dikirim ke <strong>{email}</strong>. Cek inbox Anda.
            </div>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toko@email.com" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200" />
              </label>
              <button type="submit" className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-700">Kirim Link Reset</button>
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
