import { describe, it, expect } from 'vitest';
import { POST } from './route';

function req(body: unknown) {
  return new Request('http://localhost/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/register', () => {
  it('rejects empty body', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it('registers new user', async () => {
    const res = await POST(req({ namaToko: 'Test', email: 'new@test.com', password: '123456' }));
    expect(res.status).toBe(201);
  });

  it('rejects duplicate email', async () => {
    await POST(req({ namaToko: 'A', email: 'dup@test.com', password: '123456' }));
    const res = await POST(req({ namaToko: 'B', email: 'dup@test.com', password: '654321' }));
    expect(res.status).toBe(400);
  });
});
