import { NextResponse } from 'next/server';
import { apiBadRequest, apiServerError } from '@/app/lib/apiResponse';

/**
 * POST /api/ekspor-laporan
 * Body: { jenis: 'laba-rugi'|'arus-kas'|'stok', format: 'csv'|'pdf', periode: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { jenis, format } = body;

    if (!jenis || !format) {
      return apiBadRequest('Field jenis dan format wajib diisi.');
    }

    if (format === 'csv') {
      const csv = generateCSV(jenis);
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

function generateCSV(jenis: string): string {
  const bom = '\uFEFF';
  if (jenis === 'laba-rugi') {
    return bom + [
      'Komponen,Jumlah',
      'Pendapatan,8450000',
      'HPP,5200000',
      'Biaya Operasional,1200000',
      'Biaya Lain,350000',
      'Laba Bersih,1700000',
    ].join('\n');
  }
  if (jenis === 'arus-kas') {
    return bom + [
      'Komponen,Jumlah',
      'Saldo Awal,5000000',
      'Penjualan,8450000',
      'Piutang,1200000',
      'Pembelian Stok,-4200000',
      'Operasional,-1500000',
      'Lain-lain,-500000',
      'Saldo Akhir,8450000',
    ].join('\n');
  }
  return bom + [
    'Produk,Kategori,Stok,Nilai',
    'Minyak Goreng,Rumah Tangga,8,96000',
    'Beras Premium,Sembako,6,300000',
    'Sabun Cuci,Rumah Tangga,12,36000',
    'Kopi Arabika,Minuman,15,375000',
  ].join('\n');
}
