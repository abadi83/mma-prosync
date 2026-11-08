-- ============================================================
-- 027: Modul R&D — Research Produk Baru (sub-menu Tugas Pekerjaan)
-- ============================================================
-- Alur: Pemilik bikin tugas research produk baru (nama barang, kategori,
-- target harga modal, supplier, link web, contoh foto) → di-assign ke
-- petugas (multi-user) → petugas research sampai ketemu harga modal final
-- → status research selesai. Terpisah dari tabel `tugas` agar flow yang
-- sudah ada tidak berubah.
-- ============================================================

CREATE TABLE IF NOT EXISTS rnd_produk (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nama_barang       VARCHAR(255) NOT NULL,
  kategori          VARCHAR(255),
  supplier          VARCHAR(255),
  link_web          TEXT,
  foto_contoh       TEXT,
  harga_modal_target INTEGER DEFAULT 0,   -- target/estimasi awal dari pemberi
  harga_modal_final  INTEGER,             -- hasil research (harga modal riil)
  catatan           TEXT,                 -- keterangan/instruksi dari pemberi
  hasil_research    TEXT,                 -- laporan hasil dari petugas
  pemberi_id        UUID REFERENCES pegawai(id) ON DELETE SET NULL,
  pemberi_nama      VARCHAR(255),
  status            VARCHAR(20) NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo', 'proses', 'review', 'selesai')),
  prioritas         VARCHAR(20) NOT NULL DEFAULT 'normal'
                    CHECK (prioritas IN ('rendah', 'normal', 'tinggi', 'urgent')),
  tenggat           DATE,
  selesai_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rnd_toko   ON rnd_produk(toko_id);
CREATE INDEX IF NOT EXISTS idx_rnd_status ON rnd_produk(toko_id, status);
CREATE INDEX IF NOT EXISTS idx_rnd_tenggat ON rnd_produk(tenggat);

-- Relasi multi-petugas (1 research bisa di-assign ke ≥2 user)
CREATE TABLE IF NOT EXISTS rnd_petugas (
  rnd_id      UUID NOT NULL REFERENCES rnd_produk(id) ON DELETE CASCADE,
  pegawai_id  UUID NOT NULL REFERENCES pegawai(id) ON DELETE CASCADE,
  PRIMARY KEY (rnd_id, pegawai_id)
);

CREATE INDEX IF NOT EXISTS idx_rnd_petugas_pegawai ON rnd_petugas(pegawai_id);

-- Log riwayat progress tiap research (siapa, kapan, status, catatan)
CREATE TABLE IF NOT EXISTS rnd_progress (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rnd_id      UUID NOT NULL REFERENCES rnd_produk(id) ON DELETE CASCADE,
  pegawai_id  UUID REFERENCES pegawai(id) ON DELETE SET NULL,
  user_nama   VARCHAR(255),
  status      VARCHAR(20),
  catatan     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rnd_progress_rnd ON rnd_progress(rnd_id);
