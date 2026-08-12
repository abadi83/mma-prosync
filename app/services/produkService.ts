import { query } from '@/lib/db';

export interface ProdukItem {
  id: string;
  nama: string;
  kategoriId: string;
  kategoriNama: string;
  hargaBeli: number;
  hargaJual: number;
  stokMin: number;
}

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getProduk(tokoId?: string): Promise<ProdukItem[]> {
  const { rows } = await query(
    `SELECT p.id, p.nama,
            COALESCE(p.kategori_id::text, '') AS "kategoriId",
            COALESCE(k.nama, '') AS "kategoriNama",
            p.harga_beli AS "hargaBeli",
            p.harga_jual AS "hargaJual",
            p.stok_minimum AS "stokMin"
     FROM produk p
     LEFT JOIN kategori k ON p.kategori_id = k.id
     WHERE p.toko_id = $1
     ORDER BY p.nama`,
    [tokoId || DEFAULT_TOKO]
  );
  return rows;
}

export async function createProduk(data: Omit<ProdukItem, 'id'>, tokoId?: string): Promise<ProdukItem> {
  const { rows } = await query(
    `INSERT INTO produk (toko_id, nama, kategori_id, harga_beli, harga_jual, stok_minimum)
     VALUES ($1, $2, $3::uuid, $4, $5, $6)
     RETURNING id, nama,
               COALESCE(kategori_id::text, '') AS "kategoriId",
               (SELECT nama FROM kategori WHERE id = $3::uuid) AS "kategoriNama",
               harga_beli AS "hargaBeli",
               harga_jual AS "hargaJual",
               stok_minimum AS "stokMin"`,
    [tokoId || DEFAULT_TOKO, data.nama, data.kategoriId || null, data.hargaBeli, data.hargaJual, data.stokMin]
  );
  return rows[0];
}

export async function updateProduk(id: string, data: Omit<ProdukItem, 'id'>): Promise<ProdukItem | null> {
  const { rows } = await query(
    `UPDATE produk SET nama = $2, kategori_id = $3::uuid, harga_beli = $4, harga_jual = $5, stok_minimum = $6
     WHERE id = $1
     RETURNING id, nama,
               COALESCE(kategori_id::text, '') AS "kategoriId",
               (SELECT nama FROM kategori WHERE id = $3::uuid) AS "kategoriNama",
               harga_beli AS "hargaBeli",
               harga_jual AS "hargaJual",
               stok_minimum AS "stokMin"`,
    [id, data.nama, data.kategoriId || null, data.hargaBeli, data.hargaJual, data.stokMin]
  );
  return rows[0] || null;
}

export async function deleteProduk(id: string): Promise<boolean> {
  const { rowCount } = await query('DELETE FROM produk WHERE id = $1', [id]);
  return (rowCount || 0) > 0;
}
