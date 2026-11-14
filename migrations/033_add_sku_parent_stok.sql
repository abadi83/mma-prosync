-- Migration: 033_add_sku_parent_stok.sql
-- Relasi SKU varian → SKU induk untuk berbagi stok (share stok).
--  - parent_sku : SKU induk (NULL = induk / tidak menginduk)
--  - tipe_stok  : 'share' (stok ikut induk) | 'mandiri' (stok sendiri)
-- Deteksi otomatis: SKU mengandung '+' → varian, induk = bagian sebelum '+' pertama.
-- Tetap bisa di-override manual lewat kolom parent_sku & tipe_stok.
ALTER TABLE sku_master ADD COLUMN IF NOT EXISTS parent_sku VARCHAR(255);
ALTER TABLE sku_master ADD COLUMN IF NOT EXISTS tipe_stok VARCHAR(20) NOT NULL DEFAULT 'mandiri';

CREATE INDEX IF NOT EXISTS idx_sku_parent ON sku_master(toko_id, parent_sku);
