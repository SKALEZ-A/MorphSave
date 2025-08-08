#!/bin/bash

# MorphSave Production Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
BACKUP_RETENTION_DAYS=30
HEALTH_CHECK_TIMEOUT=300

echo -e "${GREEN}🚀 Starting MorphSave deployment to ${ENVIRONMENT}...${NC}"

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    command -v docker >/dev/null 2>&1 || error "Docker is required but not installed"
    command -v docker-compose >/dev/null 2>&1 || error "Docker Compose is required but not installed"
    command -v npm >/dev/null 2>&1 || error "npm is required but not installed"
    
    if [ ! -f ".env.${ENVIRONMENT}" ]; then
        error "Environment file .env.${ENVIRONMENT} not found"
    fi
    
    log "Prerequisites check passed ✅"
}

# Backup database
backup_database() {
    if [ "$ENVIRONMENT" = "production" ]; then
        log "Creating database backup..."
        
        BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
        BACKUP_PATH="./backups/${BACKUP_FILE}"
        
        mkdir -p ./backups
        
        docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump \
            -U ${POSTGRES_USER:-morphsave} \
            -d ${POSTGRES_DB:-morphsave} > "${BACKUP_PATH}" || error "Database backup failed"
        
        log "Database backup created: ${BACKUP_PATH} ✅"
        
        # Clean old backups
        find ./backups -name "backup_*.sql" -mtime +${BACKUP_RETENTION_DAYS} -delete
        log "Old backups cleaned up ✅"
    fi
}

# Build and deploy
deploy_application() {
    log "Building and deploying application..."
    
    # Load environment variables
    export $(cat .env.${ENVIRONMENT} | grep -v '^#' | xargs)
    
    # Build Docker images
    docker-compose -f docker-compose.prod.yml build --no-cache || error "Docker build failed"
    
    # Stop existing containers
    docker-compose -f docker-compose.prod.yml down || warn "No existing containers to stop"
    
    # Start new containers
    docker-compose -f docker-compose.prod.yml up -d || error "Container startup failed"
    
    log "Application deployed ✅"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Wait for database to be ready
    sleep 10
    
    docker-compose -f docker-compose.prod.yml exec -T app npm run db:migrate || error "Database migration failed"
    
    log "Database migrations completed ✅"
}

# Health check
health_check() {
    log "Performing health check..."
    
    local start_time=$(date +%s)
    local timeout=$((start_time + HEALTH_CHECK_TIMEOUT))
    
    while [ $(date +%s) -lt $timeout ]; do
        if curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
            log "Health check passed ✅"
            return 0
        fi
        
        echo -n "."
        sleep 5
    done
    
    error "Health check failed - application not responding"
}

# Deploy smart contracts (if needed)
deploy_contracts() {
    if [ "$ENVIRONMENT" = "production" ] && [ "${DEPLOY_CONTRACTS:-false}" = "true" ]; then
        log "Deploying smart contracts..."
        
        npm run hardhat:compile || error "Smart contract compilation failed"
        npm run hardhat:deploy || error "Smart contract deployment failed"
        
        log "Smart contracts deployed ✅"
    fi
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring..."
    
    # Ensure monitoring directories exist
    mkdir -p monitoring/grafana/provisioning/{dashboards,datasources}
    
    # Copy monitoring configurations
    if [ -d "monitoring/configs" ]; then
        cp -r monitoring/configs/* monitoring/
    fi
    
    log "Monitoring setup completed ✅"
}

# Post-deployment tasks
post_deployment() {
    log "Running post-deployment tasks..."
    
    # Clear application cache
    docker-compose -f docker-compose.prod.yml exec -T app npm run cache:clear || warn "Cache clear failed"
    
    # Warm up application
    curl -s http://localhost:3000/ >/dev/null || warn "Application warmup failed"
    
    # Send deployment notification
    if [ -n "${SLACK_WEBHOOK_URL}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚀 MorphSave deployed to ${ENVIRONMENT} successfully!\"}" \
            "${SLACK_WEBHOOK_URL}" || warn "Slack notification failed"
    fi
    
    log "Post-deployment tasks completed ✅"
}

# Rollback function
rollback() {
    error_msg=$1
    warn "Deployment failed: ${error_msg}"
    warn "Initiating rollback..."
    
    # Stop current containers
    docker-compose -f docker-compose.prod.yml down
    
    # Restore from backup if available
    if [ -f "./backups/backup_*.sql" ]; then
        LATEST_BACKUP=$(ls -t ./backups/backup_*.sql | head -n1)
        warn "Restoring database from ${LATEST_BACKUP}..."
        
        docker-compose -f docker-compose.prod.yml up -d postgres
        sleep 10
        
        docker-compose -f docker-compose.prod.yml exec -T postgres psql \
            -U ${POSTGRES_USER:-morphsave} \
            -d ${POSTGRES_DB:-morphsave} < "${LATEST_BACKUP}"
    fi
    
    error "Deployment failed and rollback initiated"
}

# Main deployment flow
main() {
    trap 'rollback "Unexpected error occurred"' ERR
    
    check_prerequisites
    backup_database
    setup_monitoring
    deploy_application
    run_migrations
    deploy_contracts
    health_check
    post_deployment
    
    log "🎉 Deployment to ${ENVIRONMENT} completed successfully!"
    
    # Display useful information
    echo ""
    echo "📊 Application URLs:"
    echo "   - Application: http://localhost:3000"
    echo "   - Grafana: http://localhost:3001"
    echo "   - Prometheus: http://localhost:9090"
    echo ""
    echo "🔧 Useful commands:"
    echo "   - View logs: docker-compose -f docker-compose.prod.yml logs -f"
    echo "   - Check status: docker-compose -f docker-compose.prod.yml ps"
    echo "   - Stop services: docker-compose -f docker-compose.prod.yml down"
    echo ""
}

# Run main function
main "$@"