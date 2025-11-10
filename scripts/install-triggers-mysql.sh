#!/bin/bash

# Install OPMS Database Triggers
# This script uses MySQL command line to properly handle DELIMITER statements

echo "🔧 Installing OPMS Database Triggers..."
echo "======================================"

# Get database connection details from environment
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-3306}
DB_USER=${DB_USER:-pklopuzen}
DB_PASSWORD=${DB_PASSWORD:-localdev}
DB_NAME=${DB_NAME:-opuzen_loc_master_app}

echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo ""

# Check if MySQL client is available
if ! command -v mysql &> /dev/null; then
    echo "❌ MySQL client not found. Please install MySQL client tools."
    exit 1
fi

# Test database connection
echo "🔍 Testing database connection..."
if ! mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" "$DB_NAME" &> /dev/null; then
    echo "❌ Cannot connect to database. Please check your credentials."
    exit 1
fi
echo "✅ Database connection successful"
echo ""

# Install triggers using MySQL command line
echo "📦 Installing database triggers..."
if mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < src/db/setup-opms-sync-tables.sql; then
    echo "✅ Database triggers installed successfully!"
else
    echo "❌ Failed to install database triggers"
    exit 1
fi

echo ""
echo "🔍 Verifying trigger installation..."

# Verify triggers are installed
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "
SELECT 
    TRIGGER_NAME,
    EVENT_MANIPULATION,
    EVENT_OBJECT_TABLE,
    CREATED
FROM information_schema.TRIGGERS 
WHERE TRIGGER_SCHEMA = '$DB_NAME' 
  AND TRIGGER_NAME IN ('opms_item_sync_trigger', 'opms_product_sync_trigger');
" "$DB_NAME"

echo ""
echo "🎉 Trigger installation complete!"
