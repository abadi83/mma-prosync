import { describe, it, expect } from 'vitest';
import {
  validateRequired,
  validatePositiveNumber,
  validateDate,
  runValidations,
} from './validation';

describe('validateRequired', () => {
  it('returns null when all fields present', () => {
    expect(validateRequired({ nama: 'Test', jumlah: 5 })).toBeNull();
  });

  it('returns error when a field is empty string', () => {
    expect(validateRequired({ nama: '', jumlah: 5 })).toContain("'nama'");
  });

  it('returns error when a field is undefined', () => {
    expect(validateRequired({ nama: 'A', jumlah: undefined })).toContain("'jumlah'");
  });
});

describe('validatePositiveNumber', () => {
  it('accepts positive integers', () => {
    expect(validatePositiveNumber(10, 'jumlah')).toBeNull();
  });

  it('rejects zero', () => {
    expect(validatePositiveNumber(0, 'jumlah')).toContain('positif');
  });

  it('rejects string non-number', () => {
    expect(validatePositiveNumber('abc', 'jumlah')).toContain('positif');
  });
});

describe('validateDate', () => {
  it('accepts YYYY-MM-DD format', () => {
    expect(validateDate('2026-08-02', 'tanggal')).toBeNull();
  });

  it('rejects invalid format', () => {
    expect(validateDate('02-08-2026', 'tanggal')).toContain('YYYY-MM-DD');
  });
});

describe('runValidations', () => {
  it('returns first error encountered', () => {
    const result = runValidations(
      null,
      "Field 'produk' wajib diisi.",
      null,
    );
    expect(result).toBe("Field 'produk' wajib diisi.");
  });

  it('returns null when all valid', () => {
    const result = runValidations(null, null, null);
    expect(result).toBeNull();
  });
});
