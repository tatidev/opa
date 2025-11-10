#!/bin/bash

# Environment-Aware Database Migration Script
# Usage: ./scripts/migrate-environment.sh [environment] [options]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to print usage
print_usage() {
    cat << EOF
Environment-Aware Database Migration Script

Usage: ./scripts/migrate-environment.sh [environment] [options]

Environments:
  dev      Migrate development database (opuzen_dev_master_app)
  qa       Migrate QA database (opuzen_qa_master_app)  
  prod     Migrate production database (opuzen_prod_master_app)
  auto     Auto-detect environment from current path (default)

Options:
  --dry-run    Show what would be migrated without executing
  --reset      Reset migrations table (use with extreme caution)
  --help       Show this help message

Examples:
  # Auto-detect environment and run migrations
  ./scripts/migrate-environment.sh auto

  # Explicitly target DEV environment
  ./scripts/migrate-environment.sh dev
  
  # Dry run for PROD environment
  ./scripts/migrate-environment.sh prod --dry-run

Environment Detection:
  The script automatically detects environment from working directory:
  - /opuzen-efs/dev/   → Development environment
  - /opuzen-efs/qa/    → QA environment  
  - /opuzen-efs/prod/  → Production environment
  - Other paths        → Local development

Database Credentials:
  Retrieved automatically from AWS Secrets Manager:
  - dev:  opuzen-dev-database-credentials
  - qa:   opuzen-qa-database-credentials
  - prod: opuzen-prod-database-credentials

Prerequisites:
  - AWS CLI installed and configured
  - Deployment server has Secrets Manager access
  - Node.js and npm dependencies installed

EOF
}

# Parse command line arguments
ENVIRONMENT=${1:-auto}
shift || true

DRY_RUN=false
RESET=false
HELP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --reset)
            RESET=true
            shift
            ;;
        --help)
            HELP=true
            shift
            ;;
        *)
            print_status $RED "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# Show help if requested
if [ "$HELP" = true ]; then
    print_usage
    exit 0
fi

# Validate environment parameter
if [[ ! "$ENVIRONMENT" =~ ^(dev|qa|prod|auto)$ ]]; then
    print_status $RED "Error: Invalid environment '$ENVIRONMENT'"
    print_usage
    exit 1
fi

# Check prerequisites
print_status $BLUE "🔍 Checking prerequisites..."

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    print_status $RED "❌ AWS CLI not found. Please install AWS CLI first."
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    print_status $RED "❌ Node.js not found. Please install Node.js first."
    exit 1
fi

# Check if we're in a project directory
if [ ! -f "package.json" ]; then
    print_status $RED "❌ Not in a Node.js project directory. Please run from the project root."
    exit 1
fi

# Check if migration script exists
if [ ! -f "src/db/migrate-env-aware.js" ]; then
    print_status $RED "❌ Migration script not found. Please ensure src/db/migrate-env-aware.js exists."
    exit 1
fi

print_status $GREEN "✅ Prerequisites check passed"

# Environment detection and setup
print_status $BLUE "🌍 Setting up environment..."

if [ "$ENVIRONMENT" = "auto" ]; then
    print_status $YELLOW "🔍 Auto-detecting environment from current path..."
    CURRENT_PATH=$(pwd)
    print_status $BLUE "   Current path: $CURRENT_PATH"
    
    if [[ "$CURRENT_PATH" == *"/opuzen-efs/dev/"* ]]; then
        DETECTED_ENV="dev"
    elif [[ "$CURRENT_PATH" == *"/opuzen-efs/qa/"* ]]; then
        DETECTED_ENV="qa"
    elif [[ "$CURRENT_PATH" == *"/opuzen-efs/prod/"* ]]; then
        DETECTED_ENV="prod"
    else
        DETECTED_ENV="development"
    fi
    
    print_status $GREEN "   Detected environment: $DETECTED_ENV"
    ENVIRONMENT=$DETECTED_ENV
fi

# Environment-specific configuration
case $ENVIRONMENT in
    dev)
        ENV_DESC="Development Environment"
        DB_NAME="opuzen_dev_master_app"
        SECRET_ID="opuzen-dev-database-credentials"
        ;;
    qa)
        ENV_DESC="QA Environment"
        DB_NAME="opuzen_qa_master_app"
        SECRET_ID="opuzen-qa-database-credentials"
        ;;
    prod)
        ENV_DESC="Production Environment"
        DB_NAME="opuzen_prod_master_app"
        SECRET_ID="opuzen-prod-database-credentials"
        ;;
    development)
        ENV_DESC="Local Development"
        DB_NAME=${DB_NAME:-"opuzen"}
        SECRET_ID=""
        ;;
esac

print_status $GREEN "✅ Environment: $ENV_DESC"
print_status $GREEN "✅ Database: $DB_NAME"

# Production safety check
if [ "$ENVIRONMENT" = "prod" ] && [ "$DRY_RUN" = false ]; then
    print_status $YELLOW "⚠️  PRODUCTION ENVIRONMENT DETECTED"
    print_status $YELLOW "   This will modify the production database!"
    print_status $YELLOW "   Please ensure you have:"
    print_status $YELLOW "   - Database backup completed"
    print_status $YELLOW "   - Maintenance window scheduled"
    print_status $YELLOW "   - Explicit approval for production changes"
    echo
    read -p "Do you want to continue with PRODUCTION migration? (type 'YES' to confirm): " CONFIRM
    
    if [ "$CONFIRM" != "YES" ]; then
        print_status $YELLOW "Migration cancelled by user"
        exit 0
    fi
    
    print_status $GREEN "✅ Production migration confirmed"
fi

# Build migration command
MIGRATION_CMD="node src/db/migrate-env-aware.js"

if [ "$DRY_RUN" = true ]; then
    MIGRATION_CMD="$MIGRATION_CMD --dry-run"
    print_status $BLUE "🔍 DRY RUN MODE - No changes will be made"
fi

if [ "$RESET" = true ]; then
    MIGRATION_CMD="$MIGRATION_CMD --reset"
    print_status $YELLOW "⚠️  RESET MODE - Migrations table will be reset"
fi

# Execute migration
print_status $BLUE "🚀 Executing migration..."
print_status $BLUE "   Command: $MIGRATION_CMD"
print_status $BLUE "   Environment: $ENV_DESC"
print_status $BLUE "   Database: $DB_NAME"

echo
eval $MIGRATION_CMD

# Check exit status
if [ $? -eq 0 ]; then
    print_status $GREEN "✅ Migration completed successfully!"
    
    if [ "$DRY_RUN" = false ]; then
        print_status $GREEN "📊 New tables created for $ENV_DESC"
        print_status $GREEN "🔄 API functionality now available"
    fi
else
    print_status $RED "❌ Migration failed!"
    print_status $RED "   Check logs above for error details"
    print_status $RED "   Consider running with --dry-run first"
    exit 1
fi

print_status $BLUE "🎉 Migration process complete!"
