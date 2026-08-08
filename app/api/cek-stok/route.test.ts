import { describe, it, expect } from 'vitest';
import { GET } from './route';

function buildRequest(url: string): Request {
  return new Request(url);
}

describe('GET /api/cek-stok', () => {
  it('returns all products with stock info', async () => {
    const req = buildRequest('http://localhost/api/cek-stok');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('nama');
    expect(body[0]).toHaveProperty('stok');
    expect(body[0]).toHaveProperty('stokMin');
    expect(body[0]).toHaveProperty('hargaJual');
  });

  it('filters by search query', async () => {
    const req = buildRequest('http://localhost/api/cek-stok?search=Kran');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(1);
    expect(body[0].nama).toBe('Kran Angsa 8005 Tongkat');
  });

  it('returns all when search is empty', async () => {
    const req = buildRequest('http://localhost/api/cek-stok?search=');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(1);
  });
});
