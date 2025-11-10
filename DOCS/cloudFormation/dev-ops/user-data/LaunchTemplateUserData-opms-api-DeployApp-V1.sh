#!/bin/bash
# LaunchTemplateUserData-opms-api-DeployApp-V1.sh
# User data script for deploying and starting the OPMS API application
# This script runs AFTER the base setup and Node.js installation

# Set environment variables from positional parameters
APP_ENV="$1"
APP_NAME="$2"
SECRET_ID="$3"
DB_HOST="$4"

# Convert to lowercase
APP_ENV=$(echo "$APP_ENV" | tr '[:upper:]' '[:lower:]')
APP_NAME=$(echo "$APP_NAME" | tr '[:upper:]' '[:lower:]')

# Set PathToAppRoot for current shell session
PathToAppRoot="/opuzen-efs/${APP_ENV}/${APP_NAME}"

# Export variables for future use AND current session
export APP_ENV
export APP_NAME
export SECRET_ID
export DB_HOST
export PathToAppRoot

# Also write to /etc/environment for persistence
echo "export APP_ENV=${APP_ENV}" >> /etc/environment
echo "export APP_NAME=${APP_NAME}" >> /etc/environment
echo "export SECRET_ID=${SECRET_ID}" >> /etc/environment
echo "export DB_HOST=${DB_HOST}" >> /etc/environment
echo "export PathToAppRoot=${PathToAppRoot}" >> /etc/environment

#===============================
# Fetch Application Secrets from AWS Secrets Manager
#===============================
echo "Fetching application secrets from AWS Secrets Manager..."
APP_SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ID" \
  --region us-west-1 \
  --query 'SecretString' \
  --output text)

# Determine environment suffix for credential mapping
if [ "${APP_ENV}" = "prod" ]; then
  ENV_SUFFIX="PROD"
  echo "Using PRODUCTION NetSuite credentials"
else
  ENV_SUFFIX="SANDBOX"
  echo "Using SANDBOX NetSuite credentials (for dev/qa)"
fi

# Parse environment-specific NetSuite OAuth credentials
NETSUITE_CONSUMER_KEY=$(echo $APP_SECRET_JSON | jq -r ".NETSUITE_CONSUMER_KEY_${ENV_SUFFIX}")
NETSUITE_CONSUMER_SECRET=$(echo $APP_SECRET_JSON | jq -r ".NETSUITE_CONSUMER_SECRET_${ENV_SUFFIX}")
NETSUITE_TOKEN_ID=$(echo $APP_SECRET_JSON | jq -r ".NETSUITE_TOKEN_ID_${ENV_SUFFIX}")
NETSUITE_TOKEN_SECRET=$(echo $APP_SECRET_JSON | jq -r ".NETSUITE_TOKEN_SECRET_${ENV_SUFFIX}")
NETSUITE_REALM=$(echo $APP_SECRET_JSON | jq -r ".NETSUITE_REALM_${ENV_SUFFIX}")

# Parse shared account IDs
NETSUITE_ACCOUNT_ID_SANDBOX=$(echo $APP_SECRET_JSON | jq -r '.NETSUITE_ACCOUNT_ID_SANDBOX')
NETSUITE_ACCOUNT_ID_PROD=$(echo $APP_SECRET_JSON | jq -r '.NETSUITE_ACCOUNT_ID_PROD')

# Parse webhook and sync configuration
NS_TO_OPMS_WEBHOOK_SECRET=$(echo $APP_SECRET_JSON | jq -r '.NS_TO_OPMS_WEBHOOK_SECRET')
# REMOVED: OPMS_SYNC_ENABLED - Now controlled via database netsuite_opms_sync_config table
# OPMS_SYNC_ENABLED=$(echo $APP_SECRET_JSON | jq -r '.OPMS_SYNC_ENABLED')
SYNC_MAX_RETRIES=$(echo $APP_SECRET_JSON | jq -r '.SYNC_MAX_RETRIES')
SYNC_RETRY_DELAY_MS=$(echo $APP_SECRET_JSON | jq -r '.SYNC_RETRY_DELAY_MS')
SYNC_BATCH_SIZE=$(echo $APP_SECRET_JSON | jq -r '.SYNC_BATCH_SIZE')
SYNC_RATE_LIMIT_MS=$(echo $APP_SECRET_JSON | jq -r '.SYNC_RATE_LIMIT_MS')

# Parse NetSuite defaults
NETSUITE_DEFAULT_TAX_SCHEDULE_ID=$(echo $APP_SECRET_JSON | jq -r '.NETSUITE_DEFAULT_TAX_SCHEDULE_ID_PROD')
NETSUITE_DEFAULT_SUBSIDIARY_ID=$(echo $APP_SECRET_JSON | jq -r '.NETSUITE_DEFAULT_SUBSIDIARY_ID_PROD')

