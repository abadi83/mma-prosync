'use client';

/**
 * GlobalSyncProvider — NONAKTIF untuk data bisnis.
 * Semua data bisnis sekarang disimpan di PostgreSQL melalui API,
 * sehingga sync localStorage→file server tidak lagi diperlukan.
 * Provider ini dibiarkan sebagai wrapper agar tidak merusak tree komponen.
 */

export function GlobalSyncProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
