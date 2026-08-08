-- Seed: 002_seed_mutasi_stok.sql
-- Data mutasi stok selaras dengan mockStockData.riwayatMutasi frontend
-- Jalankan SETELAH migrasi 002

INSERT INTO mutasi_stok (id, produk_id, toko_id, tipe, jumlah, keterangan, tanggal) VALUES
  ('e1e1e1e1-4001-4000-8000-000000000001', 'c1c1c1c1-2001-4000-8000-000000000001', 'a0a0a0a0-0000-0000-0000-000000000001', 'masuk',  20, 'Restock dari supplier',     '2026-08-01 08:00:00+07'),
  ('e1e1e1e1-4001-4000-8000-000000000002', 'c1c1c1c1-2001-4000-8000-000000000002', 'a0a0a0a0-0000-0000-0000-000000000001', 'masuk',  15, 'Restock dari supplier',     '2026-08-01 09:00:00+07'),
  ('e1e1e1e1-4001-4000-8000-000000000003', 'c1c1c1c1-2001-4000-8000-000000000001', 'a0a0a0a0-0000-0000-0000-000000000001', 'keluar',  3, 'Penjualan',                  '2026-08-02 10:30:00+07'),
  ('e1e1e1e1-4001-4000-8000-000000000004', 'c1c1c1c1-2001-4000-8000-000000000002', 'a0a0a0a0-0000-0000-0000-000000000001', 'keluar',  2, 'Penjualan',                  '2026-08-02 11:00:00+07'),
  ('e1e1e1e1-4001-4000-8000-000000000005', 'c1c1c1c1-2001-4000-8000-000000000004', 'a0a0a0a0-0000-0000-0000-000000000001', 'masuk',  10, 'Restock dari supplier',     '2026-07-31 14:00:00+07'),
  ('e1e1e1e1-4001-4000-8000-000000000006', 'c1c1c1c1-2001-4000-8000-000000000003', 'a0a0a0a0-0000-0000-0000-000000000001', 'masuk',  30, 'Restock dari supplier',     '2026-07-30 15:00:00+07'),
  ('e1e1e1e1-4001-4000-8000-000000000007', 'c1c1c1c1-2001-4000-8000-000000000004', 'a0a0a0a0-0000-0000-0000-000000000001', 'keluar',  1, 'Barang rusak',               '2026-08-01 16:00:00+07'),
  ('e1e1e1e1-4001-4000-8000-000000000008', 'c1c1c1c1-2001-4000-8000-000000000003', 'a0a0a0a0-0000-0000-0000-000000000001', 'keluar',  5, 'Penjualan',                  '2026-08-01 17:00:00+07')
ON CONFLICT (id) DO NOTHING;

-- Trigger akan otomatis mengupdate stok di tabel produk setelah seed ini
