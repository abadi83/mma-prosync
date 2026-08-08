import { describe, it, expect } from 'vitest';
import { POST } from './route';

describe('POST /api/lupa-password', () => {
  it('sends reset email', async () => {
    const res = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a@b.com' }),
    }));
    expect(res.status).toBe(200);
  });

  it('rejects empty email', async () => {
    const res = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    }));
    expect(res.status).toBe(400);
  });
});
