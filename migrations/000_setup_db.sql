-- Setup database dan user untuk MMA ProSync
CREATE USER mma_admin WITH PASSWORD 'mma_prosync_2024!';
CREATE DATABASE mma_prosync OWNER mma_admin;
GRANT ALL PRIVILEGES ON DATABASE mma_prosync TO mma_admin;
\c mma_prosync
GRANT ALL ON SCHEMA public TO mma_admin;
