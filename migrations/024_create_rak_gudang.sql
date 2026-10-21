-- ============================================================
-- 024: Denah Rak Gudang (rak besi 5 susun untuk penempatan SKU)
-- ============================================================
CREATE TABLE IF NOT EXISTS rak_gudang (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nomor       VARCHAR(30) NOT NULL,
  nama        VARCHAR(120),
  posisi      INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rak_gudang_nomor ON rak_gudang(toko_id, nomor);
CREATE INDEX IF NOT EXISTS idx_rak_gudang_toko ON rak_gudang(toko_id);

CREATE TABLE IF NOT EXISTS rak_sku (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rak_id      UUID NOT NULL REFERENCES rak_gudang(id) ON DELETE CASCADE,
  ambalan     INTEGER NOT NULL DEFAULT 1 CHECK (ambalan BETWEEN 1 AND 5),
  sku         VARCHAR(100) NOT NULL,
  nama_sku    VARCHAR(255),
  catatan     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rak_sku_uniq ON rak_sku(rak_id, ambalan, sku);
CREATE INDEX IF NOT EXISTS idx_rak_sku_rak ON rak_sku(rak_id);
CREATE INDEX IF NOT EXISTS idx_rak_sku_sku ON rak_sku(sku);
