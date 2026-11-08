import { query } from '@/lib/db';

export type RndStatus = 'todo' | 'proses' | 'review' | 'selesai';
export type RndPrioritas = 'rendah' | 'normal' | 'tinggi' | 'urgent';

export interface RndPetugas {
  id: string;
  nama: string;
}

export interface RndItem {
  id: string;
  namaBarang: string;
  kategori: string;
  supplier: string;
  linkWeb: string;
  fotoContoh: string;
  hargaModalTarget: number;
  hargaModalFinal: number | null;
  catatan: string;
  hasilResearch: string;
  pemberiNama: string;
  skuId: string | null;
  petugas: RndPetugas[];
  status: RndStatus;
  prioritas: RndPrioritas;
  tenggat: string | null;
  selesaiAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RndProgressItem {
  id: string;
  userNama: string;
  status: string | null;
  catatan: string;
  tanggal: string;
}

export interface RndActor {
  nama: string;
  pegawaiId?: string | null;
}

const DEFAULT_TOKO = process.env.DEFAULT_TOKO_ID || 'a0a0a0a0-0000-0000-0000-000000000001';

const SELECT_RND = `
  SELECT r.id, r.nama_barang, COALESCE(r.kategori, '') AS kategori,
         COALESCE(r.supplier, '') AS supplier, COALESCE(r.link_web, '') AS link_web,
         COALESCE(r.foto_contoh, '') AS foto_contoh,
         COALESCE(r.harga_modal_target, 0) AS harga_modal_target,
         r.harga_modal_final AS harga_modal_final,
         COALESCE(r.catatan, '') AS catatan, COALESCE(r.hasil_research, '') AS hasil_research,
         COALESCE(r.pemberi_nama, '') AS pemberi_nama,
         r.sku_id AS sku_id,
         r.status, r.prioritas,
         to_char(r.tenggat, 'YYYY-MM-DD') AS tenggat,
         to_char(r.selesai_at, 'YYYY-MM-DD HH24:MI') AS selesai_at,
         to_char(r.created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
         to_char(r.updated_at, 'YYYY-MM-DD HH24:MI') AS updated_at
  FROM rnd_produk r
`;

function mapRow(row: any): RndItem {
  return {
    id: row.id,
    namaBarang: row.nama_barang,
    kategori: row.kategori || '',
    supplier: row.supplier || '',
    linkWeb: row.link_web || '',
    fotoContoh: row.foto_contoh || '',
    hargaModalTarget: row.harga_modal_target || 0,
    hargaModalFinal: row.harga_modal_final ?? null,
    catatan: row.catatan || '',
    hasilResearch: row.hasil_research || '',
    pemberiNama: row.pemberi_nama || '',
    skuId: row.sku_id || null,
    petugas: [],
    status: row.status,
    prioritas: row.prioritas,
    tenggat: row.tenggat || null,
    selesaiAt: row.selesai_at || null,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

async function attachPetugas(items: RndItem[]): Promise<RndItem[]> {
  if (items.length === 0) return items;
  const ids = items.map(i => i.id);
  const { rows } = await query(
    `SELECT rp.rnd_id, p.id, p.nama
     FROM rnd_petugas rp
     JOIN pegawai p ON p.id = rp.pegawai_id
     WHERE rp.rnd_id = ANY($1::uuid[])
     ORDER BY p.nama`,
    [ids],
  );
  const map = new Map<string, RndPetugas[]>();
  for (const r of rows) {
    if (!map.has(r.rnd_id)) map.set(r.rnd_id, []);
    map.get(r.rnd_id)!.push({ id: r.id, nama: r.nama });
  }
  for (const item of items) item.petugas = map.get(item.id) || [];
  return items;
}

export function petugasLabel(item: RndItem): string {
  return item.petugas.length ? item.petugas.map(p => p.nama).join(', ') : '';
}

async function notif(tokoId: string, pesan: string) {
  try {
    await query(`INSERT INTO notifikasi (user_id, tipe, pesan) VALUES ($1, 'sistem', $2)`, [tokoId, pesan.slice(0, 1000)]);
    await query(
      `DELETE FROM notifikasi WHERE id IN (
         SELECT id FROM notifikasi WHERE user_id = $1 ORDER BY created_at DESC OFFSET 200
       )`,
      [tokoId],
    );
  } catch { /* notifikasi opsional */ }
}

function normalizePetugasIds(ids: any): string[] {
  if (!ids) return [];
  const arr = Array.isArray(ids) ? ids : [ids];
  return arr.filter((x: any) => typeof x === 'string' && x.trim().length > 0).map((x: string) => x.trim());
}

async function setPetugas(rndId: string, petugasIds: string[]): Promise<void> {
  await query('DELETE FROM rnd_petugas WHERE rnd_id = $1', [rndId]);
  for (const pid of petugasIds) {
    await query(
      'INSERT INTO rnd_petugas (rnd_id, pegawai_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [rndId, pid],
    );
  }
}


export async function listRnd(
  tokoId?: string,
  opts: { status?: string; petugasId?: string; search?: string; hanyaAktif?: boolean } = {},
): Promise<RndItem[]> {
  const tid = tokoId || DEFAULT_TOKO;
  const params: any[] = [tid];
  let where = 'r.toko_id = $1';
  if (opts.status) { params.push(opts.status); where += ` AND r.status = $${params.length}`; }
  if (opts.petugasId) {
    params.push(opts.petugasId);
    where += ` AND EXISTS (SELECT 1 FROM rnd_petugas rp WHERE rp.rnd_id = r.id AND rp.pegawai_id = $${params.length})`;
  }
  if (opts.search) {
    params.push(`%${opts.search}%`);
    where += ` AND (r.nama_barang ILIKE $${params.length} OR r.kategori ILIKE $${params.length}
                    OR r.supplier ILIKE $${params.length}
                    OR EXISTS (SELECT 1 FROM rnd_petugas rp2 JOIN pegawai p2 ON p2.id = rp2.pegawai_id
                               WHERE rp2.rnd_id = r.id AND p2.nama ILIKE $${params.length}))`;
  }
  if (opts.hanyaAktif) { where += ` AND r.status <> 'selesai'`; }
  const { rows } = await query(
    `${SELECT_RND} WHERE ${where} ORDER BY r.updated_at DESC LIMIT 500`,
    params,
  );
  return attachPetugas(rows.map(mapRow));
}

export async function getRnd(tokoId: string | undefined, id: string): Promise<RndItem | null> {
  const tid = tokoId || DEFAULT_TOKO;
  const { rows } = await query(`${SELECT_RND} WHERE r.id = $1 AND r.toko_id = $2`, [id, tid]);
  if (!rows[0]) return null;
  const items = await attachPetugas([mapRow(rows[0])]);
  return items[0];
}

export async function listProgress(rndId: string): Promise<RndProgressItem[]> {
  const { rows } = await query(
    `SELECT id, COALESCE(user_nama, '') AS user_nama, status,
            COALESCE(catatan, '') AS catatan, to_char(created_at, 'YYYY-MM-DD HH24:MI') AS tanggal
     FROM rnd_progress WHERE rnd_id = $1 ORDER BY created_at DESC, id DESC LIMIT 100`,
    [rndId],
  );
  return rows.map((r: any) => ({
    id: r.id,
    userNama: r.user_nama || '',
    status: r.status || null,
    catatan: r.catatan || '',
    tanggal: r.tanggal || '',
  }));
}

export interface RndInput {
  namaBarang: string;
  kategori?: string;
  supplier?: string;
  linkWeb?: string;
  fotoContoh?: string;
  hargaModalTarget?: number;
  catatan?: string;
  petugasIds?: string[];
  prioritas?: RndPrioritas;
  tenggat?: string | null;
}

export async function createRnd(tokoId: string | undefined, data: RndInput, actor: RndActor): Promise<RndItem> {
  const tid = tokoId || DEFAULT_TOKO;
  const pegawaiId = actor.pegawaiId || null;
  const petugasIds = normalizePetugasIds(data.petugasIds);
  const { rows } = await query(
    `INSERT INTO rnd_produk
       (toko_id, nama_barang, kategori, supplier, link_web, foto_contoh, harga_modal_target, catatan, pemberi_id, pemberi_nama, prioritas, tenggat)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    [
      tid,
      data.namaBarang.trim().slice(0, 255),
      (data.kategori || '').trim() || null,
      (data.supplier || '').trim() || null,
      (data.linkWeb || '').trim() || null,
      (data.fotoContoh || '').trim() || null,
      Math.max(0, Number(data.hargaModalTarget) || 0),
      (data.catatan || '').trim() || null,
      pegawaiId,
      actor.nama || 'Pemberi',
      data.prioritas || 'normal',
      data.tenggat || null,
    ],
  );
  const id = rows[0].id;
  await setPetugas(id, petugasIds);
  const item = await getRnd(tid, id);
  const namaPetugas = petugasLabel(item!);
  await notif(tid, `🧪 Research produk baru "${data.namaBarang.trim().slice(0, 80)}"${namaPetugas ? ` untuk ${namaPetugas}` : ''} — diberikan oleh ${actor.nama || 'pemilik'}`);
  return item!;
}


export interface RndPatch {
  namaBarang?: string;
  kategori?: string;
  supplier?: string;
  linkWeb?: string;
  fotoContoh?: string;
  hargaModalTarget?: number;
  hargaModalFinal?: number | null;
  catatan?: string;
  hasilResearch?: string;
  petugasIds?: string[];
  prioritas?: RndPrioritas;
  tenggat?: string | null;
  status?: RndStatus;
}

export async function updateRnd(
  tokoId: string | undefined,
  id: string,
  patch: RndPatch,
  actor: RndActor,
): Promise<RndItem | null> {
  const tid = tokoId || DEFAULT_TOKO;
  const existing = await getRnd(tid, id);
  if (!existing) return null;

  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  const add = (col: string, val: any) => { sets.push(`${col} = $${i++}`); vals.push(val); };

  if (patch.namaBarang !== undefined) add('nama_barang', String(patch.namaBarang).trim().slice(0, 255));
  if (patch.kategori !== undefined) add('kategori', String(patch.kategori).trim() || null);
  if (patch.supplier !== undefined) add('supplier', String(patch.supplier).trim() || null);
  if (patch.linkWeb !== undefined) add('link_web', String(patch.linkWeb).trim() || null);
  if (patch.fotoContoh !== undefined) add('foto_contoh', String(patch.fotoContoh).trim() || null);
  if (patch.hargaModalTarget !== undefined) add('harga_modal_target', Math.max(0, Number(patch.hargaModalTarget) || 0));
  if (patch.hargaModalFinal !== undefined) add('harga_modal_final', patch.hargaModalFinal === null ? null : Math.max(0, Number(patch.hargaModalFinal) || 0));
  if (patch.catatan !== undefined) add('catatan', String(patch.catatan).trim() || null);
  if (patch.hasilResearch !== undefined) add('hasil_research', String(patch.hasilResearch).trim() || null);
  if (patch.prioritas !== undefined) add('prioritas', patch.prioritas);
  if (patch.tenggat !== undefined) add('tenggat', patch.tenggat || null);
  if (patch.status !== undefined) {
    add('status', patch.status);
    if (patch.status === 'selesai') {
      add('selesai_at', new Date());
    } else if (existing.status === 'selesai') {
      add('selesai_at', null);
    }
  }
  if (sets.length > 0) {
    add('updated_at', new Date());
    vals.push(id, tid);
    await query(`UPDATE rnd_produk SET ${sets.join(', ')} WHERE id = $${i++} AND toko_id = $${i}`, vals);
  }

  if (patch.petugasIds !== undefined) await setPetugas(id, normalizePetugasIds(patch.petugasIds));

  const statusBerubah = patch.status !== undefined && patch.status !== existing.status;
  const hasilBerubah = patch.hasilResearch !== undefined && String(patch.hasilResearch).trim() !== existing.hasilResearch;
  if (statusBerubah || hasilBerubah || (patch.catatan !== undefined && String(patch.catatan).trim())) {
    await query(
      `INSERT INTO rnd_progress (rnd_id, pegawai_id, user_nama, status, catatan)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        actor.pegawaiId || null,
        actor.nama || 'User',
        patch.status !== undefined ? patch.status : existing.status,
        (patch.catatan !== undefined ? String(patch.catatan).trim() : '') || null,
      ],
    );
  }

  const updated = await getRnd(tid, id);
  if (updated && statusBerubah && updated.status === 'selesai') {
    const harga = updated.hargaModalFinal !== null && updated.hargaModalFinal !== undefined
      ? ` (harga modal: Rp ${updated.hargaModalFinal.toLocaleString('id-ID')})` : '';
    await notif(tid, `✅ Research produk "${updated.namaBarang.slice(0, 60)}" selesai oleh ${actor.nama || 'petugas'}${harga}`);
  } else if (updated && patch.petugasIds !== undefined) {
    const namaPetugas = petugasLabel(updated);
    await notif(tid, `🔄 Research produk "${updated.namaBarang.slice(0, 60)}" di-assign ke ${namaPetugas || '— (tanpa petugas)'} oleh ${actor.nama || 'pemilik'}`);
  }
  return updated;
}

export async function deleteRnd(tokoId: string | undefined, id: string): Promise<boolean> {
  const tid = tokoId || DEFAULT_TOKO;
  const { rowCount } = await query('DELETE FROM rnd_produk WHERE id = $1 AND toko_id = $2', [id, tid]);
  return (rowCount || 0) > 0;
}

/** Generate kode SKU unik dari nama barang (fallback: RND-<timestamp>). */
function generateSku(nama: string, existingSkus: Set<string>): string {
  const base = nama
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.slice(0, 3))
    .join('-')
    .slice(0, 20);
  const candidate = base || 'RND';
  let sku = candidate;
  let n = 1;
  while (existingSkus.has(sku)) { sku = `${candidate}-${n++}`; }
  return sku;
}

