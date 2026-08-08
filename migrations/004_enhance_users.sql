-- Migration: 004_enhance_users.sql
-- Perluasan tabel users untuk mendukung autentikasi & profil (Fase 4)
-- Database: InsForge PostgreSQL

-- Tambah kolom baru ke users (jika belum ada dari 001)
ALTER TABLE users ADD COLUMN IF NOT EXISTS nama VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS telepon VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Tabel untuk session/token (opsional — jika tidak pakai JWT)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
