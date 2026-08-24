-- Migration: 013_add_sku_gambar.sql
-- Kolom gambar per SKU (base64 data URL, sudah di-compress & background dihapus).
-- TIDAK ikut SELECT getAllSku (SELECT_SQL) supaya tidak membebani SkuContext/localStorage.

ALTER TABLE sku_master ADD COLUMN IF NOT EXISTS gambar TEXT;
