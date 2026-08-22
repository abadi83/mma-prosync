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
        if (data.length === 0) {
          // DB kosong → coba impor data lama dari localStorage
          try {
            const local = JSON.parse(localStorage.getItem('mma_marketplace_orders') || '[]');
            if (Array.isArray(local) && local.length > 0) {
              await fetch('/api/marketplace-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orders: local }),
              });
              const res2 = await fetch(`/api/marketplace-orders?t=${Date.now()}`);
              if (res2.ok) {
                const d2 = await res2.json();
                if (Array.isArray(d2) && d2.length > 0) return d2;
              }
            }
          } catch {}
        }
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
