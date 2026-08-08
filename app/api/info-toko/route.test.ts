import { describe, it, expect } from 'vitest';
import { GET, PUT } from './route';

describe('Info Toko API', () => {
  it('GET returns toko info', async () => { const r = await GET(); expect(r.status).toBe(200); });
  it('PUT updates info', async () => {
    const r = await PUT(new Request('http://localhost',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nama:'New'})}));
    expect(r.status).toBe(200);
  });
});
