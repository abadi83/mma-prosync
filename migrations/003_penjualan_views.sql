-- Migration: 003_penjualan_views.sql
-- View & fungsi agregasi untuk modul Penjualan
-- Tabel transaksi & detail_transaksi sudah dibuat di migrasi 001
-- Database: InsForge PostgreSQL

-- ============================================================
-- Pastikan tabel sudah ada dari 001 (hanya validasi)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transaksi') THEN
    RAISE EXCEPTION 'Tabel transaksi belum ada. Jalankan 001_create_core_tables.sql terlebih dahulu.';
  END IF;
END $$;

-- ============================================================
-- Fungsi: hitung_total_transaksi()
-- Auto-kalkulasi total dari detail_transaksi
-- ============================================================
CREATE OR REPLACE FUNCTION hitung_total_transaksi(p_transaksi_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(subtotal), 0)
  FROM detail_transaksi
  WHERE transaksi_id = p_transaksi_id;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- View: v_penjualan_harian — ringkasan harian untuk dashboard
-- ============================================================
CREATE OR REPLACE VIEW v_penjualan_harian AS
SELECT
  t.toko_id,
  t.tanggal::date AS tanggal,
  COUNT(DISTINCT t.id) AS jumlah_transaksi,
  COALESCE(SUM(dt.subtotal), 0) AS total_penjualan
FROM transaksi t
LEFT JOIN detail_transaksi dt ON t.id = dt.transaksi_id
GROUP BY t.toko_id, t.tanggal::date;

-- ============================================================
-- View: v_transaksi_detail — join transaksi + detail
-- ============================================================
CREATE OR REPLACE VIEW v_transaksi_detail AS
SELECT
  t.id AS transaksi_id,
  t.toko_id,
  t.tanggal,
  t.total,
  dt.id AS detail_id,
  dt.produk_id,
  p.nama AS produk_nama,
  dt.jumlah,
  dt.harga_satuan,
  dt.subtotal,
  pl.nama AS pelanggan_nama
FROM transaksi t
LEFT JOIN detail_transaksi dt ON t.id = dt.transaksi_id
LEFT JOIN produk p ON dt.produk_id = p.id
LEFT JOIN pelanggan pl ON t.pelanggan_id = pl.id;

-- ============================================================
-- Trigger: update transaksi.total setelah detail berubah
-- ============================================================
CREATE OR REPLACE FUNCTION sync_total_transaksi()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE transaksi
  SET total = hitung_total_transaksi(COALESCE(NEW.transaksi_id, OLD.transaksi_id))
  WHERE id = COALESCE(NEW.transaksi_id, OLD.transaksi_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_detail_transaksi_sync ON detail_transaksi;
CREATE TRIGGER trg_detail_transaksi_sync
  AFTER INSERT OR UPDATE OR DELETE ON detail_transaksi
  FOR EACH ROW
  EXECUTE FUNCTION sync_total_transaksi();
