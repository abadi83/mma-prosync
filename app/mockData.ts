export const mockDashboardData = {
  stockSummary: {
    totalItems: 24,
    lowStockCount: 1,
    items: [
      { name: 'Besi AS SENTAL ST-41 5mm', stock: 12, minStock: 5, category: 'Material' },
      { name: 'Amplas Duco Grit 1500', stock: 120, minStock: 20, category: 'TOOLS' },
      { name: 'Downlight Endora 6W Putih', stock: 45, minStock: 10, category: 'ELECTRICT' },
      { name: 'Kran Angsa 8005 Tongkat', stock: 18, minStock: 5, category: 'WATERING' },
      { name: 'Paku Seng 3 Inch', stock: 500, minStock: 100, category: 'TOOLS' },
      { name: 'Skrup Roofing 12x50', stock: 1000, minStock: 200, category: 'TOOLS' },
      { name: 'Grendel Selot Pintu PVC', stock: 3, minStock: 15, category: 'Pintu' },
    ],
  },
  salesSummary: {
    today: 1845000,
    transactions: 14,
    trend: 'up' as 'up' | 'down',
  },
  shortcuts: [
    { title: 'Inventory', category: 'Inventory', description: 'Stok opname, barang masuk/keluar & riwayat mutasi.', href: '/stok-barang' },
    { title: 'Input Penjualan', category: 'Operasional', description: 'Catat penjualan harian dengan cepat.', href: '/penjualan' },
    { title: 'Laporan', category: 'Finance', description: 'Lihat laba rugi, arus kas, dan stok.', href: '/laporan' },
    { title: 'Keuangan', category: 'Finance', description: 'Pembayaran PO, arus kas, & riwayat pembayaran supplier.', href: '/keuangan' },
    { title: 'Akuntansi', category: 'Finance', description: 'Jurnal umum, COA, aset & modal, laba rugi & neraca.', href: '/akuntansi' },
    { title: 'Data Master', category: 'Master Data', description: 'Kelola SKU, supplier, toko marketplace & pelanggan.', href: '/data-master' },
    { title: 'Pembelian & Biaya', category: 'Purchasing', description: 'Pembelian HPP SKU, OPEX packing, & biaya operasional harian.', href: '/pembelian' },
    { title: 'Operasional Gudang', category: 'Warehouse', description: 'Stok opname, mutasi, retur & penyesuaian.', href: '/operasional-gudang' },
    { title: 'Pengaturan', category: 'System', description: 'Info toko, akun, ubah password & preferensi.', href: '/pengaturan' },
    { title: 'Kepegawaian', category: 'HR', description: 'Data pegawai, absensi harian, rekap kehadiran & penilaian KPI.', href: '/kepegawaian' },
    { title: 'Data Entry', category: 'Operasional', description: 'Input data operasional & keuangan per marketplace.', href: '/data-entry' },
  ],
};

// --- Data tiruan untuk halaman Stok Barang ---

