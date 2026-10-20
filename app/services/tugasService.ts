import { query } from '@/lib/db';

export type TugasStatus = 'todo' | 'proses' | 'review' | 'selesai';
export type TugasPrioritas = 'rendah' | 'normal' | 'tinggi' | 'urgent';

export interface TugasItem {
  id: string;
  judul: string;
  deskripsi: string;
  pemberiNama: string;
  petugasId: string | null;
  petugasNama: string | null;
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
         t.petugas_id, COALESCE(p.nama, '') AS petugas_nama,
         t.prioritas, t.status, t.progress,
         to_char(t.tanggal_mulai, 'YYYY-MM-DD') AS tanggal_mulai,
         to_char(t.tenggat, 'YYYY-MM-DD') AS tenggat,
         to_char(t.selesai_at, 'YYYY-MM-DD HH24:MI') AS selesai_at,
         COALESCE(t.laporan_selesai, '') AS laporan_selesai,
         to_char(t.created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
         to_char(t.updated_at, 'YYYY-MM-DD HH24:MI') AS updated_at
  FROM tugas t
  LEFT JOIN pegawai p ON p.id = t.petugas_id
`;

function mapRow(row: any): TugasItem {
  return {
    id: row.id,
    judul: row.judul,
    deskripsi: row.deskripsi || '',
    pemberiNama: row.pemberi_nama || '',
    petugasId: row.petugas_id || null,
    petugasNama: row.petugas_nama || null,
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

export async function listTugas(
  tokoId?: string,
  opts: { status?: string; petugasId?: string; search?: string; hanyaAktif?: boolean } = {},
): Promise<TugasItem[]> {
  const tid = tokoId || DEFAULT_TOKO;
  const params: any[] = [tid];
  let where = 't.toko_id = $1';
  if (opts.status) { params.push(opts.status); where += ` AND t.status = $${params.length}`; }
  if (opts.petugasId) { params.push(opts.petugasId); where += ` AND t.petugas_id = $${params.length}`; }
  if (opts.search) { params.push(`%${opts.search}%`); where += ` AND (t.judul ILIKE $${params.length} OR p.nama ILIKE $${params.length})`; }
  if (opts.hanyaAktif) { where += ` AND t.status <> 'selesai'`; }
  const { rows } = await query(
    `${SELECT_TUGAS} WHERE ${where} ORDER BY t.updated_at DESC LIMIT 500`,
    params,
  );
  return rows.map(mapRow);
}

export async function getTugas(tokoId: string | undefined, id: string): Promise<TugasItem | null> {
  const tid = tokoId || DEFAULT_TOKO;
  const { rows } = await query(`${SELECT_TUGAS} WHERE t.id = $1 AND t.toko_id = $2`, [id, tid]);
  return rows[0] ? mapRow(rows[0]) : null;
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

export interface TugasInput {
  judul: string;
  deskripsi?: string;
  petugasId?: string | null;
  prioritas?: TugasPrioritas;
  tanggalMulai?: string | null;
  tenggat?: string | null;
}

export async function createTugas(tokoId: string | undefined, data: TugasInput, actor: TugasActor): Promise<TugasItem> {
  const tid = tokoId || DEFAULT_TOKO;
  const pegawaiId = actor.pegawaiId || null;
  const { rows } = await query(
    `INSERT INTO tugas (toko_id, judul, deskripsi, pemberi_id, pemberi_nama, petugas_id, prioritas, tanggal_mulai, tenggat)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      tid,
      data.judul.trim().slice(0, 255),
      (data.deskripsi || '').trim() || null,
      pegawaiId,
      actor.nama || 'Pemberi',
      data.petugasId || null,
      data.prioritas || 'normal',
      data.tanggalMulai || null,
      data.tenggat || null,
    ],
  );
  const item = await getTugas(tid, rows[0].id);
  const petugas = item?.petugasNama ? ` untuk ${item.petugasNama}` : '';
  await notif(tid, `📋 Tugas baru "${data.judul.trim().slice(0, 80)}"${petugas} — diberikan oleh ${actor.nama || 'pemilik'}`);
  return item!;
}

