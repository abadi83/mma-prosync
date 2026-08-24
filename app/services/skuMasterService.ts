import { query, queryRow } from '@/lib/db';

export interface SkuItem {
  id: string; sku: string; nama: string; grade: string; kodeSupplierVarian: string;
  statusEditGambar: string; statusUploadToko: string; supplier: string; kategori: string;
  satuan: string; hargaModalLama: number; hargaBaru: number; hargaJual: number;
  stok: number; minStok: number; aktif: number; perubahanHargaBeli: string;
}

const DEFAULT_TOKO = process.env.DEFAULT_TOKO_ID || 'a0a0a0a0-0000-0000-0000-000000000001';

const SELECT_SQL = `SELECT id, sku, nama, grade, kode_supplier_varian, status_edit_gambar, status_upload_toko,
  supplier, kategori, satuan, harga_modal_lama, harga_beli_baru, harga_jual, stok, min_stok, aktif, perubahan_harga_beli
  FROM sku_master`;

function mapRow(row: any): SkuItem {
  return {
    id: row.id, sku: row.sku, nama: row.nama, grade: row.grade || '', kodeSupplierVarian: row.kode_supplier_varian || '',
    statusEditGambar: row.status_edit_gambar || '', statusUploadToko: row.status_upload_toko || '', supplier: row.supplier || '',
    kategori: row.kategori || '', satuan: row.satuan || 'pcs', hargaModalLama: row.harga_modal_lama || 0,
    hargaBaru: row.harga_beli_baru || 0, hargaJual: row.harga_jual || 0, stok: row.stok || 0, minStok: row.min_stok || 0,
    aktif: row.aktif ?? 1, perubahanHargaBeli: row.perubahan_harga_beli || '',
  };
}

export async function getAllSku(tokoId?: string): Promise<SkuItem[]> {
  const { rows } = await query(`${SELECT_SQL} WHERE toko_id = $1 ORDER BY nama`, [tokoId || DEFAULT_TOKO]);
  return rows.map(mapRow);
}

export async function getSkuByCode(sku: string, tokoId?: string): Promise<SkuItem | null> {
  const row = await queryRow(`${SELECT_SQL} WHERE toko_id = $1 AND sku = $2`, [tokoId || DEFAULT_TOKO, sku]);
  return row ? mapRow(row) : null;
}

/** Ambil gambar SKU per kode (terpisah dari getAllSku supaya localStorage tidak membengkak) */
export async function getSkuGambarMap(skus: string[], tokoId?: string): Promise<Record<string, string | null>> {
  if (!skus || skus.length === 0) return {};
  const { rows } = await query(
    `SELECT sku, gambar FROM sku_master WHERE toko_id = $1 AND sku = ANY($2::text[])`,
    [tokoId || DEFAULT_TOKO, skus]
  );
  const map: Record<string, string | null> = {};
  for (const s of skus) map[s] = null;
  for (const r of rows) map[r.sku] = r.gambar || null;
  return map;
}

export async function setSkuGambar(sku: string, gambar: string, tokoId?: string): Promise<boolean> {
  const { rowCount } = await query(
    `UPDATE sku_master SET gambar = $3, updated_at = NOW() WHERE toko_id = $1 AND sku = $2`,
    [tokoId || DEFAULT_TOKO, sku, gambar || null]
  );
  return (rowCount || 0) > 0;
}

export async function createSku(data: Omit<SkuItem, 'id'>, tokoId?: string): Promise<SkuItem> {
  const { rows } = await query(
    `INSERT INTO sku_master (toko_id, sku, nama, grade, kode_supplier_varian, status_edit_gambar, status_upload_toko,
      supplier, kategori, satuan, harga_modal_lama, harga_beli_baru, harga_jual, stok, min_stok, aktif, perubahan_harga_beli)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (toko_id, sku) DO UPDATE SET
       nama=EXCLUDED.nama, grade=EXCLUDED.grade, kode_supplier_varian=EXCLUDED.kode_supplier_varian,
       status_edit_gambar=EXCLUDED.status_edit_gambar, status_upload_toko=EXCLUDED.status_upload_toko,
       supplier=EXCLUDED.supplier, kategori=EXCLUDED.kategori, satuan=EXCLUDED.satuan,
       harga_modal_lama=EXCLUDED.harga_modal_lama, harga_beli_baru=EXCLUDED.harga_beli_baru,
       harga_jual=EXCLUDED.harga_jual, stok=EXCLUDED.stok, min_stok=EXCLUDED.min_stok,
       aktif=EXCLUDED.aktif, perubahan_harga_beli=EXCLUDED.perubahan_harga_beli, updated_at=NOW()
     RETURNING *`,
    [tokoId || DEFAULT_TOKO, data.sku, data.nama, data.grade, data.kodeSupplierVarian, data.statusEditGambar,
     data.statusUploadToko, data.supplier, data.kategori, data.satuan || 'pcs', data.hargaModalLama || 0,
     data.hargaBaru || 0, data.hargaJual || 0, data.stok || 0, data.minStok || 0, data.aktif ?? 1, data.perubahanHargaBeli || '']
  );
  return mapRow(rows[0]);
}

export async function updateSku(id: string, data: Partial<SkuItem>, tokoId?: string): Promise<SkuItem | null> {
  const existing = await queryRow('SELECT * FROM sku_master WHERE id = $1 AND toko_id = $2', [id, tokoId || DEFAULT_TOKO]);
  if (!existing) return null;
  const sets: string[] = []; const vals: any[] = []; let i = 1;
  const add = (col: string, val: any) => { sets.push(`${col} = $${i++}`); vals.push(val); };
  if (data.sku !== undefined) add('sku', data.sku); if (data.nama !== undefined) add('nama', data.nama);
  if (data.grade !== undefined) add('grade', data.grade); if (data.kodeSupplierVarian !== undefined) add('kode_supplier_varian', data.kodeSupplierVarian);
  if (data.statusEditGambar !== undefined) add('status_edit_gambar', data.statusEditGambar); if (data.statusUploadToko !== undefined) add('status_upload_toko', data.statusUploadToko);
  if (data.supplier !== undefined) add('supplier', data.supplier); if (data.kategori !== undefined) add('kategori', data.kategori);
  if (data.satuan !== undefined) add('satuan', data.satuan); if (data.hargaModalLama !== undefined) add('harga_modal_lama', data.hargaModalLama);
  if (data.hargaBaru !== undefined) add('harga_beli_baru', data.hargaBaru); if (data.hargaJual !== undefined) add('harga_jual', data.hargaJual);
  if (data.stok !== undefined) add('stok', data.stok); if (data.minStok !== undefined) add('min_stok', data.minStok);
  if (data.aktif !== undefined) add('aktif', data.aktif); if (data.perubahanHargaBeli !== undefined) add('perubahan_harga_beli', data.perubahanHargaBeli);
  if (sets.length === 0) return mapRow(existing);
  vals.push(id);
  const { rows } = await query(`UPDATE sku_master SET ${sets.join(', ')}, updated_at=NOW() WHERE id = $${i} RETURNING *`, vals);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteSku(id: string, tokoId?: string): Promise<boolean> {
  const { rowCount } = await query('DELETE FROM sku_master WHERE id = $1 AND toko_id = $2', [id, tokoId || DEFAULT_TOKO]);
  return (rowCount || 0) > 0;
}

export async function bulkUpsertSku(items: Omit<SkuItem, 'id'>[], tokoId?: string): Promise<SkuItem[]> {
  const out: SkuItem[] = [];
  for (const item of items) out.push(await createSku(item, tokoId));
  return out;
}
