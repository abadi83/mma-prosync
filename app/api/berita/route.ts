import { NextResponse } from 'next/server';
import { fetchBerita } from '@/app/services/beritaService';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** GET /api/berita — berita Marketplace/E-Commerce dari Google News RSS (gratis, tanpa API key). */
export async function GET() {
  try {
    const items = await fetchBerita();
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [], error: 'Gagal memuat berita' }, { status: 502 });
  }
}
