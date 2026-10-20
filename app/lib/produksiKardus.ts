/** Konstanta & tipe murni produksi kardus — aman di-import komponen client (tanpa pg). */

export interface KategoriDef {
  key: string;
  label: string;
  ukuran: { label: string; value: string }[]; // kosong → tanpa pilihan ukuran
  ukuranBebas?: boolean;                       // ukuran diinput bebas (kustom / packing kayu)
}

export const KARDUS_KATEGORI: KategoriDef[] = [
  { key: 'kardus-kecil', label: 'Kardus Kecil', ukuran: [] },
  { key: 'kardus-sedang', label: 'Kardus Sedang', ukuran: [] },
  { key: 'kardus-besar', label: 'Kardus Besar', ukuran: [] },
  { key: 'kardus-kustom', label: 'Kostumisasi', ukuran: [], ukuranBebas: true },
  {
    key: 'dus-portable',
    label: 'Dus Bak Cuci Piring Portable',
    ukuran: [50, 75, 97, 125].map(n => ({ label: `${n} cm`, value: String(n) })),
  },
  {
    key: 'dus-warna',
    label: 'Kardus Bak Cuci Piring Warna',
    ukuran: [50, 75, 97].map(n => ({ label: `${n} cm`, value: String(n) })),
  },
  { key: 'packing-kayu', label: 'Packing Kayu', ukuran: [], ukuranBebas: true },
];

export const KATEGORI_LABEL: Record<string, string> = Object.fromEntries(KARDUS_KATEGORI.map(k => [k.key, k.label]));

export function kategoriLabel(key: string): string {
  return KATEGORI_LABEL[key] || key;
}

export interface ProduksiKardusItem {
  id: string;
  kategori: string;
  ukuran: string;
  qty: number;
  tanggal: string;      // YYYY-MM-DD
  catatan: string;
  pegawaiNama: string;
  createdAt: string;
}

export interface RingkasanRow {
  kategori: string;
  ukuran: string;
  hari: number;
  minggu: number;
  bulan: number;
  tahun: number;
}
