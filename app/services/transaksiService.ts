import { mockSalesData } from '@/app/mockData';

export interface TransaksiItem {
  id: string;
  produk: string;
  jumlah: number;
  hargaSatuan: number;
  total: number;
  pelanggan: string;
  tanggal: string;
}

export async function getTransaksi(_tokoId: string): Promise<TransaksiItem[]> {
  return mockSalesData.transaksi;
}

export async function createTransaksi(
  _tokoId: string,
  entry: Omit<TransaksiItem, 'id' | 'total'> & { hargaSatuan: number },
): Promise<TransaksiItem> {
  const total = entry.jumlah * entry.hargaSatuan;
  return {
    id: `t-${Date.now()}`,
    ...entry,
    total,
  };
}
