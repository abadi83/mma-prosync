'use client';

/** Rekam proses pesanan/resi Operasional Gudang ke server (permanen di PostgreSQL).
 *  Juga dipakai untuk mencatat Retur/Klaim yang diterima Runner lebih dulu.
 *  Identitas petugas diambil server dari cookie login — klien cuma kirim aksinya. */
export function recordOpLog(entries: {
  noPesanan?: string;
  noResi?: string;
  marketplace?: string;
  kurir?: string;
  jenis?: 'proses' | 'retur' | 'klaim';
  aksi: string;
  statusProses?: string;
  keterangan?: string;
}[]) {
  if (typeof window === 'undefined') return;
  if (!entries || entries.length === 0) return;
  try {
    fetch('/api/operasional-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    });
  } catch {}
}
