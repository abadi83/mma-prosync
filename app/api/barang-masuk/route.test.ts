import { describe, it, expect } from 'vitest';
import { GET, POST } from './route';

function buildRequest(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

describe('GET /api/barang-masuk', () => {
  it('returns list of barang masuk entries', async () => {
    const req = buildRequest('http://localhost/api/barang-masuk');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('produk');
    expect(body[0]).toHaveProperty('jumlah');
    expect(body[0]).toHaveProperty('supplier');
    expect(body[0]).toHaveProperty('tanggal');
  });
});

describe('POST /api/barang-masuk', () => {
  it('rejects invalid body with 400', async () => {
    const req = buildRequest('http://localhost/api/barang-masuk', {
      method: 'POST',
      body: JSON.stringify({ produk: '' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('creates new barang masuk entry with valid data', async () => {
    const req = buildRequest('http://localhost/api/barang-masuk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produk: 'Minyak Goreng',
        jumlah: 10,
        supplier: 'PT Test',
        tanggal: '2026-08-02',
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.produk).toBe('Minyak Goreng');
    expect(body.jumlah).toBe(10);
    expect(body.supplier).toBe('PT Test');
    expect(body).toHaveProperty('id');
  });
});
