'use client';

/**
 * Baca order marketplace: PostgreSQL (API) dulu, fallback localStorage.
 * Sekali jalan: kalau DB masih kosong, BACKFILL data lama dari localStorage
 * (migrasi dari sistem lama) supaya data tidak "hilang".
 */
export async function fetchMarketplaceOrders(): Promise<any[]> {
  try {
    const res = await fetch(`/api/marketplace-orders?t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        // Backfill: kalau cache lokal menyimpan LEBIH BANYAK order dari DB
        // (data lama sebelum migrasi), impor dulu ke DB lalu baca ulang.
        try {
          const local = JSON.parse(localStorage.getItem('mma_marketplace_orders') || '[]');
          if (Array.isArray(local) && local.length > data.length) {
            await fetch('/api/marketplace-orders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orders: local }),
            });
            const res2 = await fetch(`/api/marketplace-orders?t=${Date.now()}`);
            if (res2.ok) {
              const d2 = await res2.json();
              if (Array.isArray(d2) && d2.length >= local.length) return d2;
            }
          }
        } catch {}
        return data;
      }
    }
  } catch {}

  // Fallback offline: cache lokal
  try {
    const stored = localStorage.getItem('mma_marketplace_orders');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

/** Ringkasan agregat per (marketplace, toko, tanggal) — jauh lebih kecil dari daftar penuh. */
export async function fetchMpSummary(): Promise<any[]> {
  try {
    const res = await fetch(`/api/marketplace-orders?view=summary&t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

/** Daftar ringan no_resi + tanggal — untuk pencocokan saldo ke operasional. */
export async function fetchMpResi(): Promise<{ noResi: string; tanggal: string }[]> {
  try {
    const res = await fetch(`/api/marketplace-orders?view=resi&t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
