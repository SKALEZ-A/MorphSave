# MorphSave Operations Runbook

This runbook provides step-by-step procedures for common operational tasks and incident response.

## Table of Contents

1. [System Overview](#system-overview)
2. [Monitoring & Alerting](#monitoring--alerting)
3. [Incident Response](#incident-response)
4. [Common Issues](#common-issues)
5. [Maintenance Procedures](#maintenance-procedures)
6. [Emergency Procedures](#emergency-procedures)

## System Overview

### Architecture Components

- **Application Server**: Next.js application (Port 3000)
- **Database**: PostgreSQL 15 (Port 5432)
- **Cache**: Redis 7 (Port 6379)
- **Reverse Proxy**: Nginx (Ports 80/443)
- **Monitoring**: Prometheus (Port 9090), Grafana (Port 3001)
- **Blockchain**: Morph L2 integration

### Key Metrics

- **Response Time**: < 200ms for API endpoints
- **Uptime**: 99.9% target
- **Error Rate**: < 0.1%
- **Database Connections**: < 80% of pool size
- **Memory Usage**: < 80% of allocated

## Monitoring & Alerting

### Health Checks

```bash
# Application health
curl -f http://localhost:3000/api/health

# Database health
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Redis health
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
```

### Key Dashboards

1. **Application Overview**: http://localhost:3001/d/app-overview
2. **Database Metrics**: http://localhost:3001/d/database
3. **System Resources**: http://localhost:3001/d/system
4. **Business Metrics**: http://localhost:3001/d/business

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Response Time | > 500ms | > 1000ms |
| Error Rate | > 1% | > 5% |
| CPU Usage | > 70% | > 90% |
| Memory Usage | > 80% | > 95% |
| Disk Usage | > 80% | > 90% |
| Database Connections | > 70% | > 90% |

## Incident Response

### Severity Levels

- **P0 (Critical)**: Complete service outage
- **P1 (High)**: Major functionality impaired
- **P2 (Medium)**: Minor functionality impaired
- **P3 (Low)**: Cosmetic issues or minor bugs

### Response Procedures

#### P0 - Critical Incident

1. **Immediate Response (0-5 minutes)**
   ```bash
   # Check system status
   curl -f http://localhost:3000/api/health
   
   # Check all services
   docker-compose -f docker-compose.prod.yml ps
   
   # Check logs for errors
   docker-compose -f docker-compose.prod.yml logs --tail=100 app
   ```

2. **Assessment (5-15 minutes)**
   - Identify affected components
   - Estimate user impact
   - Determine root cause
   - Notify stakeholders

3. **Mitigation (15-30 minutes)**
   ```bash
   # Restart application if needed
   docker-compose -f docker-compose.prod.yml restart app
   
   # Scale up if resource issue
   docker-compose -f docker-compose.prod.yml up -d --scale app=3
   
   # Rollback if deployment issue
   ./scripts/rollback.sh
   ```

#### P1 - High Priority

1. **Response (0-30 minutes)**
   - Investigate issue
   - Implement temporary fix if possible
   - Monitor system stability

2. **Resolution (30 minutes - 4 hours)**
   - Develop permanent fix
   - Test in staging
   - Deploy to production

## Common Issues

### Application Won't Start

**Symptoms**: Container exits immediately, health check fails

**Diagnosis**:
```bash
# Check container logs
docker-compose -f docker-compose.prod.yml logs app

# Check environment variables
docker-compose -f docker-compose.prod.yml exec app env | grep -E "(DATABASE|REDIS|JWT)"

# Check file permissions
docker-compose -f docker-compose.prod.yml exec app ls -la
```

**Resolution**:
```bash
# Fix environment variables
vim .env.production

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build app

# Check database connectivity
docker-compose -f docker-compose.prod.yml exec app npm run db:status
```

### Database Connection Issues

**Symptoms**: "Connection refused" errors, timeout errors

**Diagnosis**:
```bash
# Check database status
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Check connection pool
docker-compose -f docker-compose.prod.yml exec postgres psql -U morphsave -c "SELECT * FROM pg_stat_activity;"

# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres
```

**Resolution**:
```bash
# Restart database
docker-compose -f docker-compose.prod.yml restart postgres

# Increase connection pool if needed
# Edit docker-compose.prod.yml:
# POSTGRES_MAX_CONNECTIONS=200

# Clear connection pool
docker-compose -f docker-compose.prod.yml restart app
```

### High Memory Usage

**Symptoms**: Application slow, OOM kills

**Diagnosis**:
```bash
# Check memory usage
docker stats

# Check application memory
docker-compose -f docker-compose.prod.yml exec app node -e "console.log(process.memoryUsage())"

# Check for memory leaks
docker-compose -f docker-compose.prod.yml exec app npm run memory:profile
```

**Resolution**:
```bash
# Restart application
docker-compose -f docker-compose.prod.yml restart app

# Increase memory limits
# Edit docker-compose.prod.yml:
# deploy:
#   resources:
#     limits:
#       memory: 2G

# Scale horizontally
docker-compose -f docker-compose.prod.yml up -d --scale app=2
```

### SSL Certificate Issues

**Symptoms**: HTTPS errors, certificate warnings

**Diagnosis**:
```bash
# Check certificate validity
openssl x509 -in ssl/cert.pem -text -noout | grep -A 2 "Validity"

# Test SSL configuration
curl -I https://morphsave.com

# Check nginx configuration
docker-compose -f docker-compose.prod.yml exec nginx nginx -t
```

**Resolution**:
```bash
# Renew certificate (Let's Encrypt)
certbot renew

# Update certificate files
cp /etc/letsencrypt/live/morphsave.com/fullchain.pem ssl/cert.pem
cp /etc/letsencrypt/live/morphsave.com/privkey.pem ssl/privkey.pem

# Reload nginx
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

### Blockchain Connection Issues

**Symptoms**: Transaction failures, RPC errors

**Diagnosis**:
```bash
# Check RPC endpoint
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  $MORPH_RPC_URL

# Check contract addresses
docker-compose -f docker-compose.prod.yml exec app npm run contracts:verify

# Check wallet balance
docker-compose -f docker-compose.prod.yml exec app npm run wallet:balance
```

**Resolution**:
```bash
# Switch to backup RPC
# Update MORPH_RPC_URL in .env.production

# Restart application
docker-compose -f docker-compose.prod.yml restart app

# Re-deploy contracts if needed
npm run hardhat:deploy --network morphHolesky
```

## Maintenance Procedures

### Scheduled Maintenance

#### Weekly Maintenance (Sunday 2 AM UTC)

```bash
#!/bin/bash
# weekly-maintenance.sh

# 1. Create backup
./scripts/backup-database.sh

# 2. Update system packages
apt update && apt upgrade -y

# 3. Clean up Docker
docker system prune -f

# 4. Rotate logs
docker-compose -f docker-compose.prod.yml exec app npm run logs:rotate

# 5. Check disk space
df -h

# 6. Restart services for fresh state
docker-compose -f docker-compose.prod.yml restart
```

#### Monthly Maintenance

```bash
#!/bin/bash
# monthly-maintenance.sh

# 1. Security updates
npm audit fix

# 2. Database maintenance
docker-compose -f docker-compose.prod.yml exec postgres psql -U morphsave -c "VACUUM ANALYZE;"

# 3. Certificate renewal check
certbot certificates

# 4. Performance analysis
npm run performance:analyze

# 5. Backup verification
./scripts/verify-backups.sh
```

### Database Maintenance

#### Vacuum and Analyze

```bash
# Full vacuum (during maintenance window)
docker-compose -f docker-compose.prod.yml exec postgres psql -U morphsave -c "VACUUM FULL;"

# Regular vacuum
docker-compose -f docker-compose.prod.yml exec postgres psql -U morphsave -c "VACUUM ANALYZE;"

# Check table sizes
docker-compose -f docker-compose.prod.yml exec postgres psql -U morphsave -c "
SELECT schemaname,tablename,attname,n_distinct,correlation 
FROM pg_stats 
WHERE schemaname = 'public' 
ORDER BY n_distinct DESC;"
```

#### Index Maintenance

```bash
# Check index usage
docker-compose -f docker-compose.prod.yml exec postgres psql -U morphsave -c "
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE schemaname = 'public';"

# Rebuild indexes if needed
docker-compose -f docker-compose.prod.yml exec postgres psql -U morphsave -c "REINDEX DATABASE morphsave;"
```

## Emergency Procedures

### Complete System Failure

1. **Immediate Actions**
   ```bash
   # Check system status
   systemctl status docker
   
   # Check disk space
   df -h
   
   # Check system resources
   top
   htop
   ```

2. **Recovery Steps**
   ```bash
   # Restart Docker if needed
   systemctl restart docker
   
   # Start from backup
   ./scripts/emergency-restore.sh
   
   # Verify system health
   ./scripts/health-check.sh
   ```

### Data Corruption

1. **Stop Application**
   ```bash
   docker-compose -f docker-compose.prod.yml stop app
   ```

2. **Assess Damage**
   ```bash
   # Check database integrity
   docker-compose -f docker-compose.prod.yml exec postgres psql -U morphsave -c "
   SELECT datname, pg_database_size(datname) 
   FROM pg_database 
   WHERE datname = 'morphsave';"
   ```

3. **Restore from Backup**
   ```bash
   # Find latest backup
   ls -la backups/ | head -5
   
   # Restore database
   ./scripts/restore-database.sh backups/latest.sql.gz
   
   # Verify data integrity
   docker-compose -f docker-compose.prod.yml exec app npm run db:verify
   ```

### Security Incident

1. **Immediate Isolation**
   ```bash
   # Block suspicious IPs
   ufw insert 1 deny from SUSPICIOUS_IP
   
   # Enable maintenance mode
   docker-compose -f docker-compose.prod.yml exec nginx \
     cp /etc/nginx/maintenance.conf /etc/nginx/nginx.conf
   docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
   ```

2. **Investigation**
   ```bash
   # Check access logs
   docker-compose -f docker-compose.prod.yml logs nginx | grep -E "(POST|PUT|DELETE)"
   
   # Check application logs
   docker-compose -f docker-compose.prod.yml logs app | grep -i error
   
   # Check system logs
   journalctl -u docker --since "1 hour ago"
   ```

3. **Recovery**
   ```bash
   # Change all secrets
   # Update .env.production with new JWT_SECRET, ENCRYPTION_KEY, etc.
   
   # Force user re-authentication
   docker-compose -f docker-compose.prod.yml exec redis redis-cli FLUSHDB
   
   # Deploy security updates
   ./scripts/deploy.sh production
   ```

## Contact Information

### On-Call Rotation

- **Primary**: +1-XXX-XXX-XXXX
- **Secondary**: +1-XXX-XXX-XXXX
- **Escalation**: +1-XXX-XXX-XXXX

### External Contacts

- **Hosting Provider**: support@provider.com
- **DNS Provider**: support@dns-provider.com
- **SSL Provider**: support@ssl-provider.com
- **Morph L2 Support**: support@morphl2.io

### Communication Channels

- **Slack**: #morphsave-ops
- **Email**: ops@morphsave.com
- **Status Page**: https://status.morphsave.com

## Performance Optimization

### Database Performance

```bash
# Check slow queries
docker-compose -f docker-compose.prod.yml exec postgres psql -U morphsave -c "
SELECT query, mean_time, calls, total_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;"

# Check index usage
docker-compose -f docker-compose.prod.yml exec postgres psql -U morphsave -c "
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch 
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;"

# Analyze table statistics
docker-compose -f docker-compose.prod.yml exec postgres psql -U morphsave -c "
SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del, n_live_tup, n_dead_tup 
FROM pg_stat_user_tables 
ORDER BY n_live_tup DESC;"
```

### Application Performance

```bash
# Check memory usage patterns
docker-compose -f docker-compose.prod.yml exec app node -e "
setInterval(() => {
  const usage = process.memoryUsage();
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
    external: Math.round(usage.external / 1024 / 1024) + 'MB'
  }));
}, 5000);
"

# Profile CPU usage
docker-compose -f docker-compose.prod.yml exec app npm run profile:cpu

# Check event loop lag
docker-compose -f docker-compose.prod.yml exec app node -e "
const { performance } = require('perf_hooks');
setInterval(() => {
  const start = performance.now();
  setImmediate(() => {
    const lag = performance.now() - start;
    console.log('Event loop lag:', lag.toFixed(2), 'ms');
  });
}, 1000);
"
```

## Capacity Planning

### Resource Monitoring

```bash
# Monitor resource trends
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

# Check disk I/O
iostat -x 1

# Monitor network usage
iftop -i eth0

# Check file descriptor usage
lsof | wc -l
cat /proc/sys/fs/file-nr
```

### Scaling Decisions

#### Horizontal Scaling Triggers
- CPU usage > 70% for 10+ minutes
- Memory usage > 80% for 5+ minutes
- Response time > 500ms for 5+ minutes
- Queue depth > 100 for 5+ minutes

#### Vertical Scaling Triggers
- Memory usage consistently > 90%
- CPU usage consistently > 90%
- Disk I/O wait > 20%

```bash
# Scale application horizontally
docker-compose -f docker-compose.prod.yml up -d --scale app=3

# Scale database (read replicas)
# Add read replica configuration to docker-compose.prod.yml

# Scale Redis (cluster mode)
# Configure Redis cluster in docker-compose.prod.yml
```

## Backup and Recovery Procedures

### Automated Backup Verification

```bash
#!/bin/bash
# verify-backups.sh

BACKUP_DIR="./backups"
LATEST_BACKUP=$(ls -t $BACKUP_DIR/morphsave_backup_*.sql.gz | head -1)

echo "Verifying backup: $LATEST_BACKUP"

# Test backup integrity
if gzip -t "$LATEST_BACKUP"; then
    echo "✅ Backup file integrity: OK"
else
    echo "❌ Backup file integrity: FAILED"
    exit 1
fi

# Test backup content
if zcat "$LATEST_BACKUP" | head -10 | grep -q "PostgreSQL database dump"; then
    echo "✅ Backup content format: OK"
else
    echo "❌ Backup content format: FAILED"
    exit 1
fi

# Test restore in isolated environment
docker run --rm -e POSTGRES_PASSWORD=test postgres:15 &
POSTGRES_PID=$!
sleep 10

if zcat "$LATEST_BACKUP" | docker exec -i $(docker ps -q -f ancestor=postgres:15) psql -U postgres; then
    echo "✅ Backup restore test: OK"
else
    echo "❌ Backup restore test: FAILED"
fi

docker stop $(docker ps -q -f ancestor=postgres:15)
echo "Backup verification completed"
```

### Point-in-Time Recovery

```bash
# Enable WAL archiving (add to postgresql.conf)
# wal_level = replica
# archive_mode = on
# archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'

# Perform point-in-time recovery
./scripts/restore-database.sh --point-in-time "2024-01-15 14:30:00"
```

## Security Monitoring

### Real-time Security Monitoring

```bash
# Monitor failed authentication attempts
docker-compose -f docker-compose.prod.yml logs app | grep -i "authentication failed" | tail -20

# Check for suspicious API calls
docker-compose -f docker-compose.prod.yml logs nginx | grep -E "(POST|PUT|DELETE)" | grep -v "200\|201\|204"

# Monitor rate limiting
docker-compose -f docker-compose.prod.yml logs nginx | grep "rate limit"

# Check for SQL injection attempts
docker-compose -f docker-compose.prod.yml logs app | grep -i -E "(union|select|drop|insert|update|delete)" | grep -v "legitimate"
```

### Security Incident Response

```bash
#!/bin/bash
# security-incident-response.sh

INCIDENT_ID=$(date +%Y%m%d-%H%M%S)
INCIDENT_DIR="/var/log/morphsave/incidents/$INCIDENT_ID"

mkdir -p "$INCIDENT_DIR"

echo "Security incident response initiated: $INCIDENT_ID"

# Collect evidence
docker-compose -f docker-compose.prod.yml logs --since="1h" > "$INCIDENT_DIR/application.log"
docker-compose -f docker-compose.prod.yml logs nginx --since="1h" > "$INCIDENT_DIR/nginx.log"
netstat -tulpn > "$INCIDENT_DIR/network.log"
ps aux > "$INCIDENT_DIR/processes.log"

# Create database snapshot
./scripts/backup-database.sh
cp "backups/$(ls -t backups/ | head -1)" "$INCIDENT_DIR/"

# Notify security team
curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"🚨 Security incident $INCIDENT_ID initiated. Evidence collected in $INCIDENT_DIR\"}" \
    "$SLACK_SECURITY_WEBHOOK"

echo "Evidence collected in: $INCIDENT_DIR"
```

## Compliance and Auditing

### Audit Log Collection

```bash
# Collect audit logs for compliance
docker-compose -f docker-compose.prod.yml exec app npm run audit:collect --since="2024-01-01" --until="2024-01-31"

# Generate compliance report
docker-compose -f docker-compose.prod.yml exec app npm run compliance:report --type="SOC2" --period="Q1-2024"

# Export user data (GDPR compliance)
docker-compose -f docker-compose.prod.yml exec app npm run user:export --user-id="user123" --format="json"
```

### Data Retention Management

```bash
#!/bin/bash
# data-retention.sh

# Archive old logs (90 days)
find /var/log/morphsave -name "*.log" -mtime +90 -exec gzip {} \;
find /var/log/morphsave -name "*.log.gz" -mtime +365 -delete

# Archive old database records
docker-compose -f docker-compose.prod.yml exec app npm run data:archive --older-than="2 years"

# Clean up old backups (keep 7 years)
find ./backups -name "morphsave_backup_*.sql.gz" -mtime +2555 -delete
```

## Documentation Updates

This runbook should be updated:
- After each incident (lessons learned)
- When procedures change
- During quarterly reviews
- When new team members join
- After security assessments
- Following compliance audits

### Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2024-01-01 | Initial version | DevOps Team |
| 1.1 | 2024-01-15 | Added security procedures | Security Team |
| 1.2 | 2024-02-01 | Enhanced monitoring | Operations Team |

Last updated: $(date)
Version: 1.2