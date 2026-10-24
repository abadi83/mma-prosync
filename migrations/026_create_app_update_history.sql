-- Migration: 026_create_app_update_history.sql
-- History perbaikan & update aplikasi (changelog).
-- Akses: admin penuh (lihat + tambah), non-admin hanya jika punya role 'changelog'.
CREATE TABLE IF NOT EXISTS app_update_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  versi       VARCHAR(20) NOT NULL DEFAULT '',
  tipe        VARCHAR(20) NOT NULL DEFAULT 'update',   -- fitur | perbaikan | update
  judul       VARCHAR(255) NOT NULL,
  deskripsi   TEXT NOT NULL DEFAULT '',
  oleh        VARCHAR(100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_update_history_toko ON app_update_history(toko_id, created_at DESC);

-- Seed riwayat perubahan yang SUDAH dilakukan (dari riwayat commit aplikasi).
-- Urutan tampil di aplikasi: terbaru dulu (ORDER BY created_at DESC).
INSERT INTO app_update_history (toko_id, versi, tipe, judul, deskripsi, oleh, created_at) VALUES
  ('a0a0a0a0-0000-0000-0000-000000000001', 'v1.4.1', 'update', 'Kalkulator Harga Jual memperhitungkan Diskon', 'Kalkulator harga jual kini punya input Diskon (%): harga jual otomatis dinaikkan supaya setelah diskon keuntungan bersih tetap sesuai target (potongan marketplace + biaya tetap diperhitungkan). Ada info peringatan berapa sisa keuntungan jika harga jual tidak dinaikkan.', 'Tim MMA', NOW() - INTERVAL '2 hours'),
  ('a0a0a0a0-0000-0000-0000-000000000001', 'v1.4.0', 'fitur', 'Harga Discount di Master Data SKU', 'Kolom Diskon (%) dan Harga Discount di master data SKU. Harga discount otomatis dihitung dari Harga Jual − Diskon%, dan tetap bisa di-override manual. Tampil di form, tabel, dan detail SKU.', 'Tim MMA', NOW() - INTERVAL '1 day'),
  ('a0a0a0a0-0000-0000-0000-000000000001', 'v1.3.0', 'fitur', 'Reset Rekap Absensi', 'Fitur reset rekap absensi — data wajah yang sudah terdaftar tetap aman.', 'Tim MMA', NOW() - INTERVAL '7 days'),
  ('a0a0a0a0-0000-0000-0000-000000000001', 'v1.2.2', 'perbaikan', 'Absen pulang terblokir', 'Perbaikan bug absen pulang yang terblokir setelah absen masuk.', 'Tim MMA', NOW() - INTERVAL '9 days'),
  ('a0a0a0a0-0000-0000-0000-000000000001', 'v1.2.1', 'perbaikan', 'Sinkron riwayat face absensi antar perangkat', 'Riwayat face absensi tersinkron antar perangkat sehingga rekap terlihat di semua device.', 'Tim MMA', NOW() - INTERVAL '11 days'),
  ('a0a0a0a0-0000-0000-0000-000000000001', 'v1.2.0', 'fitur', 'Face Absensi di Rekap Absensi', 'Integrasi absensi wajah ke Rekap Absensi. Menu Kepegawaian terbuka untuk semua role: pegawai melihat Face Absensi dan rekap pribadinya sendiri.', 'Tim MMA', NOW() - INTERVAL '13 days'),
  ('a0a0a0a0-0000-0000-0000-000000000001', 'v1.1.1', 'update', 'Dashboard operasional: filter per tanggal upload', 'Dashboard operasional kini bisa difilter per tanggal upload, lengkap dengan penjelasan total kumulatif pesanan.', 'Tim MMA', NOW() - INTERVAL '15 days'),
  ('a0a0a0a0-0000-0000-0000-000000000001', 'v1.1.0', 'fitur', 'Denah Rak Gudang', 'Denah rak gudang di Inventory: rak besi 5 susun, penempatan SKU per susun, penanda jumlah SKU, dan badge stok merah/kuning.', 'Tim MMA', NOW() - INTERVAL '18 days'),
  ('a0a0a0a0-0000-0000-0000-000000000001', 'v1.0.1', 'update', 'News MMA & Google News topik marketplace', 'Halaman News MMA terbuka untuk semua role + Google News menambah topik Shopee, TikTok Shop, Lazada, dan Tokopedia.', 'Tim MMA', NOW() - INTERVAL '20 days');
