-- Migration: 017_add_sku_konten.sql
-- Tambah kolom konten SKU untuk tracking pekerjaan user/editor:
--   video_konten : apakah SKU sudah dibuatkan video konten
--   gambar_toko  : daftar toko marketplace (pipe-separated, "Shopee — Nama Toko") yang gambarnya sudah diupdate
ALTER TABLE sku_master ADD COLUMN IF NOT EXISTS video_konten BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE sku_master ADD COLUMN IF NOT EXISTS gambar_toko TEXT NOT NULL DEFAULT '';
