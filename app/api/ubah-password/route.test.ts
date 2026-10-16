import { describe, it, expect } from 'vitest';
import { POST } from './route';

function r(b: unknown) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b),
  });
}

describe('POST /api/ubah-password', () => {
  it('rejects missing fields with 400', async () => {
    const res = await POST(r({}));
    expect(res.status).toBe(400);
  });

  it('rejects when not logged in with 401', async () => {
    const res = await POST(r({ oldPassword: 'x', newPassword: 'newpass123', konfirmasi: 'newpass123' }));
    expect(res.status).toBe(401);
  });

  it('rejects mismatched confirmation with 400', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'auth_token=invalid' },
      body: JSON.stringify({ oldPassword: 'x', newPassword: 'newpass123', konfirmasi: 'beda' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
