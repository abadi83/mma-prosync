/** Kontrol akses modul berdasarkan role user (multi-role).
 *  Dipakai oleh middleware (server/edge) DAN komponen client.
 *  'admin' selalu bisa akses semua. Halaman yang tidak terdaftar = boleh semua user login. */

export interface PageRoleRule {
  prefix: string; // awalan path
  roles: string[]; // role yang diizinkan (selain admin)
  label: string; // label untuk pesan
}

export const PAGE_ROLE_MAP: PageRoleRule[] = [
  { prefix: '/keuangan', roles: ['finance'], label: 'Keuangan' },
  { prefix: '/akuntansi', roles: ['finance'], label: 'Akuntansi' },
  { prefix: '/laporan', roles: ['finance'], label: 'Laporan' },
  { prefix: '/pembelian', roles: ['purchasing', 'warehouse', 'inventory'], label: 'Pembelian' },
  { prefix: '/operasional-gudang', roles: ['warehouse', 'logistik', 'inventory'], label: 'Operasional Gudang' },
  { prefix: '/stok-barang', roles: ['warehouse', 'inventory'], label: 'Stok Barang' },
  { prefix: '/penjualan', roles: ['sales'], label: 'Penjualan' },
  { prefix: '/data-master', roles: ['inventory', 'purchasing', 'sales'], label: 'Data Master' },
  { prefix: '/data-entry', roles: ['warehouse', 'logistik', 'inventory', 'sales', 'finance', 'purchasing'], label: 'Data Entry' },
  { prefix: '/kepegawaian', roles: ['hr'], label: 'Kepegawaian' },
];

export function canAccessPath(roles: string[], pathname: string): boolean {
  if (!roles || roles.length === 0) return false;
  if (roles.includes('admin')) return true;
  const rule = PAGE_ROLE_MAP.find(r => pathname === r.prefix || pathname.startsWith(r.prefix + '/'));
  if (!rule) return true; // tidak ada aturan = bebas (dashboard, notifikasi, profil, dll)
  return rule.roles.some(r => roles.includes(r));
}

export function hasAnyRole(roles: string[], needed: string[]): boolean {
  if (roles.includes('admin')) return true;
  return needed.some(r => roles.includes(r));
}
