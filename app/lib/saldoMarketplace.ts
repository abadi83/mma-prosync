'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { AgregasiRow } from '@/app/context/AgregasiContext';

/** Tandai baris operasional yang resi-nya sama dengan upload Input Keuangan
 *  → statusKeuangan "Masuk Saldo" + tanggalSaldo (tanggal laporan keuangan).
 *  Ini HANYA update status omset — tidak mengubah angka keuangan. */
export function markMasukSaldoByResi(
  setAllRows: Dispatch<SetStateAction<AgregasiRow[]>>,
  resiList: { noResi: string; tanggal: string }[]
): number {
  if (!resiList || resiList.length === 0) return 0;
  const map = new Map<string, string>();
  for (const r of resiList) {
    const k = String(r.noResi || '').trim().toLowerCase();
    if (k && !map.has(k)) map.set(k, String(r.tanggal || ''));
  }
  if (map.size === 0) return 0;
  let count = 0;
  setAllRows(prev => prev.map(r => {
    const key = String(r.noResi || '').trim().toLowerCase();
    if (key && map.has(key)) {
      count++;
      const tgl = map.get(key) || '';
      return { ...r, statusKeuangan: 'Masuk Saldo' as const, tanggalSaldo: tgl || r.tanggalSaldo };
    }
    return r;
  }));
  return count;
}

/** Cek seluruh order keuangan di server — tandai baris operasional yang resi-nya
 *  sudah pernah masuk saldo (dipakai saat upload pesanan operasional baru). */
export async function syncSaldoKeOperasional(
  setAllRows: Dispatch<SetStateAction<AgregasiRow[]>>
): Promise<number> {
  try {
    const res = await fetch('/api/marketplace-orders?t=' + Date.now(), { cache: 'no-store' });
    const list = await res.json();
    if (!Array.isArray(list)) return 0;
    return markMasukSaldoByResi(
      setAllRows,
      list.map((o: any) => ({ noResi: o.noResi || '', tanggal: o.tanggal || '' }))
    );
  } catch {
    return 0;
  }
}
