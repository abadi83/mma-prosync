-- Seed: 003_seed_transaksi.sql
-- Data transaksi penjualan selaras dengan mockSalesData frontend
-- Jalankan SETELAH migrasi 003

-- Transaksi 1: Minyak Goreng 2x + Sabun Cuci 3x
INSERT INTO transaksi (id, toko_id, pelanggan_id, total, tanggal)
VALUES ('f1f1f1f1-5001-4000-8000-000000000001', 'a0a0a0a0-0000-0000-0000-000000000001', 'd1d1d1d1-3001-4000-8000-000000000001', 45000, '2026-08-02 10:00:00+07')
ON CONFLICT (id) DO NOTHING;

INSERT INTO detail_transaksi (id, transaksi_id, produk_id, jumlah, harga_satuan, subtotal) VALUES
  ('f1f1f1f1-5001-4000-8000-000000000101', 'f1f1f1f1-5001-4000-8000-000000000001', 'c1c1c1c1-2001-4000-8000-000000000001', 2, 15000, 30000),
  ('f1f1f1f1-5001-4000-8000-000000000102', 'f1f1f1f1-5001-4000-8000-000000000001', 'c1c1c1c1-2001-4000-8000-000000000003', 3,  5000, 15000)
ON CONFLICT (id) DO NOTHING;

-- Transaksi 2: Beras Premium 1x
INSERT INTO transaksi (id, toko_id, pelanggan_id, total, tanggal)
VALUES ('f1f1f1f1-5001-4000-8000-000000000002', 'a0a0a0a0-0000-0000-0000-000000000001', 'd1d1d1d1-3001-4000-8000-000000000001', 65000, '2026-08-02 11:00:00+07')
ON CONFLICT (id) DO NOTHING;

INSERT INTO detail_transaksi (id, transaksi_id, produk_id, jumlah, harga_satuan, subtotal) VALUES
  ('f1f1f1f1-5001-4000-8000-000000000201', 'f1f1f1f1-5001-4000-8000-000000000002', 'c1c1c1c1-2001-4000-8000-000000000002', 1, 65000, 65000)
ON CONFLICT (id) DO NOTHING;

-- Transaksi 3: Kopi Arabika 2x
INSERT INTO transaksi (id, toko_id, pelanggan_id, total, tanggal)
VALUES ('f1f1f1f1-5001-4000-8000-000000000003', 'a0a0a0a0-0000-0000-0000-000000000001', 'd1d1d1d1-3001-4000-8000-000000000001', 70000, '2026-08-02 12:00:00+07')
ON CONFLICT (id) DO NOTHING;

INSERT INTO detail_transaksi (id, transaksi_id, produk_id, jumlah, harga_satuan, subtotal) VALUES
  ('f1f1f1f1-5001-4000-8000-000000000301', 'f1f1f1f1-5001-4000-8000-000000000003', 'c1c1c1c1-2001-4000-8000-000000000004', 2, 35000, 70000)
ON CONFLICT (id) DO NOTHING;

-- Transaksi 4: Minyak Goreng 1x
INSERT INTO transaksi (id, toko_id, pelanggan_id, total, tanggal)
VALUES ('f1f1f1f1-5001-4000-8000-000000000004', 'a0a0a0a0-0000-0000-0000-000000000001', 'd1d1d1d1-3001-4000-8000-000000000001', 15000, '2026-08-01 14:00:00+07')
ON CONFLICT (id) DO NOTHING;

INSERT INTO detail_transaksi (id, transaksi_id, produk_id, jumlah, harga_satuan, subtotal) VALUES
  ('f1f1f1f1-5001-4000-8000-000000000401', 'f1f1f1f1-5001-4000-8000-000000000004', 'c1c1c1c1-2001-4000-8000-000000000001', 1, 15000, 15000)
ON CONFLICT (id) DO NOTHING;

-- Transaksi 5: Beras Premium 2x
INSERT INTO transaksi (id, toko_id, pelanggan_id, total, tanggal)
VALUES ('f1f1f1f1-5001-4000-8000-000000000005', 'a0a0a0a0-0000-0000-0000-000000000001', 'd1d1d1d1-3001-4000-8000-000000000001', 130000, '2026-08-01 15:00:00+07')
ON CONFLICT (id) DO NOTHING;

INSERT INTO detail_transaksi (id, transaksi_id, produk_id, jumlah, harga_satuan, subtotal) VALUES
  ('f1f1f1f1-5001-4000-8000-000000000501', 'f1f1f1f1-5001-4000-8000-000000000005', 'c1c1c1c1-2001-4000-8000-000000000002', 2, 65000, 130000)
ON CONFLICT (id) DO NOTHING;

-- Trigger akan mengupdate transaksi.total setelah seed
