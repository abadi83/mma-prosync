import { NextResponse, NextRequest } from 'next/server';
import { getBarangKeluar, addBarangKeluar } from '@/app/services/barangKeluarService';
import { recordActivities } from '@/app/services/activityService';

export const dynamic = 'force-dynamic';

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokoId = searchParams.get('toko_id') ?? DEFAULT_TOKO;
    const data = await getBarangKeluar(tokoId);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/barang-keluar error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data barang keluar' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { produk, jumlah, keperluan, tanggal } = body;

    if (!produk || !jumlah || jumlah <= 0 || !keperluan || !tanggal) {
      return NextResponse.json(
        { error: 'Field wajib: produk, jumlah (>0), keperluan, tanggal' },
        { status: 400 },
      );
    }

    const tokoId = body.toko_id ?? DEFAULT_TOKO;
    const entry = await addBarangKeluar(tokoId, { produk, jumlah, keperluan, tanggal });

    // Rekam aktivitas user (KPI) — identitas dari cookie login
    try {
      const username = request.cookies.get('user_pegawai_id')?.value || request.cookies.get('user_name')?.value || 'unknown';
      const namaUser = request.cookies.get('user_name')?.value || username;
      await recordActivities([{ modul: 'stok', aksi: 'barang-keluar', refLabel: produk, detail: { jumlah, keperluan, tanggal } }], { username, namaUser });
    } catch {}

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('POST /api/barang-keluar error:', error);
    return NextResponse.json({ error: 'Gagal mencatat barang keluar' }, { status: 500 });
  }
}
