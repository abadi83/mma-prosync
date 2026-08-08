import { describe, it, expect } from 'vitest';
import { POST, GET, DELETE } from './route';

function r(body?: unknown, method = 'POST') {
  return new Request('http://localhost', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/bukti-bayar', () => {
  it('menyimpan bukti bayar dengan data lengkap', async () => {
    const res = await POST(r({
      id: 'bukti-test-1',
      paymentId: 'pay-123',
      noPO: 'PO-001',
      supplierNama: 'PT Sinar',
      jumlah: 500000,
      nomorRef: 'REF123456',
      tanggalBayar: '2026-08-06',
      imageBase64: 'data:image/png;base64,xxx',
      ocrRawText: 'Transfer Rp 500.000',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBe('bukti-test-1');
  });

  it('menolak tanpa imageBase64', async () => {
    const res = await POST(r({ id: 'x', paymentId: 'p-1' }));
    expect(res.status).toBe(400);
  });

  it('menolak tanpa id', async () => {
    const res = await POST(r({ paymentId: 'p-1', imageBase64: 'x' }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/bukti-bayar', () => {
  it('mengembalikan list semua bukti', async () => {
    // Simpan dulu
    await POST(r({
      id: 'bukti-list-1',
      paymentId: 'pay-l1',
      noPO: 'PO-L1',
      supplierNama: 'Supplier A',
      jumlah: 100000,
      imageBase64: 'data:...',
    }));

    const res = await GET(new Request('http://localhost'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
  });

  it('mengembalikan 404 untuk id tidak dikenal', async () => {
    const res = await GET(new Request('http://localhost?id=tidak-ada'));
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/bukti-bayar', () => {
  it('menolak tanpa parameter id', async () => {
    const res = await DELETE(new Request('http://localhost'));
    expect(res.status).toBe(400);
  });

  it('mengembalikan 404 untuk id tidak dikenal', async () => {
    const res = await DELETE(new Request('http://localhost?id=tidak-ada'));
    expect(res.status).toBe(404);
  });
});
