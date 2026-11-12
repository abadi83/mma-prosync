'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAgregasi } from '@/app/context/AgregasiContext';
import { isKurirMendesak, isStatusAktif } from '@/app/lib/kurir';
import { speak } from '@/app/lib/speak';

const TAHAP_LABEL: Record<string, string> = {
  'Perlu Dikirim': 'belum dipicking',
  'Dipicking': 'sedang dipicking',
  'DiQC': 'menunggu QC',
  'Dipacking': 'menunggu packing',
  'DiScanRunner': 'menunggu scanner/runner',
  'PendingPickup': 'menunggu pickup',
};

/**
 * Panel pengendali notifikasi suara. Menghitung pesanan kurir mendesak
 * (instant/sameday/prioritas) yang MASIH AKTIF (belum terkirim/batal) di seluruh
 * tahap gudang, lalu membacakannya + menampilkan ringkasan. Data lama yang sudah
 * terkirim/batal otomatis dikecualikan.
 */
export function InstantAlert() {
  const { allRows } = useAgregasi();
  const [muted, setMuted] = useState(false);
  const [intervalOn, setIntervalOn] = useState(false);
  const firstSpoken = useRef(false);

  // Hanya pesanan mendesak yang masih aktif (belum selesai/batal)
  const mendesak = useMemo(() => {
    return allRows.filter(r => isStatusAktif(r) && isKurirMendesak(r.kurir));
  }, [allRows]);

  // Kelompokkan per tahap workflow
  const perTahap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of mendesak) {
      const key = r.statusProses || 'Perlu Dikirim';
      m.set(key, (m.get(key) || 0) + 1);
    }
    return Array.from(m.entries());
  }, [mendesak]);

  const totalMendesak = mendesak.length;

  const bacakan = () => {
    if (muted) return;
    if (totalMendesak === 0) {
      speak('Tidak ada pesanan instant, same day, atau prioritas yang tertunda.');
      return;
    }
    const detail = perTahap.map(([k, n]) => `${n} ${TAHAP_LABEL[k] || k}`).join(', ');
    speak(`Perhatian. Ada ${totalMendesak} pesanan kurir mendesak yang masih berjalan. ${detail}.`);
  };

  // Bicara otomatis saat pertama ada data mendesak
  useEffect(() => {
    if (!muted && totalMendesak > 0 && !firstSpoken.current) {
      firstSpoken.current = true;
      const t = setTimeout(() => bacakan(), 800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalMendesak, muted]);

  // Pengulangan otomatis (interval)
  useEffect(() => {
    if (!intervalOn || muted || totalMendesak === 0) return;
    const id = setInterval(() => bacakan(), 5 * 60 * 1000); // tiap 5 menit
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalOn, muted, totalMendesak, perTahap]);

  if (totalMendesak === 0) return null;

  return (
    <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg">🚨</span>
        <p className="min-w-0 flex-1 font-semibold">
          {totalMendesak} pesanan kurir <strong>Instant / Same Day / Prioritas</strong> masih berjalan:
        </p>
        <button onClick={() => bacakan()} className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-600">
          🔊 Bacakan
        </button>
        <button onClick={() => setIntervalOn(v => !v)} className={`rounded-lg px-2.5 py-1 text-xs font-bold border ${intervalOn ? 'bg-red-500 text-white border-red-500' : 'bg-white text-red-600 border-red-200 hover:bg-red-100'}`}>
          {intervalOn ? '🔁 Auto ON' : '🔁 Auto OFF'}
        </button>
        <button onClick={() => setMuted(m => !m)} className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-red-600 border border-red-200 hover:bg-red-100">
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      {/* Rincian per tahap */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {perTahap.map(([k, n]) => (
          <span key={k} className="rounded-full bg-white border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-600">
            {TAHAP_LABEL[k] || k}: {n}
          </span>
        ))}
      </div>
    </div>
  );
}
