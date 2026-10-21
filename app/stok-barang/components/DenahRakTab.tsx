'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSkus } from '@/app/context/SkuContext';
import { SkuPicker } from '@/app/stok-barang/components/SkuPicker';
import { AMBALAN_LIST, MAX_AMBALAN, statusStok, STATUS_STOK_BADGE, STATUS_STOK_LABEL, RakGudangItem, RakSkuItem } from '@/app/lib/rakGudang';

export function DenahRakTab() {
  const { skus } = useSkus();
  const [racks, setRacks] = useState<RakGudangItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sukses, setSukses] = useState('');
  const [showFormRak, setShowFormRak] = useState(false);
  const [editRak, setEditRak] = useState<RakGudangItem | null>(null);
  const [hapusRak, setHapusRak] = useState<RakGudangItem | null>(null);
  const [formAssign, setFormAssign] = useState<{ rak: RakGudangItem } | null>(null);
  const [moveAssign, setMoveAssign] = useState<{ rak: RakGudangItem; item: RakSkuItem } | null>(null);
  const [hapusAssign, setHapusAssign] = useState<{ rak: RakGudangItem; item: RakSkuItem } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/rak-gudang');
      if (res.ok) {
        const data = await res.json();
        setRacks(Array.isArray(data) ? data : []);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); const t = setInterval(refresh, 30000); return () => clearInterval(t); }, [refresh]);

  const flash = (msg: string) => { setSukses(msg); setTimeout(() => setSukses(''), 2500); };

  const skuMap = useMemo(() => {
    const m = new Map<string, { nama: string; stok: number; minStok: number }>();
    for (const s of skus) m.set(s.sku, { nama: s.nama, stok: s.stok, minStok: s.minStok });
    return m;
  }, [skus]);

  const q = search.trim().toLowerCase();
  const rakFiltered = useMemo(() => {
    if (!q) return racks;
    return racks.map(r => ({
      ...r,
      skus: r.skus.filter(s => s.sku.toLowerCase().includes(q) || (s.namaSku || '').toLowerCase().includes(q)),
    }));
  }, [racks, q]);

  const totalSku = racks.reduce((s, r) => s + r.skus.length, 0);
  const totalKosong = racks.reduce((s, r) => s + r.skus.filter(x => statusStok(skuMap.get(x.sku)?.stok, skuMap.get(x.sku)?.minStok) === 'kosong').length, 0);

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🗄️ Denah Rak Gudang</h2>
          <p className="text-sm text-slate-500">{racks.length} rak besi • {MAX_AMBALAN} susun per rak • {totalSku} SKU terpasang{totalKosong > 0 && <span className="font-bold text-red-600"> • {totalKosong} kosong</span>}</p>
        </div>
        <div className="flex items-center gap-2">
          {sukses && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{sukses}</span>}
          <button onClick={() => { setEditRak(null); setShowFormRak(true); }} className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">＋ Tambah Rak</button>
        </div>
      </div>

      {/* Legenda + pencarian */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-white p-2">
        <span className="text-[10px] font-bold uppercase text-slate-400">Badge stok:</span>
        {(['kosong', 'menipis', 'aman'] as const).map(k => (
          <span key={k} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STOK_BADGE[k]}`}>{STATUS_STOK_LABEL[k]}</span>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cari SKU di denah…" className="ml-auto min-w-40 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm sm:max-w-56" />
      </div>

      {/* Grid denah rak */}
      {loading ? (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">Memuat denah…</p>
      ) : racks.length === 0 ? (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">Belum ada rak. Klik "＋ Tambah Rak" untuk mulai menyusun denah gudang.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rakFiltered.map(rak => (
            <div key={rak.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Kepala rak */}
              <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-slate-700 to-slate-500 px-3 py-2 text-white">
                <div className="min-w-0">
                  <p className="text-sm font-bold">Rak {rak.nomor}</p>
                  {rak.nama && <p className="truncate text-[10px] text-white/70">{rak.nama}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => { setEditRak(rak); setShowFormRak(true); }} className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold hover:bg-white/30" title="Ubah nomor rak">✏️</button>
                  <button onClick={() => setHapusRak(rak)} className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold hover:bg-red-500" title="Hapus rak">🗑️</button>
                </div>
              </div>

              {/* 5 susun */}
              <div className="divide-y divide-slate-100">
                {AMBALAN_LIST.map(a => {
                  const items = (rak.skus || []).filter(s => s.ambalan === a);
                  return (
                    <div key={a} className="flex items-start gap-2 px-3 py-2">
                      <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">S{a}</span>
                      <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                        {items.length === 0 ? (
                          <span className="text-[10px] text-slate-300">— kosong —</span>
                        ) : items.map(it => {
                          const info = skuMap.get(it.sku);
                          const st = statusStok(info?.stok, info?.minStok);
                          const match = q && (it.sku.toLowerCase().includes(q) || (it.namaSku || '').toLowerCase().includes(q));
                          return (
                            <span key={it.id} title={`${it.namaSku || it.sku}${it.catatan ? ` — ${it.catatan}` : ''}`}
                              className={`flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-2 pr-1 text-[10px] ${match ? 'ring-2 ring-brand-400' : ''}`}>
                              <span className="max-w-28 truncate font-semibold text-slate-700">{it.namaSku || it.sku}</span>
                              <span className={`rounded-full px-1.5 py-0.5 font-bold ${STATUS_STOK_BADGE[st]}`}>{STATUS_STOK_LABEL[st]}</span>
                              <button onClick={() => setMoveAssign({ rak, item: it })} className="rounded px-0.5 text-slate-300 hover:text-brand-600" title="Pindah susun">↕</button>
                              <button onClick={() => setHapusAssign({ rak, item: it })} className="rounded px-0.5 text-slate-300 hover:text-red-500" title="Lepas dari rak">✕</button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-slate-100 px-3 py-2">
                <button onClick={() => setFormAssign({ rak })} className="w-full rounded-lg bg-brand-50 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">➕ Isi Rak {rak.nomor}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal tambah/edit rak */}
      {showFormRak && <FormRak edit={editRak} onClose={() => setShowFormRak(false)} onSaved={() => { setShowFormRak(false); refresh(); flash('✅ Rak tersimpan'); }} />}

      {/* Modal isi rak (taruh SKU) */}
      {formAssign && <FormAssign
        rak={formAssign.rak}
        skus={skus}
        onClose={() => setFormAssign(null)}
        onSaved={() => { setFormAssign(null); refresh(); flash('✅ SKU ditempatkan'); }}
      />}

      {/* Modal pindah susun */}
      {moveAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-72 rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-sm font-bold text-slate-800">↕ Pindah susun — {moveAssign.item.namaSku || moveAssign.item.sku}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {AMBALAN_LIST.map(a => (
                <button key={a} onClick={async () => {
                  await fetch('/api/rak-gudang/assign', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: moveAssign.item.id, ambalan: a }) });
                  setMoveAssign(null); refresh(); flash('✅ Susun diperbarui');
                }} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${moveAssign.item.ambalan === a ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  Susun {a}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setMoveAssign(null)} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Konfirmasi lepas SKU */}
      {hapusAssign && (
        <Konfirmasi
          title="🗑️ Lepas SKU dari Rak"
          msg={`Lepaskan "${hapusAssign.item.namaSku || hapusAssign.item.sku}" dari Rak ${hapusAssign.rak.nomor} susun ${hapusAssign.item.ambalan}?`}
          onBatal={() => setHapusAssign(null)}
          onYa={async () => { await fetch(`/api/rak-gudang/assign?id=${encodeURIComponent(hapusAssign.item.id)}`, { method: 'DELETE' }); setHapusAssign(null); refresh(); flash('🗑️ SKU dilepas'); }}
        />
      )}

      {/* Konfirmasi hapus rak */}
      {hapusRak && (
        <Konfirmasi
          title="🗑️ Hapus Rak"
          msg={`Hapus Rak ${hapusRak.nomor}? ${hapusRak.skus.length} penempatan SKU di rak ini ikut terhapus (data SKU-nya tetap aman di master).`}
          onBatal={() => setHapusRak(null)}
          onYa={async () => { await fetch(`/api/rak-gudang?id=${encodeURIComponent(hapusRak.id)}`, { method: 'DELETE' }); setHapusRak(null); refresh(); flash('🗑️ Rak dihapus'); }}
        />
      )}
    </div>
  );
}

/* ── Form rak baru / edit nomor ── */
function FormRak({ edit, onSaved, onClose }: { edit: RakGudangItem | null; onSaved: () => void; onClose: () => void }) {
  const [nomor, setNomor] = useState(edit?.nomor || '');
  const [nama, setNama] = useState(edit?.nama || '');
  const [err, setErr] = useState('');
  const save = async () => {
    if (!nomor.trim()) { setErr('Nomor rak wajib diisi.'); return; }
    const res = await fetch('/api/rak-gudang', {
      method: edit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edit ? { id: edit.id, nomor, nama } : { nomor, nama }),
    });
    if (res.ok) onSaved();
    else { const j = await res.json().catch(() => null); setErr(j?.error || 'Gagal menyimpan rak.'); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-80 rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-lg font-bold text-slate-800">{edit ? '✏️ Ubah Rak' : '➕ Tambah Rak'}</p>
        {err && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
        <div className="mt-3 space-y-2">
          <input value={nomor} onChange={e => setNomor(e.target.value)} placeholder="Nomor rak (cth: 1, A, 01-AS)" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input value={nama} onChange={e => setNama(e.target.value)} placeholder="Nama / posisi (opsional, cth: dekat pintu)" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <p className="text-[10px] text-slate-400">Setiap rak otomatis punya {MAX_AMBALAN} susun (S1–S{MAX_AMBALAN}) untuk penempatan SKU.</p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button>
          <button onClick={save} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white">💾 Simpan</button>
        </div>
      </div>
    </div>
  );
}

/* ── Form taruh SKU ke rak ── */
function FormAssign({ rak, skus, onSaved, onClose }: {
  rak: RakGudangItem;
  skus: any[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [ambalan, setAmbalan] = useState(1);
  const [sku, setSku] = useState('');
  const [catatan, setCatatan] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!sku) { setErr('Pilih SKU dulu.'); return; }
    setBusy(true);
    const namaSku = skus.find(s => s.sku === sku)?.nama || '';
    const res = await fetch('/api/rak-gudang/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rakId: rak.id, ambalan, sku, namaSku, catatan }),
    });
    if (res.ok) onSaved();
    else { const j = await res.json().catch(() => null); setErr(j?.error || 'Gagal menyimpan.'); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-lg font-bold text-slate-800">➕ Isi Rak {rak.nomor}</p>
        {err && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
        <div className="mt-3 space-y-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500">Susun (1–5)</span>
            <div className="flex gap-1.5">
              {AMBALAN_LIST.map(a => (
                <button key={a} onClick={() => setAmbalan(a)} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold ${ambalan === a ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>S{a}</button>
              ))}
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500">SKU</span>
            <SkuPicker skus={skus} value={sku} onChange={setSku} placeholder="🔍 Cari nama produk atau SKU…" />
          </label>
          <input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan (opsional)…" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button>
          <button onClick={save} disabled={busy} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">{busy ? 'Menyimpan…' : '💾 Tempatkan'}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal konfirmasi ── */
function Konfirmasi({ title, msg, onYa, onBatal }: { title: string; msg: string; onYa: () => void; onBatal: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-80 rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-lg font-bold text-slate-800">{title}</p>
        <p className="mt-2 text-sm text-slate-600">{msg}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onBatal} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Batal</button>
          <button onClick={onYa} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white">Ya</button>
        </div>
      </div>
    </div>
  );
}
