'use client';

/** Rekam aktivitas user ke server (audit trail → KPI kinerja).
 *  Identitas user diambil server dari cookie login — klien cuma kirim aksinya. */
export function recordActivity(entries: { modul: string; aksi: string; refLabel?: string; detail?: any }[]) {
  if (typeof window === 'undefined') return;
  if (!entries || entries.length === 0) return;
  try {
    fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    });
  } catch {}
}
