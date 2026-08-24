import { query } from '@/lib/db';

export interface ActivityEntry {
  modul: string;
  aksi: string;
  refLabel?: string;
  detail?: Record<string, any>;
}

const DEFAULT_TOKO = process.env.DEFAULT_TOKO_ID || 'a0a0a0a0-0000-0000-0000-000000000001';

const MODUL_LABEL: Record<string, string> = {
  sku: 'SKU', supplier: 'Supplier', pelanggan: 'Pelanggan', 'marketplace-toko': 'Toko Marketplace',
  fleet: 'Fleet', transaksi: 'Transaksi', pembelian: 'Pembelian', stok: 'Stok',
};
const AKSI_LABEL: Record<string, string> = {
  tambah: 'menambah', ubah: 'mengubah', hapus: 'menghapus', upload: 'mengupload',
  po: 'membuat PO', 'barang-masuk': 'mencatat barang masuk', 'barang-keluar': 'mencatat barang keluar',
};

function mapTipeNotif(modul: string): 'stok' | 'penjualan' | 'sistem' | 'aktivitas' {
  if (modul === 'stok') return 'stok';
  if (modul === 'transaksi') return 'penjualan';
  if (modul === 'pembelian') return 'sistem';
  return 'aktivitas';
}

function buildPesanNotif(e: ActivityEntry, username: string | undefined, namaUser: string | undefined): string {
  const nama = namaUser && namaUser !== 'unknown' ? namaUser : 'User';
  const modul = MODUL_LABEL[e.modul] || e.modul;
  const aksi = AKSI_LABEL[e.aksi] || e.aksi;
  const ref = e.refLabel ? ` "${e.refLabel}"` : '';
  const detail = e.detail && typeof e.detail === 'object'
    ? Object.entries(e.detail)
        .filter(([k]) => !['sku', 'nama'].includes(k))
        .slice(0, 3)
        .map(([k, v]) => `${k}: ${typeof v === 'number' ? Number(v).toLocaleString('id-ID') : v}`)
        .join(' • ')
    : '';
  return `👤 ${nama} ${aksi} ${modul}${ref}${detail ? ` (${detail})` : ''}`;
}

export async function recordActivities(
  entries: ActivityEntry[],
  ctx: { username?: string; namaUser?: string },
  tokoId?: string
): Promise<number> {
  const tId = tokoId || DEFAULT_TOKO;
  let count = 0;
  for (const e of entries) {
    await query(
      `INSERT INTO activity_log (toko_id, username, nama_user, modul, aksi, ref_label, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        tId,
        ctx.username || '',
        ctx.namaUser || '',
        String(e.modul || '').slice(0, 30),
        String(e.aksi || '').slice(0, 20),
        String(e.refLabel || '').slice(0, 255),
        JSON.stringify(e.detail || {}),
      ]
    );

    // Otomatis jadi notifikasi (tipe mengikuti modul)
    try {
      await query(
        `INSERT INTO notifikasi (user_id, tipe, pesan) VALUES ($1, $2, $3)`,
        [tId, mapTipeNotif(e.modul), buildPesanNotif(e, ctx.username, ctx.namaUser)]
      );
      // Jaga maksimal 200 notifikasi per toko (hapus yang lama)
      await query(
        `DELETE FROM notifikasi WHERE user_id = $1 AND id NOT IN (
           SELECT id FROM notifikasi WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200
         )`,
        [tId]
      );
    } catch { /* notifikasi opsional — jangan gagalkan pencatatan aktivitas */ }
    count++;
  }
  return count;
}

export async function listActivities(opts: { username?: string; modul?: string; limit?: number; tokoId?: string } = {}) {
  const limit = Math.min(opts.limit || 300, 1000);
  const params: any[] = [opts.tokoId || DEFAULT_TOKO];
  let where = 'toko_id = $1';
  if (opts.username) {
    params.push(opts.username);
    where += ` AND username = $${params.length}`;
  }
  if (opts.modul) {
    params.push(opts.modul);
    where += ` AND modul = $${params.length}`;
  }
  params.push(limit);
  const { rows } = await query(
    `SELECT id, username, nama_user, modul, aksi, ref_label, detail, created_at
     FROM activity_log
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return rows.map(r => ({
    id: r.id,
    username: r.username || '',
    namaUser: r.nama_user || '',
    modul: r.modul,
    aksi: r.aksi,
    refLabel: r.ref_label || '',
    detail: r.detail || {},
    createdAt: r.created_at,
  }));
}
