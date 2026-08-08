import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('GET /api/laporan-stok', () => {
  it('returns stok report with items array', async () => {
    const res = await GET(new Request('http://localhost/api/laporan-stok'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('totalItem');
    expect(body).toHaveProperty('totalNilai');
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items[0]).toHaveProperty('nama');
    expect(body.items[0]).toHaveProperty('nilai');
  });
});
