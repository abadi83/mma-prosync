-- Rollback: 002_create_mutasi_stok_down.sql

DROP VIEW IF EXISTS v_produk_stok;
DROP TRIGGER IF EXISTS trg_mutasi_stok_insert ON mutasi_stok;
DROP FUNCTION IF EXISTS update_stok_after_mutasi();
DROP TABLE IF EXISTS mutasi_stok;
