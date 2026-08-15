-- Migration: 007_create_master_data.sql
-- Menyatukan semua master data & transaksi operasional yang sebelumnya di localStorage
-- Database: MMA ProSync PostgreSQL
-- Jalankan SETELAH migrasi 006_create_supplier.sql

-- ============================================================
-- 1. SKU / Produk Marketplace
-- ============================================================
CREATE TABLE IF NOT EXISTS sku_master (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sku           VARCHAR(255) NOT NULL,
  nama          VARCHAR(255) NOT NULL,
  grade         VARCHAR(50),
  kode_supplier_varian VARCHAR(255),
  status_edit_gambar   VARCHAR(255),
  status_upload_toko   TEXT,
  supplier      VARCHAR(255),
  kategori      VARCHAR(255),
  satuan        VARCHAR(50) DEFAULT 'pcs',
  harga_modal_lama INTEGER DEFAULT 0,
  harga_beli_baru  INTEGER DEFAULT 0,
  harga_jual    INTEGER DEFAULT 0,
  stok          INTEGER DEFAULT 0,
  min_stok      INTEGER DEFAULT 0,
  aktif         INTEGER DEFAULT 1,
  perubahan_harga_beli VARCHAR(50),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sku_toko ON sku_master(toko_id);
CREATE INDEX IF NOT EXISTS idx_sku_sku  ON sku_master(toko_id, sku);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sku_unique_toko_sku ON sku_master(toko_id, sku);

-- ============================================================
-- 2-3. Supplier & Pelanggan extension
-- ============================================================
ALTER TABLE supplier ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE supplier ADD COLUMN IF NOT EXISTS pic VARCHAR(255);
ALTER TABLE pelanggan ADD COLUMN IF NOT EXISTS marketplace VARCHAR(100);
ALTER TABLE pelanggan ADD COLUMN IF NOT EXISTS total_transaksi INTEGER DEFAULT 0;

-- ============================================================
-- 4. Toko per Marketplace
-- ============================================================
CREATE TABLE IF NOT EXISTS marketplace_toko (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nama          VARCHAR(255) NOT NULL,
  marketplace   VARCHAR(100) NOT NULL,
  link          TEXT,
  persen_fee    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_toko_toko ON marketplace_toko(toko_id);

-- ============================================================
-- 5. Fleet / Kendaraan
-- ============================================================
CREATE TABLE IF NOT EXISTS fleet (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nama          VARCHAR(255) NOT NULL,
  plat_nomor    VARCHAR(50) NOT NULL,
  tipe          VARCHAR(50) NOT NULL,
  kapasitas     VARCHAR(100),
  driver        VARCHAR(255),
  tahun         VARCHAR(10),
  status        VARCHAR(50) DEFAULT 'Tersedia',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_toko ON fleet(toko_id);

-- ============================================================
-- 6. Marketplace Orders (agregasi pesanan dari upload)
-- ============================================================
CREATE TABLE IF NOT EXISTS marketplace_orders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  no_pesanan    VARCHAR(255) NOT NULL,
  no_resi       VARCHAR(255),
  marketplace   VARCHAR(100),
  nama_toko     VARCHAR(255),
  sku           VARCHAR(255),
  nama_produk   VARCHAR(255),
  kuantity      INTEGER DEFAULT 1,
  harga_jual    INTEGER DEFAULT 0,
  hpp           INTEGER DEFAULT 0,
  kurir         VARCHAR(100),
  status_pesanan VARCHAR(100),
  dibuat        VARCHAR(50),
  sla           VARCHAR(50),
  status_proses VARCHAR(50) DEFAULT 'Perlu Dikirim',
  jenis_paket   VARCHAR(50),
  handover_id   VARCHAR(255),
  handover_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mo_toko ON marketplace_orders(toko_id);
CREATE INDEX IF NOT EXISTS idx_mo_pesanan ON marketplace_orders(toko_id, no_pesanan);
CREATE INDEX IF NOT EXISTS idx_mo_status ON marketplace_orders(toko_id, status_proses);

-- ============================================================
-- 7. Marketplace Income
-- ============================================================
CREATE TABLE IF NOT EXISTS marketplace_income (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tanggal       DATE NOT NULL,
  marketplace_id VARCHAR(255),
  marketplace_nama VARCHAR(255),
  pendapatan_kotor INTEGER DEFAULT 0,
  fee_marketplace INTEGER DEFAULT 0,
  biaya_pengiriman INTEGER DEFAULT 0,
  pendapatan_bersih INTEGER DEFAULT 0,
  biaya_proses  INTEGER DEFAULT 0,
  total_hpp     INTEGER DEFAULT 0,
  catatan       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mi_toko_tanggal ON marketplace_income(toko_id, tanggal);

-- ============================================================
-- 8. Keuangan Manual
-- ============================================================
CREATE TABLE IF NOT EXISTS keuangan_manual (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tanggal       DATE NOT NULL,
  marketplace_id VARCHAR(255),
  marketplace_nama VARCHAR(255),
  pendapatan_kotor INTEGER DEFAULT 0,
  fee_marketplace INTEGER DEFAULT 0,
  biaya_iklan   INTEGER DEFAULT 0,
  biaya_pengemasan INTEGER DEFAULT 0,
  biaya_pengiriman INTEGER DEFAULT 0,
  pendapatan_bersih INTEGER DEFAULT 0,
  catatan       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_km_toko_tanggal ON keuangan_manual(toko_id, tanggal);


-- ============================================================
-- 9. Kas Kecil
-- ============================================================
CREATE TABLE IF NOT EXISTS kas_kecil (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tanggal       DATE NOT NULL DEFAULT NOW(),
  jenis         VARCHAR(20) NOT NULL CHECK (jenis IN ('masuk', 'keluar')),
  sumber        VARCHAR(255),
  jumlah        INTEGER NOT NULL DEFAULT 0,
  keterangan    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kas_kecil_toko ON kas_kecil(toko_id);

-- ============================================================
-- 10. Data Operasional Harian
-- ============================================================
CREATE TABLE IF NOT EXISTS data_operasional (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tanggal       DATE NOT NULL,
  jam_buka      VARCHAR(10),
  jam_tutup     VARCHAR(10),
  jumlah_karyawan INTEGER DEFAULT 0,
  catatan       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_do_toko_tanggal ON data_operasional(toko_id, tanggal);
CREATE UNIQUE INDEX IF NOT EXISTS idx_do_unique_tanggal ON data_operasional(toko_id, tanggal);

-- ============================================================
-- 11. Kepegawaian: Pegawai
-- ============================================================
CREATE TABLE IF NOT EXISTS pegawai (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nama          VARCHAR(255) NOT NULL,
  nik           VARCHAR(100),
  username      VARCHAR(100),
  jabatan       VARCHAR(255),
  departemen    VARCHAR(255),
  tanggal_masuk DATE,
  status        VARCHAR(50) DEFAULT 'Aktif',
  no_hp         VARCHAR(100),
  email         VARCHAR(255),
  roles         TEXT[] DEFAULT ARRAY['pegawai'],
  password_hash VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pegawai_toko ON pegawai(toko_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pegawai_username ON pegawai(toko_id, username);

-- ============================================================
-- 12. Absensi
-- ============================================================
CREATE TABLE IF NOT EXISTS absensi (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pegawai_id    UUID NOT NULL REFERENCES pegawai(id) ON DELETE CASCADE,
  tanggal       DATE NOT NULL,
  jam_masuk     VARCHAR(10),
  jam_keluar    VARCHAR(10),
  status        VARCHAR(50) DEFAULT 'Hadir',
  keterangan    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_absensi_toko ON absensi(toko_id);
CREATE INDEX IF NOT EXISTS idx_absensi_pegawai ON absensi(pegawai_id);

-- ============================================================
-- 13. Izin / Cuti
-- ============================================================
CREATE TABLE IF NOT EXISTS izin (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pegawai_id    UUID NOT NULL REFERENCES pegawai(id) ON DELETE CASCADE,
  jenis         VARCHAR(50) NOT NULL,
  tanggal_mulai DATE NOT NULL,
  tanggal_selesai DATE,
  alasan        TEXT,
  status        VARCHAR(50) DEFAULT 'pending',
  diajukan_pada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  diproses_oleh VARCHAR(255),
  diproses_pada TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_izin_toko ON izin(toko_id);


-- ============================================================
-- 14. KPI
-- ============================================================
CREATE TABLE IF NOT EXISTS kpi (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pegawai_id    UUID NOT NULL REFERENCES pegawai(id) ON DELETE CASCADE,
  bulan         VARCHAR(7) NOT NULL,
  target_kerja  INTEGER DEFAULT 0,
  kualitas_kerja INTEGER DEFAULT 0,
  kedisiplinan  INTEGER DEFAULT 0,
  kerjasama     INTEGER DEFAULT 0,
  total_skor    INTEGER DEFAULT 0,
  catatan       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kpi_toko ON kpi(toko_id);

-- ============================================================
-- 15. Face Attendance Data
-- ============================================================
CREATE TABLE IF NOT EXISTS face_attendance (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pegawai_id    UUID NOT NULL REFERENCES pegawai(id) ON DELETE CASCADE,
  descriptor    NUMERIC[] NOT NULL,
  label         VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_face_toko_pegawai ON face_attendance(toko_id, pegawai_id);

CREATE TABLE IF NOT EXISTS absensi_face (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pegawai_id    UUID NOT NULL REFERENCES pegawai(id) ON DELETE CASCADE,
  jenis         VARCHAR(20) NOT NULL CHECK (jenis IN ('masuk', 'pulang')),
  tanggal       DATE NOT NULL DEFAULT NOW(),
  waktu         VARCHAR(10) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_absensi_face_toko ON absensi_face(toko_id);

-- ============================================================
-- 16. Biaya Operasional Harian
-- ============================================================
CREATE TABLE IF NOT EXISTS biaya_operasional (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tanggal       DATE NOT NULL,
  deskripsi     VARCHAR(255),
  kategori      VARCHAR(255),
  jumlah        INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bo_toko_tanggal ON biaya_operasional(toko_id, tanggal);

-- ============================================================
-- 17. OPEX Purchases
-- ============================================================
CREATE TABLE IF NOT EXISTS opex_purchases (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nama_item     VARCHAR(255) NOT NULL,
  kategori      VARCHAR(255),
  qty           INTEGER DEFAULT 1,
  satuan        VARCHAR(50),
  harga_satuan  INTEGER DEFAULT 0,
  total         INTEGER DEFAULT 0,
  supplier_nama VARCHAR(255),
  tanggal       DATE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opex_toko_tanggal ON opex_purchases(toko_id, tanggal);


-- ============================================================
-- 18. HPP Purchases / PO
-- ============================================================
CREATE TABLE IF NOT EXISTS hpp_purchases (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  no_po         VARCHAR(100) NOT NULL,
  sku           VARCHAR(255),
  nama_sku      VARCHAR(255),
  supplier_id   UUID REFERENCES supplier(id) ON DELETE SET NULL,
  supplier_nama VARCHAR(255),
  qty           INTEGER DEFAULT 0,
  harga_beli    INTEGER DEFAULT 0,
  total         INTEGER DEFAULT 0,
  metode_bayar  VARCHAR(50),
  dibayar       INTEGER DEFAULT 0,
  sisa_tagihan  INTEGER DEFAULT 0,
  tanggal       DATE NOT NULL,
  jatuh_tempo   DATE,
  lunas         BOOLEAN DEFAULT FALSE,
  petugas_logistik VARCHAR(255),
  pickup_status VARCHAR(50) DEFAULT 'belum',
  foto_base64   TEXT,
  nama_file_foto VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hpp_toko ON hpp_purchases(toko_id);
CREATE INDEX IF NOT EXISTS idx_hpp_no_po ON hpp_purchases(toko_id, no_po);

-- ============================================================
-- 19. Payment History
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_history (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  po_id         UUID REFERENCES hpp_purchases(id) ON DELETE SET NULL,
  no_po         VARCHAR(100),
  supplier_nama VARCHAR(255),
  jumlah_dibayar INTEGER DEFAULT 0,
  sisa_sebelum  INTEGER DEFAULT 0,
  sisa_sesudah  INTEGER DEFAULT 0,
  metode        VARCHAR(50),
  nomor_ref     VARCHAR(255),
  catatan       TEXT,
  tanggal_bayar DATE NOT NULL,
  dibayar_oleh  VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_toko ON payment_history(toko_id);

-- ============================================================
-- 20. Koreksi PO
-- ============================================================
CREATE TABLE IF NOT EXISTS koreksi_po (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  no_po         VARCHAR(100),
  sku           VARCHAR(255),
  nama_sku      VARCHAR(255),
  qty           INTEGER DEFAULT 0,
  supplier_nama VARCHAR(255),
  jenis_koreksi VARCHAR(100),
  catatan       TEXT,
  status        VARCHAR(50) DEFAULT 'pending',
  diajukan_oleh VARCHAR(255),
  diajukan_pada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  diproses_pada TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_koreksi_toko ON koreksi_po(toko_id);

CREATE TABLE IF NOT EXISTS koreksi_refund (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  koreksi_id    UUID REFERENCES koreksi_po(id) ON DELETE SET NULL,
  no_po         VARCHAR(100),
  supplier_nama VARCHAR(255),
  sku           VARCHAR(255),
  nama_sku      VARCHAR(255),
  qty           INTEGER DEFAULT 0,
  tanggal       DATE NOT NULL,
  status        VARCHAR(100) DEFAULT 'menunggu_refund',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 21. Pengantaran Offline
-- ============================================================
CREATE TABLE IF NOT EXISTS pengantaran_offline (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  no_nota       VARCHAR(255) NOT NULL,
  penerima      VARCHAR(255) NOT NULL,
  no_hp         VARCHAR(100),
  alamat        TEXT,
  kendaraan_id  UUID REFERENCES fleet(id) ON DELETE SET NULL,
  kendaraan_nama VARCHAR(255),
  plat_nomor    VARCHAR(50),
  catatan       TEXT,
  tanggal       DATE NOT NULL DEFAULT NOW(),
  jam           VARCHAR(10),
  status        VARCHAR(50) DEFAULT 'Terkirim',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pengantaran_toko ON pengantaran_offline(toko_id);

