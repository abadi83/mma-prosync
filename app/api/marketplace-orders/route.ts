import { NextResponse } from 'next/server';
import { listMarketplaceOrders, upsertMarketplaceOrders, deleteAllMarketplaceOrders, MarketplaceOrder } from '@/app/services/marketplaceOrderService';

export const dynamic = 'force-dynamic';
const json = (data: any, status = 200) => NextResponse.json(data, { status });

/** GET /api/marketplace-orders — daftar semua order marketplace (max 5000 terbaru) */
export async function GET() {
  try { return json(await listMarketplaceOrders()); }
  catch { return json({ error: 'Gagal memuat order marketplace' }, 500); }
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

/** DELETE /api/marketplace-orders — hapus semua order marketplace (reset) */
export async function DELETE() {
  try {
    const deleted = await deleteAllMarketplaceOrders();
    return json({ success: true, deleted });
  } catch {
    return json({ error: 'Gagal menghapus order marketplace' }, 500);
  }
}
