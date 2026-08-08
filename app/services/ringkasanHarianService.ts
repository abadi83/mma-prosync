import { mockSalesData } from '@/app/mockData';

export interface RingkasanHarianData {
  tanggal: string;
  totalPenjualan: number;
  jumlahTransaksi: number;
  rataRataTransaksi: number;
}

export async function getRingkasanHarian(
  _tokoId: string,
  tanggal?: string,
): Promise<RingkasanHarianData> {
  const hariIni = tanggal ?? new Date().toISOString().slice(0, 10);
  const filtered = mockSalesData.transaksi.filter((t) => t.tanggal === hariIni);
  const totalPenjualan = filtered.reduce((sum, t) => sum + t.total, 0);
  const jumlahTransaksi = filtered.length;
  const rataRataTransaksi = jumlahTransaksi > 0 ? Math.round(totalPenjualan / jumlahTransaksi) : 0;

  return { tanggal: hariIni, totalPenjualan, jumlahTransaksi, rataRataTransaksi };
}
