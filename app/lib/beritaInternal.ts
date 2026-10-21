/** Konstanta & tipe murni berita internal — aman untuk komponen client (tanpa pg). */

export type BeritaKategori = 'morning' | 'operasional' | 'klaim';

export interface KategoriBeritaDef {
  key: BeritaKategori;
  label: string;
  icon: string;
  deskripsi: string;
  gradien: string; // fallback kalau tidak ada gambar latar
}

export const KATEGORI_BERITA: KategoriBeritaDef[] = [
  { key: 'morning', label: 'Morning Briefing', icon: '🌅', deskripsi: 'Briefing pagi harian untuk seluruh tim.', gradien: 'from-amber-400 via-orange-500 to-rose-500' },
  { key: 'operasional', label: 'Operational News', icon: '🏭', deskripsi: 'Info & update operasional gudang, packing, pengiriman.', gradien: 'from-sky-400 via-blue-500 to-indigo-600' },
  { key: 'klaim', label: 'Klaim News', icon: '⚠️', deskripsi: 'Update klaim, retur & kendala marketplace.', gradien: 'from-red-400 via-rose-500 to-pink-600' },
];

export const KATEGORI_BERITA_LABEL: Record<string, string> = Object.fromEntries(KATEGORI_BERITA.map(k => [k.key, k.label]));

export function kategoriBeritaLabel(key: string): string {
  return KATEGORI_BERITA_LABEL[key] || key;
}

export function kategoriBeritaDef(key: string): KategoriBeritaDef {
  return KATEGORI_BERITA.find(k => k.key === key) || KATEGORI_BERITA[0];
}

export interface BeritaInternalItem {
  id: string;
  kategori: BeritaKategori | string;
  judul: string;
  isi: string;
  penulisId: string | null;
  penulisNama: string;
  waktu: string;        // ISO / tampilan
  gambarBg: string;     // base64 (bisa kosong)
  createdAt: string;
  updatedAt: string;
}
