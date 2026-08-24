'use client';

/** Pencairan Saldo Marketplace → Kas Besar.
 *  Saldo MP per toko = Σ pendapatanBersih (upload Input Keuangan) − Σ pencairan.
 *  Saat dicairkan, uang pindah dari saldo MP ke Kas Besar (bukan pendapatan baru). */

export interface PencairanEntry {
  id: string;
  tanggal: string;      // YYYY-MM-DD
  marketplace: string;  // label marketplace
  tokoId: string;       // key unik: marketplace||tokoNama
  tokoNama: string;
  jumlah: number;
  keterangan: string;
}

export const PENCAIRAN_STORAGE = 'mma_pencairan';

export function loadPencairan(): PencairanEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENCAIRAN_STORAGE);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function savePencairan(list: PencairanEntry[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(PENCAIRAN_STORAGE, JSON.stringify(list)); } catch {}
  try { window.dispatchEvent(new Event('pencairan-updated')); } catch {}
}

export function totalPencairan(list: PencairanEntry[], tokoId?: string): number {
  return list.filter(p => !tokoId || p.tokoId === tokoId).reduce((s, p) => s + (p.jumlah || 0), 0);
}
