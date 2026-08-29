'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSkus } from '@/app/context/SkuContext';

interface ActivityRow {
  aksi: string;
  refLabel: string;
  namaUser: string;
  username: string;
  detail?: { marketplace?: string; toko?: string; status?: string };
  createdAt: string;
}

/** Pisahkan "Marketplace — NamaToko | ..." jadi array */
function extractTokos(status: string): string[] {
  if (!status) return [];
  return status.split('|').map(s => s.trim()).filter(Boolean);
}

/**
 * Tab 📸 Konten — lihat SKU mana yang sudah diupdate gambarnya (per toko marketplace),
 * video konten yang sudah dibuat, dan siapa user yang mengerjakan (dari activity_log).
 */
export function KontenSkuTab() {
  const { skus } = useSkus();
  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState<'semua' | 'gambar' | 'video'>('semua');
  const [aktivitas, setAktivitas] = useState<ActivityRow[]>([]);

  useEffect(() => {
    let active = true;
    fetch('/api/activity?modul=sku&limit=500')
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (active) setAktivitas(Array.isArray(d) ? d : []); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // sku → toko → editor terakhir (dari aksi 'update-gambar')
  const editorGambar = useMemo(() => {
    const m = new Map<string, Map<string, { user: string; tgl: string }>>();
    for (const a of aktivitas) {
      if (a.aksi !== 'update-gambar' || !a.refLabel) continue;
      const toko = `${a.detail?.marketplace || ''} — ${a.detail?.toko || ''}`.replace(/^\s*—\s*/, '').trim() || 'Toko';
      let byToko = m.get(a.refLabel);
      if (!byToko) { byToko = new Map(); m.set(a.refLabel, byToko); }
      const prev = byToko.get(toko);
      if (!prev || new Date(a.createdAt) > new Date(prev.tgl)) {
        byToko.set(toko, { user: a.namaUser || a.username || '-', tgl: a.createdAt });
      }
    }
    return m;
  }, [aktivitas]);

  // sku → editor video terakhir (dari aksi 'video-konten')
  const editorVideo = useMemo(() => {
    const m = new Map<string, { user: string; tgl: string; status: string }>();
    for (const a of aktivitas) {
      if (a.aksi !== 'video-konten' || !a.refLabel) continue;
      const prev = m.get(a.refLabel);
      if (!prev || new Date(a.createdAt) > new Date(prev.tgl)) {
        m.set(a.refLabel, { user: a.namaUser || a.username || '-', tgl: a.createdAt, status: a.detail?.status || 'dibuat' });
      }
    }
    return m;
  }, [aktivitas]);

  const rows = useMemo(() => {
    return skus
      .filter(s => extractTokos(s.gambarToko).length > 0 || s.videoKonten)
      .map(s => ({ ...s, tokos: extractTokos(s.gambarToko) }))
      .filter(r => {
        const q = search.toLowerCase().trim();
        if (q && !r.sku.toLowerCase().includes(q) && !r.nama.toLowerCase().includes(q)) return false;
        if (filterJenis === 'gambar' && r.tokos.length === 0) return false;
        if (filterJenis === 'video' && !r.videoKonten) return false;
        return true;
      })
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [skus, search, filterJenis]);

  const totalGambarSku = skus.filter(s => extractTokos(s.gambarToko).length > 0).length;
  const totalTokoGambar = skus.reduce((sum, s) => sum + extractTokos(s.gambarToko).length, 0);
  const totalVideo = skus.filter(s => s.videoKonten).length;

  const fmtTgl = (tgl: string) => {
    try { return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }); } catch { return '-'; }
  };

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-pink-500 to-brand-300" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">📸 Konten SKU</h2>
          <p className="text-sm text-slate-500">SKU yang sudah diupdate gambarnya (per toko marketplace) & video konten — lengkap dengan user yang mengerjakan.</p>
        </div>
        <div className="flex gap-2">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cari SKU / Nama..." className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none sm:max-w-[200px]" />
          <select value={filterJenis} onChange={e => setFilterJenis(e.target.value as 'semua' | 'gambar' | 'video')} className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 focus:border-brand-500 focus:outline-none">
            <option value="semua">Semua</option>
            <option value="gambar">🖼️ Punya Gambar</option>
            <option value="video">🎬 Punya Video</option>
          </select>
        </div>
      </div>

      {/* Ringkasan */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-emerald-50 p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{totalGambarSku}</p>
          <p className="text-xs text-emerald-500">SKU Gambar Diupdate</p>
        </div>
        <div className="rounded-xl bg-indigo-50 p-3 text-center">
          <p className="text-2xl font-bold text-indigo-600">{totalTokoGambar}</p>
          <p className="text-xs text-indigo-500">Toko Ditandai (Gambar)</p>
        </div>
        <div className="rounded-xl bg-pink-50 p-3 text-center">
          <p className="text-2xl font-bold text-pink-600">{totalVideo}</p>
          <p className="text-xs text-pink-500">SKU Punya Video</p>
        </div>
      </div>

      {/* Tabel */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase text-slate-500">
              <th className="px-3 py-3 font-semibold">SKU</th>
              <th className="px-3 py-3 font-semibold">Nama Produk</th>
              <th className="px-3 py-3 font-semibold">🖼️ Gambar per Toko (Editor)</th>
              <th className="px-3 py-3 font-semibold">🎬 Video Konten</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="py-10 text-center text-slate-400">Belum ada SKU dengan update gambar atau video konten.</td></tr>
            ) : (
              rows.map(r => {
                const edGambar = editorGambar.get(r.sku);
                const edVideo = editorVideo.get(r.sku);
                return (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className="px-3 py-2.5 font-mono text-xs text-brand-700">{r.sku}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">{r.nama}</td>
                    <td className="px-3 py-2.5">
                      {r.tokos.length === 0 ? (
                        <span className="text-xs text-slate-300">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {r.tokos.map(t => {
                            const ed = edGambar?.get(t);
                            return (
                              <span key={t} title={ed ? `Diupdate: ${ed.user} • ${fmtTgl(ed.tgl)}` : 'Belum ada catatan editor'} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                ✅ {t}
                                {ed && <span className="font-normal text-emerald-500">· {ed.user}</span>}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.videoKonten ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-semibold text-pink-700">
                          🎬 Ada {edVideo && <span className="font-normal text-pink-500">· {edVideo.user} • {fmtTgl(edVideo.tgl)}</span>}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">{rows.length} SKU ditampilkan • editor tercatat dari log aktivitas (Kepegawaian → Aktivitas).</p>
    </div>
  );
}