# Parse JWT credentials
JWT_SECRET=$(echo $APP_SECRET_JSON | jq -r '.JWT_SECRET')
JWT_EXPIRES_IN=$(echo $APP_SECRET_JSON | jq -r '.JWT_EXPIRES_IN')
JWT_REFRESH_EXPIRES_IN=$(echo $APP_SECRET_JSON | jq -r '.JWT_REFRESH_EXPIRES_IN')

# Set environment-specific webhook URL
if [ "${APP_ENV}" = "prod" ]; then
  NS_TO_OPMS_ENDPOINT="https://api.opuzen-service.com/api/ns-to-opms/webhook"
elif [ "${APP_ENV}" = "qa" ]; then
  NS_TO_OPMS_ENDPOINT="https://api-qa.opuzen-service.com/api/ns-to-opms/webhook"
else
  NS_TO_OPMS_ENDPOINT="https://api-dev.opuzen-service.com/api/ns-to-opms/webhook"
fi

echo "Application secrets retrieved successfully from AWS Secrets Manager"

#===============================
# Log everything for debugging
#===============================
exec > /var/log/app-deployment.log 2>&1
echo "Starting application deployment script execution at $(date)..."
echo "Environment: ${APP_ENV}"
echo "Application: ${APP_NAME}"
echo "Database Host: ${DB_HOST}"

#===============================
# Wait for EFS to be mounted
#===============================
echo "Waiting for EFS to be mounted..."
while [ ! -d "/opuzen-efs" ]; do
    echo "EFS not mounted yet, waiting 10 seconds..."
    sleep 10
done
echo "EFS is mounted at /opuzen-efs"

#===============================
# Create application directory
#===============================
echo "Creating application directory..."
mkdir -p ${PathToAppRoot}
chown -R ubuntu:ubuntu ${PathToAppRoot}
cd ${PathToAppRoot}

#===============================
# Clone application code from GitHub (COMMENTED OUT - uses shared EFS)
#===============================
# echo "Cloning application code from GitHub..."
# if [ -d ".git" ]; then
#     echo "Git repository already exists, pulling latest changes..."
#     git pull origin deployDev
# else
#     echo "Cloning fresh repository..."
#     git clone -b deployDev https://github.com/PaulKLeasure/opuzen-api.git .
# fi
echo "Using existing application code from shared EFS directory"

#===============================
# Install npm dependencies (skip if already installed)
#===============================
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
else
    echo "Dependencies already installed in shared EFS, skipping npm install"
fi

#===============================
# Create Comprehensive Environment File for Node.js
#===============================
echo "Creating comprehensive environment file with all credentials..."

# Create .env file with all required credentials
echo "NODE_ENV=${APP_ENV}" > ${PathToAppRoot}/.env
echo "PORT=3000" >> ${PathToAppRoot}/.env

# Database credentials (from RDS secret via InstallNodeJS script)
echo "DB_HOST=${DB_HOST}" >> ${PathToAppRoot}/.env
echo "DB_USER=${DB_USERNAME}" >> ${PathToAppRoot}/.env
echo "DB_PASSWORD=${DB_PASSWORD}" >> ${PathToAppRoot}/.env
echo "DB_NAME=opuzen_${APP_ENV}_master_app" >> ${PathToAppRoot}/.env

# NetSuite OAuth credentials (WITHOUT suffix - code expects this)
echo "NETSUITE_CONSUMER_KEY=${NETSUITE_CONSUMER_KEY}" >> ${PathToAppRoot}/.env
echo "NETSUITE_CONSUMER_SECRET=${NETSUITE_CONSUMER_SECRET}" >> ${PathToAppRoot}/.env
echo "NETSUITE_TOKEN_ID=${NETSUITE_TOKEN_ID}" >> ${PathToAppRoot}/.env
echo "NETSUITE_TOKEN_SECRET=${NETSUITE_TOKEN_SECRET}" >> ${PathToAppRoot}/.env
echo "NETSUITE_REALM=${NETSUITE_REALM}" >> ${PathToAppRoot}/.env

# NetSuite Account IDs (both available)
echo "NETSUITE_ACCOUNT_ID_SANDBOX=${NETSUITE_ACCOUNT_ID_SANDBOX}" >> ${PathToAppRoot}/.env
echo "NETSUITE_ACCOUNT_ID_PROD=${NETSUITE_ACCOUNT_ID_PROD}" >> ${PathToAppRoot}/.env

