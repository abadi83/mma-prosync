'use client';

/* ═══════════════════════════════════════════════════════════════════ */
/* Tombstone hapus data (partial delete) — biar data yang dihapus di   */
/* satu perangkat tidak "hidup lagi" dari copy server/perangkat lain.  */
/* Union-sync GlobalSyncProvider akan menyaring item yang di-tombstone */
/* sebelum merge, sehingga hapus bersifat permanen lintas perangkat.   */
/* ═══════════════════════════════════════════════════════════════════ */

export const TOMBSTONE_KEY = 'mma_tombstones';

export interface Tombstone {
  id: string;          // payment id ATAU noPO ATAU entry id kas kecil/kas besar masuk
  kind: 'payment' | 'po' | 'kaskecil' | 'kasbesar';
  deletedAt: string;
}

const MAX_TOMBSTONES = 2000;

export function readTombstones(): Tombstone[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TOMBSTONE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function writeTombstones(list: Tombstone[]): void {
  try { localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(list)); } catch {}
}

export function addTombstones(entries: { id: string; kind: 'payment' | 'po' | 'kaskecil' | 'kasbesar' }[]): Tombstone[] {
  if (entries.length === 0) return readTombstones();
  const now = new Date().toISOString();
  const existing = readTombstones();
  const seen = new Set(existing.map(t => `${t.kind}||${t.id}`));
  const next = [...existing];
  for (const e of entries) {
    const key = `${e.kind}||${e.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push({ id: e.id, kind: e.kind, deletedAt: now });
  }
  const capped = next.slice(-MAX_TOMBSTONES);
  writeTombstones(capped);
  try {
    window.dispatchEvent(new Event('tombstones-updated'));
    window.dispatchEvent(new Event('shared-data-updated'));
  } catch {}
  return capped;
}

/* ── Saring data per key berdasarkan tombstone (dipakai sync provider) ── */
export function applyTombstones(key: string, data: any, tombs: Tombstone[]): any {
  if (!Array.isArray(data) || data.length === 0 || tombs.length === 0) return data;
  if (key === TOMBSTONE_KEY) return data;
  const poIds = new Set(tombs.filter(t => t.kind === 'po').map(t => t.id));
  const payIds = new Set(tombs.filter(t => t.kind === 'payment').map(t => t.id));
  const kasKecilIds = new Set(tombs.filter(t => t.kind === 'kaskecil').map(t => t.id));
  const kasBesarIds = new Set(tombs.filter(t => t.kind === 'kasbesar').map(t => t.id));

  if (key === 'mma_hpp_purchases') {
    return data.filter((i: any) => !poIds.has(i?.noPO));
  }
  if (key === 'mma_payment_history') {
    return data.filter((i: any) => !payIds.has(i?.id) && !poIds.has(i?.noPO));
  }
  if (key === 'mma_bukti_bayar') {
    return data.filter((i: any) => !payIds.has(i?.paymentId) && !poIds.has(i?.noPO));
  }
  if (key === 'mma_koreksi_po') {
    return data.filter((i: any) => !poIds.has(i?.noPO));
  }
  if (key === 'mma_kas_kecil') {
    return data.filter((i: any) => !kasKecilIds.has(i?.id));
  }
  if (key === 'mma_kas_besar_masuk') {
    return data.filter((i: any) => !kasBesarIds.has(i?.id));
  }
  return data;
}
