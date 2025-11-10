#!/bin/bash

# =====================================================
# NetSuite to OPMS Pricing Sync - Test Runner
# =====================================================
# Automated test execution script
# 
# Usage:
#   ./run-tests.sh               # Run all steps
#   ./run-tests.sh --skip-setup  # Skip OPMS setup (if already done)
#   ./run-tests.sh --cleanup     # Only run cleanup
# =====================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_HOST="${OPMS_DB_HOST:-localhost}"
DB_USER="${OPMS_DB_USER:-root}"
DB_NAME="${OPMS_DB_NAME:-opms_database}"
API_URL="${API_BASE_URL:-http://localhost:3000}"

# Functions
print_header() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║  NetSuite to OPMS Pricing Sync - Test Runner             ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "${GREEN}▶ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠  $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

check_prerequisites() {
    print_step "Checking prerequisites..."
    
    # Check MySQL client
    if ! command -v mysql &> /dev/null; then
        print_error "MySQL client not found. Please install MySQL client."
        exit 1
    fi
    print_success "MySQL client found"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found. Please install Node.js 18+."
        exit 1
    fi
    print_success "Node.js found ($(node --version))"
    
    # Check if API server is running
    if curl -s "$API_URL/api/health" > /dev/null 2>&1; then
        print_success "API server is running at $API_URL"
    else
        print_warning "API server not responding at $API_URL"
        echo "Please start the API server before running tests."
        echo "  npm start  # or npm run dev"
        exit 1
    fi
    
    # Check environment variables
    if [ -z "$NS_TO_OPMS_WEBHOOK_SECRET" ]; then
        print_warning "NS_TO_OPMS_WEBHOOK_SECRET not set"
        echo "Tests will use default test secret"
    else
        print_success "Webhook secret configured"
    fi
    
    echo ""
}

run_opms_setup() {
    print_step "Step 1: Setting up OPMS test data..."
    
    if [ ! -f "1-setup-opms-test-data.sql" ]; then
        print_error "Setup script not found: 1-setup-opms-test-data.sql"
        exit 1
    fi
    
    echo "Database: $DB_NAME @ $DB_HOST"
    echo "User: $DB_USER"
    echo ""
    
    mysql -h "$DB_HOST" -u "$DB_USER" -p "$DB_NAME" < 1-setup-opms-test-data.sql
    
    if [ $? -eq 0 ]; then
        print_success "OPMS test data created successfully"
    else
        print_error "Failed to create OPMS test data"
        exit 1
    fi
    
    echo ""
    print_warning "IMPORTANT: Note the Product ID and Item ID from the output above"
    echo "You'll need these for NetSuite setup in Step 2"
    echo ""
    read -p "Press Enter when you've noted the IDs..."
    echo ""
}

show_netsuite_guide() {
    print_step "Step 2: NetSuite Test Item Setup"
    echo ""
    echo "Please follow the guide in:"
    echo "  2-netsuite-test-item-setup-guide.md"
    echo ""
    echo "Quick checklist:"
    echo "  1. Create inventory item: opmsAPI-SYNC-TEST-001"
    echo "  2. Enable Lot Numbered Item"
    echo "  3. Set Lisa Slayman Item = FALSE (unchecked)"
    echo "  4. Set pricing:"
    echo "     - Base Price Line 1: \$100.00"
    echo "     - Base Price Line 2: \$150.00"
    echo "     - Cost: \$40.00"
    echo "     - Roll Price: \$50.00"
    echo "  5. Set OPMS Item ID and Product ID custom fields"
    echo "  6. Save item"
    echo ""
    read -p "Press Enter when NetSuite item is ready..."
    echo ""
}

run_sync_tests() {
    print_step "Step 3: Running sync tests..."
    echo ""
    
    if [ ! -f "3-manual-sync-test.js" ]; then
        print_error "Test script not found: 3-manual-sync-test.js"
        exit 1
    fi
    
    node 3-manual-sync-test.js
    
    if [ $? -eq 0 ]; then
        print_success "Sync tests completed"
    else
        print_error "Sync tests failed"
        echo ""
        echo "Check the error messages above for details"
        exit 1
    fi
    
    echo ""
}

