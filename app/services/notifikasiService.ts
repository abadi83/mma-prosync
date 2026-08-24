import { query } from '@/lib/db';

interface Notif { id: string; tipe: string; pesan: string; dibaca: boolean; tanggal: string; }

const DEFAULT_USER = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getNotifikasi(userId?: string) {
  const { rows } = await query(
    `SELECT id, tipe, pesan, dibaca, to_char(created_at, 'YYYY-MM-DD HH24:MI') AS tanggal
     FROM notifikasi
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId || DEFAULT_USER]
  );
  return rows;
}

export async function getUnreadCount(userId?: string) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS jumlah FROM notifikasi
     WHERE user_id = $1 AND dibaca = false`,
    [userId || DEFAULT_USER]
  );
  return rows[0]?.jumlah || 0;
}

export async function markRead(id: string) {
  const { rows } = await query(
    'UPDATE notifikasi SET dibaca = true WHERE id = $1 RETURNING id, tipe, pesan, dibaca, to_char(created_at, \'YYYY-MM-DD HH24:MI\') AS tanggal',
    [id]
  );
  return rows[0] || null;
}

export async function markAllRead(userId?: string) {
  await query('UPDATE notifikasi SET dibaca = true WHERE user_id = $1', [userId || DEFAULT_USER]);
}
