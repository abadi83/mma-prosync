import { query } from '@/lib/db';

export interface SupplierItem { id: string; nama: string; kontak: string; alamat: string; }

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getSupplier(tokoId?: string) {
  const { rows } = await query(
    'SELECT id, nama, COALESCE(kontak, \'\') AS kontak, COALESCE(alamat, \'\') AS alamat FROM supplier WHERE toko_id = $1 ORDER BY nama',
    [tokoId || DEFAULT_TOKO]
  );
  return rows;
}

export async function createSupplier(nama: string, kontak: string, alamat: string, tokoId?: string) {
  const { rows } = await query(
    'INSERT INTO supplier (toko_id, nama, kontak, alamat) VALUES ($1, $2, $3, $4) RETURNING id, nama, COALESCE(kontak, \'\') AS kontak, COALESCE(alamat, \'\') AS alamat',
    [tokoId || DEFAULT_TOKO, nama, kontak || null, alamat || null]
  );
  return rows[0];
}

export async function updateSupplier(id: string, nama: string, kontak: string, alamat: string) {
  const { rows } = await query(
    'UPDATE supplier SET nama = $2, kontak = $3, alamat = $4 WHERE id = $1 RETURNING id, nama, COALESCE(kontak, \'\') AS kontak, COALESCE(alamat, \'\') AS alamat',
    [id, nama, kontak || null, alamat || null]
  );
  return rows[0] || null;
}

export async function deleteSupplier(id: string) {
  const { rowCount } = await query('DELETE FROM supplier WHERE id = $1', [id]);
  return (rowCount || 0) > 0;
}
