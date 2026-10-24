import { NextResponse } from 'next/server';
import { AUTH_COOKIE, verifyAuthToken } from '@/app/lib/authToken';
import { getAllAppUpdateHistory, createAppUpdateHistory } from '@/app/services/appUpdateHistoryService';

export const dynamic = 'force-dynamic';

/** Ambil payload token terverifikasi dari cookie (identitas aman, bukan cookie yang bisa dipalsukan) */
function getPayload(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const token = cookieHeader.match(new RegExp(`(?:^|;\\s*)${AUTH_COOKIE}=([^;]*)`))?.[1];
  return verifyAuthToken(token);
}

const isAdmin = (roles: string[] | undefined) => Array.isArray(roles) && roles.includes('admin');
const canView = (roles: string[] | undefined) => isAdmin(roles) || (Array.isArray(roles) && roles.includes('changelog'));

export async function GET(request: Request) {
  try {
    const payload = getPayload(request);
    if (!payload) return NextResponse.json({ error: 'Sesi berakhir. Silakan login ulang.' }, { status: 401 });
    if (!canView(payload.roles)) return NextResponse.json({ error: 'Tidak ada akses ke history aplikasi.' }, { status: 403 });
    const items = await getAllAppUpdateHistory(payload.tokoId);
    return NextResponse.json(items);
  } catch (err: any) {
    console.error('GET /api/app-update-history error:', err?.message);
    return NextResponse.json({ error: 'Gagal mengambil history aplikasi' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = getPayload(request);
    if (!payload) return NextResponse.json({ error: 'Sesi berakhir. Silakan login ulang.' }, { status: 401 });
    if (!isAdmin(payload.roles)) return NextResponse.json({ error: 'Hanya admin yang bisa menambah history aplikasi.' }, { status: 403 });

    const body = await request.json();
    const { versi = '', tipe = 'update', judul = '', deskripsi = '', oleh = '' } = body || {};
    if (!String(judul).trim()) return NextResponse.json({ error: 'Judul wajib diisi.' }, { status: 400 });

    const item = await createAppUpdateHistory(
      { versi: String(versi), tipe: String(tipe), judul: String(judul), deskripsi: String(deskripsi), oleh: String(oleh) },
      payload.tokoId
    );
    return NextResponse.json({ success: true, item });
  } catch (err: any) {
    console.error('POST /api/app-update-history error:', err?.message);
    return NextResponse.json({ error: 'Gagal menyimpan history aplikasi' }, { status: 500 });
  }
}
