import { describe, it, expect } from 'vitest';
import { GET, PUT } from './route';

describe('Notifikasi API', () => {
  it('GET returns list', async () => { const r=await GET(); expect(r.status).toBe(200); });
  it('PUT marks all read', async () => { const r=await PUT(new Request('http://localhost',{method:'PUT'})); expect(r.status).toBe(200); });
});
