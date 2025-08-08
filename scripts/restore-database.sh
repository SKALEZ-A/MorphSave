#!/bin/bash

# Database restore script for MorphSave
set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

usage() {
    echo "Usage: $0 [OPTIONS] BACKUP_FILE"
    echo ""
    echo "Options:"
    echo "  -e, --environment ENV    Target environment (staging|production)"
    echo "  -f, --force             Skip confirmation prompts"
    echo "  -s, --s3-restore        Restore from S3 backup"
    echo "  -l, --list-backups      List available backups"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -e staging ./backups/morphsave_backup_20240101_120000.sql.gz"
    echo "  $0 -s -e production s3://bucket/path/to/backup.sql.gz"
    echo "  $0 -l"
    exit 1
}

list_backups() {
    echo "Available local backups:"
    find ./backups -name "morphsave_backup_*.sql.gz" -type f -exec ls -lh {} \; | sort -k9
    
    if [ -n "${BACKUP_S3_BUCKET}" ]; then
        echo ""
        echo "Available S3 backups:"
        aws s3 ls "s3://${BACKUP_S3_BUCKET}/database-backups/" --recursive --human-readable
    fi
}

# Parse command line arguments
ENVIRONMENT=""
FORCE=false
S3_RESTORE=false
BACKUP_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -s|--s3-restore)
            S3_RESTORE=true
            shift
            ;;
        -l|--list-backups)
            list_backups
            exit 0
            ;;
        -h|--help)
            usage
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

# Validate arguments
if [ -z "$BACKUP_FILE" ]; then
    error "Backup file is required"
fi

if [ -z "$ENVIRONMENT" ]; then
    error "Environment is required (-e staging|production)"
fi

if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
    error "Environment must be 'staging' or 'production'"
fi

# Load environment variables
ENV_FILE=".env.${ENVIRONMENT}"
if [ -f "$ENV_FILE" ]; then
    export $(cat "$ENV_FILE" | grep -v '^#' | xargs)
else
    error "Environment file $ENV_FILE not found"
fi

# Safety check for production
if [ "$ENVIRONMENT" = "production" ] && [ "$FORCE" = false ]; then
    warn "You are about to restore to PRODUCTION environment!"
    warn "This will OVERWRITE the current production database!"
    echo ""
    read -p "Type 'RESTORE PRODUCTION' to continue: " confirmation
    if [ "$confirmation" != "RESTORE PRODUCTION" ]; then
        error "Restoration cancelled"
    fi
fi

# Download from S3 if needed
if [ "$S3_RESTORE" = true ]; then
    log "Downloading backup from S3..."
    LOCAL_BACKUP="/tmp/$(basename "$BACKUP_FILE")"
    aws s3 cp "$BACKUP_FILE" "$LOCAL_BACKUP" || error "Failed to download backup from S3"
    BACKUP_FILE="$LOCAL_BACKUP"
fi

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    error "Backup file not found: $BACKUP_FILE"
fi

# Verify backup file integrity
log "Verifying backup file integrity..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gzip -t "$BACKUP_FILE" || error "Backup file is corrupted"
    zcat "$BACKUP_FILE" | head -n 10 | grep -q "PostgreSQL database dump" || error "Invalid backup file format"
else
    head -n 10 "$BACKUP_FILE" | grep -q "PostgreSQL database dump" || error "Invalid backup file format"
fi

log "Backup file verification passed"

# Create pre-restore backup
log "Creating pre-restore backup..."
PRE_RESTORE_BACKUP="./backups/pre_restore_$(date +%Y%m%d_%H%M%S).sql.gz"
mkdir -p ./backups

if docker-compose -f "docker-compose.${ENVIRONMENT}.yml" ps postgres | grep -q "Up"; then
    docker-compose -f "docker-compose.${ENVIRONMENT}.yml" exec -T postgres pg_dump \
        -U ${POSTGRES_USER:-morphsave} \
        -d ${POSTGRES_DB:-morphsave} \
        --verbose --no-owner --no-privileges | gzip > "$PRE_RESTORE_BACKUP"
