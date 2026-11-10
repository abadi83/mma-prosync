-- Simpan referensi PO khusus untuk audit Barang Masuk PO dan proteksi duplicate.
ALTER TABLE mutasi_stok ADD COLUMN IF NOT EXISTS no_po VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mutasi_stok_unique_po_sku_masuk
  ON mutasi_stok (toko_id, produk_id, no_po)
  WHERE tipe = 'masuk' AND no_po IS NOT NULL;
