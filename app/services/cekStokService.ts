import { mockStockData } from '@/app/mockData';

export interface CekStokItem {
  id: string;
  nama: string;
  kategori: string;
  stok: number;
  stokMin: number;
  hargaJual: number;
}

export async function getCekStok(_tokoId: string, search?: string): Promise<CekStokItem[]> {
  let data = mockStockData.cekStok;
  if (search) {
    const q = search.toLowerCase();
    data = data.filter(
      (item) =>
        item.nama.toLowerCase().includes(q) ||
        item.kategori.toLowerCase().includes(q),
    );
  }
  return data;
}
