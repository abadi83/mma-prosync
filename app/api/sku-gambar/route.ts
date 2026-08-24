import { NextResponse } from 'next/server';
import { getSkuGambarMap, setSkuGambar } from '@/app/services/skuMasterService';

export const dynamic = 'force-dynamic';
const json = (data: any, status = 200) => NextResponse.json(data, { status });

/** GET /api/sku-gambar?sku=SKU1,SKU2,... → { "SKU1": "data:image/...", "SKU2": null } */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const skuParam = searchParams.get('sku') || '';
    const skus = skuParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 500);
    if (skus.length === 0) return json({});
    return json(await getSkuGambarMap(skus));
  } catch {
    return json({ error: 'Gagal memuat gambar SKU' }, 500);
  }
}

/** POST /api/sku-gambar { sku, gambar } — simpan/update gambar (gambar '' = hapus) */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sku = String(body.sku || '').trim();
    const gambar = String(body.gambar || '');
    if (!sku) return json({ error: 'sku wajib diisi' }, 400);
    if (gambar.length > 600_000) return json({ error: 'Gambar terlalu besar (maks ±600KB base64)' }, 400);
    const ok = await setSkuGambar(sku, gambar);
    if (!ok) return json({ error: 'SKU tidak ditemukan' }, 404);
    return json({ success: true, sku });
  } catch {
    return json({ error: 'Gagal menyimpan gambar' }, 500);
  }
}
