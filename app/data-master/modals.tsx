'use client';

import React from 'react';

export function ModalForm({ title, error, onCancel, onSave, children }: { title: string; error: string; onCancel: () => void; onSave: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-80 rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-lg font-bold text-slate-800">{title}</p>
        {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="mt-3">{children}</div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button>
          <button onClick={onSave} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white">Simpan</button>
        </div>
      </div>
    </div>
  );
}

export function ModalConfirm({ title, msg, onCancel, onConfirm }: { title: string; msg: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-80 rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-lg font-bold text-slate-800">{title}</p>
        <p className="mt-2 text-sm text-slate-600">{msg}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button>
          <button onClick={onConfirm} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white">Hapus</button>
        </div>
      </div>
    </div>
  );
}
