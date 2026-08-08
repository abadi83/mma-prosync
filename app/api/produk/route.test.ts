import { describe, it, expect } from 'vitest';
import { GET, POST, PUT, DELETE } from './route';

function req(method: string, body?: unknown, id?: string) {
  return new Request(id ? `http://localhost/api/produk?id=${id}` : 'http://localhost/api/produk', {
    method, headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Produk API', () => {
  it('GET returns list', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('POST creates', async () => {
    const res = await POST(req('POST', { nama: 'Gula', kategoriId: 'k-2', kategoriNama: 'Sembako', hargaBeli: 10000, hargaJual: 14000, stokMin: 20 }));
    expect(res.status).toBe(201);
  });

  it('PUT updates', async () => {
    const list = await (await GET()).json();
    const res = await PUT(req('PUT', { id: list[0].id, nama: 'Updated', kategoriId: list[0].kategoriId, kategoriNama: list[0].kategoriNama, hargaBeli: 9999, hargaJual: 19999, stokMin: 5 }));
    expect(res.status).toBe(200);
  });

  it('DELETE removes', async () => {
    const list = await (await GET()).json();
    const res = await DELETE(req('DELETE', undefined, list[list.length - 1].id));
    expect(res.status).toBe(200);
  });
});
