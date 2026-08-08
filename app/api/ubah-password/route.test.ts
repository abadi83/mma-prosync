import { describe, it, expect } from 'vitest';
import { POST } from './route';

function r(b: unknown) { return new Request('http://localhost',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}); }

describe('POST /api/ubah-password', () => {
  it('success with correct old password', async () => { const res=await POST(r({oldPassword:'demo123',newPassword:'newpass',konfirmasi:'newpass'})); expect(res.status).toBe(200); });
  it('rejects wrong old password', async () => { const res=await POST(r({oldPassword:'wrong',newPassword:'new',konfirmasi:'new'})); expect(res.status).toBe(400); });
});
