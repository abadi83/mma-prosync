import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, isLegacyHash } from '@/app/lib/password';

describe('hashPassword / verifyPassword', () => {
  it('hash & verify roundtrip works', () => {
    const hash = hashPassword('rahasia123');
    expect(hash.startsWith('scrypt:')).toBe(true);
    expect(verifyPassword('rahasia123', hash)).toBe(true);
    expect(verifyPassword('salah', hash)).toBe(false);
  });

  it('hash berbeda untuk password sama (salt acak)', () => {
    expect(hashPassword('sama')).not.toBe(hashPassword('sama'));
  });

  it('tidak menyimpan password dalam bentuk terbaca', () => {
    const hash = hashPassword('rahasia123');
    expect(hash).not.toContain('rahasia123');
  });

  it('mendukung hash legacy mock_hash_', () => {
    expect(isLegacyHash('mock_hash_rahasia123')).toBe(true);
    expect(verifyPassword('rahasia123', 'mock_hash_rahasia123')).toBe(true);
    expect(verifyPassword('salah', 'mock_hash_rahasia123')).toBe(false);
  });

  it('menolak format korup / kosong', () => {
    expect(verifyPassword('x', '')).toBe(false);
    expect(verifyPassword('x', 'scrypt:abc')).toBe(false);
    expect(verifyPassword('x', null)).toBe(false);
  });
});
