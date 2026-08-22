-- Migration: 010_create_marketplace_orders.sql
-- Data order marketplace (upload Excel keuangan) — SUMBER UTAMA di PostgreSQL.
-- Menggantikan localStorage 'mma_marketplace_orders' (browser storage terbatas ~5MB).
-- Dedup otomatis di level DB: UNIQUE (toko_id, marketplace, no_pesanan) → re-upload = UPDATE.

CREATE TABLE IF NOT EXISTS marketplace_order (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  no_pesanan        VARCHAR(255) NOT NULL,
  marketplace       VARCHAR(50)  NOT NULL,
  tanggal           VARCHAR(10),
  toko_nama         VARCHAR(255),
  pendapatan_kotor  NUMERIC(14,2) NOT NULL DEFAULT 0,
  pendapatan_bersih NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_biaya       NUMERIC(14,2) NOT NULL DEFAULT 0,
  fee_admin         NUMERIC(14,2) NOT NULL DEFAULT 0,
  fee_layanan       NUMERIC(14,2) NOT NULL DEFAULT 0,
  ongkir_aktual     NUMERIC(14,2) NOT NULL DEFAULT 0,
  subsidi_ongkir    NUMERIC(14,2) NOT NULL DEFAULT 0,
  biaya_pemrosesan  NUMERIC(14,2) NOT NULL DEFAULT 0,
  premi_proteksi    NUMERIC(14,2) NOT NULL DEFAULT 0,
  biaya_ams         NUMERIC(14,2) NOT NULL DEFAULT 0,
  biaya_transaksi   NUMERIC(14,2) NOT NULL DEFAULT 0,
  komisi            NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_hpp         NUMERIC(14,2) NOT NULL DEFAULT 0,
  laba_kotor        NUMERIC(14,2) NOT NULL DEFAULT 0,
  catatan           TEXT,
  status_pesanan    VARCHAR(255),
  items             JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (toko_id, marketplace, no_pesanan)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_order_toko ON marketplace_order(toko_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_order_tanggal ON marketplace_order(tanggal);
