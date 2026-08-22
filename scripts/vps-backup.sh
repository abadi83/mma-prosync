#!/bin/bash
# ── Backup harian MMA ProSync (PostgreSQL + data JSON) ──
# Pasang di cron VPS:
#   0 2 * * * /bin/bash /home/mma-prosync/scripts/vps-backup.sh >> /home/backups/backup.log 2>&1
set -euo pipefail

APP_DIR=/home/mma-prosync
BACKUP_ROOT=/home/backups
DB_DIR=$BACKUP_ROOT/db
DATA_DIR=$BACKUP_ROOT/data
ARCH_DIR=$BACKUP_ROOT/archive
TODAY=$(date +%Y-%m-%d)
STAMP=$(date +%Y-%m-%d_%H%M%S)

mkdir -p "$DB_DIR" "$DATA_DIR" "$ARCH_DIR"

# Load DATABASE_URL dari .env.local (tanpa menampilkan isinya)
cd "$APP_DIR"
set -a; . ./.env.local; set +a

DB_NAME=$(echo "$DATABASE_URL" | sed -E 's#.*\/([^/?]+)(\?.*)?$#\1#')
DB_USER=$(echo "$DATABASE_URL" | sed -E 's#.*:\/\/([^:]+):.*#\1#')
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's#.*@([^:/]+)[:/].*#\1#')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's#.*:([0-9]+)\/.*#\1#')
export PGPASSWORD=$(echo "$DATABASE_URL" | sed -E 's#.*://[^:]+:([^@]+)@.*#\1#')

# 1. Backup PostgreSQL (custom format, bisa di-restore dengan pg_restore)
pg_dump -U "$DB_USER" -h "$DB_HOST" -p "${DB_PORT:-5432}" -F c -f "$DB_DIR/mma_$TODAY.dump" "$DB_NAME"

# 2. Backup folder data/*.json (sinkronisasi localStorage)
tar -czf "$DATA_DIR/data_$STAMP.tar.gz" -C "$APP_DIR" data

# 3. Rotasi: dump harian disimpan 30 hari, data tar 30 hari
find "$DB_DIR" -name 'mma_*.dump' -mtime +30 -delete
find "$DATA_DIR" -name 'data_*.tar.gz' -mtime +30 -delete

# 4. Arsip bulanan (setiap tgl 1): salinan dump disimpan 12 bulan
if [ "$(date +%d)" = "01" ]; then
  cp "$DB_DIR/mma_$TODAY.dump" "$ARCH_DIR/mma_$(date +%Y-%m).dump"
  find "$ARCH_DIR" -name 'mma_*.dump' -mtime +365 -delete
fi

echo "✅ Backup selesai: $DB_DIR/mma_$TODAY.dump + data_$STAMP.tar.gz"
