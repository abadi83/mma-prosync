-- Setup user untuk MMA ProSync (idempotent)
-- NOTE: Database 'mma_prosync' dibuat manual via psql:
--   sudo -u postgres psql -c "CREATE DATABASE mma_prosync OWNER mma_admin;"
-- File ini hanya memastikan user & grants ada.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mma_admin') THEN
    CREATE USER mma_admin WITH PASSWORD 'mma_prosync_2024!';
  END IF;
END $$;

GRANT ALL ON SCHEMA public TO mma_admin;
