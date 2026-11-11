-- Migration: 032_add_app_update_history_commit.sql
-- Simpan hash commit sumber changelog otomatis (anti-duplikat).
ALTER TABLE app_update_history ADD COLUMN IF NOT EXISTS commit_hash VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_update_history_commit
  ON app_update_history (commit_hash)
  WHERE commit_hash IS NOT NULL;
