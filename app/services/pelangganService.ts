import { query } from '@/lib/db';

export interface PelangganItem { id: string; nama: string; kontak: string; }

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getPelanggan(tokoId?: string) {
  const { rows } = await query(
    'SELECT id, nama, COALESCE(kontak, \'\') AS kontak FROM pelanggan WHERE toko_id = $1 ORDER BY nama',
    [tokoId || DEFAULT_TOKO]
  );
  return rows;
}

export async function createPelanggan(nama: string, kontak: string, tokoId?: string) {
  const { rows } = await query(
    'INSERT INTO pelanggan (toko_id, nama, kontak) VALUES ($1, $2, $3) RETURNING id, nama, COALESCE(kontak, \'\') AS kontak',
    [tokoId || DEFAULT_TOKO, nama, kontak || null]
  );
  return rows[0];
}

export async function updatePelanggan(id: string, nama: string, kontak: string) {
  const { rows } = await query(
    'UPDATE pelanggan SET nama = $2, kontak = $3 WHERE id = $1 RETURNING id, nama, COALESCE(kontak, \'\') AS kontak',
    [id, nama, kontak || null]
  );
  return rows[0] || null;
}

export async function deletePelanggan(id: string) {
  const { rowCount } = await query('DELETE FROM pelanggan WHERE id = $1', [id]);
  return (rowCount || 0) > 0;
}
