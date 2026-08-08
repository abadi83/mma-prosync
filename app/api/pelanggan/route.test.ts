import { describe, it, expect } from 'vitest';
import { GET, POST } from './route';

describe('Pelanggan API', () => {
  it('GET returns list', async () => { const r = await GET(); expect(r.status).toBe(200); });
  it('POST creates', async () => {
    const r = await POST(new Request('http://localhost', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({nama:'Test',kontak:'081'}) }));
    expect(r.status).toBe(201);
  });
});
