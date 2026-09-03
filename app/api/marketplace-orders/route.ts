import { NextResponse } from 'next/server';
import { listMarketplaceOrders, getMpSummary, listMpResi, upsertMarketplaceOrders, updateMarketplaceOrder, deleteAllMarketplaceOrders, deleteMarketplaceOrdersByCatatan, MarketplaceOrder } from '@/app/services/marketplaceOrderService';

export const dynamic = 'force-dynamic';
const json = (data: any, status = 200) => NextResponse.json(data, { status });

/** GET /api/marketplace-orders
 *  view=summary → agregat per (marketplace, toko, tanggal) — kecil & cepat
 *  view=resi     → daftar no_resi + tanggal — untuk pencocokan operasional
 *  limit=N       → batasi daftar penuh (riwayat upload cukup 300 terbaru)
 *  default       → daftar lengkap (legacy, berat — hanya untuk tampilan detail) */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'list';
    if (view === 'summary') return json(await getMpSummary());
    if (view === 'resi') return json(await listMpResi());
    const limit = parseInt(searchParams.get('limit') || '0', 10) || 0;
    return json(await listMarketplaceOrders(undefined, limit));
  }
  catch { return json({ error: 'Gagal memuat order marketplace' }, 500);
}
}

/** POST /api/marketplace-orders — upsert (dedup otomatis per marketplace+no pesanan) */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orders: MarketplaceOrder[] = Array.isArray(body?.orders) ? body.orders : (Array.isArray(body) ? body : []);
    if (orders.length === 0) return json({ error: 'orders wajib diisi' }, 400);
    const result = await upsertMarketplaceOrders(orders);
    return json({ success: true, ...result });
  } catch {
    return json({ error: 'Gagal menyimpan order marketplace' }, 500);
  }
}

/** PUT /api/marketplace-orders — update satu order (edit SKU/HPP manual) */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...rest } = body;
    if (!id) return json({ error: 'id wajib diisi' }, 400);
    const ok = await updateMarketplaceOrder(id, rest);
    if (!ok) return json({ error: 'Order tidak ditemukan' }, 404);
    return json({ success: true, updated: true });
  } catch {
    return json({ error: 'Gagal update order marketplace' }, 500);
  }
}

/** DELETE /api/marketplace-orders
 *  ?catatan=...  → hapus satu batch upload (semua order dengan catatan tsb)
 *  tanpa param    → hapus semua order marketplace (reset) */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const catatan = searchParams.get('catatan');
    if (catatan) {
      const deleted = await deleteMarketplaceOrdersByCatatan(catatan);
      return json({ success: true, deleted });
    }
    const deleted = await deleteAllMarketplaceOrders();
    return json({ success: true, deleted });
  } catch {
    return json({ error: 'Gagal menghapus order marketplace' }, 500);
  }
}
