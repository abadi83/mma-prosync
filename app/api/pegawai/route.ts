import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { apiSuccess, apiCreated, apiBadRequest, apiNotFound, apiServerError } from '@/app/lib/apiResponse';
import { validateRequired } from '@/app/lib/validation';

export const dynamic = 'force-dynamic';

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

/* ── Helper: hash sederhana (konsisten dengan authService) ── */
function hashPassword(password: string): string {
  return `mock_hash_${password}`;
}

/* GET /api/pegawai — daftar pegawai */
export async function GET() {
  try {
    const { rows } = await query(
      `SELECT id, nama, nik, username, jabatan, departemen,
              tanggal_masuk, status, no_hp, email, roles
       FROM pegawai WHERE toko_id = $1 ORDER BY created_at DESC`,
      [DEFAULT_TOKO]
    );
    return apiSuccess(rows);
  } catch (err: any) {
    console.error('GET /api/pegawai error:', err?.message);
    return apiServerError('GET /api/pegawai');
  }
}

/* POST /api/pegawai — tambah pegawai (auto password: pegawai123) */
export async function POST(request: Request) {
  try {
    const { nama, nik, username, jabatan, departemen, tanggalMasuk, status, noHp, email, roles, password } = await request.json();
    const err = validateRequired({ nama, nik });
    if (err) return apiBadRequest(err);

    const passwordHash = hashPassword(password || 'pegawai123');
    const rolesArr = Array.isArray(roles) && roles.length > 0 ? roles : ['pegawai'];

    const { rows } = await query(
      `INSERT INTO pegawai (toko_id, nama, nik, username, jabatan, departemen, tanggal_masuk, status, no_hp, email, roles, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, nama, nik, username, jabatan, departemen, tanggal_masuk, status, no_hp, email, roles`,
      [DEFAULT_TOKO, nama.trim(), nik.trim(), (username || '').trim() || null, jabatan || null, departemen || null,
       tanggalMasuk || null, status || 'Aktif', noHp || null, email || null, rolesArr, passwordHash]
    );
    return apiCreated(rows[0]);
  } catch (err: any) {
    console.error('POST /api/pegawai error:', err?.message);
    if (err?.code === '23505') return apiBadRequest('Username sudah dipakai.');
    return apiServerError('POST /api/pegawai');
  }
}

/* PUT /api/pegawai — update pegawai (termasuk reset password) */
export async function PUT(request: Request) {
  try {
    const { id, nama, nik, username, jabatan, departemen, tanggalMasuk, status, noHp, email, roles, password } = await request.json();
    const err = validateRequired({ id, nama, nik });
    if (err) return apiBadRequest(err);

    const { rows: existing } = await query(
      'SELECT id FROM pegawai WHERE id = $1 AND toko_id = $2', [id, DEFAULT_TOKO]
    );
    if (existing.length === 0) return apiNotFound();

    const { rows } = await query(
      `UPDATE pegawai SET
         nama = $1, nik = $2, username = $3, jabatan = $4, departemen = $5,
         tanggal_masuk = $6, status = $7, no_hp = $8, email = $9, roles = $10,
         password_hash = COALESCE($11, password_hash),
         updated_at = NOW()
       WHERE id = $12 AND toko_id = $13
       RETURNING id, nama, nik, username, jabatan, departemen, tanggal_masuk, status, no_hp, email, roles`,
      [nama.trim(), nik.trim(), (username || '').trim() || null, jabatan || null, departemen || null,
       tanggalMasuk || null, status || 'Aktif', noHp || null, email || null,
       Array.isArray(roles) && roles.length > 0 ? roles : ['pegawai'],
       password ? hashPassword(password) : null, id, DEFAULT_TOKO]
    );
    return apiSuccess(rows[0]);
  } catch (err: any) {
    console.error('PUT /api/pegawai error:', err?.message);
    if (err?.code === '23505') return apiBadRequest('Username sudah dipakai.');
    return apiServerError('PUT /api/pegawai');
  }
}

/* DELETE /api/pegawai?id=... — hapus pegawai */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return apiBadRequest('id wajib');

    const { rows } = await query(
      'DELETE FROM pegawai WHERE id = $1 AND toko_id = $2 RETURNING id', [id, DEFAULT_TOKO]
    );
    if (rows.length === 0) return apiNotFound();
    return apiSuccess({ deleted: true });
  } catch (err: any) {
    console.error('DELETE /api/pegawai error:', err?.message);
    return apiServerError('DELETE /api/pegawai');
  }
}