run_validation() {
    print_step "Step 4: Validating sync results in OPMS..."
    echo ""
    
    if [ ! -f "4-validate-sync-results.sql" ]; then
        print_error "Validation script not found: 4-validate-sync-results.sql"
        exit 1
    fi
    
    mysql -h "$DB_HOST" -u "$DB_USER" -p "$DB_NAME" < 4-validate-sync-results.sql
    
    if [ $? -eq 0 ]; then
        print_success "Validation completed"
    else
        print_error "Validation failed"
        exit 1
    fi
    
    echo ""
}

run_cleanup() {
    print_step "Step 5: Cleaning up test data..."
    echo ""
    
    print_warning "This will delete all opmsAPI- test data from OPMS"
    read -p "Continue? (y/N): " confirm
    
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "Cleanup cancelled"
        return
    fi
    
    if [ ! -f "6-cleanup-test-data.sql" ]; then
        print_error "Cleanup script not found: 6-cleanup-test-data.sql"
        exit 1
    fi
    
    mysql -h "$DB_HOST" -u "$DB_USER" -p "$DB_NAME" < 6-cleanup-test-data.sql
    
    if [ $? -eq 0 ]; then
        print_success "OPMS cleanup completed"
    else
        print_error "Cleanup failed"
        exit 1
    fi
    
    echo ""
    print_warning "Don't forget to delete the NetSuite test item:"
    echo "  1. Navigate to: Lists → Accounting → Items"
    echo "  2. Search for: opmsAPI-SYNC-TEST-001"
    echo "  3. Delete item"
    echo "  4. Empty trash/recycle bin"
    echo ""
}

show_summary() {
    echo ""
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║  Test Suite Complete                                      ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    print_success "All steps completed successfully!"
    echo ""
    echo "What was tested:"
    echo "  ✓ Normal pricing sync (4 fields)"
    echo "  ✓ Lisa Slayman skip logic"
    echo "  ✓ Invalid data handling"
    echo "  ✓ Missing item handling"
    echo "  ✓ OPMS database validation"
    echo ""
    echo "For detailed results, review:"
    echo "  - Console output above"
    echo "  - Validation query results"
    echo "  - API server logs"
    echo ""
}

# Main execution
main() {
    print_header
    
    # Parse arguments
    SKIP_SETUP=false
    CLEANUP_ONLY=false
    
    for arg in "$@"; do
        case $arg in
            --skip-setup)
                SKIP_SETUP=true
                shift
                ;;
            --cleanup)
                CLEANUP_ONLY=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [options]"
                echo ""
                echo "Options:"
                echo "  --skip-setup  Skip OPMS test data setup (if already done)"
                echo "  --cleanup     Only run cleanup (remove test data)"
                echo "  --help, -h    Show this help message"
                echo ""
                echo "Environment Variables:"
                echo "  OPMS_DB_HOST              Database host (default: localhost)"
                echo "  OPMS_DB_USER              Database user (default: root)"
                echo "  OPMS_DB_NAME              Database name (default: opms_database)"
                echo "  API_BASE_URL              API URL (default: http://localhost:3000)"
                echo "  NS_TO_OPMS_WEBHOOK_SECRET Webhook secret (optional)"
                echo ""
                exit 0
                ;;
            *)
                print_error "Unknown option: $arg"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Handle cleanup-only mode
    if [ "$CLEANUP_ONLY" = true ]; then
        check_prerequisites
        run_cleanup
        print_success "Cleanup complete"
        exit 0
    fi
    
    # Run full test suite
    check_prerequisites
    
    if [ "$SKIP_SETUP" = false ]; then
        run_opms_setup
    else
        print_warning "Skipping OPMS setup (as requested)"
        echo ""
    fi
    
    show_netsuite_guide
    run_sync_tests
    run_validation
    
    echo ""
    read -p "Run cleanup now? (y/N): " cleanup_confirm
    if [ "$cleanup_confirm" = "y" ] || [ "$cleanup_confirm" = "Y" ]; then
        run_cleanup
    else
        print_warning "Cleanup skipped. Remember to run:"
        echo "  ./run-tests.sh --cleanup"
        echo "or manually run: 6-cleanup-test-data.sql"
        echo ""
    fi
    
    show_summary
}

# Run main function
main "$@"

