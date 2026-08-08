-- Migration: 002_create_mutasi_stok.sql
-- Tabel mutasi_stok + trigger auto-update stok di tabel produk
-- Database: InsForge PostgreSQL

-- ============================================================
-- Tabel MUTASI_STOK — log kronologis barang masuk/keluar
-- ============================================================
CREATE TABLE IF NOT EXISTS mutasi_stok (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produk_id   UUID NOT NULL REFERENCES produk(id) ON DELETE RESTRICT,
  toko_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipe        VARCHAR(10) NOT NULL CHECK (tipe IN ('masuk', 'keluar')),
  jumlah      INTEGER NOT NULL CHECK (jumlah > 0),
  keterangan  VARCHAR(255),
  tanggal     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mutasi_produk    ON mutasi_stok(produk_id);
CREATE INDEX IF NOT EXISTS idx_mutasi_toko      ON mutasi_stok(toko_id);
CREATE INDEX IF NOT EXISTS idx_mutasi_tanggal   ON mutasi_stok(tanggal);
CREATE INDEX IF NOT EXISTS idx_mutasi_tipe      ON mutasi_stok(tipe);

-- ============================================================
-- Fungsi: update_stok_after_mutasi()
-- Dipanggil oleh trigger setelah INSERT/UPDATE/DELETE di mutasi_stok
-- ============================================================
CREATE OR REPLACE FUNCTION update_stok_after_mutasi()
RETURNS TRIGGER AS $$
DECLARE
  total_masuk  INTEGER;
  total_keluar INTEGER;
BEGIN
  -- Hitung ulang stok dari seluruh mutasi produk terkait
  SELECT
    COALESCE(SUM(CASE WHEN tipe = 'masuk'  THEN jumlah ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipe = 'keluar' THEN jumlah ELSE 0 END), 0)
  INTO total_masuk, total_keluar
  FROM mutasi_stok
  WHERE produk_id = COALESCE(NEW.produk_id, OLD.produk_id);

  UPDATE produk
  SET stok = total_masuk - total_keluar
  WHERE id = COALESCE(NEW.produk_id, OLD.produk_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Trigger: trg_mutasi_stok_update
-- ============================================================
DROP TRIGGER IF EXISTS trg_mutasi_stok_insert ON mutasi_stok;
CREATE TRIGGER trg_mutasi_stok_insert
  AFTER INSERT OR UPDATE OR DELETE ON mutasi_stok
  FOR EACH ROW
  EXECUTE FUNCTION update_stok_after_mutasi();

-- ============================================================
-- View: v_produk_stok — ringkasan stok per produk (untuk API)
-- ============================================================
CREATE OR REPLACE VIEW v_produk_stok AS
SELECT
  p.id,
  p.toko_id,
  p.nama,
  k.nama AS kategori,
  p.harga_beli,
  p.harga_jual,
  p.stok,
  p.stok_minimum,
  CASE WHEN p.stok < p.stok_minimum THEN TRUE ELSE FALSE END AS is_menipis,
  p.created_at
FROM produk p
LEFT JOIN kategori k ON p.kategori_id = k.id;
