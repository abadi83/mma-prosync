import { mockSalesData } from '@/app/mockData';
import type { TransaksiItem } from '@/app/services/transaksiService';

export interface TransaksiHarianResponse {
  tanggal: string;
  transaksi: TransaksiItem[];
  totalPenjualan: number;
  jumlahTransaksi: number;
}

export async function getTransaksiHarian(
  _tokoId: string,
  tanggal?: string,
): Promise<TransaksiHarianResponse> {
  const hariIni = tanggal ?? new Date().toISOString().slice(0, 10);
  const filtered = mockSalesData.transaksi.filter((t) => t.tanggal === hariIni);
  const totalPenjualan = filtered.reduce((sum, t) => sum + t.total, 0);

  return {
    tanggal: hariIni,
    transaksi: filtered,
    totalPenjualan,
    jumlahTransaksi: filtered.length,
  };
}
