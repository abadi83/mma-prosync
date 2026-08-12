import { query } from '@/lib/db';

interface StokItem { nama: string; kategori: string; stok: number; nilai: number; }

export interface LaporanStokResponse {
  totalItem: number;
  totalNilai: number;
  items: StokItem[];
}

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getLaporanStok(tokoId?: string, _periode?: string): Promise<LaporanStokResponse> {
  const tid = tokoId || DEFAULT_TOKO;

  const { rows: items } = await query(
    `SELECT p.nama, COALESCE(k.nama, 'Umum') AS kategori, p.stok, (p.stok * p.harga_beli)::int AS nilai
     FROM produk p LEFT JOIN kategori k ON p.kategori_id = k.id
     WHERE p.toko_id = $1 ORDER BY p.nama`,
    [tid]
  );

  const totalNilai = items.reduce((sum: number, i: any) => sum + Number(i.nilai), 0);

  return {
    totalItem: items.length,
    totalNilai,
    items: items.map((i: any) => ({ ...i, stok: Number(i.stok), nilai: Number(i.nilai) })),
  };
}
