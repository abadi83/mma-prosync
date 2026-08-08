import { apiSuccess, apiBadRequest, apiNotFound, apiServerError } from '@/app/lib/apiResponse';

/**
 * API untuk menyimpan & mengambil arsip bukti bayar.
 * Karena project ini client-side heavy (localStorage), API ini hanya
 * memvalidasi dan me-return data — penyimpanan tetap di localStorage client.
 * Untuk production: ganti dengan Supabase / database lain.
 */

// In-memory store untuk session (reset tiap restart server)
const store = new Map<string, unknown>();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const data = store.get(id);
      if (!data) return apiNotFound('Bukti bayar tidak ditemukan.');
      return apiSuccess(data);
    }

    // List semua
    const all = Array.from(store.entries()).map(([key, val]) => ({ id: key, ...(val as object) }));
    return apiSuccess(all);
  } catch {
    return apiServerError('GET /api/bukti-bayar');
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, paymentId, noPO, supplierNama, jumlah, nomorRef, tanggalBayar, imageBase64, ocrRawText } = body;

    if (!id || !paymentId || !imageBase64) {
      return apiBadRequest('Field id, paymentId, dan imageBase64 wajib.');
    }

    const record = {
      id,
      paymentId,
      noPO: noPO || '',
      supplierNama: supplierNama || '',
      jumlah: jumlah || 0,
      nomorRef: nomorRef || '',
      tanggalBayar: tanggalBayar || '',
      imageBase64,
      ocrRawText: ocrRawText || '',
      createdAt: new Date().toISOString(),
    };

    store.set(id, record);
    return apiSuccess({ success: true, data: record, message: 'Bukti bayar berhasil disimpan.' });
  } catch {
    return apiServerError('POST /api/bukti-bayar');
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return apiBadRequest('Parameter id wajib.');

    const existed = store.has(id);
    if (!existed) return apiNotFound('Bukti bayar tidak ditemukan.');

    store.delete(id);
    return apiSuccess({ success: true, message: 'Bukti bayar berhasil dihapus.' });
  } catch {
    return apiServerError('DELETE /api/bukti-bayar');
  }
}
