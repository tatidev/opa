# NetSuite to OPMS Synchronization - Environment Variables

This document outlines all required environment variables for the NetSuite to OPMS pricing synchronization service.

**Updated for `ns-to-opms` naming convention.**

## 🔒 Required Environment Variables

### OPMS Database Configuration
```bash
# OPMS Database Connection
OPMS_DB_HOST=localhost
OPMS_DB_USER=opms_user
OPMS_DB_PASSWORD=secure_password
OPMS_DB_NAME=opms_database
OPMS_DB_PORT=3306
```

### NetSuite OAuth 1.0a Configuration
```bash
# NetSuite API Authentication
NETSUITE_ACCOUNT_ID=your_account_id
NETSUITE_CONSUMER_KEY=oauth_consumer_key
NETSUITE_CONSUMER_SECRET=oauth_consumer_secret
NETSUITE_TOKEN_ID=oauth_token_id
NETSUITE_TOKEN_SECRET=oauth_token_secret
NETSUITE_BASE_URL=https://your-account.suitetalk.api.netsuite.com
```

### NS to OPMS Webhook Configuration
```bash
# Webhook Security
NS_TO_OPMS_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Webhook Endpoint URL (for NetSuite script configuration)
NS_TO_OPMS_ENDPOINT_URL=https://your-api-domain.com/api/ns-to-opms/webhook
```

### NetSuite Script Deployment
```bash
# SuiteScript Deployment IDs (for reference)
NETSUITE_WEBHOOK_SCRIPT_ID=customscript_item_pricing_webhook
NETSUITE_WEBHOOK_DEPLOYMENT_ID=customdeploy_item_pricing_webhook
```

### NS to OPMS Sync Service Configuration
```bash
# Sync Performance Settings
NS_TO_OPMS_MAX_RETRIES=3
NS_TO_OPMS_RETRY_DELAY_MS=5000
NS_TO_OPMS_BATCH_SIZE=50
NS_TO_OPMS_RATE_LIMIT_MS=1000
```

### Logging Configuration
```bash
# Logging Settings
LOG_LEVEL=info
LOG_DIR=./logs
```

### API Configuration
```bash
# Server Settings
PORT=3000
NODE_ENV=production
```

## 🔧 Environment Variable Validation

The sync service validates all required environment variables on startup. Missing or invalid variables will prevent the service from starting.

### Critical Variables (Service Won't Start Without These)
- `OPMS_DB_HOST`
- `OPMS_DB_USER` 
- `OPMS_DB_PASSWORD`
- `OPMS_DB_NAME`
- `NETSUITE_ACCOUNT_ID`
- `NETSUITE_CONSUMER_KEY`
- `NETSUITE_CONSUMER_SECRET`
- `NETSUITE_TOKEN_ID`
- `NETSUITE_TOKEN_SECRET`
- `NS_TO_OPMS_WEBHOOK_SECRET`

### Optional Variables (Have Defaults)
- `OPMS_DB_PORT` (default: 3306)
- `NS_TO_OPMS_MAX_RETRIES` (default: 3)
- `NS_TO_OPMS_RETRY_DELAY_MS` (default: 5000)
- `NS_TO_OPMS_BATCH_SIZE` (default: 50)
- `NS_TO_OPMS_RATE_LIMIT_MS` (default: 1000)
- `LOG_LEVEL` (default: 'info')
- `PORT` (default: 3000)

## 🚀 Deployment Examples

### Development Environment (.env.development)
```bash
# Development Database
OPMS_DB_HOST=localhost
OPMS_DB_USER=opms_dev
OPMS_DB_PASSWORD=dev_password
OPMS_DB_NAME=opms_development
OPMS_DB_PORT=3306

# NetSuite Sandbox
NETSUITE_ACCOUNT_ID=123456_SB1
NETSUITE_CONSUMER_KEY=dev_consumer_key
NETSUITE_CONSUMER_SECRET=dev_consumer_secret
NETSUITE_TOKEN_ID=dev_token_id
NETSUITE_TOKEN_SECRET=dev_token_secret
NETSUITE_BASE_URL=https://123456-sb1.suitetalk.api.netsuite.com

# Development Webhook
NS_TO_OPMS_WEBHOOK_SECRET=dev-webhook-secret-123
NS_TO_OPMS_ENDPOINT_URL=https://dev-api.opuzen.com/api/ns-to-opms/webhook

# Development Settings
LOG_LEVEL=debug
NODE_ENV=development
PORT=3000
```

