import { NextResponse } from 'next/server';
import { apiBadRequest, apiServerError } from '@/app/lib/apiResponse';
import { getLabaRugi } from '@/app/services/labaRugiService';
import { getArusKas } from '@/app/services/arusKasService';
import { getLaporanStok } from '@/app/services/laporanStokService';

/**
 * POST /api/ekspor-laporan
 * Body: { jenis: 'laba-rugi'|'arus-kas'|'stok', format: 'csv'|'pdf', periode?: string, toko_id?: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { jenis, format, periode, toko_id } = body;

    if (!jenis || !format) {
      return apiBadRequest('Field jenis dan format wajib diisi.');
    }

    if (format === 'csv') {
      const csv = await generateCSV(jenis, toko_id, periode);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename=laporan-${jenis}.csv`,
        },
      });
    }

    // Simulasi PDF
    return NextResponse.json({
      message: 'PDF berhasil digenerate (simulasi)',
      jenis,
      format: 'pdf',
      timestamp: new Date().toISOString(),
    });
  } catch {
    return apiServerError('POST /api/ekspor-laporan');
  }
}

function esc(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toRows(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => esc(String(c))).join(',')).join('\n');
}

async function generateCSV(jenis: string, tokoId?: string, periode?: string): Promise<string> {
  const bom = '\uFEFF';
  if (jenis === 'laba-rugi') {
    const d = await getLabaRugi(tokoId, periode);
    return bom + toRows([
      ['Komponen', 'Jumlah'],
      ['Pendapatan', d.pendapatan],
      ['Pendapatan Lain-lain', d.pendapatanLain],
      ['HPP', d.hargaPokok],
      ['Biaya Operasional', d.biayaOperasional],
      ['Biaya Lain (OPEX + Fee MP)', d.biayaLain],
      ['Laba Kotor', d.labaKotor],
      ['Laba Bersih', d.labaBersih],
    ]);
  }
  if (jenis === 'arus-kas') {
    const d = await getArusKas(tokoId, periode);
    const rows: (string | number)[][] = [['Komponen', 'Jumlah'], ['Saldo Awal', d.saldoAwal]];
    for (const p of d.pemasukan) rows.push([p.sumber, p.jumlah]);
    for (const p of d.pengeluaran) rows.push([p.sumber, -p.jumlah]);
    rows.push(['Saldo Akhir', d.saldoAkhir]);
    return bom + toRows(rows);
  }
  // default: stok
  const d = await getLaporanStok(tokoId, periode);
  const rows: (string | number)[][] = [['Produk', 'Kategori', 'Stok', 'Nilai']];
  for (const i of d.items) rows.push([i.nama, i.kategori, i.stok, i.nilai]);
  rows.push(['TOTAL', '', d.totalItem, d.totalNilai]);
  return bom + toRows(rows);
}