/** Naikkan research produk menjadi SKU di master data (sekali saja). */
export async function promoteToSku(
  tokoId: string | undefined,
  id: string,
  actor: RndActor,
): Promise<{ ok: boolean; sku?: string; error?: string }> {
  const tid = tokoId || DEFAULT_TOKO;
  const item = await getRnd(tid, id);
  if (!item) return { ok: false, error: 'Research tidak ditemukan.' };
  if (item.skuId) return { ok: false, error: 'Research ini sudah dimasukkan ke Master Data SKU.' };
  if (item.hargaModalFinal === null || item.hargaModalFinal === undefined || item.hargaModalFinal <= 0) {
    return { ok: false, error: 'Isi Harga Modal Final dulu sebelum memasukkan ke SKU.' };
  }

  // Ambil daftar SKU yang sudah ada untuk cek duplikat kode
  const { rows: existingRows } = await query('SELECT sku FROM sku_master WHERE toko_id = $1', [tid]);
  const existingSkus = new Set<string>(existingRows.map((r: any) => r.sku));
  const sku = generateSku(item.namaBarang, existingSkus);

  const { rows } = await query(
    `INSERT INTO sku_master
       (toko_id, sku, nama, supplier, kategori, harga_modal_lama, harga_beli_baru, harga_jual, satuan, aktif)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pcs', 1)
     RETURNING id`,
    [
      tid,
      sku,
      item.namaBarang.slice(0, 255),
      item.supplier || null,
      item.kategori || null,
      item.hargaModalFinal,
      item.hargaModalFinal,
      Math.round(item.hargaModalFinal * 1.3), // harga jual awal +30% dari modal (bisa diubah nanti)
    ],
  );
  const skuId = rows[0].id;

  await query('UPDATE rnd_produk SET sku_id = $2, updated_at = NOW() WHERE id = $1', [id, skuId]);
  await notif(tid, `📦 Research "${item.namaBarang.slice(0, 60)}" sudah dimasukkan ke Master Data SKU (${sku}) oleh ${actor.nama || 'petugas'}`);
  return { ok: true, sku };
}
