-- Migration: 011_create_sku_activity_log.sql
-- Audit trail aktivitas SKU per user (untuk KPI kinerja).
-- Dicatat oleh server: identitas user diambil dari cookie login (tidak bisa dipalsukan klien).

CREATE TABLE IF NOT EXISTS sku_activity_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username    VARCHAR(255),
  nama_user   VARCHAR(255),
  aksi        VARCHAR(20) NOT NULL,            -- 'tambah' | 'ubah' | 'hapus' | 'upload'
  sku         VARCHAR(255),
  nama        VARCHAR(255),
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb, -- perubahan sebelum/sesudah, jumlah upload, dll
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sku_activity_toko_time ON sku_activity_log(toko_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sku_activity_user ON sku_activity_log(username);
