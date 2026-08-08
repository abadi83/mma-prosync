import { describe, it, expect } from 'vitest';
import { GET, POST } from './route';

function buildRequest(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

describe('GET /api/transaksi', () => {
  it('returns list of transactions', async () => {
    const req = buildRequest('http://localhost/api/transaksi');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toHaveProperty('total');
    expect(body[0]).toHaveProperty('pelanggan');
  });
});

describe('POST /api/transaksi', () => {
  it('rejects invalid body with 400', async () => {
    const req = buildRequest('http://localhost/api/transaksi', {
      method: 'POST',
      body: JSON.stringify({ produk: '', jumlah: 0 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('creates transaction with computed total', async () => {
    const req = buildRequest('http://localhost/api/transaksi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produk: 'Kopi Arabika',
        jumlah: 3,
        hargaSatuan: 35000,
        pelanggan: 'Andi',
        tanggal: '2026-08-02',
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.produk).toBe('Kopi Arabika');
    expect(body.total).toBe(105000);
    expect(body.pelanggan).toBe('Andi');
  });
});
