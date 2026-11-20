-- Migration: 035_harga_kanal_numeric.sql
-- Ubah kolom pengaturan harga Web/Reseller dari INTEGER ke NUMERIC(6,2)
-- supaya mendukung nilai desimal (mis. pajak 0.5%).

ALTER TABLE users ALTER COLUMN pajak_persen TYPE NUMERIC(6,2);
ALTER TABLE users ALTER COLUMN operasional_persen TYPE NUMERIC(6,2);
ALTER TABLE users ALTER COLUMN margin_web_persen TYPE NUMERIC(6,2);
ALTER TABLE users ALTER COLUMN margin_reseller_persen TYPE NUMERIC(6,2);
