-- Migration: 028_add_rnd_sku_ref.sql
-- Menandai research produk yang sudah "dinaikkan" menjadi SKU di master data.
-- Kolom sku_id menyimpan referensi SKU hasil, supaya tombol "Masukkan ke SKU"
-- tidak bisa diklik dua kali (duplikat).

ALTER TABLE rnd_produk ADD COLUMN IF NOT EXISTS sku_id UUID;
