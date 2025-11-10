#!/bin/bash

# OPMS to NetSuite Sync Test Suite Runner
# This script runs the complete test suite for OPMS to NetSuite synchronization

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="test-execution.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')] SUCCESS:${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

# Header
echo "=========================================="
echo "OPMS to NetSuite Sync Test Suite"
echo "=========================================="
echo "Timestamp: $TIMESTAMP"
echo "Script Directory: $SCRIPT_DIR"
echo "Log File: $LOG_FILE"
echo ""

# Initialize log file
echo "Test execution started at $TIMESTAMP" > "$LOG_FILE"

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed or not in PATH"
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version)
    log "Node.js version: $NODE_VERSION"
    
    # Check if required files exist
    local required_files=(
        "1-setup-opms-test-data.sql"
        "2-test-runner.js"
        "3-validate-netsuite-results.js"
        "4-cleanup-test-data.js"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$SCRIPT_DIR/$file" ]; then
            error "Required file not found: $file"
            exit 1
        fi
    done
    
    success "Prerequisites check passed"
}

# Function to setup test data
setup_test_data() {
    log "Setting up test data..."
    
    # Check if database connection is configured
    if [ -z "$OPMS_DB_HOST" ] || [ -z "$OPMS_DB_USER" ] || [ -z "$OPMS_DB_NAME" ]; then
        warning "Database environment variables not set"
        warning "Please set OPMS_DB_HOST, OPMS_DB_USER, OPMS_DB_PASSWORD, and OPMS_DB_NAME"
        warning "Skipping database setup..."
        return 0
    fi
    
    # Run the SQL setup script
    if command -v mysql &> /dev/null; then
        log "Running OPMS test data setup..."
        mysql -h "$OPMS_DB_HOST" -u "$OPMS_DB_USER" -p"$OPMS_DB_PASSWORD" "$OPMS_DB_NAME" < "$SCRIPT_DIR/1-setup-opms-test-data.sql" 2>&1 | tee -a "$LOG_FILE"
        success "Test data setup completed"
    else
        warning "MySQL client not found, skipping database setup"
        warning "Please run 1-setup-opms-test-data.sql manually"
    fi
}

# Function to run tests
run_tests() {
    log "Running OPMS to NetSuite sync tests..."
    
    # Check if API server is running
    if [ -z "$API_BASE_URL" ]; then
        API_BASE_URL="http://localhost:3000"
    fi
    
    log "API Base URL: $API_BASE_URL"
    
    # Test API connectivity
    if command -v curl &> /dev/null; then
        if curl -s "$API_BASE_URL/health" > /dev/null; then
            success "API server is running"
        else
            error "API server is not responding at $API_BASE_URL"
            error "Please start the API server before running tests"
            exit 1
        fi
    else
        warning "curl not found, skipping API connectivity check"
    fi
    
    # Run the test runner
    log "Starting test execution..."
    cd "$SCRIPT_DIR"
    
    if node 2-test-runner.js 2>&1 | tee -a "$LOG_FILE"; then
        success "Test execution completed"
    else
        error "Test execution failed"
        return 1
    fi
}

# Function to validate results
validate_results() {
    log "Validating NetSuite results..."
    
    cd "$SCRIPT_DIR"
    
    if node 3-validate-netsuite-results.js 2>&1 | tee -a "$LOG_FILE"; then
        success "Validation completed"
    else
        error "Validation failed"
        return 1
    fi
}

# Function to cleanup test data
cleanup_test_data() {
    log "Cleaning up test data..."
    
    cd "$SCRIPT_DIR"
    
    if node 4-cleanup-test-data.js 2>&1 | tee -a "$LOG_FILE"; then
        success "Cleanup completed"
    else
        error "Cleanup failed"
        return 1
    fi
}

# Function to show test results
show_results() {
    log "Test Results Summary:"
    echo ""
    
    # Show test results if available
    if [ -f "$SCRIPT_DIR/test-results.json" ]; then
        echo "📊 Test Execution Results:"
        echo "------------------------"
        if command -v jq &> /dev/null; then
            jq -r '.summary | "Total: \(.total), Passed: \(.passed), Failed: \(.failed), Skipped: \(.skipped)"' "$SCRIPT_DIR/test-results.json"
        else
            echo "Install jq for formatted output, or check test-results.json"
        fi
        echo ""
    fi
    
    # Show validation results if available
    if [ -f "$SCRIPT_DIR/validation-results.json" ]; then
        echo "🔍 Validation Results:"
        echo "---------------------"
        if command -v jq &> /dev/null; then
            jq -r '.summary | "Total: \(.total), Passed: \(.passed), Failed: \(.failed)"' "$SCRIPT_DIR/validation-results.json"
        else
            echo "Install jq for formatted output, or check validation-results.json"
        fi
        echo ""
    fi
    
    # Show cleanup results if available
    if [ -f "$SCRIPT_DIR/cleanup-results.json" ]; then
        echo "🧹 Cleanup Results:"
        echo "------------------"
        if command -v jq &> /dev/null; then
            jq -r '.summary | "Total: \(.total), Deleted: \(.deleted), Failed: \(.failed)"' "$SCRIPT_DIR/cleanup-results.json"
        else
            echo "Install jq for formatted output, or check cleanup-results.json"
        fi
        echo ""
    fi
}

# Function to show help
show_help() {
    echo "OPMS to NetSuite Sync Test Suite Runner"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --setup-only      Only run test data setup"
    echo "  --test-only       Only run tests (skip setup and cleanup)"
    echo "  --validate-only   Only run validation"
    echo "  --cleanup-only    Only run cleanup"
    echo "  --no-cleanup      Skip cleanup step"
    echo "  --help            Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  API_BASE_URL      API server URL (default: http://localhost:3000)"
    echo "  OPMS_DB_HOST      OPMS database host"
    echo "  OPMS_DB_USER      OPMS database user"
    echo "  OPMS_DB_PASSWORD  OPMS database password"
    echo "  OPMS_DB_NAME      OPMS database name"
    echo ""
    echo "Examples:"
    echo "  $0                           # Run complete test suite"
    echo "  $0 --test-only               # Run only tests"
    echo "  $0 --no-cleanup              # Run tests without cleanup"
    echo "  API_BASE_URL=http://localhost:3000 $0  # Use custom API URL"
}

# Main execution
main() {
    local setup_only=false
    local test_only=false
    local validate_only=false
    local cleanup_only=false
    local no_cleanup=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --setup-only)
                setup_only=true
                shift
                ;;
            --test-only)
                test_only=true
                shift
                ;;
            --validate-only)
                validate_only=true
                shift
                ;;
            --cleanup-only)
                cleanup_only=true
                shift
                ;;
            --no-cleanup)
                no_cleanup=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Run based on options
    if [ "$setup_only" = true ]; then
        check_prerequisites
        setup_test_data
    elif [ "$test_only" = true ]; then
        check_prerequisites
        run_tests
    elif [ "$validate_only" = true ]; then
        check_prerequisites
        validate_results
    elif [ "$cleanup_only" = true ]; then
        check_prerequisites
        cleanup_test_data
    else
        # Run complete test suite
        check_prerequisites
        setup_test_data
        run_tests
        validate_results
        
        if [ "$no_cleanup" = false ]; then
            cleanup_test_data
        fi
    fi
    
    show_results
    
    success "Test suite execution completed"
    echo ""
    echo "📄 Detailed logs saved to: $LOG_FILE"
    echo "📁 Test results in: $SCRIPT_DIR"
}

# Run main function with all arguments
main "$@"



