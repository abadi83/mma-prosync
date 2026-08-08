import { mockStockData } from '@/app/mockData';

export interface BarangMasukItem {
  id: string;
  produk: string;
  jumlah: number;
  supplier: string;
  tanggal: string;
}

/**
 * Ambil daftar barang masuk untuk toko tertentu.
 * TODO: ganti query ke tabel mutasi_stok WHERE tipe='masuk'
 */
export async function getBarangMasuk(_tokoId: string): Promise<BarangMasukItem[]> {
  // SELECT ms.id, p.nama AS produk, ms.jumlah, ms.keterangan AS supplier, ms.tanggal::date
  //   FROM mutasi_stok ms JOIN produk p ON ms.produk_id = p.id
  //   WHERE ms.toko_id = $1 AND ms.tipe = 'masuk'
  //   ORDER BY ms.tanggal DESC;
  return mockStockData.barangMasuk;
}

/**
 * Catat barang masuk baru.
 * TODO: INSERT INTO mutasi_stok (produk_id, toko_id, tipe, jumlah, keterangan)
 *   Trigger akan otomatis update produk.stok.
 */
export async function addBarangMasuk(
  _tokoId: string,
  entry: Omit<BarangMasukItem, 'id'>,
): Promise<BarangMasukItem> {
  const newEntry: BarangMasukItem = {
    id: `in-${Date.now()}`,
    ...entry,
  };
  // Simulasi: data disimpan di memori service (akan diganti DB insert)
  return newEntry;
}
