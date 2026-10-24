-- Migration: 025_add_sku_harga_diskon.sql
-- Menambahkan Harga Discount di master data SKU:
--   diskon_persen = persen diskon (0-100), harga_diskon = harga jual setelah diskon.
-- Kolom baru bersifat opsional (default 0) sehingga tidak merusak flow / data lama.
ALTER TABLE sku_master ADD COLUMN IF NOT EXISTS diskon_persen INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sku_master ADD COLUMN IF NOT EXISTS harga_diskon INTEGER NOT NULL DEFAULT 0;
