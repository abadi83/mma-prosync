import { NextResponse } from 'next/server';
import { getAllSku, createSku, updateSku, deleteSku, bulkUpsertSku, SkuItem } from '@/app/services/skuMasterService';

export const dynamic = 'force-dynamic';

function apiJson(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET() {
  try {
    const items = await getAllSku();
    return apiJson(items);
  } catch (err: any) {
    console.error('GET /api/sku-master error:', err?.message);
    return apiJson({ error: 'Gagal mengambil data SKU' }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (Array.isArray(body)) {
      const items = await bulkUpsertSku(body as Omit<SkuItem, 'id'>[]);
      return apiJson({ success: true, count: items.length, items });
    }
    const { sku, nama } = body;
    if (!sku || !nama) return apiJson({ error: 'sku dan nama wajib diisi' }, 400);
    const item = await createSku(body);
    return apiJson({ success: true, item });
  } catch (err: any) {
    console.error('POST /api/sku-master error:', err?.message);
    return apiJson({ error: 'Gagal menyimpan SKU' }, 500);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...rest } = body;
    if (!id) return apiJson({ error: 'id wajib diisi' }, 400);
    const item = await updateSku(id, rest);
    if (!item) return apiJson({ error: 'SKU tidak ditemukan' }, 404);
    return apiJson({ success: true, item });
  } catch (err: any) {
    console.error('PUT /api/sku-master error:', err?.message);
    return apiJson({ error: 'Gagal mengupdate SKU' }, 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return apiJson({ error: 'id wajib diisi' }, 400);
    const ok = await deleteSku(id);
    if (!ok) return apiJson({ error: 'SKU tidak ditemukan' }, 404);
    return apiJson({ success: true, deleted: true });
  } catch (err: any) {
    console.error('DELETE /api/sku-master error:', err?.message);
    return apiJson({ error: 'Gagal menghapus SKU' }, 500);
  }
}
