import { query } from '@/lib/db';

export interface OpLogEntry {
  noPesanan?: string;
  noResi?: string;
  marketplace?: string;
  kurir?: string;
  jenis: 'proses' | 'retur' | 'klaim';
  aksi: string;
  statusProses?: string;
  petugas?: string;
  pegawaiId?: string;
  keterangan?: string;
}

const DEFAULT_TOKO = process.env.DEFAULT_TOKO_ID || 'a0a0a0a0-0000-0000-0000-000000000001';

export async function insertOpLog(e: OpLogEntry, tokoId?: string): Promise<void> {
  await query(
    `INSERT INTO operasional_log
       (toko_id, no_pesanan, no_resi, marketplace, kurir, jenis, aksi, status_proses, petugas, pegawai_id, keterangan)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      tokoId || DEFAULT_TOKO,
      String(e.noPesanan || '').slice(0, 255),
      String(e.noResi || '').slice(0, 255),
      String(e.marketplace || '').slice(0, 100),
      String(e.kurir || '').slice(0, 100),
      e.jenis,
      String(e.aksi || '').slice(0, 100),
      e.statusProses ? String(e.statusProses).slice(0, 50) : null,
      String(e.petugas || '').slice(0, 255),
      String(e.pegawaiId || '').slice(0, 255),
      String(e.keterangan || '').slice(0, 1000),
    ]
  );
}

export async function insertManyOpLog(entries: OpLogEntry[], tokoId?: string): Promise<number> {
  let count = 0;
  for (const e of entries) {
    if (!e.jenis || !e.aksi) continue;
    await insertOpLog(e, tokoId);
    count++;
  }
  return count;
}

export async function listOpLog(opts: {
  jenis?: string; search?: string; limit?: number; tokoId?: string;
}) {
  const { rows } = await query(
    `SELECT id, no_pesanan, no_resi, marketplace, kurir, jenis, aksi, status_proses, petugas, keterangan,
            to_char(created_at, 'YYYY-MM-DD HH24:MI') AS tanggal
     FROM operasional_log
     WHERE toko_id = $1
       AND ($2::text IS NULL OR jenis = $2)
       AND ($3::text IS NULL OR no_pesanan ILIKE '%'||$3||'%' OR no_resi ILIKE '%'||$3||'%')
     ORDER BY created_at DESC, id DESC
     LIMIT $4`,
    [opts.tokoId || DEFAULT_TOKO, opts.jenis || null, opts.search || null, opts.limit || 200]
  );
  return rows;
}

/** Notifikasi untuk retur/klaim yang diterima Runner — bos langsung tahu. */
export async function notifyReturKlaim(e: OpLogEntry, namaUser: string, tokoId?: string) {
  if (e.jenis !== 'retur' && e.jenis !== 'klaim') return;
  const tId = tokoId || DEFAULT_TOKO;
  const nama = namaUser && namaUser !== 'unknown' ? namaUser : 'User';
  const label = e.jenis === 'retur' ? '📦 Retur' : '⚖️ Klaim';
  const ref = [e.noResi && `resi ${e.noResi}`, e.noPesanan && `pesanan ${e.noPesanan}`].filter(Boolean).join(' • ');
  const pesan = `${label} diterima Runner${ref ? `: ${ref}` : ''}${e.keterangan ? ` — ${e.keterangan}` : ''} (${nama})`;
  await query(
    `INSERT INTO notifikasi (user_id, tipe, pesan) VALUES ($1, 'sistem', $2)`,
    [tId, pesan.slice(0, 1000)]
  );
  // Jaga maksimal 200 notifikasi
  await query(
    `DELETE FROM notifikasi WHERE id IN (
       SELECT id FROM notifikasi WHERE user_id = $1 ORDER BY created_at DESC OFFSET 200
     )`,
    [tId]
  );
}
