-- Migration: 015_create_operasional_log.sql
-- Log permanen proses pesanan & resi di Operasional Gudang + Retur/Klaim yang diterima Runner.
-- Tujuannya: setiap pesanan/resi yang lewat operasional TEREKAM semua (audit trail),
-- termasuk retur/klaim yang diterima Runner lebih dulu — tidak bisa hilang meski data dashboard direset.

CREATE TABLE IF NOT EXISTS operasional_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  no_pesanan    VARCHAR(255),
  no_resi       VARCHAR(255),
  marketplace   VARCHAR(100),
  kurir         VARCHAR(100),
  jenis         VARCHAR(20) NOT NULL DEFAULT 'proses',  -- proses | retur | klaim
  aksi          VARCHAR(100) NOT NULL,                  -- Upload Order, Picking, QC, Packing, Serah Terima Runner, Hand Over, Retur Diterima, Klaim Diterima
  status_proses VARCHAR(50),                            -- status workflow saat aksi terjadi
  petugas       VARCHAR(255),                           -- nama user (dari cookie login)
  pegawai_id    VARCHAR(255),                           -- id pegawai (dari cookie login)
  keterangan    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ol_toko_tgl  ON operasional_log(toko_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ol_resi      ON operasional_log(toko_id, no_resi);
CREATE INDEX IF NOT EXISTS idx_ol_pesanan   ON operasional_log(toko_id, no_pesanan);
CREATE INDEX IF NOT EXISTS idx_ol_jenis     ON operasional_log(toko_id, jenis);
