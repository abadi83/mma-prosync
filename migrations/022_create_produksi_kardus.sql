-- ============================================================
-- 022: Produksi Kardus & Packing Kayu (input harian + rekap)
-- ============================================================
CREATE TABLE IF NOT EXISTS produksi_kardus (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kategori      VARCHAR(40) NOT NULL,
  ukuran        VARCHAR(30) NOT NULL DEFAULT '',
  qty           INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  tanggal       DATE NOT NULL DEFAULT CURRENT_DATE,
  catatan       TEXT,
  pegawai_id    UUID REFERENCES pegawai(id) ON DELETE SET NULL,
  pegawai_nama  VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produksi_kardus_toko    ON produksi_kardus(toko_id);
CREATE INDEX IF NOT EXISTS idx_produksi_kardus_tanggal ON produksi_kardus(toko_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_produksi_kardus_kategori ON produksi_kardus(toko_id, kategori);
