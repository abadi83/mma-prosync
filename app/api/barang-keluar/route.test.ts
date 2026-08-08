import { describe, it, expect } from 'vitest';
import { GET, POST } from './route';

function buildRequest(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

describe('GET /api/barang-keluar', () => {
  it('returns list of barang keluar entries', async () => {
    const req = buildRequest('http://localhost/api/barang-keluar');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('keperluan');
  });
});

describe('POST /api/barang-keluar', () => {
  it('rejects empty body with 400', async () => {
    const req = buildRequest('http://localhost/api/barang-keluar', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('creates barang keluar entry', async () => {
    const req = buildRequest('http://localhost/api/barang-keluar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produk: 'Sabun Cuci',
        jumlah: 3,
        keperluan: 'Penjualan',
        tanggal: '2026-08-02',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.produk).toBe('Sabun Cuci');
    expect(body.keperluan).toBe('Penjualan');
  });
});
