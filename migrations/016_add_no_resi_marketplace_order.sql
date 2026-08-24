-- Migration: 016_add_no_resi_marketplace_order.sql
-- Tambah kolom no_resi di marketplace_order (Input Keuangan) supaya bisa dicocokkan
-- dengan resi pesanan di Operasional Gudang.
-- Keuangan & Operasional tetap terpisah: resi sama hanya UPDATE status omset
-- menjadi "Masuk Saldo" — TIDAK dihitung/diubah angkanya di keuangan.

ALTER TABLE marketplace_order ADD COLUMN IF NOT EXISTS no_resi VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_mo_no_resi ON marketplace_order(toko_id, no_resi);
