import { describe, it, expect } from 'vitest';
import { POST } from './route';

function r(body: unknown) {
  return new Request('http://localhost', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

describe('POST /api/reset-password', () => {
  it('resets with valid data', async () => {
    const res = await POST(r({ token: 'abc', password: 'newpass', konfirmasi: 'newpass' }));
    expect(res.status).toBe(200);
  });

  it('rejects mismatch', async () => {
    const res = await POST(r({ token: 'abc', password: 'a', konfirmasi: 'b' }));
    expect(res.status).toBe(400);
  });
});
