import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('GET /api/arus-kas', () => {
  it('returns arus kas with totals computed', async () => {
    const res = await GET(new Request('http://localhost/api/arus-kas'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('saldoAwal');
    expect(body).toHaveProperty('saldoAkhir');
    expect(body.totalMasuk).toBeGreaterThan(0);
    expect(body.totalKeluar).toBeGreaterThan(0);
    expect(body.saldoAkhir).toBe(body.saldoAwal + body.totalMasuk - body.totalKeluar);
  });
});
