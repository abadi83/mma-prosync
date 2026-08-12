-- Migration: 006_create_supplier.sql
-- Tabel supplier untuk data master supplier

CREATE TABLE IF NOT EXISTS supplier (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nama      VARCHAR(255) NOT NULL,
  kontak    VARCHAR(100),
  alamat    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_toko ON supplier(toko_id);