# NetSuite Defaults
echo "NETSUITE_DEFAULT_TAX_SCHEDULE_ID_SANDBOX=${NETSUITE_DEFAULT_TAX_SCHEDULE_ID}" >> ${PathToAppRoot}/.env
echo "NETSUITE_DEFAULT_TAX_SCHEDULE_ID_PROD=${NETSUITE_DEFAULT_TAX_SCHEDULE_ID}" >> ${PathToAppRoot}/.env
echo "NETSUITE_DEFAULT_SUBSIDIARY_ID_SANDBOX=${NETSUITE_DEFAULT_SUBSIDIARY_ID}" >> ${PathToAppRoot}/.env
echo "NETSUITE_DEFAULT_SUBSIDIARY_ID_PROD=${NETSUITE_DEFAULT_SUBSIDIARY_ID}" >> ${PathToAppRoot}/.env

# Webhook and Sync Configuration
echo "NS_TO_OPMS_WEBHOOK_SECRET=${NS_TO_OPMS_WEBHOOK_SECRET}" >> ${PathToAppRoot}/.env
echo "NS_TO_OPMS_ENDPOINT_URL=${NS_TO_OPMS_ENDPOINT}" >> ${PathToAppRoot}/.env
# REMOVED: OPMS_SYNC_ENABLED - Now controlled via database netsuite_opms_sync_config table
# echo "OPMS_SYNC_ENABLED=${OPMS_SYNC_ENABLED}" >> ${PathToAppRoot}/.env
echo "NS_TO_OPMS_MAX_RETRIES=${SYNC_MAX_RETRIES}" >> ${PathToAppRoot}/.env
echo "NS_TO_OPMS_RETRY_DELAY_MS=${SYNC_RETRY_DELAY_MS}" >> ${PathToAppRoot}/.env
echo "NS_TO_OPMS_BATCH_SIZE=${SYNC_BATCH_SIZE}" >> ${PathToAppRoot}/.env
echo "NS_TO_OPMS_RATE_LIMIT_MS=${SYNC_RATE_LIMIT_MS}" >> ${PathToAppRoot}/.env

# JWT Authentication
echo "JWT_SECRET=${JWT_SECRET}" >> ${PathToAppRoot}/.env
echo "JWT_EXPIRES_IN=${JWT_EXPIRES_IN}" >> ${PathToAppRoot}/.env
echo "JWT_REFRESH_EXPIRES_IN=${JWT_REFRESH_EXPIRES_IN}" >> ${PathToAppRoot}/.env

# AWS Configuration
echo "AWS_REGION=us-west-1" >> ${PathToAppRoot}/.env
echo "RDS_SECRET_ARN=${SECRET_ID}" >> ${PathToAppRoot}/.env
echo "AWS_S3_BUCKET=opuzen-${APP_ENV}" >> ${PathToAppRoot}/.env

# API Configuration (environment-specific)
if [ "${APP_ENV}" = "prod" ]; then
  echo "CORS_ORIGIN=https://api.opuzen-service.com" >> ${PathToAppRoot}/.env
  echo "API_URL=https://api.opuzen-service.com" >> ${PathToAppRoot}/.env
elif [ "${APP_ENV}" = "qa" ]; then
  echo "CORS_ORIGIN=https://api-qa.opuzen-service.com" >> ${PathToAppRoot}/.env
  echo "API_URL=https://api-qa.opuzen-service.com" >> ${PathToAppRoot}/.env
else
  echo "CORS_ORIGIN=https://api-dev.opuzen-service.com" >> ${PathToAppRoot}/.env
  echo "API_URL=https://api-dev.opuzen-service.com" >> ${PathToAppRoot}/.env
fi

# Set proper permissions
chown ubuntu:ubuntu ${PathToAppRoot}/.env
chmod 600 ${PathToAppRoot}/.env

echo "✅ Environment file created with all credentials (Database, NetSuite, JWT, Sync)"
echo "   - NetSuite credentials: ${ENV_SUFFIX}"
echo "   - Webhook endpoint: ${NS_TO_OPMS_ENDPOINT}"
echo "   - Database: opuzen_${APP_ENV}_master_app"

#===============================
# Create start.sh script
#===============================
echo "Creating start.sh script..."
cat > ${PathToAppRoot}/start.sh << EOF
#!/bin/bash
cd ${PathToAppRoot}
echo "Starting OPMS API directly with Node.js in \$(pwd)"

# Kill any existing Node.js processes
pkill -f "node.*src/index.js" || true

# Start Node.js application directly (uses .env file)
nohup node src/index.js > /home/ubuntu/opms-api.log 2>&1 &

