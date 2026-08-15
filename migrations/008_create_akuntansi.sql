-- Migration: 008_create_akuntansi.sql
-- Tabel akuntansi: COA, jurnal umum, aset tetap, modal

-- ============================================================
-- 1. Chart of Accounts (COA)
-- ============================================================
CREATE TABLE IF NOT EXISTS coa (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kode_akun     VARCHAR(50) NOT NULL,
  nama_akun     VARCHAR(255) NOT NULL,
  tipe_akun     VARCHAR(50) NOT NULL,
  saldo_normal  VARCHAR(10) NOT NULL CHECK (saldo_normal IN ('DEBIT', 'KREDIT')),
  keterangan    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coa_toko ON coa(toko_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coa_unique ON coa(toko_id, kode_akun);

-- ============================================================
-- 2. Jurnal Umum
-- ============================================================
CREATE TABLE IF NOT EXISTS jurnal_umum (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tanggal       DATE NOT NULL,
  akun_debit_id VARCHAR(50) NOT NULL,
  akun_kredit_id VARCHAR(50) NOT NULL,
  nominal       INTEGER NOT NULL DEFAULT 0,
  keterangan    TEXT,
  referensi     VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jurnal_toko ON jurnal_umum(toko_id);
CREATE INDEX IF NOT EXISTS idx_jurnal_tanggal ON jurnal_umum(toko_id, tanggal);

-- ============================================================
-- 3. Aset Tetap
-- ============================================================
CREATE TABLE IF NOT EXISTS aset_tetap (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nama_aset     VARCHAR(255) NOT NULL,
  kategori      VARCHAR(255),
  tanggal_perolehan DATE NOT NULL,
  harga_perolehan INTEGER DEFAULT 0,
  masa_manfaat  INTEGER DEFAULT 0,
  nilai_sisa    INTEGER DEFAULT 0,
  akumulasi_depresiasi INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aset_toko ON aset_tetap(toko_id);

-- ============================================================
-- 4. Modal
-- ============================================================
CREATE TABLE IF NOT EXISTS modal (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jenis         VARCHAR(50) NOT NULL CHECK (jenis IN ('AWAL', 'TAMBAHAN')),
  tanggal       DATE NOT NULL,
  jumlah        INTEGER DEFAULT 0,
  keterangan    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_modal_toko ON modal(toko_id);
