import { NextResponse } from 'next/server';
import { getFleet, createFleet, updateFleet, deleteFleet } from '@/app/services/fleetService';

export const dynamic = 'force-dynamic';
const json = (data: any, status = 200) => NextResponse.json(data, { status });

export async function GET() {
  try { return json(await getFleet()); }
  catch { return json({ error: 'Gagal mengambil data fleet' }, 500); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.nama || !body.platNomor || !body.tipe) return json({ error: 'nama, platNomor, tipe wajib' }, 400);
    return json({ success: true, item: await createFleet(body) });
  } catch { return json({ error: 'Gagal menyimpan fleet' }, 500); }
}

export async function PUT(request: Request) {
  try {
    const { id, ...rest } = await request.json();
    if (!id) return json({ error: 'id wajib' }, 400);
    const item = await updateFleet(id, rest);
    if (!item) return json({ error: 'Tidak ditemukan' }, 404);
    return json({ success: true, item });
  } catch { return json({ error: 'Gagal update fleet' }, 500); }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return json({ error: 'id wajib' }, 400);
    const ok = await deleteFleet(id);
    if (!ok) return json({ error: 'Tidak ditemukan' }, 404);
    return json({ success: true, deleted: true });
  } catch { return json({ error: 'Gagal hapus fleet' }, 500); }
}
