-- Rollback: 001_create_core_tables_down.sql
-- Hapus tabel dalam urutan terbalik (child tables dulu)

DROP TABLE IF EXISTS detail_transaksi;
DROP TABLE IF EXISTS transaksi;
DROP TABLE IF EXISTS pelanggan;
DROP TABLE IF EXISTS produk;
DROP TABLE IF EXISTS kategori;
DROP TABLE IF EXISTS users;
