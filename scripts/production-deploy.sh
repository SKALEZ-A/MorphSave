#!/bin/bash

# Production Deployment Script for MorphSave
# This script handles the complete production deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_ID=$(date +%Y%m%d-%H%M%S)
LOG_FILE="/var/log/morphsave/deployment-${DEPLOYMENT_ID}.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

# Usage function
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --environment ENV    Target environment (staging|production)"
    echo "  -v, --version VERSION    Version to deploy (default: latest)"
    echo "  -s, --skip-tests        Skip pre-deployment tests"
    echo "  -f, --force             Force deployment without confirmation"
    echo "  -r, --rollback          Rollback to previous version"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -e production -v v1.2.3"
    echo "  $0 -e staging --skip-tests"
    echo "  $0 --rollback"
    exit 1
}

# Parse command line arguments
ENVIRONMENT=""
VERSION="latest"
SKIP_TESTS=false
FORCE=false
ROLLBACK=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -s|--skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -r|--rollback)
            ROLLBACK=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Validate environment
if [ -z "$ENVIRONMENT" ]; then
    error "Environment is required (-e staging|production)"
fi

if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
    error "Environment must be 'staging' or 'production'"
fi

# Change to project root
cd "$PROJECT_ROOT"

log "🚀 Starting MorphSave deployment to $ENVIRONMENT"
log "Deployment ID: $DEPLOYMENT_ID"
log "Version: $VERSION"

# Load environment variables
ENV_FILE=".env.${ENVIRONMENT}"
if [ ! -f "$ENV_FILE" ]; then
    error "Environment file $ENV_FILE not found"
fi

export $(cat "$ENV_FILE" | grep -v '^#' | xargs)

