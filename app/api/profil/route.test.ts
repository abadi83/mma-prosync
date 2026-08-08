import { describe, it, expect } from 'vitest';
import { GET, PUT } from './route';

describe('Profil API', () => {
  it('GET returns profil', async () => { const r = await GET(); expect(r.status).toBe(200); });
  it('PUT updates profil', async () => {
    const r = await PUT(new Request('http://localhost', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({nama:'Updated',telepon:'081'}) }));
    expect(r.status).toBe(200);
  });
});
