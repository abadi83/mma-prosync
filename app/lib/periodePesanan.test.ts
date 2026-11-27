import { describe, expect, it } from 'vitest';
import { filterPesananByPeriode } from './periodePesanan';

const now = Date.parse('2026-08-07T17:00:00Z'); // 8 Agustus, 00.00 WIB
const row = (noPesanan: string, dibuat: string, sku = 'a') => ({ noPesanan, noResi: 'resi', dibuat, sku });

describe('filterPesananByPeriode', () => {
  it('mempertahankan semua data tanpa perubahan pada pilihan default', () => {
    const rows = [row('lama', '2025-01-01'), row('kosong', '')];
    expect(filterPesananByPeriode(rows, 'semua', now)).toBe(rows);
  });

  it('menghitung hari berdasarkan WIB dan menyertakan semua SKU dalam paket', () => {
    const sebelum = row('sebelum', '2026-08-07T16:59:59Z');
    const mulai = row('mulai', '2026-08-07T17:00:00Z');
    const skuTanpaTanggal = row('mulai', '', 'b');
    const lokal = row('lokal', '08/08/2026 10:30');
    const excel = row('excel', '46242.5');
    const besok = row('besok', '2026-08-09');
    const rows = [sebelum, skuTanpaTanggal, mulai, lokal, excel, besok];
    expect(filterPesananByPeriode(rows, 'hari-ini', now)).toEqual([skuTanpaTanggal, mulai, lokal, excel]);
  });

  it('menyertakan hari ini dan enam hari sebelumnya, bukan tanggal invalid', () => {
    const awal = row('awal', '2026-08-02');
    const hariIni = row('hari-ini', '2026-08-08 08:00:00');
    const rows = [row('lama', '2026-08-01'), awal, hariIni, row('invalid', '2026-07-39'), row('kosong', '')];
    expect(filterPesananByPeriode(rows, '7-hari', now)).toEqual([awal, hariIni]);
    expect(filterPesananByPeriode([row('lama', '2026-08-01')], 'hari-ini', now)).toEqual([]);
  });
});
