import { describe, it, expect } from 'vitest';
import { POST } from './route';

function req(body: unknown) {
  return new Request('http://localhost/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

describe('POST /api/login', () => {
  it('rejects missing fields with 400', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it('rejects empty email with 400', async () => {
    const res = await POST(req({ email: '', password: 'secret123' }));
    expect(res.status).toBe(400);
  });
});
