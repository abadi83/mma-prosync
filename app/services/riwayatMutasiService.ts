import { mockStockData } from '@/app/mockData';

export interface RiwayatMutasiItem {
  id: string;
  produk: string;
  tipe: 'masuk' | 'keluar';
  jumlah: number;
  keterangan: string;
  tanggal: string;
}

export async function getRiwayatMutasi(
  _tokoId: string,
  filter?: { tipe?: 'masuk' | 'keluar'; produk?: string },
): Promise<RiwayatMutasiItem[]> {
  let data = mockStockData.riwayatMutasi;
  if (filter?.tipe) {
    data = data.filter((item) => item.tipe === filter.tipe);
  }
  if (filter?.produk) {
    const q = filter.produk.toLowerCase();
    data = data.filter((item) => item.produk.toLowerCase().includes(q));
  }
  return data;
}
