-- ============================================================
-- 023: Berita Internal (Morning Briefing / Operational / Klaim)
-- ============================================================
CREATE TABLE IF NOT EXISTS berita_internal (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kategori      VARCHAR(20) NOT NULL
                CHECK (kategori IN ('morning', 'operasional', 'klaim')),
  judul         VARCHAR(255) NOT NULL,
  isi           TEXT,
  penulis_id    UUID REFERENCES pegawai(id) ON DELETE SET NULL,
  penulis_nama  VARCHAR(255),
  waktu         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  gambar_bg     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_berita_internal_toko     ON berita_internal(toko_id);
CREATE INDEX IF NOT EXISTS idx_berita_internal_kategori ON berita_internal(toko_id, kategori);
CREATE INDEX IF NOT EXISTS idx_berita_internal_waktu    ON berita_internal(toko_id, waktu DESC);
