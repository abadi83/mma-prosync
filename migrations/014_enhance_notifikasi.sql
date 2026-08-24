-- Migration: 014_enhance_notifikasi.sql
-- Izinkan tipe 'aktivitas' pada tabel notifikasi (notifikasi dari aktivitas modul).

ALTER TABLE notifikasi DROP CONSTRAINT IF EXISTS notifikasi_tipe_check;
ALTER TABLE notifikasi ADD CONSTRAINT notifikasi_tipe_check
  CHECK (tipe IN ('stok', 'penjualan', 'sistem', 'aktivitas'));