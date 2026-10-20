-- ============================================================
-- 021: Tugas multi-petugas (1 tugas bisa di-assign ke ≥2 orang)
-- ============================================================
CREATE TABLE IF NOT EXISTS tugas_petugas (
  tugas_id    UUID NOT NULL REFERENCES tugas(id) ON DELETE CASCADE,
  pegawai_id  UUID NOT NULL REFERENCES pegawai(id) ON DELETE CASCADE,
  PRIMARY KEY (tugas_id, pegawai_id)
);

CREATE INDEX IF NOT EXISTS idx_tugas_petugas_pegawai ON tugas_petugas(pegawai_id);

-- Backfill: pindahkan assignee tunggal lama ke tabel relasi
INSERT INTO tugas_petugas (tugas_id, pegawai_id)
SELECT t.id, t.petugas_id
FROM tugas t
WHERE t.petugas_id IS NOT NULL
ON CONFLICT (tugas_id, pegawai_id) DO NOTHING;
