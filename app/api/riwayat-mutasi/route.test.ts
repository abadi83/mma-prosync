import { describe, it, expect } from 'vitest';
import { GET } from './route';

function buildRequest(url: string): Request {
  return new Request(url);
}

describe('GET /api/riwayat-mutasi', () => {
  it('returns all mutasi entries', async () => {
    const req = buildRequest('http://localhost/api/riwayat-mutasi');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('tipe');
    expect(body[0]).toHaveProperty('produk');
    expect(['masuk', 'keluar']).toContain(body[0].tipe);
  });

  it('filters by tipe=masuk', async () => {
    const req = buildRequest('http://localhost/api/riwayat-mutasi?tipe=masuk');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
    for (const item of body) {
      expect(item.tipe).toBe('masuk');
    }
  });

  it('filters by produk name', async () => {
    const req = buildRequest('http://localhost/api/riwayat-mutasi?produk=Besi');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
    for (const item of body) {
      expect(item.produk).toContain('Besi');
    }
  });
});
