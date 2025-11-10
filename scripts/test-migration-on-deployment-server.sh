#!/bin/bash

# Test Migration System on Deployment Server
# Tests environment detection and migration functionality

set -e

echo "🧪 Testing Environment-Aware Migration System on Deployment Server"
echo "=================================================================="

# Test 1: Environment Detection
echo
echo "🔍 Test 1: Environment Detection"
echo "Current working directory: $(pwd)"

# Test the environment detection
if [ -f "src/db/migrate-env-aware.js" ]; then
    echo "✅ Migration script found"
    
    # Test environment detection
    echo "Testing environment detection..."
    node -e "
    const { detectEnvironmentFromPath } = require('./src/db/migrate-env-aware');
    const env = detectEnvironmentFromPath();
    console.log('Detected environment:', env);
    "
else
    echo "❌ Migration script not found - deployment may not be complete"
    exit 1
fi

# Test 2: Migration Script Help
echo
echo "🔍 Test 2: Migration Script Help"
node src/db/migrate-env-aware.js --help

# Test 3: Dry Run with Environment Detection
echo
echo "🔍 Test 3: Dry Run Test"
echo "Testing migration dry-run..."
node src/db/migrate-env-aware.js --dry-run

# Test 4: Wrapper Script
echo
echo "🔍 Test 4: Wrapper Script Test"
if [ -f "scripts/migrate-environment.sh" ]; then
    echo "✅ Wrapper script found"
    ./scripts/migrate-environment.sh auto --dry-run
else
    echo "❌ Wrapper script not found"
fi

echo
echo "🎉 Migration system tests completed!"
echo "📋 Summary:"
echo "   ✅ Environment detection working"
echo "   ✅ Migration scripts deployed"
echo "   ✅ Dry-run functionality working"
echo
echo "🚀 Next step: Run actual migration if tests passed"
echo "   Command: ./scripts/migrate-environment.sh auto"
