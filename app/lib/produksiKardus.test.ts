import { describe, it, expect } from 'vitest';
import { KARDUS_KATEGORI, kategoriLabel } from '@/app/lib/produksiKardus';

describe('KARDUS_KATEGORI', () => {
  it('memuat semua kategori sesuai spesifikasi', () => {
    const keys = KARDUS_KATEGORI.map(k => k.key);
    expect(keys).toEqual(['kardus-kecil', 'kardus-sedang', 'kardus-besar', 'kardus-kustom', 'dus-portable', 'dus-warna', 'packing-kayu']);
  });

  it('dus portable punya ukuran 50/75/97/125 cm', () => {
    const dus = KARDUS_KATEGORI.find(k => k.key === 'dus-portable')!;
    expect(dus.ukuran.map(u => u.value)).toEqual(['50', '75', '97', '125']);
  });

  it('dus warna punya ukuran 50/75/97 cm', () => {
    const dus = KARDUS_KATEGORI.find(k => k.key === 'dus-warna')!;
    expect(dus.ukuran.map(u => u.value)).toEqual(['50', '75', '97']);
  });

  it('kostumisasi & packing kayu ukuran bebas; kardus kecil/sedang/besar tanpa ukuran', () => {
    expect(KARDUS_KATEGORI.find(k => k.key === 'kardus-kustom')!.ukuranBebas).toBe(true);
    expect(KARDUS_KATEGORI.find(k => k.key === 'packing-kayu')!.ukuranBebas).toBe(true);
    expect(KARDUS_KATEGORI.find(k => k.key === 'kardus-kecil')!.ukuran).toHaveLength(0);
    expect(KARDUS_KATEGORI.find(k => k.key === 'kardus-sedang')!.ukuran).toHaveLength(0);
    expect(KARDUS_KATEGORI.find(k => k.key === 'kardus-besar')!.ukuran).toHaveLength(0);
  });

  it('kategoriLabel menerjemahkan kunci → label', () => {
    expect(kategoriLabel('dus-portable')).toBe('Dus Bak Cuci Piring Portable');
    expect(kategoriLabel('unknown-key')).toBe('unknown-key');
  });
});