export const mockStockData = {
  barangMasuk: [
    { id: 'in-1', produk: 'Besi AS SENTAL ST-41 5mm', jumlah: 20, supplier: 'PT Sinar Jaya', tanggal: '2026-08-01' },
    { id: 'in-2', produk: 'Downlight Endora 6W Putih', jumlah: 15, supplier: 'UD Pangan Makmur', tanggal: '2026-08-01' },
    { id: 'in-3', produk: 'Kran Angsa 8005 Tongkat', jumlah: 10, supplier: 'CV Kopi Nusantara', tanggal: '2026-07-31' },
    { id: 'in-4', produk: 'Amplas Duco Grit 1500', jumlah: 50, supplier: 'PT Bersih Sejahtera', tanggal: '2026-07-30' },
  ],
  barangKeluar: [
    { id: 'out-1', produk: 'Besi AS SENTAL ST-41 5mm', jumlah: 3, keperluan: 'Penjualan', tanggal: '2026-08-02' },
    { id: 'out-2', produk: 'Paku Seng 3 Inch', jumlah: 50, keperluan: 'Penjualan', tanggal: '2026-08-02' },
    { id: 'out-3', produk: 'Skrup Roofing 12x50', jumlah: 100, keperluan: 'Rusak', tanggal: '2026-08-01' },
    { id: 'out-4', produk: 'Grendel Selot Pintu PVC', jumlah: 5, keperluan: 'Penjualan', tanggal: '2026-08-01' },
  ],
  cekStok: [
    { id: 'BTJ-001', nama: 'Besi AS SENTAL ST-41 5mm x 6m', kategori: 'Material', stok: 12, stokMin: 5, hargaJual: 25690 },
    { id: 'BB-8-D', nama: 'Amplas Duco Grit 1500 Perlembar', kategori: 'TOOLS', stok: 120, stokMin: 20, hargaJual: 1500 },
    { id: '200825', nama: 'Downlight Endora 6W Putih', kategori: 'ELECTRICT', stok: 45, stokMin: 10, hargaJual: 20899 },
    { id: 'AU-5-A', nama: 'Gagang Gergaji Triplek', kategori: 'TOOLS', stok: 30, stokMin: 5, hargaJual: 15950 },
    { id: '200959', nama: 'Kran Angsa 8005 Tongkat', kategori: 'WATERING', stok: 18, stokMin: 5, hargaJual: 95402 },
    { id: '200946', nama: 'Kunci Pintu Besar HPP 01', kategori: 'DOORING', stok: 22, stokMin: 5, hargaJual: 74000 },
    { id: '200046-1PCS', nama: 'Paku Seng 3 Inch', kategori: 'TOOLS', stok: 500, stokMin: 100, hargaJual: 415 },
    { id: 'BC-1-C', nama: 'Skrup Roofing 12x50', kategori: 'TOOLS', stok: 1000, stokMin: 200, hargaJual: 240 },
  ],
  riwayatMutasi: [
    { id: 'm-1', produk: 'Besi AS SENTAL ST-41 5mm', tipe: 'masuk' as const, jumlah: 20, tanggal: '2026-08-01', keterangan: 'Restock dari supplier' },
    { id: 'm-2', produk: 'Downlight Endora 6W Putih', tipe: 'masuk' as const, jumlah: 15, tanggal: '2026-08-01', keterangan: 'Restock dari supplier' },
    { id: 'm-3', produk: 'Besi AS SENTAL ST-41 5mm', tipe: 'keluar' as const, jumlah: 3, tanggal: '2026-08-02', keterangan: 'Penjualan' },
    { id: 'm-4', produk: 'Paku Seng 3 Inch', tipe: 'keluar' as const, jumlah: 50, tanggal: '2026-08-02', keterangan: 'Penjualan' },
    { id: 'm-5', produk: 'Kran Angsa 8005 Tongkat', tipe: 'masuk' as const, jumlah: 10, tanggal: '2026-07-31', keterangan: 'Restock dari supplier' },
    { id: 'm-6', produk: 'Amplas Duco Grit 1500', tipe: 'masuk' as const, jumlah: 50, tanggal: '2026-07-30', keterangan: 'Restock dari supplier' },
    { id: 'm-7', produk: 'Skrup Roofing 12x50', tipe: 'keluar' as const, jumlah: 100, tanggal: '2026-08-01', keterangan: 'Barang rusak' },
    { id: 'm-8', produk: 'Grendel Selot Pintu PVC', tipe: 'keluar' as const, jumlah: 5, tanggal: '2026-08-01', keterangan: 'Penjualan' },
  ],
};

// --- Data tiruan untuk halaman Penjualan ---

export const mockSalesData = {
  transaksi: [
    { id: 't-1', produk: 'Besi AS SENTAL ST-41 5mm', jumlah: 2, hargaSatuan: 25690, total: 51380, pelanggan: 'Budi', tanggal: '2026-08-02' },
    { id: 't-2', produk: 'Downlight Endora 6W Putih', jumlah: 1, hargaSatuan: 20899, total: 20899, pelanggan: 'Siti', tanggal: '2026-08-02' },
    { id: 't-3', produk: 'Amplas Duco Grit 1500', jumlah: 10, hargaSatuan: 1500, total: 15000, pelanggan: 'Umum', tanggal: '2026-08-02' },
    { id: 't-4', produk: 'Kran Angsa 8005 Tongkat', jumlah: 1, hargaSatuan: 95402, total: 95402, pelanggan: 'Rudi', tanggal: '2026-08-02' },
    { id: 't-5', produk: 'Paku Seng 3 Inch', jumlah: 100, hargaSatuan: 415, total: 41500, pelanggan: 'Umum', tanggal: '2026-08-01' },
    { id: 't-6', produk: 'Kunci Pintu Besar HPP 01', jumlah: 2, hargaSatuan: 74000, total: 148000, pelanggan: 'Dewi', tanggal: '2026-08-01' },
  ],
};

