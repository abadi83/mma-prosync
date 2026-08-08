/**
 * Validasi input API — fungsi bantu yang mengembalikan pesan error
 * atau null jika valid.
 */

export function validateRequired(fields: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') {
      return `Field '${key}' wajib diisi.`;
    }
  }
  return null;
}

export function validatePositiveNumber(value: unknown, fieldName: string): string | null {
  const num = typeof value === 'string' ? parseInt(value, 10) : Number(value);
  if (isNaN(num) || num <= 0) {
    return `Field '${fieldName}' harus berupa angka positif (>0).`;
  }
  return null;
}

export function validateDate(value: string, fieldName: string): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `Field '${fieldName}' harus berformat YYYY-MM-DD.`;
  }
  return null;
}

/**
 * Jalankan semua validasi, kembalikan error pertama yang ditemukan.
 */
export function runValidations(...validators: (string | null)[]): string | null {
  for (const v of validators) {
    if (v) return v;
  }
  return null;
}
