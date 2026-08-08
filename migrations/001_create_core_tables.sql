-- Migration: 001_create_core_tables.sql
-- Membuat tabel inti untuk mendukung data Beranda (Fase 1)
-- Database: InsForge PostgreSQL

-- Ekstensi untuk UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Tabel USERS (minimal — akan diperluas di Fase 4)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nama_toko     VARCHAR(255),
  alamat_toko   TEXT,
  logo_url      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Tabel KATEGORI
-- ============================================================
CREATE TABLE IF NOT EXISTS kategori (
  id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nama     VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kategori_toko ON kategori(toko_id);

-- ============================================================
-- Tabel PRODUK (inti: mendukung Ringkasan Stok di Beranda)
-- ============================================================
CREATE TABLE IF NOT EXISTS produk (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kategori_id   UUID REFERENCES kategori(id) ON DELETE SET NULL,
  nama          VARCHAR(255) NOT NULL,
  harga_beli    INTEGER NOT NULL DEFAULT 0,
  harga_jual    INTEGER NOT NULL DEFAULT 0,
  stok          INTEGER NOT NULL DEFAULT 0,
  stok_minimum  INTEGER NOT NULL DEFAULT 10,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produk_toko      ON produk(toko_id);
CREATE INDEX IF NOT EXISTS idx_produk_kategori  ON produk(kategori_id);
CREATE INDEX IF NOT EXISTS idx_produk_stok      ON produk(stok, stok_minimum);

-- ============================================================
-- Tabel PELANGGAN (diperlukan untuk transaksi)
-- ============================================================
CREATE TABLE IF NOT EXISTS pelanggan (
  id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nama     VARCHAR(255) NOT NULL,
  kontak   VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pelanggan_toko ON pelanggan(toko_id);

-- ============================================================
-- Tabel TRANSAKSI (inti: mendukung Ringkasan Penjualan di Beranda)
-- ============================================================
CREATE TABLE IF NOT EXISTS transaksi (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pelanggan_id  UUID REFERENCES pelanggan(id) ON DELETE SET NULL,
  total         INTEGER NOT NULL DEFAULT 0,
  tanggal       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transaksi_toko      ON transaksi(toko_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_tanggal   ON transaksi(tanggal);
CREATE INDEX IF NOT EXISTS idx_transaksi_toko_tgl  ON transaksi(toko_id, tanggal);

-- ============================================================
-- Tabel DETAIL_TRANSAKSI
-- ============================================================
CREATE TABLE IF NOT EXISTS detail_transaksi (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaksi_id  UUID NOT NULL REFERENCES transaksi(id) ON DELETE CASCADE,
  produk_id     UUID NOT NULL REFERENCES produk(id) ON DELETE RESTRICT,
  jumlah        INTEGER NOT NULL DEFAULT 1,
  harga_satuan  INTEGER NOT NULL DEFAULT 0,
  subtotal      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_detail_transaksi      ON detail_transaksi(transaksi_id);
CREATE INDEX IF NOT EXISTS idx_detail_transaksi_produk ON detail_transaksi(produk_id);