else
    pg_dump "$DATABASE_URL" --verbose --no-owner --no-privileges | gzip > "$PRE_RESTORE_BACKUP"
fi

log "Pre-restore backup created: $PRE_RESTORE_BACKUP"

# Stop application services
log "Stopping application services..."
if [ -f "docker-compose.${ENVIRONMENT}.yml" ]; then
    docker-compose -f "docker-compose.${ENVIRONMENT}.yml" stop web api worker || true
fi

# Restore database
log "Starting database restoration..."

# Drop and recreate database
if docker-compose -f "docker-compose.${ENVIRONMENT}.yml" ps postgres | grep -q "Up"; then
    # Docker environment
    docker-compose -f "docker-compose.${ENVIRONMENT}.yml" exec -T postgres psql \
        -U ${POSTGRES_USER:-morphsave} \
        -d postgres \
        -c "DROP DATABASE IF EXISTS ${POSTGRES_DB:-morphsave};"
    
    docker-compose -f "docker-compose.${ENVIRONMENT}.yml" exec -T postgres psql \
        -U ${POSTGRES_USER:-morphsave} \
        -d postgres \
        -c "CREATE DATABASE ${POSTGRES_DB:-morphsave};"
    
    # Restore data
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        zcat "$BACKUP_FILE" | docker-compose -f "docker-compose.${ENVIRONMENT}.yml" exec -T postgres psql \
            -U ${POSTGRES_USER:-morphsave} \
            -d ${POSTGRES_DB:-morphsave}
    else
        cat "$BACKUP_FILE" | docker-compose -f "docker-compose.${ENVIRONMENT}.yml" exec -T postgres psql \
            -U ${POSTGRES_USER:-morphsave} \
            -d ${POSTGRES_DB:-morphsave}
    fi
else
    # Direct database connection
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    
    PGPASSWORD=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') \
        dropdb -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" --if-exists
    
    PGPASSWORD=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') \
        createdb -h "$DB_HOST" -U "$DB_USER" "$DB_NAME"
    
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        zcat "$BACKUP_FILE" | PGPASSWORD=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') \
            psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME"
    else
        PGPASSWORD=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') \
            psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$BACKUP_FILE"
    fi
fi

log "Database restoration completed"

# Run migrations if needed
if [ -f "package.json" ] && grep -q "db:migrate" package.json; then
    log "Running database migrations..."
    npm run db:migrate:deploy || warn "Migration failed - manual intervention may be required"
fi

# Restart application services
log "Restarting application services..."
if [ -f "docker-compose.${ENVIRONMENT}.yml" ]; then
    docker-compose -f "docker-compose.${ENVIRONMENT}.yml" up -d
fi

# Verify restoration
log "Verifying database restoration..."
sleep 10

if [ -f "docker-compose.${ENVIRONMENT}.yml" ]; then
    TABLE_COUNT=$(docker-compose -f "docker-compose.${ENVIRONMENT}.yml" exec -T postgres psql \
        -U ${POSTGRES_USER:-morphsave} \
        -d ${POSTGRES_DB:-morphsave} \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
else
    TABLE_COUNT=$(PGPASSWORD=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') \
        psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
fi

if [ "$TABLE_COUNT" -gt 0 ]; then
    log "Database restoration verified successfully ($TABLE_COUNT tables restored)"
else
    error "Database restoration verification failed"
fi

# Cleanup temporary files
if [ "$S3_RESTORE" = true ] && [ -f "$LOCAL_BACKUP" ]; then
    rm "$LOCAL_BACKUP"
fi

# Send notification
if [ -n "${SLACK_WEBHOOK_URL}" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ Database restored successfully to ${ENVIRONMENT} from ${BACKUP_FILE}\"}" \
        "${SLACK_WEBHOOK_URL}" >/dev/null 2>&1 || true
fi

log "Database restoration process completed successfully"
log "Pre-restore backup saved at: $PRE_RESTORE_BACKUP"