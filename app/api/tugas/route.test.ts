import { describe, it, expect } from 'vitest';
import { GET, POST } from './route';

describe('Tugas API', () => {
  it('GET returns list', async () => {
    const r = await GET(new Request('http://localhost/api/tugas'));
    expect(r.status).toBe(200);
  });

  it('POST creates', async () => {
    const r = await POST(new Request('http://localhost/api/tugas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ judul: 'Tugas Uji', deskripsi: 'Cek API', prioritas: 'normal', tanggalMulai: '2026-10-20' }),
    }));
    expect(r.status).toBe(201);
  });
});
