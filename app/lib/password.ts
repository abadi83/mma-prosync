import crypto from 'crypto';

/**
 * Hashing password dengan scrypt (Node built-in — TANPA dependency eksternal).
 * Format simpanan: scrypt:<N>:<r>:<p>:<saltHex>:<hashHex>
 *
 * Password lama memakai format `mock_hash_<plaintext>` (legacy) — tetap bisa
 * diverifikasi, dan akan di-upgrade ke scrypt saat user login/ubah password.
 */

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

const LEGACY_PREFIX = 'mock_hash_';

export function isLegacyHash(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && stored.startsWith(LEGACY_PREFIX);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (typeof stored !== 'string' || stored.length === 0) return false;

  if (isLegacyHash(stored)) {
    // Legacy: bandingkan plaintext (di-upgrade pemanggilnya setelah sukses)
    return password === stored.slice(LEGACY_PREFIX.length);
  }

  const parts = stored.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], 'hex');
  const expected = Buffer.from(parts[5], 'hex');
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p) || salt.length === 0 || expected.length === 0) {
    return false;
  }
  const actual = crypto.scryptSync(password, salt, expected.length, { N, r, p });
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
