-- Seed: 001_seed_beranda.sql
-- Data awal untuk mendukung tampilan Beranda (selaras dengan mockData frontend)
-- Jalankan SETELAH migrasi 001_create_core_tables.sql

-- Pengguna demo (password: demo123 — hanya untuk development)
INSERT INTO users (id, email, password_hash, nama_toko, alamat_toko)
VALUES (
  'a0a0a0a0-0000-0000-0000-000000000001',
  'demo@mmasync.id',
  '$2a$10$placeholder_hash',
  'Toko Berkah Abadi',
  'Jl. Merdeka No. 10, Jakarta'
) ON CONFLICT (id) DO NOTHING;

-- Kategori
INSERT INTO kategori (id, toko_id, nama) VALUES
  ('b1b1b1b1-1001-4000-8000-000000000001', 'a0a0a0a0-0000-0000-0000-000000000001', 'Kebutuhan Rumah Tangga'),
  ('b1b1b1b1-1001-4000-8000-000000000002', 'a0a0a0a0-0000-0000-0000-000000000001', 'Sembako'),
  ('b1b1b1b1-1001-4000-8000-000000000003', 'a0a0a0a0-0000-0000-0000-000000000001', 'Minuman')
ON CONFLICT (id) DO NOTHING;

-- Produk (selaras dengan mockData.stockSummary.items)
INSERT INTO produk (id, toko_id, kategori_id, nama, harga_beli, harga_jual, stok, stok_minimum) VALUES
  ('c1c1c1c1-2001-4000-8000-000000000001', 'a0a0a0a0-0000-0000-0000-000000000001', 'b1b1b1b1-1001-4000-8000-000000000001', 'Minyak Goreng',  12000, 15000, 8,  10),
  ('c1c1c1c1-2001-4000-8000-000000000002', 'a0a0a0a0-0000-0000-0000-000000000001', 'b1b1b1b1-1001-4000-8000-000000000002', 'Beras Premium',  50000, 65000, 6,  10),
  ('c1c1c1c1-2001-4000-8000-000000000003', 'a0a0a0a0-0000-0000-0000-000000000001', 'b1b1b1b1-1001-4000-8000-000000000001', 'Sabun Cuci',      3000,  5000, 12, 10),
  ('c1c1c1c1-2001-4000-8000-000000000004', 'a0a0a0a0-0000-0000-0000-000000000001', 'b1b1b1b1-1001-4000-8000-000000000003', 'Kopi Arabika',   25000, 35000, 15, 10)
ON CONFLICT (id) DO NOTHING;

-- Pelanggan default (walk-in)
INSERT INTO pelanggan (id, toko_id, nama, kontak) VALUES
  ('d1d1d1d1-3001-4000-8000-000000000001', 'a0a0a0a0-0000-0000-0000-000000000001', 'Pelanggan Umum', NULL)
ON CONFLICT (id) DO NOTHING;
