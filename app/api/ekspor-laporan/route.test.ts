import { describe, it, expect } from 'vitest';
import { POST } from './route';

function req(body: unknown) {
  return new Request('http://localhost/api/ekspor-laporan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ekspor-laporan', () => {
  it('rejects missing fields with 400', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it('returns CSV for laba-rugi', async () => {
    const res = await POST(req({ jenis: 'laba-rugi', format: 'csv' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const text = await res.text();
    expect(text).toContain('Pendapatan');
    expect(text).toContain('8450000');
  });

  it('returns simulated PDF response', async () => {
    const res = await POST(req({ jenis: 'stok', format: 'pdf' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.format).toBe('pdf');
    expect(body).toHaveProperty('message');
  });
});
