'use client';

import React, { useMemo } from 'react';
import { useSkus } from '@/app/context/SkuContext';

/* ── Warna per marketplace (konsisten dengan AgregasiDashboard) ── */
const MP_COLORS: Record<string, string> = {
  Shopee: 'bg-orange-400',
  'TikTok Shop': 'bg-slate-600',
  Lazada: 'bg-blue-500',
  Tokopedia: 'bg-emerald-500',
  Website: 'bg-violet-500',
};

function mpColor(name: string): string {
  return MP_COLORS[name] || 'bg-slate-400';
}

/* ── Ekstrak label toko dari status (pipe-separated "Marketplace — NamaToko") ── */
function extractTokos(status: string): string[] {
  if (!status || status === 'nan') return [];
  return status.split('|').map(s => s.trim()).filter(Boolean);
}

/** Ambil nama marketplace dari satu segmen "Marketplace — NamaToko". */
function mpName(segmen: string): string {
  return segmen.split('—')[0]?.trim() || segmen;
}

/**
 * 📊 SkuTokoDashboard — grafik distribusi SKU per toko & SKU yang sudah
 * di-update (gambar/konten) di Dashboard utama. Read-only: tidak mengubah
 * flow/state apa pun, hanya membaca dari SkuContext (sumber yang sama
 * dengan Data Master).
 */
export default function SkuTokoDashboard() {
  const { skus } = useSkus();

  /* ── 1. Jumlah SKU per toko (dari statusUploadToko), urut terbanyak → tersedikit ── */
  const perToko = useMemo(() => {
    const m = new Map<string, { nama: string; marketplace: string; jumlah: number }>();
    for (const s of skus) {
      for (const seg of extractTokos(s.statusUploadToko)) {
        const nama = seg.trim();
        if (!nama) continue;
        const mp = mpName(seg);
        const key = `${mp}|${nama}`;
        const e = m.get(key) || { nama, marketplace: mp, jumlah: 0 };
        e.jumlah++;
        m.set(key, e);
      }
    }
    return Array.from(m.values()).sort((a, b) => b.jumlah - a.jumlah);
  }, [skus]);
  const maxToko = Math.max(...perToko.map(d => d.jumlah), 1);

  /* ── 2. SKU yang sudah di-update/diperbarui (gambar per toko / video konten) ──
     sumber: gambarToko (SKU yang gambarnya sudah diupdate per toko) + videoKonten */
  const skuDiupdate = useMemo(() => {
    const list: { sku: string; nama: string; toko: number; video: boolean }[] = [];
    for (const s of skus) {
      const tokoGambar = extractTokos(s.gambarToko).length;
      if (tokoGambar > 0 || s.videoKonten) {
        list.push({ sku: s.sku, nama: s.nama, toko: tokoGambar, video: !!s.videoKonten });
      }
    }
    return list.sort((a, b) => b.toko - a.toko);
  }, [skus]);
  const maxUpdate = Math.max(...skuDiupdate.map(d => d.toko), 1);

  const totalSku = skus.length;
  const totalSkuDiupdate = skuDiupdate.length;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* ── Grafik 1: Toko dengan SKU terbanyak → tersedikit ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-bold text-slate-700">🏪 Toko dengan SKU Terbanyak</p>
        <p className="text-[11px] text-slate-400 mb-3">
          Jumlah SKU yang di-upload ke tiap toko marketplace ({totalSku} SKU total)
        </p>
        {perToko.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-300">Belum ada SKU yang di-upload ke toko.</p>
        ) : (
          <div className="space-y-2.5">
            {perToko.map(d => (
              <div key={d.nama}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate pr-2">
                    <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${mpColor(d.marketplace)}`} />
                    <span className="font-medium text-slate-700">{d.nama}</span>
                  </span>
                  <span className="shrink-0 font-bold text-slate-700">{d.jumlah}</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all ${mpColor(d.marketplace)}`}
                    style={{ width: `${Math.max((d.jumlah / maxToko) * 100, 3)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Grafik 2: SKU yang sudah di-update/diperbarui ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-bold text-slate-700">🖼️ SKU yang Sudah Diperbarui</p>
        <p className="text-[11px] text-slate-400 mb-3">
          SKU yang gambarnya sudah di-update per toko / sudah dibuatkan video konten ({totalSkuDiupdate} SKU)
        </p>
        {skuDiupdate.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-300">Belum ada SKU yang diperbarui.</p>
        ) : (
          <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
            {skuDiupdate.map(d => (
              <div key={d.sku}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate pr-2">
                    <span className="font-mono text-[11px] text-brand-700">{d.sku}</span>
                    <span className="text-slate-400"> — {d.nama}</span>
                  </span>
                  <span className="shrink-0 font-bold text-slate-700">
                    {d.toko} toko{d.video && <span className="ml-1 text-[10px] font-normal text-pink-500">🎬</span>}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
                    style={{ width: `${Math.max((d.toko / maxUpdate) * 100, 3)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
