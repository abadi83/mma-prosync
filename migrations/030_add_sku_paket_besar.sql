-- Migration: 030_add_sku_paket_besar.sql
-- Tandai SKU yang tergolong "paket besar" agar terdeteksi otomatis di QC.
ALTER TABLE sku_master ADD COLUMN IF NOT EXISTS paket_besar BOOLEAN NOT NULL DEFAULT FALSE;
