import { query } from '@/lib/db';

export type TugasStatus = 'todo' | 'proses' | 'review' | 'selesai';
export type TugasPrioritas = 'rendah' | 'normal' | 'tinggi' | 'urgent';

export interface TugasPetugas {
  id: string;
  nama: string;
  pengawas?: boolean; // pegawai ini punya role pengawas
}

export interface TugasItem {
  id: string;
  judul: string;
  deskripsi: string;
  pemberiNama: string;
  petugas: TugasPetugas[];      // bisa lebih dari 1 orang
  prioritas: TugasPrioritas;
  status: TugasStatus;
  progress: number;
  tanggalMulai: string | null;
  tenggat: string | null;
  selesaiAt: string | null;
  laporanSelesai: string;
  createdAt: string;
  updatedAt: string;
}

export interface TugasProgressItem {
  id: string;
  userNama: string;
  status: string | null;
  progress: number;
  catatan: string;
  tanggal: string;
}

export interface TugasActor {
  nama: string;
  pegawaiId?: string | null;
}

const DEFAULT_TOKO = process.env.DEFAULT_TOKO_ID || 'a0a0a0a0-0000-0000-0000-000000000001';

const SELECT_TUGAS = `
  SELECT t.id, t.judul, COALESCE(t.deskripsi, '') AS deskripsi,
         COALESCE(t.pemberi_nama, '') AS pemberi_nama,
         t.prioritas, t.status, t.progress,
         to_char(t.tanggal_mulai, 'YYYY-MM-DD') AS tanggal_mulai,
         to_char(t.tenggat, 'YYYY-MM-DD') AS tenggat,
         to_char(t.selesai_at, 'YYYY-MM-DD HH24:MI') AS selesai_at,
         COALESCE(t.laporan_selesai, '') AS laporan_selesai,
         to_char(t.created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
         to_char(t.updated_at, 'YYYY-MM-DD HH24:MI') AS updated_at
  FROM tugas t
`;

