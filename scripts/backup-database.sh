#!/bin/bash

# Database backup script for MorphSave
set -e

# Configuration
BACKUP_DIR="./backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Load environment variables
if [ -f ".env.production" ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
else
    error "Production environment file not found"
fi

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Database backup
log "Starting database backup..."

BACKUP_FILE="${BACKUP_DIR}/morphsave_backup_${TIMESTAMP}.sql"

# Check if running in Docker
if docker-compose -f docker-compose.prod.yml ps postgres | grep -q "Up"; then
    # Backup from Docker container
    docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump \
        -U ${POSTGRES_USER:-morphsave} \
        -d ${POSTGRES_DB:-morphsave} \
        --verbose \
        --no-owner \
        --no-privileges > "${BACKUP_FILE}" || error "Database backup failed"
else
    # Direct backup (if database is accessible)
    pg_dump "${DATABASE_URL}" \
        --verbose \
        --no-owner \
        --no-privileges > "${BACKUP_FILE}" || error "Database backup failed"
fi

# Compress backup
log "Compressing backup..."
gzip "${BACKUP_FILE}"
BACKUP_FILE="${BACKUP_FILE}.gz"

# Verify backup
if [ -f "${BACKUP_FILE}" ] && [ -s "${BACKUP_FILE}" ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    log "Backup completed successfully: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
    error "Backup verification failed"
fi

# Clean old backups
log "Cleaning old backups (older than ${RETENTION_DAYS} days)..."
find "${BACKUP_DIR}" -name "morphsave_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
REMAINING_BACKUPS=$(find "${BACKUP_DIR}" -name "morphsave_backup_*.sql.gz" | wc -l)
log "Cleanup completed. ${REMAINING_BACKUPS} backups remaining."

# Upload to cloud storage (optional)
if [ -n "${BACKUP_S3_BUCKET}" ]; then
    log "Uploading backup to S3..."
    S3_KEY="database-backups/$(date +%Y/%m/%d)/morphsave_backup_${TIMESTAMP}.sql.gz"
    aws s3 cp "${BACKUP_FILE}" "s3://${BACKUP_S3_BUCKET}/${S3_KEY}" \
        --storage-class STANDARD_IA \
        --metadata "backup-type=database,timestamp=${TIMESTAMP},retention-days=${RETENTION_DAYS}" || error "S3 upload failed"
    log "Backup uploaded to S3: s3://${BACKUP_S3_BUCKET}/${S3_KEY}"
    
    # Set lifecycle policy for automatic cleanup
    aws s3api put-object-lifecycle-configuration \
        --bucket "${BACKUP_S3_BUCKET}" \
        --lifecycle-configuration file://scripts/s3-lifecycle-policy.json >/dev/null 2>&1 || true
fi

# Create backup metadata
METADATA_FILE="${BACKUP_DIR}/backup_metadata_${TIMESTAMP}.json"
cat > "${METADATA_FILE}" << EOF
{
  "timestamp": "${TIMESTAMP}",
  "backup_file": "${BACKUP_FILE}",
  "backup_size": "$(stat -f%z "${BACKUP_FILE}" 2>/dev/null || stat -c%s "${BACKUP_FILE}")",
  "database_url": "$(echo ${DATABASE_URL} | sed 's/:[^:]*@/:***@/')",
  "backup_type": "full",
  "compression": "gzip",
  "retention_days": ${RETENTION_DAYS},
  "s3_location": "${S3_KEY:-"not_uploaded"}",
  "created_by": "$(whoami)",
  "hostname": "$(hostname)"
}
EOF

# Test backup integrity
log "Testing backup integrity..."
if command -v pg_restore >/dev/null 2>&1; then
    pg_restore --list "${BACKUP_FILE}" >/dev/null 2>&1 && log "Backup integrity check passed" || error "Backup integrity check failed"
else
    zcat "${BACKUP_FILE}" | head -n 10 | grep -q "PostgreSQL database dump" && log "Basic backup format check passed" || error "Backup format check failed"
fi

# Send notification
if [ -n "${SLACK_WEBHOOK_URL}" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ Database backup completed: ${BACKUP_FILE} (${BACKUP_SIZE})\"}" \
        "${SLACK_WEBHOOK_URL}" >/dev/null 2>&1 || true
fi

log "Database backup process completed successfully"