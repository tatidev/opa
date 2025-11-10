#!/bin/bash

# fix-permissions-and-deploy.sh
# Fixes file permissions and deploys the application

set -e  # Exit on any error

echo "Starting deployment process..."

cd /opuzen-efs/dev/opms-api

echo "Changed to directory: $(pwd)"

# Fix ownership for all files
echo "Fixing ownership for all files..."
sudo chown -R ubuntu:www-data .

# Fix specific problematic files (ignore errors if files don't exist)
echo "Fixing ownership for specific files..."
sudo chown ubuntu:www-data .env.backup .env.bak .gitignore package-lock.json 2>/dev/null || true

# Verify the fix
echo "Verifying ownership fix..."
ls -la | head -10

# Now try npm install
echo "Installing Node.js dependencies..."
npm install

# Kill any existing Node.js processes
echo "Stopping existing application..."
sudo pkill -f 'node.*src/index.js' || true
sleep 2

# Start the app
echo "Starting the application..."
sudo -u ubuntu bash -c 'cd /opuzen-efs/dev/opms-api && NODE_ENV=dev nohup node src/index.js > /home/ubuntu/opms-api.log 2>&1 &'

# Wait for app to start
echo "Waiting for application to start..."
sleep 3

# Verify app is running
echo "Verifying application is running..."
if ps aux | grep -q 'node.*src/index.js' && ! ps aux | grep -q 'grep.*node'; then
    echo "Application is running successfully"
else
    echo "ERROR: Application failed to start"
    echo "Last 10 lines of log:"
    tail -10 /home/ubuntu/opms-api.log || echo "No log file found"
    exit 1
fi

echo "Deployment completed successfully!"
