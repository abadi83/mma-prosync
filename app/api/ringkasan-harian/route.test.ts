import { describe, it, expect } from 'vitest';
import { GET } from './route';

function buildRequest(url: string): Request {
  return new Request(url);
}

describe('GET /api/ringkasan-harian', () => {
  it('returns daily summary with required fields', async () => {
    const req = buildRequest('http://localhost/api/ringkasan-harian?tanggal=2026-08-02');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('tanggal', '2026-08-02');
    expect(body).toHaveProperty('totalPenjualan');
    expect(body).toHaveProperty('jumlahTransaksi');
    expect(body).toHaveProperty('rataRataTransaksi');
    expect(body.totalPenjualan).toBeGreaterThan(0);
    expect(body.jumlahTransaksi).toBeGreaterThan(0);
  });

  it('rataRata equals total / count', async () => {
    const req = buildRequest('http://localhost/api/ringkasan-harian?tanggal=2026-08-02');
    const res = await GET(req);
    const body = await res.json();

    const expected = Math.round(body.totalPenjualan / body.jumlahTransaksi);
    expect(body.rataRataTransaksi).toBe(expected);
  });
});
