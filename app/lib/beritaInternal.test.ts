import { describe, it, expect } from 'vitest';
import { KATEGORI_BERITA, kategoriBeritaLabel, kategoriBeritaDef } from '@/app/lib/beritaInternal';

describe('KATEGORI_BERITA', () => {
  it('punya 3 kategori: morning, operasional, klaim', () => {
    expect(KATEGORI_BERITA.map(k => k.key)).toEqual(['morning', 'operasional', 'klaim']);
  });

  it('label & deskripsi tersedia untuk tiap kategori', () => {
    for (const k of KATEGORI_BERITA) {
      expect(k.label.length).toBeGreaterThan(0);
      expect(k.deskripsi.length).toBeGreaterThan(0);
      expect(k.gradien.length).toBeGreaterThan(0);
    }
  });

  it('kategoriBeritaLabel menerjemahkan kunci → label, fallback ke kunci', () => {
    expect(kategoriBeritaLabel('morning')).toBe('Morning Briefing');
    expect(kategoriBeritaLabel('operasional')).toBe('Operational News');
    expect(kategoriBeritaLabel('klaim')).toBe('Klaim News');
    expect(kategoriBeritaLabel('lainnya')).toBe('lainnya');
  });

  it('kategoriBeritaDef fallback ke kategori pertama untuk kunci tak dikenal', () => {
    expect(kategoriBeritaDef('klaim').key).toBe('klaim');
    expect(kategoriBeritaDef('tidak-ada').key).toBe('morning');
  });
});
