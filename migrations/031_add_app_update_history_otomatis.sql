-- Migration: 031_add_app_update_history_otomatis.sql
-- Tandai entri changelog yang dicatat otomatis oleh sistem (bukan manual admin).
ALTER TABLE app_update_history ADD COLUMN IF NOT EXISTS otomatis BOOLEAN NOT NULL DEFAULT FALSE;
