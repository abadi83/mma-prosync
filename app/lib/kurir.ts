/** Klasifikasi kurir/pengiriman untuk badge khusus (terutama Instant / Same Day). */

export type KurirKategori = 'instant' | 'sameday' | 'reguler' | 'lain';

export function kategoriKurir(kurir: string): KurirKategori {
  const k = (kurir || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!k) return 'reguler';
  if (k.includes('instant') || k.includes('gosend') || k.includes('grabexpress') || k.includes('grab') || k.includes('dash') || k.includes('lalamove') || k.includes('borzo')) return 'instant';
  if (k.includes('sameday') || k.includes('same-day') || k.includes('samedaydelivery') || k.includes('kilat') || k.includes('sehari') || k.includes('nextday') || k.includes('next-day')) return 'sameday';
  return 'reguler';
}

export function kurirBadge(kurir: string): { label: string; icon: string; cls: string } | null {
  const cat = kategoriKurir(kurir);
  if (cat === 'instant') return { label: '⚡ Instant', icon: '⚡', cls: 'bg-red-100 text-red-700 border-red-200' };
  if (cat === 'sameday') return { label: '🚀 Same Day', icon: '🚀', cls: 'bg-orange-100 text-orange-700 border-orange-200' };
  return null; // reguler tidak perlu badge khusus
}
