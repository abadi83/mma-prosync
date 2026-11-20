/** Helper hitung harga kanal (Web/Online & Reseller/Offline) dari HPP terbaru.
 *  Client-safe (tidak import DB) supaya bisa dipakai di komponen client seperti SkuTab.
 *  Rumus konsisten dengan hitungHargaKanluran di tokoService (server). */

export interface HargaKanalSettings {
  pajakPersen: number;       // PPN / pajak (%)
  operasionalPersen: number; // potongan operasional / fee (%)
  marginWebPersen: number;   // margin keuntungan web/online (%)
  marginResellerPersen: number; // margin keuntungan reseller/offline (%)
}

function hitungDenganMargin(hpp: number, s: { pajakPersen: number; operasionalPersen: number; marginPersen: number }): number {
  if (!hpp || hpp <= 0) return 0;
  const pajak = Math.max(0, s.pajakPersen || 0);
  const operasional = Math.max(0, s.operasionalPersen || 0);
  const margin = Math.max(0, s.marginPersen || 0);
  if (operasional >= 100) return 0;
  // HPP + pajak + margin, lalu dinaikkan untuk menutup potongan operasional
  const sebelumPotongan = hpp * (1 + pajak / 100) * (1 + margin / 100);
  return Math.round(sebelumPotongan / (1 - operasional / 100));
}

export function hitungHargaWeb(hpp: number, s: HargaKanalSettings): number {
  return hitungDenganMargin(hpp, { pajakPersen: s.pajakPersen, operasionalPersen: s.operasionalPersen, marginPersen: s.marginWebPersen });
}

export function hitungHargaReseller(hpp: number, s: HargaKanalSettings): number {
  return hitungDenganMargin(hpp, { pajakPersen: s.pajakPersen, operasionalPersen: s.operasionalPersen, marginPersen: s.marginResellerPersen });
}
