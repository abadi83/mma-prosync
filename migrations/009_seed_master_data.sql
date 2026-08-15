-- Migration: 009_seed_master_data.sql
-- Seed data master untuk toko default (construction/building materials theme)

-- ============================================================
-- Supplier default
-- ============================================================
INSERT INTO supplier (id, toko_id, nama, kontak, alamat) VALUES
  ('e1e1e1e1-4001-4000-8000-000000000001', 'a0a0a0a0-0000-0000-0000-000000000001', 'PT Sinar Jaya Steel', '021-5555-1234', 'Jl. Industri Raya No. 45, Cikarang, Bekasi'),
  ('e1e1e1e1-4001-4000-8000-000000000002', 'a0a0a0a0-0000-0000-0000-000000000001', 'UD Sumber Bangunan', '0813-9876-5432', 'Jl. Raya Bogor KM 12, Cibinong'),
  ('e1e1e1e1-4001-4000-8000-000000000003', 'a0a0a0a0-0000-0000-0000-000000000001', 'CV Teknik Makmur', '0811-2233-4455', 'Jl. Pangeran Jayakarta No. 88, Jakarta Pusat'),
  ('e1e1e1e1-4001-4000-8000-000000000004', 'a0a0a0a0-0000-0000-0000-000000000001', 'PT Plasma Pack Indonesia', '021-8888-7777', 'Kawasan Industri Pulogadung Blok C-12, Jakarta Timur'),
  ('e1e1e1e1-4001-4000-8000-000000000005', 'a0a0a0a0-0000-0000-0000-000000000001', 'Toko Listrik Jaya', '0856-1111-2222', 'Jl. Kenari No. 25, Pasar Baru, Jakarta Pusat')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Marketplace Toko default
-- ============================================================
INSERT INTO marketplace_toko (id, toko_id, nama, marketplace, link, persen_fee) VALUES
  ('f1f1f1f1-5001-4000-8000-000000000001', 'a0a0a0a0-0000-0000-0000-000000000001', 'Toko Berkah Abadi', 'Shopee', 'https://shopee.co.id/berkah_abadi', 10),
  ('f1f1f1f1-5001-4000-8000-000000000002', 'a0a0a0a0-0000-0000-0000-000000000001', 'Berkah Abadi Official', 'Tokopedia', 'https://tokopedia.com/berkah_abadi', 6),
  ('f1f1f1f1-5001-4000-8000-000000000003', 'a0a0a0a0-0000-0000-0000-000000000001', 'Toko Berkah Abadi', 'Lazada', 'https://lazada.co.id/berkah_abadi', 8)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Pelanggan default
-- ============================================================
INSERT INTO pelanggan (id, toko_id, nama, kontak, marketplace, total_transaksi) VALUES
  ('d2d2d2d2-3002-4000-8000-000000000001', 'a0a0a0a0-0000-0000-0000-000000000001', 'Budi Santoso', '0812-3456-7890', 'Shopee', 12),
  ('d2d2d2d2-3002-4000-8000-000000000002', 'a0a0a0a0-0000-0000-0000-000000000001', 'Siti Aminah', '0856-7890-1234', 'Tokopedia', 8)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Fleet default
-- ============================================================
INSERT INTO fleet (id, toko_id, nama, plat_nomor, tipe, kapasitas, driver, tahun, status) VALUES
  ('71616161-6001-4000-8000-000000000001', 'a0a0a0a0-0000-0000-0000-000000000001', 'Pick-up 1', 'B 1234 ABC', 'Pick-up', '1 ton', 'Doni', '2020', 'Tersedia'),
  ('71616161-6001-4000-8000-000000000002', 'a0a0a0a0-0000-0000-0000-000000000001', 'Box 1', 'B 5678 DEF', 'Box', '2 ton', 'Eko', '2019', 'Tersedia')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SKU Master default
-- ============================================================
INSERT INTO sku_master (id, toko_id, sku, nama, grade, supplier, kategori, satuan, harga_modal_lama, harga_beli_baru, harga_jual, stok, min_stok, aktif) VALUES
  ('81818181-7001-4000-8000-000000000001', 'a0a0a0a0-0000-0000-0000-000000000001', 'BTJ-001', 'Besi AS SENTAL ST-41 5mm x 6m', 'A', 'PT Sinar Jaya Steel', 'Material', 'pcs', 22000, 22000, 25690, 12, 5, 1),
  ('81818181-7001-4000-8000-000000000002', 'a0a0a0a0-0000-0000-0000-000000000001', 'BB-8-D', 'Amplas Duco Grit 1500 Perlembar', 'A', 'UD Sumber Bangunan', 'TOOLS', 'lembar', 1200, 1200, 1500, 120, 20, 1),
  ('81818181-7001-4000-8000-000000000003', 'a0a0a0a0-0000-0000-0000-000000000001', '200825', 'Downlight Endora 6W Putih', 'A', 'Toko Listrik Jaya', 'ELECTRICT', 'pcs', 18000, 18000, 20899, 45, 10, 1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Pegawai default
-- ============================================================
INSERT INTO pegawai (id, toko_id, nama, nik, username, jabatan, departemen, tanggal_masuk, status, no_hp, email, roles, password_hash) VALUES
  ('91919191-8001-4000-8000-000000000001', 'a0a0a0a0-0000-0000-0000-000000000001', 'Andi Pratama', 'MMA-001', 'andi', 'Kepala Gudang', 'Warehouse', '2024-01-15', 'Aktif', '0812-3456-7890', 'andi@mma.id', ARRAY['admin','hr','warehouse','logistik','inventory'], '$2a$10$placeholder'),
  ('91919191-8001-4000-8000-000000000002', 'a0a0a0a0-0000-0000-0000-000000000001', 'Siti Nurhaliza', 'MMA-002', 'siti', 'Admin Penjualan', 'Sales', '2024-02-01', 'Aktif', '0812-3456-7891', 'siti@mma.id', ARRAY['sales','pegawai'], '$2a$10$placeholder')
ON CONFLICT (id) DO NOTHING;
