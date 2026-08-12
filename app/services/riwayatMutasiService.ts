import { query } from '@/lib/db';

export interface RiwayatMutasiItem {
  id: string;
  produk: string;
  tipe: 'masuk' | 'keluar';
  jumlah: number;
  keterangan: string;
  tanggal: string;
}

const DEFAULT_TOKO = 'a0a0a0a0-0000-0000-0000-000000000001';

export async function getRiwayatMutasi(
  tokoId?: string,
  filter?: { tipe?: 'masuk' | 'keluar'; produk?: string },
): Promise<RiwayatMutasiItem[]> {
  let sql = `SELECT ms.id, p.nama AS produk, ms.tipe, ms.jumlah, COALESCE(ms.keterangan, '') AS keterangan,
                    to_char(ms.tanggal, 'YYYY-MM-DD') AS tanggal
             FROM mutasi_stok ms
             JOIN produk p ON ms.produk_id = p.id
             WHERE ms.toko_id = $1`;
  const params: any[] = [tokoId || DEFAULT_TOKO];
  let idx = 2;

  if (filter?.tipe) {
    sql += ` AND ms.tipe = $${idx++}`;
    params.push(filter.tipe);
  }
  if (filter?.produk) {
    sql += ` AND p.nama ILIKE $${idx++}`;
    params.push(`%${filter.produk}%`);
  }

  sql += ' ORDER BY ms.tanggal DESC LIMIT 200';
  const { rows } = await query(sql, params);
  return rows.map((r: any) => ({ ...r, jumlah: Number(r.jumlah) }));
}
