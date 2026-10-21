import { describe, it, expect } from 'vitest';
import { statusStok, AMBALAN_LIST, MAX_AMBALAN, STATUS_STOK_LABEL } from '@/app/lib/rakGudang';

describe('denah rak helpers', () => {
  it('rak punya 5 susun', () => {
    expect(MAX_AMBALAN).toBe(5);
    expect(AMBALAN_LIST).toEqual([1, 2, 3, 4, 5]);
  });

  it('statusStok: 0/negatif → kosong (badge merah)', () => {
    expect(statusStok(0, 10)).toBe('kosong');
    expect(statusStok(-2, 10)).toBe('kosong');
    expect(STATUS_STOK_LABEL.kosong).toBe('Kosong');
  });

  it('statusStok: stok <= minStok → menipis (badge kuning)', () => {
    expect(statusStok(5, 5)).toBe('menipis');
    expect(statusStok(3, 10)).toBe('menipis');
  });

  it('statusStok: di atas minimum → aman', () => {
    expect(statusStok(11, 10)).toBe('aman');
    expect(statusStok(4, 0)).toBe('aman'); // tanpa minimum → tidak pernah "menipis"
  });

  it('statusStok: data tidak ada → tidak-diketahui', () => {
    expect(statusStok(undefined, undefined)).toBe('tidak-diketahui');
    expect(statusStok(null, 5)).toBe('tidak-diketahui');
  });
});