echo "Application started with Node.js directly"
sleep 2
ps aux | grep "node.*src/index.js" | grep -v grep || echo "No Node.js process found"
EOF

chmod +x ${PathToAppRoot}/start.sh
chown ubuntu:ubuntu ${PathToAppRoot}/start.sh

#===============================
# Start the application
#===============================
echo "Starting the OPMS API application..."
cd ${PathToAppRoot}

# Start Node.js application directly (uses .env file for reliable variable passing)
sudo -u ubuntu bash -c "cd ${PathToAppRoot} && nohup node src/index.js > /home/ubuntu/opms-api.log 2>&1 &"

# Wait for application to start
echo "Waiting for application to start..."
sleep 10

#===============================
# Verify application is running
#===============================
echo "Verifying application is running..."
if ps aux | grep -q "node.*src/index.js" && ! ps aux | grep -q "grep.*node"; then
    echo "✅ OPMS API is running successfully"
    ps aux | grep "node.*src/index.js" | grep -v grep
else
    echo "❌ OPMS API failed to start"
    cat /home/ubuntu/opms-api.log || echo "No application log found"
    exit 1
fi

#===============================
# Test application health
#===============================
echo "Testing application health..."
sleep 5
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Application health check passed"
else
    echo "❌ Application health check failed"
    echo "PM2 logs:"
    pm2 logs --lines 20
fi

#===============================
# Final setup and verification
#===============================
echo "Setting up final configurations..."

# Ensure PM2 starts on boot
sudo -u ubuntu pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Set proper ownership
chown -R ubuntu:ubuntu ${PathToAppRoot}

#===============================
# Deployment complete
#===============================
echo "=========================================="
echo "OPMS API Application Deployment Complete!"
echo "=========================================="
echo "Environment: ${APP_ENV}"
echo "Application: ${APP_NAME}"
echo "Database Host: ${DB_HOST}"
echo "Application Directory: ${PathToAppRoot}"
echo "Health Check: http://localhost:3000/api/health"
echo "PM2 Status: $(pm2 list | grep opms-api | awk '{print $10}')"

#===============================
# Create Git Commit Watcher
#===============================
echo "Setting up git commit watcher..."

# Create the watcher script (environment-aware)
cat > /home/ubuntu/git-commit-watcher.sh << EOF
#!/bin/bash
LAST_COMMIT_FILE="/tmp/last-opms-api-commit-${APP_ENV}"
APP_DIR="${PathToAppRoot}"
LOG_FILE="/home/ubuntu/git-watcher.log"

echo "\$(date): Git commit watcher started for ${APP_ENV} environment" >> \$LOG_FILE

while true; do
    cd \$APP_DIR 2>/dev/null || { sleep 30; continue; }
    CURRENT_COMMIT=\$(git rev-parse HEAD 2>/dev/null)
    LAST_COMMIT=\$(cat \$LAST_COMMIT_FILE 2>/dev/null)
    
    if [ -n "\$CURRENT_COMMIT" ] && [ "\$CURRENT_COMMIT" != "\$LAST_COMMIT" ]; then
        echo "\$(date): New commit detected: \$CURRENT_COMMIT (was: \$LAST_COMMIT)" >> \$LOG_FILE
        echo "\$CURRENT_COMMIT" > \$LAST_COMMIT_FILE
        
        # Restart app
        echo "\$(date): Restarting app..." >> \$LOG_FILE
        sudo pkill -f 'node.*src/index.js' || true
        sleep 2
        sudo -u ubuntu bash -c "cd ${PathToAppRoot} && NODE_ENV=${APP_ENV} nohup node src/index.js > /home/ubuntu/opms-api.log 2>&1 &"
        echo "\$(date): App restarted successfully for commit \$CURRENT_COMMIT" >> \$LOG_FILE
    fi
    
    sleep 30
done
EOF

chmod +x /home/ubuntu/git-commit-watcher.sh
chown ubuntu:ubuntu /home/ubuntu/git-commit-watcher.sh

# Create systemd service
cat > /etc/systemd/system/git-commit-watcher.service << 'EOF'
[Unit]
Description=Git Commit Watcher for OPMS API
After=network.target

[Service]
Type=simple
User=ubuntu
ExecStart=/home/ubuntu/git-commit-watcher.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
systemctl enable git-commit-watcher
systemctl start git-commit-watcher

echo "Git commit watcher configured and started"
echo "Check watcher status with: systemctl status git-commit-watcher"
echo "Check watcher logs with: tail -f /home/ubuntu/git-watcher.log"
echo "Deployment completed at: $(date)"
echo "=========================================="
