#!/bin/bash

# Install Node.js on Deployment Server
# Quick setup for migration functionality

set -e

echo "🚀 Installing Node.js on deployment server..."

# Check if Node.js is already installed
if command -v node &> /dev/null; then
    echo "✅ Node.js already installed: $(node --version)"
    echo "✅ npm already installed: $(npm --version)"
else
    echo "📦 Installing Node.js..."
    
    # Update package list
    sudo apt-get update
    
    # Install Node.js 18.x (LTS)
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    echo "✅ Node.js installed: $(node --version)"
    echo "✅ npm installed: $(npm --version)"
fi

# Install dependencies if needed
if [ -f "package.json" ] && [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already available"
fi

echo "🎉 Node.js setup completed!"
echo "📋 You can now run:"
echo "   ./scripts/test-migration-on-deployment-server.sh"
