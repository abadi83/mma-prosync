import { describe, it, expect } from 'vitest';
import { GET } from './route';

function buildRequest(url: string): Request {
  return new Request(url);
}

describe('GET /api/sales-summary', () => {
  it('returns sales summary with default toko_id', async () => {
    const req = buildRequest('http://localhost/api/sales-summary');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveProperty('today');
    expect(body).toHaveProperty('transactions');
    expect(body).toHaveProperty('trend');
    expect(body.today).toBeGreaterThan(0);
    expect(body.transactions).toBeGreaterThan(0);
  });

  it('accepts toko_id query param', async () => {
    const req = buildRequest('http://localhost/api/sales-summary?toko_id=abc-123');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.today).toBeGreaterThan(0);
  });

  it('trend is either up or down', async () => {
    const req = buildRequest('http://localhost/api/sales-summary');
    const res = await GET(req);
    const body = await res.json();

    expect(['up', 'down']).toContain(body.trend);
  });
});
