-- ============================================================
-- 019: Pelanggan — alamat & telepon (data pembeli dari kasir)
-- ============================================================
ALTER TABLE pelanggan ADD COLUMN IF NOT EXISTS alamat  TEXT;
ALTER TABLE pelanggan ADD COLUMN IF NOT EXISTS telepon VARCHAR(50);
