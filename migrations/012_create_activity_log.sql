-- Migration: 012_create_activity_log.sql
-- Audit trail aktivitas user untuk SEMUA modul (SKU, supplier, transaksi, pembelian, stok, dll)
-- untuk penilaian kinerja (KPI). Identitas user dari cookie login di sisi server.

CREATE TABLE IF NOT EXISTS activity_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username    VARCHAR(255),
  nama_user   VARCHAR(255),
  modul       VARCHAR(30) NOT NULL,          -- 'sku' | 'supplier' | 'pelanggan' | 'marketplace-toko' | 'fleet' | 'transaksi' | 'pembelian' | 'stok'
  aksi        VARCHAR(20) NOT NULL,          -- 'tambah' | 'ubah' | 'hapus' | 'upload' | 'po' | 'barang-masuk' | 'barang-keluar'
  ref_label   VARCHAR(255),                  -- nama SKU / supplier / no PO / dll
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_toko_time ON activity_log(toko_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_modul ON activity_log(modul);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(username);
