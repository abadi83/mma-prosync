import { NextResponse, NextRequest } from 'next/server';
import { recordActivities, listActivities } from '@/app/services/activityService';

export const dynamic = 'force-dynamic';
const json = (data: any, status = 200) => NextResponse.json(data, { status });

/** GET /api/activity?username=&modul=&limit= — riwayat aktivitas semua modul */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username') || undefined;
    const modul = searchParams.get('modul') || undefined;
    const limit = parseInt(searchParams.get('limit') || '300', 10);
    return json(await listActivities({ username, modul, limit }));
  } catch {
    return json({ error: 'Gagal memuat aktivitas' }, 500);
  }
}

/** POST /api/activity { entries: [{ modul, aksi, refLabel, detail }] }
 *  Identitas user dibaca dari cookie login di sisi server (tidak bisa dipalsukan). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entries = Array.isArray(body?.entries) ? body.entries : [];
    if (entries.length === 0) return json({ error: 'entries wajib diisi' }, 400);

    const username = request.cookies.get('user_pegawai_id')?.value
      || request.cookies.get('user_name')?.value
      || 'unknown';
    const namaUser = request.cookies.get('user_name')?.value || username;

    const mapped: any[] = entries
      .map((e: any) => ({
        modul: String(e.modul || '').slice(0, 30),
        aksi: String(e.aksi || '').slice(0, 20),
        refLabel: String(e.refLabel || '').slice(0, 255),
        detail: e.detail && typeof e.detail === 'object' ? e.detail : {},
      }))
      .filter((e: any) => e.modul && e.aksi);

    const count = await recordActivities(mapped, { username, namaUser });
    return json({ success: true, count, username, namaUser });
  } catch (e: any) {
    console.error('[ACTIVITY POST ERROR]', e?.message || e);
    return json({ error: 'Gagal mencatat aktivitas', detail: String(e?.message || e).slice(0, 500) }, 500);
  }
}
