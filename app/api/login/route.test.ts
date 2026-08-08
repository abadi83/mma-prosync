import { describe, it, expect } from 'vitest';
import { POST } from './route';

function req(body: unknown) {
  return new Request('http://localhost/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

describe('POST /api/login', () => {
  it('returns token for valid demo credentials', async () => {
    const res = await POST(req({ email: 'demo@mma.id', password: 'demo123' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('token');
    expect(body.email).toBe('demo@mma.id');
  });

  it('rejects wrong password', async () => {
    const res = await POST(req({ email: 'demo@mma.id', password: 'wrong' }));
    expect(res.status).toBe(400);
  });
});
