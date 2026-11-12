'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAgregasi } from '@/app/context/AgregasiContext';
import { isKurirMendesak } from '@/app/lib/kurir';
import { speak } from '@/app/lib/speak';

/**
 * Banner + notifikasi suara: pesanan kurir mendesak (instant/sameday/prioritas)
 * yang masih "Perlu Dikirim" (belum dipicking dan belum sampai scanner).
 */
export function InstantAlert() {
  const { allRows } = useAgregasi();
  const [muted, setMuted] = useState(false);
  const spokenRef = useRef(false);

  const mendesak = useMemo(() => {
    return allRows.filter(r => {
      if (!r.statusProses || r.statusProses === 'Perlu Dikirim') {
        return isKurirMendesak(r.kurir);
      }
      return false;
    });
  }, [allRows]);

  const totalMendesak = mendesak.length;

  const bacakan = () => {
    if (muted) return;
    if (totalMendesak === 0) {
      speak('Tidak ada pesanan instant atau same day yang tertunda.');
      return;
    }
    const inst = mendesak.filter(r => r.kurir && r.kurir.toLowerCase().includes('instant')).length;
    speak(`Perhatian. Ada ${totalMendesak} pesanan kurir mendesak yang belum diproses${inst > 0 ? `, termasuk ${inst} pesanan instant` : ''}. Segera lakukan picking.`);
  };

  // Bicara otomatis sekali saat ada data mendesak (setelah first render)
  useEffect(() => {
    if (!spokenRef.current && totalMendesak > 0 && !muted) {
      spokenRef.current = true;
      const t = setTimeout(() => bacakan(), 800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalMendesak]);

  if (totalMendesak === 0) return null;

  return (
    <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg">🚨</span>
        <p className="min-w-0 flex-1 font-semibold">
          {totalMendesak} pesanan kurir <strong>Instant / Same Day / Prioritas</strong> masih "Perlu Dikirim" — segera diproses picking.
        </p>
        <button
          onClick={() => bacakan()}
          className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-600"
        >
          🔊 Bacakan
        </button>
        <button
          onClick={() => setMuted(m => !m)}
          className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-red-600 border border-red-200 hover:bg-red-100"
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </div>
  );
}
