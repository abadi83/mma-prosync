import { describe, it, expect } from 'vitest';
import { GET } from './route';

function buildRequest(url: string): Request {
  return new Request(url);
}

describe('GET /api/stock-summary', () => {
  it('returns stock summary with default toko_id', async () => {
    const req = buildRequest('http://localhost/api/stock-summary');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveProperty('totalItems');
    expect(body).toHaveProperty('lowStockCount');
    expect(body).toHaveProperty('items');
    expect(body.totalItems).toBeGreaterThan(0);
    expect(body.items.length).toBeGreaterThan(0);
  });

  it('returns stock summary for specific toko_id', async () => {
    const req = buildRequest('http://localhost/api/stock-summary?toko_id=test-123');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalItems).toBeGreaterThan(0);
  });

  it('each item has required fields', async () => {
    const req = buildRequest('http://localhost/api/stock-summary');
    const res = await GET(req);
    const body = await res.json();

    for (const item of body.items) {
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('stock');
      expect(item).toHaveProperty('minStock');
      expect(item).toHaveProperty('category');
    }
  });
});
