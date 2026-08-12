import { NextResponse } from 'next/server';
import { getStockSummary } from '@/app/services/stockService';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), 'data');

function readSkuData(): any[] {
  try {
    const filePath = path.join(DATA_DIR, 'mma_sku_data.json');
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch { return []; }
}

/**
 * GET /api/stock-summary
 * Prioritas: baca dari data SKU bersama (sama dengan Data Master)
 * Fallback: query PostgreSQL produk table
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokoId = searchParams.get('toko_id') ?? 'a0a0a0a0-0000-0000-0000-000000000001';

    // 1. Baca dari shared SKU data (sumber yg sama dengan Data Master)
    const skuData = readSkuData();
    if (skuData.length > 0) {
      const activeSkus = skuData.filter((s: any) => s.aktif === 1 || s.aktif === undefined);
      const items = activeSkus.map((s: any) => ({
        name: s.nama || s.name || 'Unknown',
        stock: Number(s.stok || s.stock || 0),
        minStock: Number(s.minStok || s.minStock || 10),
        category: s.kategori || s.category || 'Umum',
      }));
      const lowStockCount = items.filter((i: any) => i.stock < i.minStock).length;
      return NextResponse.json({
        totalItems: items.length,
        lowStockCount,
        items: items.sort((a: any, b: any) => a.stock - b.stock).slice(0, 10),
      });
    }

    // 2. Fallback ke PostgreSQL
    const data = await getStockSummary(tokoId);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/stock-summary error:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil ringkasan stok' },
      { status: 500 },
    );
  }
}
