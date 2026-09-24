/** Tanggal LOKAL (WIB dll) — JANGAN pakai toISOString untuk tanggal harian:
 *  toISOString pakai UTC → input sebelum jam 07:00 WIB bisa mundur 1 hari.
 */
export function fmtLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayLocal(): string {
  return fmtLocalDate(new Date());
}
