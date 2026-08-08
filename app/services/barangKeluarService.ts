import { mockStockData } from '@/app/mockData';

export interface BarangKeluarItem {
  id: string;
  produk: string;
  jumlah: number;
  keperluan: string;
  tanggal: string;
}

export async function getBarangKeluar(_tokoId: string): Promise<BarangKeluarItem[]> {
  return mockStockData.barangKeluar;
}

export async function addBarangKeluar(
  _tokoId: string,
  entry: Omit<BarangKeluarItem, 'id'>,
): Promise<BarangKeluarItem> {
  return { id: `out-${Date.now()}`, ...entry };
}
