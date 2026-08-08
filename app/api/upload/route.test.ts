import { describe, it, expect } from 'vitest';
import { POST } from './route';

function r(b: unknown) { return new Request('http://localhost',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}); }

describe('POST /api/upload', () => {
  it('accepts foto upload', async () => { const res=await POST(r({type:'foto',base64:'data:...'})); expect(res.status).toBe(200); });
  it('rejects invalid type', async () => { const res=await POST(r({type:'file',base64:'x'})); expect(res.status).toBe(400); });
});
