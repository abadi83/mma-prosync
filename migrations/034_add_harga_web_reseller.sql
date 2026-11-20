-- Migration: 034_add_harga_web_reseller.sql
-- Menambah pengaturan global untuk harga Web (Online) & Reseller (Offline) di Master SKU.
-- Harga Web/Reseller dihitung on-the-fly dari HPP terbaru (harga_beli_baru) + komponen:
--   pajak (PPN) %, potongan operasional %, dan margin (keuntungan) % per kanal.
-- Disimpan di tabel users (per toko) supaya konsisten antar perangkat (single source of truth).
-- TIDAK mengubah kolom harga yang sudah ada (harga_modal_lama, harga_beli_baru, harga_jual).

ALTER TABLE users ADD COLUMN IF NOT EXISTS pajak_persen INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS operasional_persen INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS margin_web_persen INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS margin_reseller_persen INTEGER NOT NULL DEFAULT 0;
