#!/bin/bash
# ============================================
# Lebensordner Daily Backup Script
# ============================================
# Backs up PostgreSQL database and retains 30 days of backups.
# Run via systemd timer or cron.

set -euo pipefail

BACKUP_DIR="/mnt/storage-data/backups"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
CONTAINER_NAME="supabase-db"
LOG_TAG="[BACKUP]"

mkdir -p "$BACKUP_DIR"

echo "$LOG_TAG Starting PostgreSQL backup at $(date)"

# Dump PostgreSQL
if docker exec "$CONTAINER_NAME" pg_dump -U postgres -d postgres | gzip > "$BACKUP_DIR/pg_$DATE.sql.gz"; then
    SIZE=$(du -h "$BACKUP_DIR/pg_$DATE.sql.gz" | cut -f1)
    echo "$LOG_TAG Backup completed: pg_$DATE.sql.gz ($SIZE)"
else
    echo "$LOG_TAG ERROR: Backup failed!" >&2
    exit 1
fi

# Retain last 30 days
DELETED=$(find "$BACKUP_DIR" -name "pg_*.sql.gz" -mtime +30 -delete -print | wc -l)
echo "$LOG_TAG Cleaned up $DELETED old backup(s)"

echo "$LOG_TAG Backup finished at $(date)"
