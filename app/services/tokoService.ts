import { query } from '@/lib/db';

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export interface HargaWebResellerSettings {
  pajakPersen: number;
  operasionalPersen: number;
  marginWebPersen: number;
  marginResellerPersen: number;
}

export async function getInfoToko(tokoId?: string) {
  const { rows } = await query(
    `SELECT nama_toko AS nama, COALESCE(alamat_toko, '') AS alamat, COALESCE(logo_url, '') AS logo,
       COALESCE(pajak_persen, 0) AS "pajakPersen",
       COALESCE(operasional_persen, 0) AS "operasionalPersen",
       COALESCE(margin_web_persen, 0) AS "marginWebPersen",
       COALESCE(margin_reseller_persen, 0) AS "marginResellerPersen"
     FROM users WHERE id = $1`,
    [tokoId || DEFAULT_TOKO]
  );
  return rows[0] || { nama: 'Toko Berkah Abadi', alamat: '', logo: '', pajakPersen: 0, operasionalPersen: 0, marginWebPersen: 0, marginResellerPersen: 0 };
}

export async function updateInfoToko(data: {
  nama?: string; alamat?: string; logo?: string;
  pajakPersen?: number; operasionalPersen?: number;
  marginWebPersen?: number; marginResellerPersen?: number;
}, tokoId?: string) {
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (data.nama !== undefined) { sets.push(`nama_toko = $${i++}`); vals.push(data.nama); }
  if (data.alamat !== undefined) { sets.push(`alamat_toko = $${i++}`); vals.push(data.alamat); }
  if (data.logo !== undefined) { sets.push(`logo_url = $${i++}`); vals.push(data.logo); }
  if (data.pajakPersen !== undefined) { sets.push(`pajak_persen = $${i++}`); vals.push(data.pajakPersen); }
  if (data.operasionalPersen !== undefined) { sets.push(`operasional_persen = $${i++}`); vals.push(data.operasionalPersen); }
  if (data.marginWebPersen !== undefined) { sets.push(`margin_web_persen = $${i++}`); vals.push(data.marginWebPersen); }
  if (data.marginResellerPersen !== undefined) { sets.push(`margin_reseller_persen = $${i++}`); vals.push(data.marginResellerPersen); }
  if (sets.length === 0) return getInfoToko(tokoId);
  vals.push(tokoId || DEFAULT_TOKO);
  const { rows } = await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING nama_toko AS nama, COALESCE(alamat_toko, '') AS alamat, COALESCE(logo_url, '') AS logo,
       COALESCE(pajak_persen, 0) AS "pajakPersen", COALESCE(operasional_persen, 0) AS "operasionalPersen",
       COALESCE(margin_web_persen, 0) AS "marginWebPersen", COALESCE(margin_reseller_persen, 0) AS "marginResellerPersen"`,
    vals
  );
  return rows[0];
}

/** Hitung harga Web/Reseller dari HPP + settings (dipakai konsisten di frontend & server). */
export function hitungHargaKanluran(
  hpp: number,
  s: { pajakPersen: number; operasionalPersen: number; marginPersen: number }
): number {
  if (!hpp || hpp <= 0) return 0;
  const pajak = Math.max(0, s.pajakPersen || 0);
  const operasional = Math.max(0, s.operasionalPersen || 0);
  const margin = Math.max(0, s.marginPersen || 0);
  if (operasional >= 100) return 0;
  // HPP + pajak + margin, lalu dinaikkan untuk menutup potongan operasional
  const sebelumPotongan = hpp * (1 + pajak / 100) * (1 + margin / 100);
  return Math.round(sebelumPotongan / (1 - operasional / 100));
}
