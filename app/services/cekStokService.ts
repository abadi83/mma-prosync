import { query } from '@/lib/db';

export interface CekStokItem {
  id: string;
  nama: string;
  kategori: string;
  stok: number;
  stokMin: number;
  hargaJual: number;
}

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getCekStok(tokoId?: string, search?: string): Promise<CekStokItem[]> {
  let sql = `SELECT p.id, p.nama, COALESCE(k.nama, '') AS kategori, p.stok, p.stok_minimum AS "stokMin", p.harga_jual AS "hargaJual"
     FROM produk p LEFT JOIN kategori k ON p.kategori_id = k.id
     WHERE p.toko_id = $1`;
  const params: any[] = [tokoId || DEFAULT_TOKO];

  if (search) {
    sql += ` AND (p.nama ILIKE $2 OR k.nama ILIKE $2)`;
    params.push(`%${search}%`);
  }

  sql += ' ORDER BY p.nama';
  const { rows } = await query(sql, params);
  return rows.map((r: any) => ({ ...r, stok: Number(r.stok), stokMin: Number(r.stokMin), hargaJual: Number(r.hargaJual) }));
}
