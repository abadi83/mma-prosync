import { describe, it, expect } from 'vitest';
import { AUTH_TOKEN_TTL_SECONDS, signAuthToken, verifyAuthToken } from '@/app/lib/authToken';

const base = {
  sub: 'kasir@tokoku.id',
  name: 'Kasir',
  tokoId: 'toko-1',
  role: 'pegawai',
  roles: ['sales'],
};

describe('signAuthToken / verifyAuthToken', () => {
  it('sign & verify roundtrip', () => {
    const token = signAuthToken({
      sub: 'admin@tokoku.id',
      name: 'Administrator',
      tokoId: 'toko-1',
      role: 'admin',
      roles: ['admin', 'finance'],
    });
    expect(token.startsWith('v2.')).toBe(true);
    const payload = verifyAuthToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe('admin@tokoku.id');
    expect(payload?.roles).toContain('finance');
  });

  it('menolak token yang diutak-atik', () => {
    const token = signAuthToken(base);
    const parts = token.split('.');
    const forgedPayload = JSON.stringify({
      sub: base.sub,
      name: base.name,
      tokoId: base.tokoId,
      role: 'admin',
      roles: ['admin'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 100000,
    });
    const forged = `v2.${Buffer.from(forgedPayload).toString('base64url')}.${parts[2]}`;
    expect(verifyAuthToken(forged)).toBeNull();
  });

  it('menolak token format salah / kosong / legacy', () => {
    expect(verifyAuthToken('')).toBeNull();
    expect(verifyAuthToken('abc.def')).toBeNull();
    expect(verifyAuthToken(null)).toBeNull();
    expect(verifyAuthToken('tok_123_abc')).toBeNull();
  });

  it('token expired ditolak walau signature valid', () => {
    const token = signAuthToken(base, { nowMs: Date.now() - (AUTH_TOKEN_TTL_SECONDS + 60) * 1000 });
    expect(verifyAuthToken(token)).toBeNull();
  });

  it('dua token berbeda walau payload sama (iat berbeda)', () => {
    const t1 = signAuthToken(base, { nowMs: Date.now() - 5000 });
    const t2 = signAuthToken(base, { nowMs: Date.now() - 3000 });
    expect(t1).not.toBe(t2);
    expect(verifyAuthToken(t1)).not.toBeNull();
    expect(verifyAuthToken(t2)).not.toBeNull();
  });
});
