import { query } from '@/lib/db';

export interface KategoriItem {
  id: string;
  nama: string;
}

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getKategori(tokoId?: string): Promise<KategoriItem[]> {
  const { rows } = await query(
    'SELECT id, nama FROM kategori WHERE toko_id = $1 ORDER BY nama',
    [tokoId || DEFAULT_TOKO]
  );
  return rows;
}

export async function createKategori(nama: string, tokoId?: string): Promise<KategoriItem> {
  const { rows } = await query(
    'INSERT INTO kategori (toko_id, nama) VALUES ($1, $2) RETURNING id, nama',
    [tokoId || DEFAULT_TOKO, nama]
  );
  return rows[0];
}

export async function updateKategori(id: string, nama: string): Promise<KategoriItem | null> {
  const { rows } = await query(
    'UPDATE kategori SET nama = $2 WHERE id = $1 RETURNING id, nama',
    [id, nama]
  );
  return rows[0] || null;
}

export async function deleteKategori(id: string): Promise<boolean> {
  const { rowCount } = await query('DELETE FROM kategori WHERE id = $1', [id]);
  return (rowCount || 0) > 0;
}