function mapRow(row: any): TugasItem {
  return {
    id: row.id,
    judul: row.judul,
    deskripsi: row.deskripsi || '',
    pemberiNama: row.pemberi_nama || '',
    petugas: [],
    prioritas: row.prioritas,
    status: row.status,
    progress: row.progress || 0,
    tanggalMulai: row.tanggal_mulai || null,
    tenggat: row.tenggat || null,
    selesaiAt: row.selesai_at || null,
    laporanSelesai: row.laporan_selesai || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

/** Ambil daftar petugas untuk banyak tugas sekaligus (1 query) */
async function attachPetugas(items: TugasItem[]): Promise<TugasItem[]> {
  if (items.length === 0) return items;
  const ids = items.map(i => i.id);
  const { rows } = await query(
    `SELECT tp.tugas_id, p.id, p.nama, p.roles
     FROM tugas_petugas tp
     JOIN pegawai p ON p.id = tp.pegawai_id
     WHERE tp.tugas_id = ANY($1::uuid[])
     ORDER BY p.nama`,
    [ids],
  );
  const map = new Map<string, TugasPetugas[]>();
  for (const r of rows) {
    if (!map.has(r.tugas_id)) map.set(r.tugas_id, []);
    const roles: unknown = r.roles;
    map.get(r.tugas_id)!.push({
      id: r.id,
      nama: r.nama,
      pengawas: Array.isArray(roles) && roles.includes('pengawas'),
    });
  }
  for (const item of items) item.petugas = map.get(item.id) || [];
  return items;
}

export function petugasLabel(item: TugasItem): string {
  return item.petugas.length ? item.petugas.map(p => (p.pengawas ? `🛡️ ${p.nama}` : p.nama)).join(', ') : '';
}

export async function listTugas(
  tokoId?: string,
  opts: { status?: string; petugasId?: string; search?: string; hanyaAktif?: boolean } = {},
): Promise<TugasItem[]> {
  const tid = tokoId || DEFAULT_TOKO;
  const params: any[] = [tid];
  let where = 't.toko_id = $1';
  if (opts.status) { params.push(opts.status); where += ` AND t.status = $${params.length}`; }
  if (opts.petugasId) {
    params.push(opts.petugasId);
    where += ` AND EXISTS (SELECT 1 FROM tugas_petugas tp WHERE tp.tugas_id = t.id AND tp.pegawai_id = $${params.length})`;
  }
  if (opts.search) {
    params.push(`%${opts.search}%`);
    where += ` AND (t.judul ILIKE $${params.length} OR t.pemberi_nama ILIKE $${params.length}
                    OR EXISTS (SELECT 1 FROM tugas_petugas tp2 JOIN pegawai p2 ON p2.id = tp2.pegawai_id
                               WHERE tp2.tugas_id = t.id AND p2.nama ILIKE $${params.length}))`;
  }
  if (opts.hanyaAktif) { where += ` AND t.status <> 'selesai'`; }
  const { rows } = await query(
    `${SELECT_TUGAS} WHERE ${where} ORDER BY t.updated_at DESC LIMIT 500`,
    params,
  );
  return attachPetugas(rows.map(mapRow));
}

export async function getTugas(tokoId: string | undefined, id: string): Promise<TugasItem | null> {
  const tid = tokoId || DEFAULT_TOKO;
  const { rows } = await query(`${SELECT_TUGAS} WHERE t.id = $1 AND t.toko_id = $2`, [id, tid]);
  if (!rows[0]) return null;
  const items = await attachPetugas([mapRow(rows[0])]);
  return items[0];
}

export async function listProgress(tugasId: string): Promise<TugasProgressItem[]> {
  const { rows } = await query(
    `SELECT id, COALESCE(user_nama, '') AS user_nama, status, progress,
            COALESCE(catatan, '') AS catatan, to_char(created_at, 'YYYY-MM-DD HH24:MI') AS tanggal
     FROM tugas_progress WHERE tugas_id = $1 ORDER BY created_at DESC, id DESC LIMIT 100`,
    [tugasId],
  );
  return rows.map((r: any) => ({
    id: r.id,
    userNama: r.user_nama || '',
    status: r.status || null,
    progress: r.progress || 0,
    catatan: r.catatan || '',
    tanggal: r.tanggal || '',
  }));
}

/* Notifikasi ke seluruh toko (user_id = toko) — opsional, tidak menggagalkan operasi */
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

async function setPetugasTugas(tugasId: string, petugasIds: string[]): Promise<void> {
  await query('DELETE FROM tugas_petugas WHERE tugas_id = $1', [tugasId]);
  for (const pid of petugasIds) {
    await query(
      'INSERT INTO tugas_petugas (tugas_id, pegawai_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [tugasId, pid],
    );
  }
}

export interface TugasInput {
  judul: string;
  deskripsi?: string;
  petugasIds?: string[];
  prioritas?: TugasPrioritas;
  tanggalMulai?: string | null;
  tenggat?: string | null;
}

export async function createTugas(tokoId: string | undefined, data: TugasInput, actor: TugasActor): Promise<TugasItem> {
  const tid = tokoId || DEFAULT_TOKO;
  const pegawaiId = actor.pegawaiId || null;
  const petugasIds = normalizePetugasIds(data.petugasIds);
  const { rows } = await query(
    `INSERT INTO tugas (toko_id, judul, deskripsi, pemberi_id, pemberi_nama, prioritas, tanggal_mulai, tenggat)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      tid,
      data.judul.trim().slice(0, 255),
      (data.deskripsi || '').trim() || null,
      pegawaiId,
      actor.nama || 'Pemberi',
      data.prioritas || 'normal',
      data.tanggalMulai || null,
      data.tenggat || null,
    ],
  );
  const id = rows[0].id;
  await setPetugasTugas(id, petugasIds);
  const item = await getTugas(tid, id);
  const namaPetugas = petugasLabel(item!);
  await notif(tid, `📋 Tugas baru "${data.judul.trim().slice(0, 80)}"${namaPetugas ? ` untuk ${namaPetugas}` : ''} — diberikan oleh ${actor.nama || 'pemilik'}`);
  return item!;
}

export interface TugasPatch {
  judul?: string;
  deskripsi?: string;
  petugasIds?: string[];
  prioritas?: TugasPrioritas;
  tanggalMulai?: string | null;
  tenggat?: string | null;
  progress?: number;
  status?: TugasStatus;
  laporanSelesai?: string;
  catatan?: string; // catatan progress → masuk tugas_progress
}

export async function updateTugas(
  tokoId: string | undefined,
  id: string,
  patch: TugasPatch,
  actor: TugasActor,
): Promise<TugasItem | null> {
  const tid = tokoId || DEFAULT_TOKO;
  const existing = await getTugas(tid, id);
  if (!existing) return null;

  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  const add = (col: string, val: any) => { sets.push(`${col} = $${i++}`); vals.push(val); };

  if (patch.judul !== undefined) add('judul', String(patch.judul).trim().slice(0, 255));
  if (patch.deskripsi !== undefined) add('deskripsi', String(patch.deskripsi).trim() || null);
  if (patch.prioritas !== undefined) add('prioritas', patch.prioritas);
  if (patch.tanggalMulai !== undefined) add('tanggal_mulai', patch.tanggalMulai || null);
  if (patch.tenggat !== undefined) add('tenggat', patch.tenggat || null);
  if (patch.progress !== undefined) add('progress', Math.min(100, Math.max(0, Math.round(patch.progress))));
  if (patch.laporanSelesai !== undefined) add('laporan_selesai', String(patch.laporanSelesai).trim() || null);
  if (patch.status !== undefined) {
    add('status', patch.status);
    if (patch.status === 'selesai') {
      add('progress', 100);
      add('selesai_at', new Date());
    } else if (existing.status === 'selesai') {
      // dibuka lagi → hapus penanda selesai
      add('selesai_at', null);
      if (patch.progress === undefined && existing.progress >= 100) add('progress', 90);
    }
  }
  if (sets.length === 0 && patch.petugasIds === undefined) return existing;
  if (sets.length > 0) {
    add('updated_at', new Date());
    vals.push(id, tid);
    await query(`UPDATE tugas SET ${sets.join(', ')} WHERE id = $${i++} AND toko_id = $${i}`, vals);
  }

  // Multi-petugas: ganti seluruh daftar assignee
  const petugasBerubah = patch.petugasIds !== undefined;
  if (petugasBerubah) await setPetugasTugas(id, normalizePetugasIds(patch.petugasIds));

  // Catat riwayat progress kalau ada perubahan progress / status / catatan
  const progressNorm = patch.progress !== undefined ? Math.min(100, Math.max(0, Math.round(patch.progress))) : existing.progress;
  const progressBerubah = patch.progress !== undefined && progressNorm !== existing.progress;
  const statusBerubah = patch.status !== undefined && patch.status !== existing.status;
  if (progressBerubah || statusBerubah || (patch.catatan !== undefined && String(patch.catatan).trim())) {
    await query(
      `INSERT INTO tugas_progress (tugas_id, pegawai_id, user_nama, status, progress, catatan)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        actor.pegawaiId || null,
        actor.nama || 'User',
        patch.status !== undefined ? patch.status : existing.status,
        progressNorm,
        (patch.catatan !== undefined ? String(patch.catatan).trim() : '') || null,
      ],
    );
  }

  const updated = await getTugas(tid, id);
  if (updated && statusBerubah && updated.status === 'selesai') {
    const lap = updated.laporanSelesai ? ` — Laporan: ${updated.laporanSelesai.slice(0, 120)}` : '';
    await notif(tid, `✅ Tugas "${updated.judul.slice(0, 60)}" selesai oleh ${actor.nama || 'petugas'}${lap}`);
  } else if (updated && petugasBerubah) {
    const namaPetugas = petugasLabel(updated);
    await notif(tid, `🔄 Tugas "${updated.judul.slice(0, 60)}" di-assign ke ${namaPetugas || '— (tanpa petugas)'} oleh ${actor.nama || 'pemilik'}`);
  }
  return updated;
}

export async function deleteTugas(tokoId: string | undefined, id: string): Promise<boolean> {
  const tid = tokoId || DEFAULT_TOKO;
  const { rowCount } = await query('DELETE FROM tugas WHERE id = $1 AND toko_id = $2', [id, tid]);
  return (rowCount || 0) > 0;
}
