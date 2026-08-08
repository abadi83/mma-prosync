-- Migration: 005_create_notifikasi.sql
-- Tabel notifikasi + seed data (Fase 5)
-- Database: InsForge PostgreSQL

CREATE TABLE IF NOT EXISTS notifikasi (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipe VARCHAR(20) NOT NULL CHECK (tipe IN ('stok', 'penjualan', 'sistem')),
  pesan TEXT NOT NULL,
  dibaca BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifikasi_user ON notifikasi(user_id);
CREATE INDEX IF NOT EXISTS idx_notifikasi_dibaca ON notifikasi(dibaca);
