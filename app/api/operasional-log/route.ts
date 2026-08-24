import { NextRequest } from 'next/server';
import { insertManyOpLog, listOpLog, notifyReturKlaim, type OpLogEntry } from '@/app/services/operasionalLogService';
import { apiSuccess, apiBadRequest, apiServerError } from '@/app/lib/apiResponse';

export const dynamic = 'force-dynamic';

/** GET /api/operasional-log?jenis=&search=&limit= — riwayat proses pesanan/resi + retur/klaim */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jenis = searchParams.get('jenis') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = parseInt(searchParams.get('limit') || '200', 10);
    return apiSuccess(await listOpLog({ jenis, search, limit }));
  } catch {
    return apiServerError('GET /api/operasional-log');
  }
}

/** POST /api/operasional-log { entries: [{ noPesanan, noResi, marketplace, kurir, jenis, aksi, statusProses, keterangan }] }
 *  Identitas petugas dibaca dari cookie login di sisi server. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entries: any[] = Array.isArray(body?.entries) ? body.entries : (body?.entry ? [body.entry] : []);
    if (entries.length === 0) return apiBadRequest('entries wajib diisi');

    const pegawaiId = request.cookies.get('user_pegawai_id')?.value || '';
    const namaUser = request.cookies.get('user_name')?.value || '';

    const mapped: OpLogEntry[] = entries
      .map((e: any) => ({
        noPesanan: String(e.noPesanan || ''),
        noResi: String(e.noResi || ''),
        marketplace: String(e.marketplace || ''),
        kurir: String(e.kurir || ''),
        jenis: (['proses', 'retur', 'klaim'].includes(e.jenis) ? e.jenis : 'proses') as OpLogEntry['jenis'],
        aksi: String(e.aksi || '').slice(0, 100),
        statusProses: e.statusProses ? String(e.statusProses).slice(0, 50) : undefined,
        petugas: namaUser,
        pegawaiId,
        keterangan: String(e.keterangan || ''),
      }))
      .filter((e: OpLogEntry) => e.aksi && (e.noPesanan || e.noResi || e.keterangan));

    const count = await insertManyOpLog(mapped);
    // Notifikasi untuk retur/klaim
    for (const e of mapped) {
      if (e.jenis === 'retur' || e.jenis === 'klaim') await notifyReturKlaim(e, namaUser);
    }
    return apiSuccess({ success: true, count, petugas: namaUser });
  } catch {
    return apiServerError('POST /api/operasional-log');
  }
}
