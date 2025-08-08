# MorphSave Deployment Guide

This guide covers the deployment process for MorphSave in production environments.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- SSL certificates (for HTTPS)
- Domain name configured

## Environment Setup

### 1. Environment Variables

Copy the production environment template:
```bash
cp .env.production.example .env.production
```

Configure the following critical variables:

#### Database
```env
DATABASE_URL=postgresql://username:password@host:5432/morphsave_prod
DATABASE_POOL_SIZE=20
DATABASE_SSL=true
```

#### Security
```env
JWT_SECRET=your-super-secure-jwt-secret-here
ENCRYPTION_KEY=your-32-character-encryption-key-here
```

#### Blockchain
```env
MORPH_RPC_URL=https://rpc-quicknode-holesky.morphl2.io
MORPH_CHAIN_ID=2810
PRIVATE_KEY=your-deployment-private-key-here
```

#### External Services
```env
PLAID_CLIENT_ID=your-plaid-client-id
PLAID_SECRET=your-plaid-secret-key
PLAID_ENV=production

OPENAI_API_KEY=your-openai-api-key
```

### 2. SSL Certificates

Place your SSL certificates in the `ssl/` directory:
```
ssl/
├── cert.pem
├── privkey.pem
└── chain.pem
```

## Deployment Methods

### Method 1: Docker Compose (Recommended)

1. **Build and deploy:**
```bash
./scripts/deploy.sh production
```

2. **Manual deployment:**
```bash
# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Build and start services
docker-compose -f docker-compose.prod.yml up -d --build

# Run database migrations
docker-compose -f docker-compose.prod.yml exec app npm run db:migrate

# Check health
curl http://localhost:3000/api/health
```

### Method 2: Kubernetes

1. **Create namespace:**
```bash
kubectl create namespace morphsave
```

2. **Deploy secrets:**
```bash
kubectl create secret generic morphsave-secrets \
  --from-env-file=.env.production \
  --namespace=morphsave
```

3. **Deploy application:**
```bash
kubectl apply -f k8s/ --namespace=morphsave
```

## Database Management

### Migrations

Run database migrations:
```bash
# In Docker
docker-compose -f docker-compose.prod.yml exec app npm run db:migrate

# Direct
npm run db:migrate
```

### Backups

Automated backups run daily. Manual backup:
```bash
./scripts/backup-database.sh
```

Restore from backup:
```bash
# Find backup file
ls -la backups/

# Restore
gunzip -c backups/morphsave_backup_YYYYMMDD_HHMMSS.sql.gz | \
docker-compose -f docker-compose.prod.yml exec -T postgres psql \
  -U morphsave -d morphsave
```

## Smart Contract Deployment

### Deploy to Morph L2

1. **Compile contracts:**
```bash
npm run hardhat:compile
```

2. **Deploy contracts:**
```bash
npm run hardhat:deploy --network morphHolesky
```

3. **Verify contracts:**
```bash
npx hardhat verify --network morphHolesky DEPLOYED_ADDRESS
```

### Update contract addresses

Update the deployed contract addresses in your environment:
```env
SAVINGS_VAULT_ADDRESS=0x...
GAME_ENGINE_ADDRESS=0x...
YIELD_MANAGER_ADDRESS=0x...
```

## Monitoring Setup

### Prometheus & Grafana

Monitoring is automatically set up with Docker Compose:

- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3001 (admin/admin)

### Custom Dashboards

Import the provided Grafana dashboards:
1. Open Grafana
2. Go to Dashboards > Import
3. Upload files from `monitoring/grafana/dashboards/`

### Alerts

Configure alerts in `monitoring/prometheus/rules/`:

```yaml
groups:
  - name: morphsave-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(morphsave_http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
```

## Security Considerations

### SSL/TLS

Ensure HTTPS is properly configured:
```nginx
server {
    listen 443 ssl http2;
    server_name morphsave.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
}
```

### Rate Limiting

Configure rate limiting in nginx:
```nginx
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    server {
        location /api/ {
            limit_req zone=api burst=20 nodelay;
        }
    }
}
```

### Firewall

Configure firewall rules:
```bash
# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow SSH (change port as needed)
ufw allow 22/tcp

# Block all other incoming
ufw default deny incoming
ufw default allow outgoing

# Enable firewall
ufw enable
```

## Performance Optimization

### Database Optimization

1. **Connection pooling:**
```env
DATABASE_POOL_SIZE=20
DATABASE_MAX_CONNECTIONS=100
```