### Production Environment (.env.production)
```bash
# Production Database
OPMS_DB_HOST=prod-db.opuzen.com
OPMS_DB_USER=opms_prod
OPMS_DB_PASSWORD=secure_prod_password
OPMS_DB_NAME=opms_production
OPMS_DB_PORT=3306

# NetSuite Production
NETSUITE_ACCOUNT_ID=123456
NETSUITE_CONSUMER_KEY=prod_consumer_key
NETSUITE_CONSUMER_SECRET=prod_consumer_secret
NETSUITE_TOKEN_ID=prod_token_id
NETSUITE_TOKEN_SECRET=prod_token_secret
NETSUITE_BASE_URL=https://123456.suitetalk.api.netsuite.com

# Production Webhook
NS_TO_OPMS_WEBHOOK_SECRET=super-secure-webhook-secret-prod-2024
NS_TO_OPMS_ENDPOINT_URL=https://api.opuzen.com/api/ns-to-opms/webhook

# Production Settings
LOG_LEVEL=info
NODE_ENV=production
PORT=3000
```

## 🔐 Security Best Practices

### Webhook Secret Generation
```bash
# Generate a secure webhook secret
openssl rand -hex 32
```

### Environment Variable Security
1. **Never commit secrets to version control**
2. **Use different secrets for each environment**
3. **Rotate secrets regularly (quarterly)**
4. **Use environment-specific key management**
5. **Limit access to production secrets**

### NetSuite Token Security
1. **Use role-based access control**
2. **Limit token permissions to minimum required**
3. **Monitor token usage in NetSuite**
4. **Rotate tokens according to security policy**

## 📋 Validation Script

Create a validation script to check environment variables:

```javascript
// scripts/validate-env.js
const requiredVars = [
  'OPMS_DB_HOST',
  'OPMS_DB_USER',
  'OPMS_DB_PASSWORD',
  'OPMS_DB_NAME',
  'NETSUITE_ACCOUNT_ID',
  'NETSUITE_CONSUMER_KEY',
  'NETSUITE_CONSUMER_SECRET',
  'NETSUITE_TOKEN_ID',
  'NETSUITE_TOKEN_SECRET',
  'NS_TO_OPMS_WEBHOOK_SECRET'
];

const missing = requiredVars.filter(varName => !process.env[varName]);

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(varName => console.error(`  - ${varName}`));
  process.exit(1);
}

console.log('✅ All required environment variables are set');
```

Run validation:
```bash
node scripts/validate-env.js
```

## 🔄 Environment Variable Updates

When updating environment variables:

1. **Update all environments** (dev, staging, prod)
2. **Test in development first**
3. **Update NetSuite script parameters** if webhook URL changes
4. **Restart services** after environment changes
5. **Verify sync functionality** after updates

## 📊 Monitoring Environment Variables

Monitor these metrics:
- Database connection health
- NetSuite API authentication status
- Webhook endpoint availability
- Sync service performance metrics

## 🚨 Troubleshooting

### Common Issues

**Database Connection Fails**
- Check `OPMS_DB_HOST`, `OPMS_DB_PORT`
- Verify database credentials
- Test network connectivity

**NetSuite Authentication Fails**
- Verify OAuth tokens haven't expired
- Check NetSuite account permissions
- Validate `NETSUITE_BASE_URL` format

**Webhook Authentication Fails**
- Verify `NS_TO_OPMS_WEBHOOK_SECRET` matches NetSuite script
- Check webhook URL accessibility
- Review webhook logs for errors

**Sync Performance Issues**
- Adjust `NS_TO_OPMS_RATE_LIMIT_MS` for NetSuite limits
- Tune `NS_TO_OPMS_BATCH_SIZE` for optimal performance
- Monitor `NS_TO_OPMS_MAX_RETRIES` for failure patterns
