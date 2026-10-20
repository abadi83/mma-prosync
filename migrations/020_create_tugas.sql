-- ============================================================
-- 020: Modul Tugas Pekerjaan (assign, progress, laporan, gantt)
-- ============================================================
CREATE TABLE IF NOT EXISTS tugas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  toko_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  judul           VARCHAR(255) NOT NULL,
  deskripsi       TEXT,
  pemberi_id      UUID REFERENCES pegawai(id) ON DELETE SET NULL,
  pemberi_nama    VARCHAR(255),
  petugas_id      UUID REFERENCES pegawai(id) ON DELETE SET NULL,
  prioritas       VARCHAR(20) NOT NULL DEFAULT 'normal'
                  CHECK (prioritas IN ('rendah', 'normal', 'tinggi', 'urgent')),
  status          VARCHAR(20) NOT NULL DEFAULT 'todo'
                  CHECK (status IN ('todo', 'proses', 'review', 'selesai')),
  progress        INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  tanggal_mulai   DATE,
  tenggat         DATE,
  selesai_at      TIMESTAMPTZ,
  laporan_selesai TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tugas_toko          ON tugas(toko_id);
CREATE INDEX IF NOT EXISTS idx_tugas_status        ON tugas(toko_id, status);
CREATE INDEX IF NOT EXISTS idx_tugas_petugas       ON tugas(petugas_id);
CREATE INDEX IF NOT EXISTS idx_tugas_tenggat       ON tugas(tenggat);

-- Log riwayat progress tiap tugas (siapa, kapan, progress berapa, catatan apa)
CREATE TABLE IF NOT EXISTS tugas_progress (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tugas_id    UUID NOT NULL REFERENCES tugas(id) ON DELETE CASCADE,
  pegawai_id  UUID REFERENCES pegawai(id) ON DELETE SET NULL,
  user_nama   VARCHAR(255),
  status      VARCHAR(20),
  progress    INTEGER NOT NULL DEFAULT 0,
  catatan     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tugas_progress_tugas ON tugas_progress(tugas_id);