export interface TugasPatch {
  judul?: string;
  deskripsi?: string;
  petugasId?: string | null;
  prioritas?: TugasPrioritas;
  tanggalMulai?: string | null;
  tenggat?: string | null;
  progress?: number;
  status?: TugasStatus;
  laporanSelesai?: string;
  catatan?: string; // catatan progress → masuk tugas_progress
}

function sanitize<T extends Record<string, any>>(patch: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (k === 'judul') out[k as keyof T] = String(v).trim().slice(0, 255) as any;
    else if (k === 'deskripsi' || k === 'laporanSelesai' || k === 'catatan') out[k as keyof T] = String(v).trim() as any;
    else out[k as keyof T] = v;
  }
  return out;
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

  const p = sanitize(patch);
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  const add = (col: string, val: any) => { sets.push(`${col} = $${i++}`); vals.push(val); };

  if (p.judul !== undefined) add('judul', p.judul);
  if (p.deskripsi !== undefined) add('deskripsi', (p.deskripsi || '').trim() || null);
  if (p.petugasId !== undefined) add('petugas_id', p.petugasId || null);
  if (p.prioritas !== undefined) add('prioritas', p.prioritas);
  if (p.tanggalMulai !== undefined) add('tanggal_mulai', p.tanggalMulai || null);
  if (p.tenggat !== undefined) add('tenggat', p.tenggat || null);
  if (p.progress !== undefined) add('progress', Math.min(100, Math.max(0, Math.round(p.progress))));
  if (p.laporanSelesai !== undefined) add('laporan_selesai', (p.laporanSelesai || '').trim() || null);
  if (p.status !== undefined) {
    add('status', p.status);
    if (p.status === 'selesai') {
      add('progress', 100);
      add('selesai_at', new Date());
    } else if (existing.status === 'selesai') {
      // dibuka lagi → hapus penanda selesai
      add('selesai_at', null);
      if (p.progress === undefined && existing.progress >= 100) add('progress', 90);
    }
  }
  if (sets.length === 0) return existing;
  add('updated_at', new Date());

  vals.push(id, tid);
  await query(`UPDATE tugas SET ${sets.join(', ')} WHERE id = $${i++} AND toko_id = $${i}`, vals);

  // Catat riwayat progress kalau ada perubahan progress / status / catatan
  const progressBerubah = p.progress !== undefined && Math.min(100, Math.max(0, Math.round(p.progress))) !== existing.progress;
  const statusBerubah = p.status !== undefined && p.status !== existing.status;
  if (progressBerubah || statusBerubah || (p.catatan !== undefined && String(p.catatan).trim())) {
    await query(
      `INSERT INTO tugas_progress (tugas_id, pegawai_id, user_nama, status, progress, catatan)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        actor.pegawaiId || null,
        actor.nama || 'User',
        p.status !== undefined ? p.status : existing.status,
        p.progress !== undefined ? Math.min(100, Math.max(0, Math.round(p.progress))) : existing.progress,
        (p.catatan !== undefined ? String(p.catatan).trim() : '') || null,
      ],
    );
  }

  const updated = await getTugas(tid, id);
  // Notifikasi: selesai / di-assign ulang / progress besar
  if (updated && statusBerubah && updated.status === 'selesai') {
    const lap = updated.laporanSelesai ? ` — Laporan: ${updated.laporanSelesai.slice(0, 120)}` : '';
    await notif(tid, `✅ Tugas "${updated.judul.slice(0, 60)}" selesai oleh ${actor.nama || 'petugas'}${lap}`);
  } else if (updated && p.petugasId !== undefined && p.petugasId && p.petugasId !== existing.petugasId) {
    await notif(tid, `🔄 Tugas "${updated.judul.slice(0, 60)}" di-assign ke ${updated.petugasNama || 'petugas baru'} oleh ${actor.nama || 'pemilik'}`);
  }
  return updated;
}

export async function deleteTugas(tokoId: string | undefined, id: string): Promise<boolean> {
  const tid = tokoId || DEFAULT_TOKO;
  const { rowCount } = await query('DELETE FROM tugas WHERE id = $1 AND toko_id = $2', [id, tid]);
  return (rowCount || 0) > 0;
}
