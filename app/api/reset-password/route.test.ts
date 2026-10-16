import { describe, it, expect } from 'vitest';
import { POST } from './route';

function r(body: unknown) {
  return new Request('http://localhost', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

describe('POST /api/reset-password', () => {
  it('rejects invalid token format', async () => {
    const res = await POST(r({ token: 'abc', password: 'newpass', konfirmasi: 'newpass' }));
    expect(res.status).toBe(400);
  });

  it('rejects mismatch', async () => {
    const token = 'a'.repeat(64);
    const res = await POST(r({ token, password: 'newpass', konfirmasi: 'beda' }));
    expect(res.status).toBe(400);
  });

  it('rejects missing fields', async () => {
    const res = await POST(r({}));
    expect(res.status).toBe(400);
  });
});
