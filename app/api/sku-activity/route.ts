import { NextResponse, NextRequest } from 'next/server';
import { recordSkuActivities, listSkuActivities } from '@/app/services/skuActivityService';

export const dynamic = 'force-dynamic';
const json = (data: any, status = 200) => NextResponse.json(data, { status });

/** GET /api/sku-activity?username=&limit= — riwayat aktivitas SKU per user */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username') || undefined;
    const limit = parseInt(searchParams.get('limit') || '300', 10);
    return json(await listSkuActivities({ username, limit }));
  } catch {
    return json({ error: 'Gagal memuat aktivitas SKU' }, 500);
  }
}

/** POST /api/sku-activity { entries: [{ aksi, sku, nama, detail }] }
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

    const mapped = entries
      .map((e: any) => ({
        username,
        namaUser,
        aksi: String(e.aksi || '').slice(0, 20),
        sku: String(e.sku || '').slice(0, 255),
        nama: String(e.nama || '').slice(0, 255),
        detail: e.detail && typeof e.detail === 'object' ? e.detail : {},
      }))
      .filter((e: any) => e.aksi);

    const count = await recordSkuActivities(mapped);
    return json({ success: true, count, username, namaUser });
  } catch {
    return json({ error: 'Gagal mencatat aktivitas' }, 500);
  }
}
