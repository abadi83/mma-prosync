import { describe, it, expect } from 'vitest';
import { GET, POST, PUT, DELETE } from './route';

function req(method: string, body?: unknown, id?: string) {
  const url = id ? `http://localhost/api/kategori?id=${id}` : 'http://localhost/api/kategori';
  return new Request(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Kategori API', () => {
  it('GET returns list', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('POST creates new kategori', async () => {
    const res = await POST(req('POST', { nama: 'Elektronik' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.nama).toBe('Elektronik');
  });

  it('POST rejects empty nama', async () => {
    const res = await POST(req('POST', { nama: '' }));
    expect(res.status).toBe(400);
  });

  it('PUT updates kategori', async () => {
    // First find an existing one
    const list = await (await GET()).json();
    const res = await PUT(req('PUT', { id: list[0].id, nama: 'Updated' }));
    expect(res.status).toBe(200);
  });

  it('DELETE removes kategori', async () => {
    const list = await (await GET()).json();
    const last = list[list.length - 1];
    const res = await DELETE(req('DELETE', undefined, last.id));
    expect(res.status).toBe(200);
  });
});
