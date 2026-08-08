import { describe, it, expect } from 'vitest';
import { GET } from './route';

function buildRequest(url: string): Request {
  return new Request(url);
}

describe('GET /api/transaksi-harian', () => {
  it('returns daily transaction summary with list', async () => {
    const req = buildRequest('http://localhost/api/transaksi-harian?tanggal=2026-08-02');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('tanggal', '2026-08-02');
    expect(body).toHaveProperty('transaksi');
    expect(body).toHaveProperty('totalPenjualan');
    expect(body).toHaveProperty('jumlahTransaksi');
    expect(Array.isArray(body.transaksi)).toBe(true);
  });

  it('totalPenjualan matches sum of transaksi totals', async () => {
    const req = buildRequest('http://localhost/api/transaksi-harian?tanggal=2026-08-02');
    const res = await GET(req);
    const body = await res.json();

    const sum = body.transaksi.reduce((s: number, t: { total: number }) => s + t.total, 0);
    expect(body.totalPenjualan).toBe(sum);
  });
});
