/** Konstanta & helper murni Denah Rak Gudang — aman untuk komponen client. */

export const MAX_AMBALAN = 5; // rak besi 5 susun

export const AMBALAN_LIST = [1, 2, 3, 4, 5];

export type StatusStok = 'kosong' | 'menipis' | 'aman' | 'tidak-diketahui';

/** Badge stok di denah: kosong → MERAH, menipis → KUNING, aman → hijau. */
export function statusStok(stok: number | null | undefined, minStok: number | null | undefined): StatusStok {
  if (stok === null || stok === undefined || typeof stok !== 'number') return 'tidak-diketahui';
  if (stok <= 0) return 'kosong';
  const min = typeof minStok === 'number' && minStok >= 0 ? minStok : 0;
  if (min > 0 && stok <= min) return 'menipis';
  return 'aman';
}

export const STATUS_STOK_LABEL: Record<StatusStok, string> = {
  kosong: 'Kosong',
  menipis: 'Menipis',
  aman: 'Aman',
  'tidak-diketahui': '?',
};

export const STATUS_STOK_BADGE: Record<StatusStok, string> = {
  kosong: 'bg-red-600 text-white',
  menipis: 'bg-amber-400 text-white',
  aman: 'bg-emerald-500 text-white',
  'tidak-diketahui': 'bg-slate-300 text-slate-600',
};

export interface RakSkuItem {
  id: string;
  ambalan: number;
  sku: string;
  namaSku: string;
  catatan: string;
}

export interface RakGudangItem {
  id: string;
  nomor: string;
  nama: string;
  posisi: number;
  skus: RakSkuItem[];
}
