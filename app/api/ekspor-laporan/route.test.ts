import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

vi.mock('@/app/services/labaRugiService', () => ({
  getLabaRugi: vi.fn(async () => ({
    pendapatan: 8450000,
    pendapatanLain: 100000,
    hargaPokok: 5200000,
    biayaOperasional: 1200000,
    biayaLain: 350000,
    labaKotor: 3250000,
    labaBersih: 1700000,
    marginKotor: 38.5,
    marginBersih: 20.1,
  })),
}));

vi.mock('@/app/services/arusKasService', () => ({
  getArusKas: vi.fn(async () => ({
    saldoAwal: 5000000,
    pemasukan: [{ sumber: 'Penjualan', jumlah: 8450000 }],
    pengeluaran: [{ sumber: 'Biaya Operasional', jumlah: 1200000 }],
    totalMasuk: 8450000,
    totalKeluar: 1200000,
    saldoAkhir: 12250000,
  })),
}));

vi.mock('@/app/services/laporanStokService', () => ({
  getLaporanStok: vi.fn(async () => ({
    totalItem: 2,
    totalNilai: 96000,
    items: [
      { nama: 'Minyak Goreng', kategori: 'Rumah Tangga', stok: 8, nilai: 96000 },
      { nama: 'Sabun Cuci', kategori: 'Rumah Tangga', stok: 12, nilai: 0 },
    ],
  })),
}));

function req(body: unknown) {
  return new Request('http://localhost/api/ekspor-laporan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ekspor-laporan', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects missing fields with 400', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it('returns CSV with real report data for laba-rugi', async () => {
    const res = await POST(req({ jenis: 'laba-rugi', format: 'csv' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const text = await res.text();
    expect(text).toContain('Pendapatan');
    expect(text).toContain('8450000');
    expect(text).toContain('Laba Bersih');
    expect(text).not.toContain('Minyak Goreng'); // bukan data stok
  });

  it('returns CSV for arus-kas with computed saldo', async () => {
    const res = await POST(req({ jenis: 'arus-kas', format: 'csv', periode: 'bulan' }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Saldo Awal');
    expect(text).toContain('12250000');
  });

  it('returns simulated PDF response', async () => {
    const res = await POST(req({ jenis: 'stok', format: 'pdf' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.format).toBe('pdf');
    expect(body).toHaveProperty('message');
  });
});
