-- Rollback: 003_penjualan_views_down.sql

DROP TRIGGER IF EXISTS trg_detail_transaksi_sync ON detail_transaksi;
DROP FUNCTION IF EXISTS sync_total_transaksi();
DROP VIEW IF EXISTS v_transaksi_detail;
DROP VIEW IF EXISTS v_penjualan_harian;
DROP FUNCTION IF EXISTS hitung_total_transaksi();
