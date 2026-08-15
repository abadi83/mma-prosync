import { NextResponse } from 'next/server';
import { getMarketplaceToko, createMarketplaceToko, updateMarketplaceToko, deleteMarketplaceToko, TokoItem } from '@/app/services/marketplaceTokoService';

export const dynamic = 'force-dynamic';
const json = (data: any, status = 200) => NextResponse.json(data, { status });

export async function GET() {
  try { return json(await getMarketplaceToko()); }
  catch { return json({ error: 'Gagal mengambil data toko marketplace' }, 500); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nama, marketplace } = body;
    if (!nama || !marketplace) return json({ error: 'nama dan marketplace wajib' }, 400);
    return json({ success: true, item: await createMarketplaceToko(body) });
  } catch { return json({ error: 'Gagal menyimpan toko marketplace' }, 500); }
}

export async function PUT(request: Request) {
  try {
    const { id, ...rest } = await request.json();
    if (!id) return json({ error: 'id wajib' }, 400);
    const item = await updateMarketplaceToko(id, rest);
    if (!item) return json({ error: 'Tidak ditemukan' }, 404);
    return json({ success: true, item });
  } catch { return json({ error: 'Gagal update toko marketplace' }, 500); }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return json({ error: 'id wajib' }, 400);
    const ok = await deleteMarketplaceToko(id);
    if (!ok) return json({ error: 'Tidak ditemukan' }, 404);
    return json({ success: true, deleted: true });
  } catch { return json({ error: 'Gagal hapus toko marketplace' }, 500); }
}
