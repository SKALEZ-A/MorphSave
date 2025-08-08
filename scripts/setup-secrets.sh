#!/bin/bash

# Production Secrets Setup Script
# This script helps configure production secrets securely

set -e

echo "🔐 MorphSave Production Secrets Setup"
echo "======================================"

# Check if running in production environment
if [ "$NODE_ENV" != "production" ]; then
    echo "⚠️  Warning: This script should only be run in production environment"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Function to generate secure random string
generate_secret() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Function to prompt for secret with validation
prompt_secret() {
    local var_name=$1
    local description=$2
    local current_value=${!var_name}
    
    echo
    echo "Setting: $var_name"
    echo "Description: $description"
    
    if [ -n "$current_value" ] && [ "$current_value" != "your-*" ]; then
        echo "Current value is already set (hidden for security)"
        read -p "Update this value? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return
        fi
    fi
    
    read -s -p "Enter $var_name: " new_value
    echo
    
    if [ -n "$new_value" ]; then
        export $var_name="$new_value"
        echo "✅ $var_name updated"
    else
        echo "❌ $var_name not updated (empty value)"
    fi
}

# Load existing environment
if [ -f ".env.production" ]; then
    source .env.production
fi

echo
echo "🔑 Configuring Authentication Secrets"
echo "------------------------------------"

# Generate JWT secrets if not set
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "your-super-secure-jwt-secret-here" ]; then
    JWT_SECRET=$(generate_secret)
    echo "✅ Generated new JWT_SECRET"
fi

if [ -z "$REFRESH_TOKEN_SECRET" ] || [ "$REFRESH_TOKEN_SECRET" = "your-super-secure-refresh-token-secret-here" ]; then
    REFRESH_TOKEN_SECRET=$(generate_secret)
    echo "✅ Generated new REFRESH_TOKEN_SECRET"
fi

if [ -z "$ENCRYPTION_KEY" ] || [ "$ENCRYPTION_KEY" = "your-32-character-encryption-key-here" ]; then
    ENCRYPTION_KEY=$(generate_secret)
    echo "✅ Generated new ENCRYPTION_KEY"
fi

echo
echo "🌐 Configuring External API Keys"
echo "--------------------------------"

prompt_secret "PLAID_CLIENT_ID" "Plaid API Client ID"
prompt_secret "PLAID_SECRET" "Plaid API Secret Key"
prompt_secret "OPENAI_API_KEY" "OpenAI API Key"

echo
echo "📧 Configuring Email Service"
echo "---------------------------"

prompt_secret "SMTP_PASS" "SendGrid API Key"

echo
echo "🔔 Configuring Push Notifications"
echo "--------------------------------"

if [ -z "$VAPID_PUBLIC_KEY" ] || [ "$VAPID_PUBLIC_KEY" = "your-vapid-public-key" ]; then
    echo "Generating VAPID keys for push notifications..."
    npx web-push generate-vapid-keys > vapid_keys.tmp
    VAPID_PUBLIC_KEY=$(grep "Public Key:" vapid_keys.tmp | cut -d' ' -f3)
    VAPID_PRIVATE_KEY=$(grep "Private Key:" vapid_keys.tmp | cut -d' ' -f3)
    rm vapid_keys.tmp
    echo "✅ Generated new VAPID keys"
fi

echo
echo "🔗 Configuring Blockchain"
echo "------------------------"

prompt_secret "PRIVATE_KEY" "Deployment Private Key (without 0x prefix)"

echo
echo "📊 Configuring Monitoring"
echo "------------------------"

prompt_secret "SENTRY_DSN" "Sentry DSN for error tracking"
prompt_secret "DATADOG_API_KEY" "Datadog API Key for metrics"

echo
echo "☁️  Configuring AWS for Backups"
echo "------------------------------"

prompt_secret "AWS_ACCESS_KEY_ID" "AWS Access Key ID"
prompt_secret "AWS_SECRET_ACCESS_KEY" "AWS Secret Access Key"

# Write updated environment file
echo
echo "💾 Updating .env.production file..."

cat > .env.production << EOF
# Production Environment Configuration
# Generated on $(date)

# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-https://morphsave.com}
NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-https://api.morphsave.com}

# Database
DATABASE_URL=${DATABASE_URL}
DATABASE_POOL_SIZE=20
DATABASE_SSL=true

# Redis
REDIS_URL=${REDIS_URL}
REDIS_TLS=true

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=${REFRESH_TOKEN_SECRET}
REFRESH_TOKEN_EXPIRES_IN=30d

# Encryption
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Blockchain
MORPH_RPC_URL=${MORPH_RPC_URL:-https://rpc-quicknode-holesky.morphl2.io}
MORPH_CHAIN_ID=2810
PRIVATE_KEY=${PRIVATE_KEY}
SAVINGS_VAULT_ADDRESS=${SAVINGS_VAULT_ADDRESS}
GAME_ENGINE_ADDRESS=${GAME_ENGINE_ADDRESS}
YIELD_MANAGER_ADDRESS=${YIELD_MANAGER_ADDRESS}

# External APIs
PLAID_CLIENT_ID=${PLAID_CLIENT_ID}
PLAID_SECRET=${PLAID_SECRET}
PLAID_ENV=production

OPENAI_API_KEY=${OPENAI_API_KEY}

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=${SMTP_PASS}
FROM_EMAIL=noreply@morphsave.com

# Push Notifications
VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY}
VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY}
VAPID_SUBJECT=mailto:admin@morphsave.com

# Monitoring
SENTRY_DSN=${SENTRY_DSN}
DATADOG_API_KEY=${DATADOG_API_KEY}

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=https://morphsave.com

# Performance
ENABLE_COMPRESSION=true
ENABLE_CACHING=true
CACHE_TTL=3600

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE_PATH=/var/log/morphsave/app.log
LOG_MAX_SIZE=100MB
LOG_MAX_FILES=10

# Health Checks
HEALTH_CHECK_INTERVAL=30000
HEALTH_CHECK_TIMEOUT=5000

# Backup
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
BACKUP_S3_BUCKET=morphsave-backups
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
AWS_REGION=us-east-1

# Feature Flags
ENABLE_MAINTENANCE_MODE=false
ENABLE_NEW_USER_REGISTRATION=true
ENABLE_AI_INSIGHTS=true
ENABLE_SOCIAL_FEATURES=true

# Resource Limits
MAX_UPLOAD_SIZE=10MB
MAX_REQUEST_SIZE=1MB
CONNECTION_TIMEOUT=30000
REQUEST_TIMEOUT=30000
EOF

echo "✅ Environment configuration updated"

# Set secure permissions
chmod 600 .env.production
echo "🔒 Set secure permissions on .env.production"

echo
echo "🎉 Production secrets setup complete!"
echo
echo "⚠️  IMPORTANT SECURITY NOTES:"
echo "- Never commit .env.production to version control"
echo "- Store secrets in a secure password manager"
echo "- Rotate secrets regularly"
echo "- Use environment-specific secret management in production"
echo
echo "Next steps:"
echo "1. Review the generated .env.production file"
echo "2. Test the configuration in staging environment"
echo "3. Deploy to production using your CI/CD pipeline"