# Pre-deployment checks
pre_deployment_checks() {
    log "🔍 Running pre-deployment checks..."
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running"
    fi
    
    # Check if required files exist
    local required_files=(
        "docker-compose.${ENVIRONMENT}.yml"
        "$ENV_FILE"
        "package.json"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            error "Required file not found: $file"
        fi
    done
    
    # Check environment variables
    local required_vars=(
        "DATABASE_URL"
        "JWT_SECRET"
        "ENCRYPTION_KEY"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            error "Required environment variable not set: $var"
        fi
    done
    
    # Check disk space
    local available_space=$(df / | awk 'NR==2 {print $4}')
    if [ "$available_space" -lt 1048576 ]; then # Less than 1GB
        warn "Low disk space: $(df -h / | awk 'NR==2 {print $4}') available"
    fi
    
    log "✅ Pre-deployment checks passed"
}

# Run tests
run_tests() {
    if [ "$SKIP_TESTS" = true ]; then
        warn "Skipping tests as requested"
        return
    fi
    
    log "🧪 Running tests..."
    
    # Install dependencies
    npm ci
    
    # Run unit tests
    npm run test -- --passWithNoTests
    
    # Run integration tests
    npm run test:integration
    
    # Run security audit
    npm audit --audit-level high
    
    log "✅ All tests passed"
}

# Create backup
create_backup() {
    log "💾 Creating pre-deployment backup..."
    
    local backup_file="backups/pre_deploy_${DEPLOYMENT_ID}.sql.gz"
    mkdir -p backups
    
    if docker-compose -f "docker-compose.${ENVIRONMENT}.yml" ps postgres | grep -q "Up"; then
        docker-compose -f "docker-compose.${ENVIRONMENT}.yml" exec -T postgres pg_dump \
            -U ${POSTGRES_USER:-morphsave} \
            -d ${POSTGRES_DB:-morphsave} \
            --verbose --no-owner --no-privileges | gzip > "$backup_file"
    else
        pg_dump "$DATABASE_URL" --verbose --no-owner --no-privileges | gzip > "$backup_file"
    fi
    
    if [ -f "$backup_file" ] && [ -s "$backup_file" ]; then
        log "✅ Backup created: $backup_file"
        echo "$backup_file" > ".last_backup"
    else
        error "Backup creation failed"
    fi
}

# Deploy smart contracts
deploy_contracts() {
    log "📜 Deploying smart contracts..."
    
    # Compile contracts
    npm run hardhat:compile
    
    # Deploy to network
    if [ "$ENVIRONMENT" = "production" ]; then
        npm run hardhat:deploy --network morphMainnet
    else
        npm run hardhat:deploy --network morphHolesky
    fi
    
    # Verify contracts
    npm run hardhat:verify
    
    log "✅ Smart contracts deployed"
}

# Deploy application
deploy_application() {
    log "🚢 Deploying application..."
    
    # Pull latest images
    docker-compose -f "docker-compose.${ENVIRONMENT}.yml" pull
    
    # Build application
    docker-compose -f "docker-compose.${ENVIRONMENT}.yml" build --no-cache app
    
    # Start services with rolling update
    docker-compose -f "docker-compose.${ENVIRONMENT}.yml" up -d --remove-orphans
    
    # Wait for services to be healthy
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f "http://localhost:3000/api/health" >/dev/null 2>&1; then
            log "✅ Application is healthy"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            error "Application failed to start after $max_attempts attempts"
        fi
        
        info "Waiting for application to start (attempt $attempt/$max_attempts)..."
        sleep 10
        ((attempt++))
    done
}

# Run database migrations
run_migrations() {
    log "🗄️  Running database migrations..."
    
    docker-compose -f "docker-compose.${ENVIRONMENT}.yml" exec -T app npm run db:migrate:deploy
    
    log "✅ Database migrations completed"
}

# Post-deployment verification
post_deployment_verification() {
    log "✅ Running post-deployment verification..."
    
    # Health checks
    local endpoints=(
        "http://localhost:3000/api/health"
        "http://localhost:3000/api/metrics"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if ! curl -f "$endpoint" >/dev/null 2>&1; then
            error "Health check failed for: $endpoint"
        fi
    done
    
    # Database connectivity
    if ! docker-compose -f "docker-compose.${ENVIRONMENT}.yml" exec -T postgres pg_isready; then
        error "Database connectivity check failed"
    fi
    
    # Redis connectivity
    if ! docker-compose -f "docker-compose.${ENVIRONMENT}.yml" exec -T redis redis-cli ping >/dev/null 2>&1; then
        error "Redis connectivity check failed"
    fi
    
    # Run smoke tests
    if [ -f "test/smoke.test.js" ]; then
        npm run test:smoke
    fi
    
    log "✅ Post-deployment verification passed"
}

# Rollback function
rollback_deployment() {
    log "🔄 Rolling back deployment..."
    
    if [ ! -f ".last_backup" ]; then
        error "No backup file found for rollback"
    fi
    
    local backup_file=$(cat .last_backup)
    
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
    fi
    
    # Stop current services
    docker-compose -f "docker-compose.${ENVIRONMENT}.yml" down
    
    # Restore database
    if docker-compose -f "docker-compose.${ENVIRONMENT}.yml" up -d postgres; then
        sleep 10
        zcat "$backup_file" | docker-compose -f "docker-compose.${ENVIRONMENT}.yml" exec -T postgres psql \
            -U ${POSTGRES_USER:-morphsave} \
            -d ${POSTGRES_DB:-morphsave}
    fi
    
    # Start previous version
    docker-compose -f "docker-compose.${ENVIRONMENT}.yml" up -d
    
    log "✅ Rollback completed"
}

# Send notifications
send_notifications() {
    local status=$1
    local message=$2
    
    # Slack notification
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local emoji="✅"
        if [ "$status" = "failed" ]; then
            emoji="❌"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$emoji MorphSave deployment to $ENVIRONMENT $status\\nDeployment ID: $DEPLOYMENT_ID\\nVersion: $VERSION\\n$message\"}" \
            "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || true
    fi
    
    # Email notification (if configured)
    if [ -n "$NOTIFICATION_EMAIL" ]; then
        echo "$message" | mail -s "MorphSave Deployment $status - $ENVIRONMENT" "$NOTIFICATION_EMAIL" || true
    fi
}

# Main deployment function
main() {
    local start_time=$(date +%s)
    
    # Handle rollback
    if [ "$ROLLBACK" = true ]; then
        rollback_deployment
        send_notifications "rolled back" "Deployment rolled back successfully"
        return
    fi
    
    # Confirmation for production
    if [ "$ENVIRONMENT" = "production" ] && [ "$FORCE" = false ]; then
        warn "You are about to deploy to PRODUCTION environment!"
        warn "Version: $VERSION"
        warn "Deployment ID: $DEPLOYMENT_ID"
        echo ""
        read -p "Type 'DEPLOY TO PRODUCTION' to continue: " confirmation
        if [ "$confirmation" != "DEPLOY TO PRODUCTION" ]; then
            error "Deployment cancelled"
        fi
    fi
    
    # Execute deployment steps
    trap 'error "Deployment failed at step: ${BASH_COMMAND}"' ERR
    
    pre_deployment_checks
    run_tests
    create_backup
    deploy_contracts
    deploy_application
    run_migrations
    post_deployment_verification
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log "🎉 Deployment completed successfully!"
    log "Duration: ${duration} seconds"
    log "Deployment ID: $DEPLOYMENT_ID"
    log "Version: $VERSION"
    log "Environment: $ENVIRONMENT"
    
    send_notifications "succeeded" "Deployment completed in ${duration} seconds"
}

# Execute main function
main "$@"