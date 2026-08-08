import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('GET /api/laba-rugi', () => {
  it('returns laba rugi data with margins', async () => {
    const res = await GET(new Request('http://localhost/api/laba-rugi'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('pendapatan');
    expect(body).toHaveProperty('labaKotor');
    expect(body).toHaveProperty('labaBersih');
    expect(body).toHaveProperty('marginKotor');
    expect(body).toHaveProperty('marginBersih');
    expect(body.labaKotor).toBe(body.pendapatan - body.hargaPokok);
  });
});