2. **Indexes:**
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_transaction_user_id ON savings_transactions(user_id);
CREATE INDEX idx_transaction_created_at ON savings_transactions(created_at);
```

### Caching

Redis caching is configured automatically. Key cache strategies:

- Session data: 24 hours
- User profiles: 1 hour
- API responses: 5 minutes
- Static content: 1 day

### CDN Setup

Configure CDN for static assets:
```env
NEXT_PUBLIC_CDN_URL=https://cdn.morphsave.com
```

## Troubleshooting

### Common Issues

1. **Database connection errors:**
```bash
# Check database status
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# View database logs
docker-compose -f docker-compose.prod.yml logs postgres
```

2. **Memory issues:**
```bash
# Check memory usage
docker stats

# Increase memory limits in docker-compose.prod.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 2G
```

3. **SSL certificate issues:**
```bash
# Check certificate validity
openssl x509 -in ssl/cert.pem -text -noout

# Test SSL configuration
curl -I https://morphsave.com
```

### Log Analysis

View application logs:
```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f app

# With Grafana/Loki
# Access logs at http://localhost:3001
```

## Maintenance

### Regular Tasks

1. **Daily:**
   - Check application health
   - Review error logs
   - Monitor resource usage

2. **Weekly:**
   - Update dependencies
   - Review security alerts
   - Analyze performance metrics

3. **Monthly:**
   - Database maintenance
   - Certificate renewal check
   - Backup verification

### Updates

1. **Application updates:**
```bash
# Pull latest code
git pull origin main

# Deploy with zero downtime
./scripts/deploy.sh production
```

2. **Dependency updates:**
```bash
# Check for updates
npm audit

# Update packages
npm update

# Test and deploy
npm test && ./scripts/deploy.sh production
```

## Rollback Procedures

### Application Rollback

```bash
# Stop current version
docker-compose -f docker-compose.prod.yml down

# Restore previous image
docker tag morphsave:previous morphsave:latest

# Start previous version
docker-compose -f docker-compose.prod.yml up -d
```

### Database Rollback

```bash
# Find backup
ls -la backups/

# Restore database
./scripts/restore-database.sh backups/morphsave_backup_YYYYMMDD_HHMMSS.sql.gz
```

## Production Deployment Checklist

### Pre-Deployment

- [ ] Environment variables configured and validated
- [ ] SSL certificates installed and valid
- [ ] Database backups completed
- [ ] Smart contracts deployed and verified
- [ ] Monitoring and alerting configured
- [ ] Load balancer and CDN configured
- [ ] Security scanning completed
- [ ] Performance testing completed

### Deployment

- [ ] Application deployed successfully
- [ ] Database migrations executed
- [ ] Health checks passing
- [ ] Monitoring dashboards updated
- [ ] SSL/TLS configuration verified
- [ ] Rate limiting configured
- [ ] Backup systems operational

### Post-Deployment

- [ ] Smoke tests executed
- [ ] Performance metrics within acceptable ranges
- [ ] Error rates below threshold
- [ ] User acceptance testing completed
- [ ] Documentation updated
- [ ] Team notified of deployment

## Disaster Recovery

### RTO/RPO Targets

- **Recovery Time Objective (RTO):** 4 hours
- **Recovery Point Objective (RPO):** 1 hour

### Recovery Procedures

1. **Database Recovery:**
   - Restore from latest backup (automated daily)
   - Apply transaction logs if available
   - Verify data integrity

2. **Application Recovery:**
   - Deploy from last known good image
   - Restore configuration from backup
   - Verify all services operational

3. **Infrastructure Recovery:**
   - Provision new infrastructure if needed
   - Restore from infrastructure as code
   - Reconfigure load balancers and DNS

### Emergency Contacts

- **On-call Engineer:** +1-XXX-XXX-XXXX
- **DevOps Lead:** +1-XXX-XXX-XXXX
- **Security Team:** security@morphsave.com

## Compliance and Auditing

### Audit Logging

All production activities are logged:
- User actions and authentication
- Administrative changes
- System access and modifications
- Security events and alerts

### Compliance Requirements

- **SOC 2 Type II:** Annual audit required
- **PCI DSS:** For payment processing
- **GDPR:** For EU user data protection
- **SOX:** For financial reporting

### Data Retention

- **Application logs:** 90 days
- **Security logs:** 1 year
- **Audit logs:** 7 years
- **Database backups:** 7 years (with archival)

## Support

For deployment issues:
1. Check logs first
2. Review this documentation
3. Contact the development team
4. Create an issue in the repository

## Security Contacts

For security issues:
- Email: security@morphsave.com
- Encrypted: Use PGP key from website
- Emergency: +1-XXX-XXX-XXXX (24/7)