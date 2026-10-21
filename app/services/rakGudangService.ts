import { query } from '@/lib/db';
import { RakGudangItem, RakSkuItem } from '@/app/lib/rakGudang';

const DEFAULT_TOKO = process.env.DEFAULT_TOKO_ID || 'a0a0a0a0-0000-0000-0000-000000000001';

export async function listRakGudang(tokoId?: string): Promise<RakGudangItem[]> {
  const tid = tokoId || DEFAULT_TOKO;
  const { rows } = await query(
    `SELECT id, nomor, COALESCE(nama, '') AS nama, posisi
     FROM rak_gudang WHERE toko_id = $1
     ORDER BY posisi ASC, nomor ASC`,
    [tid],
  );
  const racks: RakGudangItem[] = rows.map((r: any) => ({
    id: r.id, nomor: r.nomor, nama: r.nama || '', posisi: r.posisi || 0, skus: [],
  }));
  if (racks.length === 0) return racks;
  const ids = racks.map(r => r.id);
  const { rows: sRows } = await query(
    `SELECT id, rak_id, ambalan, sku, COALESCE(nama_sku, '') AS nama_sku, COALESCE(catatan, '') AS catatan
     FROM rak_sku WHERE rak_id = ANY($1::uuid[]) ORDER BY ambalan ASC, sku ASC`,
    [ids],
  );
  const byRak = new Map<string, RakSkuItem[]>();
  for (const s of sRows) {
    if (!byRak.has(s.rak_id)) byRak.set(s.rak_id, []);
    byRak.get(s.rak_id)!.push({
      id: s.id, ambalan: s.ambalan || 1, sku: s.sku, namaSku: s.nama_sku || '', catatan: s.catatan || '',
    });
  }
  for (const r of racks) r.skus = byRak.get(r.id) || [];
  return racks;
}

export async function createRak(tokoId: string | undefined, data: { nomor: string; nama?: string }): Promise<RakGudangItem | null> {
  const tid = tokoId || DEFAULT_TOKO;
  const nomor = data.nomor.trim();
  if (!nomor) return null;
  const { rows: pos } = await query('SELECT COALESCE(MAX(posisi), 0) + 1 AS next FROM rak_gudang WHERE toko_id = $1', [tid]);
  const { rows } = await query(
    `INSERT INTO rak_gudang (toko_id, nomor, nama, posisi) VALUES ($1, $2, $3, $4)
     RETURNING id, nomor, COALESCE(nama, '') AS nama, posisi`,
    [tid, nomor, (data.nama || '').trim() || null, pos[0].next],
  );
  return { id: rows[0].id, nomor: rows[0].nomor, nama: rows[0].nama || '', posisi: rows[0].posisi, skus: [] };
}

export async function updateRak(tokoId: string | undefined, id: string, patch: { nomor?: string; nama?: string }): Promise<RakGudangItem | null> {
  const tid = tokoId || DEFAULT_TOKO;
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (patch.nomor !== undefined) { sets.push(`nomor = $${i++}`); vals.push(patch.nomor.trim()); }
  if (patch.nama !== undefined) { sets.push(`nama = $${i++}`); vals.push(patch.nama.trim() || null); }
  if (sets.length === 0) return null;
  sets.push(`updated_at = $${i++}`); vals.push(new Date());
  vals.push(id, tid);
  const { rows } = await query(
    `UPDATE rak_gudang SET ${sets.join(', ')} WHERE id = $${i++} AND toko_id = $${i}
     RETURNING id, nomor, COALESCE(nama, '') AS nama, posisi`,
    vals,
  );
  if (!rows[0]) return null;
  const all = await listRakGudang(tid);
  return all.find(r => r.id === rows[0].id) || null;
}

export async function deleteRak(tokoId: string | undefined, id: string): Promise<boolean> {
  const tid = tokoId || DEFAULT_TOKO;
  const { rowCount } = await query('DELETE FROM rak_gudang WHERE id = $1 AND toko_id = $2', [id, tid]);
  return (rowCount || 0) > 0;
}

/* ── Penempatan SKU ── */

export async function assignSku(
  tokoId: string | undefined,
  data: { rakId: string; ambalan: number; sku: string; namaSku?: string; catatan?: string },
): Promise<{ ok: boolean; error?: string }> {
  const tid = tokoId || DEFAULT_TOKO;
  const ambalan = Math.min(5, Math.max(1, Math.round(data.ambalan || 1)));
  const sku = data.sku.trim();
  if (!data.rakId || !sku) return { ok: false, error: 'Rak & SKU wajib diisi.' };
  // Rak harus milik toko ini
  const { rows: rak } = await query('SELECT id FROM rak_gudang WHERE id = $1 AND toko_id = $2', [data.rakId, tid]);
  if (rak.length === 0) return { ok: false, error: 'Rak tidak ditemukan.' };
  try {
    await query(
      `INSERT INTO rak_sku (toko_id, rak_id, ambalan, sku, nama_sku, catatan)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (rak_id, ambalan, sku) DO UPDATE
       SET nama_sku = EXCLUDED.nama_sku, catatan = EXCLUDED.catatan, updated_at = NOW()`,
      [tid, data.rakId, ambalan, sku, (data.namaSku || '').trim() || null, (data.catatan || '').trim() || null],
    );
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.code === '23503' ? 'SKU tidak dikenal.' : 'Gagal menyimpan penempatan.' };
  }
}

export async function updateAssign(
  tokoId: string | undefined,
  id: string,
  patch: { ambalan?: number; catatan?: string },
): Promise<boolean> {
  const tid = tokoId || DEFAULT_TOKO;
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (patch.ambalan !== undefined) { sets.push(`ambalan = $${i++}`); vals.push(Math.min(5, Math.max(1, Math.round(patch.ambalan)))); }
  if (patch.catatan !== undefined) { sets.push(`catatan = $${i++}`); vals.push(patch.catatan.trim() || null); }
  if (sets.length === 0) return true;
  sets.push(`updated_at = $${i++}`); vals.push(new Date());
  vals.push(id, tid);
  const { rowCount } = await query(
    `UPDATE rak_sku SET ${sets.join(', ')} WHERE id = $${i++} AND toko_id = $${i}`,
    vals,
  );
  return (rowCount || 0) > 0;
}

export async function deleteAssign(tokoId: string | undefined, id: string): Promise<boolean> {
  const tid = tokoId || DEFAULT_TOKO;
  const { rowCount } = await query('DELETE FROM rak_sku WHERE id = $1 AND toko_id = $2', [id, tid]);
  return (rowCount || 0) > 0;
}
