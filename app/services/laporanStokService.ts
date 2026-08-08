interface StokItem { nama: string; kategori: string; stok: number; nilai: number; }

export interface LaporanStokResponse {
  totalItem: number;
  totalNilai: number;
  items: StokItem[];
}

const MOCK: LaporanStokResponse = {
  totalItem: 24,
  totalNilai: 38750000,
  items: [
    { nama: 'Minyak Goreng', kategori: 'Rumah Tangga', stok: 8, nilai: 96000 },
    { nama: 'Beras Premium', kategori: 'Sembako', stok: 6, nilai: 300000 },
    { nama: 'Sabun Cuci', kategori: 'Rumah Tangga', stok: 12, nilai: 36000 },
    { nama: 'Kopi Arabika', kategori: 'Minuman', stok: 15, nilai: 375000 },
  ],
};

export async function getLaporanStok(_tokoId: string, _periode?: string): Promise<LaporanStokResponse> {
  return MOCK;
}
