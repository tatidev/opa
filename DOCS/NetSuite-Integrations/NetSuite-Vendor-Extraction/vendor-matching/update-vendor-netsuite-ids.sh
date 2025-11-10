#!/bin/bash

# =============================================================================
# Update OPMS Vendors with NetSuite IDs and Names from CSV
# =============================================================================
# This script updates Z_VENDOR table with NetSuite vendor IDs and names
# from the CSV mapping file, using CSV as the source of truth for names.
#
# Usage: ./update-vendor-netsuite-ids.sh [--dry-run]
# =============================================================================

set -euo pipefail  # Exit on any error, undefined vars, pipe failures

# Configuration
SECRET_NAME="rds!cluster-2cc47963-bf79-4426-8b61-6aac4f194a15"
DB_HOST="opuzen-aurora-mysql8-cluster.cluster-c7886s6kkcmk.us-west-1.rds.amazonaws.com"
AWS_REGION="us-west-1"
DB_NAME="opuzen_prod_master_app"

# Get script directory and find CSV file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CSV_FILE="$SCRIPT_DIR/csv/NetSuite-OPMS-VENDOR-MAPPING_AnnUpdated_25-10-15.csv"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Global variables
DRY_RUN=false
DB_USERNAME=""
DB_PASSWORD=""
TEMP_DIR="/tmp/vendor_update_$$"
LOG_FILE="$TEMP_DIR/update_log.txt"

# =============================================================================
# Utility Functions
# =============================================================================

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE" 2>/dev/null || echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE" 2>/dev/null || echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE" 2>/dev/null || echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE" 2>/dev/null || echo -e "${RED}[ERROR]${NC} $1"
}

cleanup() {
    log "Cleaning up temporary files..."
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# =============================================================================
# Database Functions
# =============================================================================

fetch_db_credentials() {
    log "Fetching database credentials from AWS Secrets Manager..."
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed or not in PATH"
        exit 1
    fi
    
    # Fetch secret from AWS Secrets Manager
    local secret_json
    if ! secret_json=$(aws secretsmanager get-secret-value \
        --secret-id "$SECRET_NAME" \
        --region "$AWS_REGION" \
        --query SecretString \
        --output text 2>/dev/null); then
        log_error "Failed to fetch secret from AWS Secrets Manager"
        exit 1
    fi
    
    # Parse credentials
    DB_USERNAME=$(echo "$secret_json" | jq -r '.username')
    DB_PASSWORD=$(echo "$secret_json" | jq -r '.password')
    
    if [[ "$DB_USERNAME" == "null" || "$DB_PASSWORD" == "null" ]]; then
        log_error "Failed to parse database credentials from secret"
        exit 1
    fi
    
    log_success "Database credentials fetched successfully"
}

test_db_connection() {
    log "Testing database connection..."
    
    if ! mysql -h "$DB_HOST" -u "$DB_USERNAME" -p"$DB_PASSWORD" -e "USE $DB_NAME; SELECT 1;" >/dev/null 2>&1; then
        log_error "Failed to connect to database $DB_NAME"
        exit 1
    fi
    
    log_success "Database connection successful to $DB_NAME"
}

execute_sql() {
    local sql="$1"
    local description="$2"
    
    log "Executing: $description"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN - Would execute: $sql"
        return 0
    fi
    
    if mysql -h "$DB_HOST" -u "$DB_USERNAME" -p"$DB_PASSWORD" -D "$DB_NAME" -e "$sql" 2>/dev/null; then
        log_success "$description completed"
        return 0
    else
        log_error "$description failed"
        return 1
    fi
}

# =============================================================================
# CSV Processing Functions
# =============================================================================

validate_csv_file() {
    log "Validating CSV file: $CSV_FILE"
    
    if [[ ! -f "$CSV_FILE" ]]; then
        log_error "CSV file not found: $CSV_FILE"
        exit 1
    fi
    
    # Check if file has content
    if [[ ! -s "$CSV_FILE" ]]; then
        log_error "CSV file is empty: $CSV_FILE"
        exit 1
    fi
    
    # Check if file has expected headers
    if ! head -1 "$CSV_FILE" | grep -q "opms_vendor_id.*netsuite_vendor_name.*netsuite_vendor_id"; then
        log_warning "CSV file may not have expected headers"
    fi
    
    log_success "CSV file validation passed"
}

process_csv_data() {
    log "Processing CSV data to extract vendor mappings..." >&2
    
    # Create temporary files
    local csv_processed="$TEMP_DIR/vendors_to_update.csv"
    local sql_updates="$TEMP_DIR/update_statements.sql"
    
    # Extract rows with non-NULL netsuite_vendor_id
    # Skip header row and filter for valid NetSuite IDs
    tail -n +2 "$CSV_FILE" | \
    awk -F',' '
    BEGIN { print "opms_vendor_id,netsuite_vendor_name,netsuite_vendor_id" }
    $5 != "" && $5 != "NULL" && $5 != "null" && $5 != "❌ No mapping" {
        print $1 "," $2 "," $5
    }' > "$csv_processed"
    
    local vendor_count=$(tail -n +2 "$csv_processed" | wc -l)
    log "Found $vendor_count vendors with valid NetSuite IDs" >&2
    
    if [[ $vendor_count -eq 0 ]]; then
        log_error "No vendors found with valid NetSuite IDs" >&2
        exit 1
    fi
    
    # Generate SQL update statements
    cat > "$sql_updates" << 'EOF'
-- Update Z_VENDOR table with NetSuite IDs and names from CSV
-- CSV is the source of truth for vendor names

EOF
    
    # Process each vendor
    while IFS=',' read -r opms_id netsuite_name netsuite_id; do
        # Skip header
        if [[ "$opms_id" == "opms_vendor_id" ]]; then
            continue
        fi
        
        # Escape single quotes in names for SQL
        local escaped_name=$(echo "$netsuite_name" | sed "s/'/''/g")
        
        cat >> "$sql_updates" << EOF
UPDATE Z_VENDOR 
SET name = '$escaped_name',
    netsuite_id = $netsuite_id
WHERE id = $opms_id
  AND active = 'Y' 
  AND archived = 'N';

EOF
    done < "$csv_processed"
    
    log_success "Generated SQL update statements for $vendor_count vendors" >&2
    echo "$sql_updates"
}

# =============================================================================
# Database Schema Functions
# =============================================================================

backup_z_vendor_table() {
    log "Creating full backup of Z_VENDOR table..."
    
    local backup_file="$TEMP_DIR/z_vendor_full_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    # Use configured database name
    local db_name="$DB_NAME"
    log "Using database: $db_name"
    
    # Create full table backup with structure and data
    log "Attempting mysqldump backup..."
    if mysqldump -h "$DB_HOST" -u "$DB_USERNAME" -p"$DB_PASSWORD" \
        --single-transaction \
        --add-drop-table \
        --create-options \
        --disable-keys \
        --extended-insert \
        --quick \
        --lock-tables=false \
        --no-tablespaces \
        "$db_name" \
        Z_VENDOR > "$backup_file" 2>"$TEMP_DIR/mysqldump_errors.log"; then
        log_success "Full Z_VENDOR table backup created: $backup_file"
        
        # Show backup file size
        local backup_size=$(du -h "$backup_file" | cut -f1)
        log "Backup file size: $backup_size"
        
        # Verify backup contains data
        local backup_lines=$(wc -l < "$backup_file")
        if [[ $backup_lines -gt 10 ]]; then
            log_success "Backup verification passed ($backup_lines lines)"
        else
            log_error "Backup verification failed - file appears empty or corrupted"
            return 1
        fi
    else
        log_error "Failed to create Z_VENDOR table backup"
        log "Debug info:"
        log "  Database: $db_name"
        log "  Host: $DB_HOST"
        log "  Username: $DB_USERNAME"
        
        # Show mysqldump error details
        if [[ -f "$TEMP_DIR/mysqldump_errors.log" ]]; then
            log "mysqldump error details:"
            cat "$TEMP_DIR/mysqldump_errors.log" | head -10 | while read -r line; do
                log "  $line"
            done
        fi
        
        # Try a proper backup using SELECT INTO OUTFILE
        log "Trying SELECT INTO OUTFILE backup method..."
        local temp_backup="$TEMP_DIR/z_vendor_data.csv"
        
        if mysql -h "$DB_HOST" -u "$DB_USERNAME" -p"$DB_PASSWORD" -D "$db_name" -e "
        SELECT 
            CONCAT('INSERT INTO Z_VENDOR (id, abrev, name, date_add, date_modif, user_id, active, archived, netsuite_id) VALUES (',
                   id, ', ',
                   IFNULL(CONCAT('\"', abrev, '\"'), 'NULL'), ', ',
                   IFNULL(CONCAT('\"', name, '\"'), 'NULL'), ', ',
                   IFNULL(CONCAT('\"', date_add, '\"'), 'NULL'), ', ',
                   IFNULL(CONCAT('\"', date_modif, '\"'), 'NULL'), ', ',
                   user_id, ', ',
                   IFNULL(CONCAT('\"', active, '\"'), 'NULL'), ', ',
                   IFNULL(CONCAT('\"', archived, '\"'), 'NULL'), ', ',
                   IFNULL(netsuite_id, 'NULL'), ');'
            ) as insert_statement
        FROM Z_VENDOR
        ORDER BY id
        " > "$backup_file" 2>/dev/null; then
            log_success "Alternative backup method succeeded (full data)"
        else
            log_error "All backup methods failed"
            return 1
        fi
    fi
}

add_netsuite_id_column() {
    log "Adding netsuite_id column to Z_VENDOR table..."
    
    # Check if column already exists
    local check_column_sql="
    SELECT COUNT(*) as column_exists 
    FROM information_schema.columns 
    WHERE table_schema = DATABASE() 
    AND table_name = 'Z_VENDOR' 
    AND column_name = 'netsuite_id'
    "
    
    local column_exists
    column_exists=$(mysql -h "$DB_HOST" -u "$DB_USERNAME" -p"$DB_PASSWORD" -D "$DB_NAME" -e "$check_column_sql" -s -N 2>/dev/null || echo "0")
    
    if [[ "$column_exists" == "1" ]]; then
        log_warning "netsuite_id column already exists in Z_VENDOR table"
        return 0
    fi
    
    # Create backup before altering table structure
    if ! backup_z_vendor_table; then
        log_error "Failed to create backup before altering table. Aborting."
        return 1
    fi
    
    # Add the column
    local add_column_sql="
    ALTER TABLE Z_VENDOR 
    ADD COLUMN netsuite_id INT NULL 
    COMMENT 'NetSuite vendor internal ID for integration mapping'
    AFTER archived
    "
    
    execute_sql "$add_column_sql" "Adding netsuite_id column"
    
    # Add index for performance
    local add_index_sql="
    ALTER TABLE Z_VENDOR 
    ADD INDEX idx_netsuite_id (netsuite_id)
    "
    
    execute_sql "$add_index_sql" "Adding index on netsuite_id"
    
    # Add unique constraint
    local add_unique_sql="
    ALTER TABLE Z_VENDOR 
    ADD UNIQUE KEY unique_netsuite_id (netsuite_id)
    "
    
    execute_sql "$add_unique_sql" "Adding unique constraint on netsuite_id"
}

# =============================================================================
# Validation Functions
# =============================================================================

backup_current_state() {
    log "Creating backup of current Z_VENDOR state..."
    
    local backup_file="$TEMP_DIR/z_vendor_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    local backup_sql="
    SELECT 
        id,
        name,
        abrev,
        active,
        archived,
        netsuite_id
    FROM Z_VENDOR 
    WHERE active = 'Y' AND archived = 'N'
    ORDER BY id
    "
    
    if mysql -h "$DB_HOST" -u "$DB_USERNAME" -p"$DB_PASSWORD" -D "$DB_NAME" -e "$backup_sql" > "$backup_file" 2>/dev/null; then
        log_success "Backup created: $backup_file"
    else
        log_warning "Failed to create backup"
    fi
}

validate_updates() {
    log "Validating updates before execution..."
    
    local sql_file="$1"
    local validation_errors=0
    
    # Check for SQL injection attempts
    if grep -i "drop\|delete\|truncate\|alter" "$sql_file" >/dev/null; then
        log_error "Potentially dangerous SQL detected in update file"
        ((validation_errors++))
    fi
    
    # Check for proper WHERE clauses
    if ! grep -q "WHERE id = " "$sql_file"; then
        log_error "Update statements missing proper WHERE clauses"
        ((validation_errors++))
    fi
    
    # Check for active/archived filters
    if ! grep -q "active = 'Y'" "$sql_file"; then
        log_error "Update statements missing active vendor filter"
        ((validation_errors++))
    fi
    
    if [[ $validation_errors -gt 0 ]]; then
        log_error "Validation failed with $validation_errors errors"
        return 1
    fi
    
    log_success "Validation passed"
    return 0
}

# =============================================================================
# Main Execution Functions
# =============================================================================

show_summary() {
    log "=== VENDOR UPDATE SUMMARY ==="
    
    local sql_file="$1"
    local vendor_count=0
    
    if [[ -f "$sql_file" ]]; then
        vendor_count=$(grep -c "UPDATE Z_VENDOR" "$sql_file" 2>/dev/null || echo "0")
    fi
    
    echo "CSV File: $CSV_FILE"
    echo "SQL File: $sql_file"
    echo "Vendors to Update: $vendor_count"
    echo "Database Host: $DB_HOST"
    echo "Dry Run Mode: $DRY_RUN"
    echo "Log File: $LOG_FILE"
    echo "================================"
}

execute_updates() {
    local sql_file="$1"
    
    log "Executing vendor updates..."
    
    # Validate SQL file exists and has content
    if [[ ! -f "$sql_file" ]]; then
        log_error "SQL file not found: $sql_file"
        return 1
    fi
    
    local sql_lines=$(wc -l < "$sql_file")
    if [[ $sql_lines -lt 5 ]]; then
        log_error "SQL file appears to be empty or invalid: $sql_lines lines"
        return 1
    fi
    
    log "SQL file validation passed: $sql_lines lines"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN MODE - No actual updates will be performed"
        log "Would execute the following SQL:"
        echo "----------------------------------------"
        head -20 "$sql_file"
        echo "----------------------------------------"
        return 0
    fi
    
    # Execute the updates
    local error_output="$TEMP_DIR/mysql_errors.log"
    if mysql -h "$DB_HOST" -u "$DB_USERNAME" -p"$DB_PASSWORD" -D "$DB_NAME" < "$sql_file" 2>"$error_output"; then
        log_success "All vendor updates completed successfully"
    else
        log_error "Some vendor updates failed"
        log "MySQL error output:"
        cat "$error_output" | head -20 | while read -r line; do
            log "  $line"
        done
        return 1
    fi
}

verify_updates() {
    log "Verifying updates..."
    
    local verification_sql="
    SELECT 
        COUNT(*) as total_active_vendors,
        COUNT(netsuite_id) as vendors_with_netsuite_id,
        COUNT(*) - COUNT(netsuite_id) as vendors_without_netsuite_id
    FROM Z_VENDOR 
    WHERE active = 'Y' AND archived = 'N'
    "
    
    mysql -h "$DB_HOST" -u "$DB_USERNAME" -p"$DB_PASSWORD" -D "$DB_NAME" -e "$verification_sql" 2>/dev/null | \
    while read -r line; do
        log "Verification: $line"
    done
}

# =============================================================================
# Main Script
# =============================================================================

main() {
    # Parse command line arguments
    if [[ "${1:-}" == "--dry-run" ]]; then
        DRY_RUN=true
        log_warning "DRY RUN MODE ENABLED - No changes will be made"
    fi
    
    # Create temporary directory
    mkdir -p "$TEMP_DIR"
    
    # Initialize log file
    touch "$LOG_FILE"
    
    log "Starting OPMS Vendor NetSuite ID Update Process"
    log "=============================================="
    
    # Step 1: Validate CSV file
    validate_csv_file
    
    # Step 2: Fetch database credentials
    fetch_db_credentials
    
    # Step 3: Test database connection
    test_db_connection
    
    # Step 4: Add netsuite_id column if needed
    add_netsuite_id_column
    
    # Step 5: Process CSV data
    local sql_file
    sql_file=$(process_csv_data)  # Log messages go to stderr, file path to stdout
    
    # Step 6: Show summary
    show_summary "$sql_file"
    
    # Step 7: Validate updates
    if ! validate_updates "$sql_file"; then
        log_error "Update validation failed. Aborting."
        exit 1
    fi
    
    # Step 8: Create additional backup before data updates
    backup_current_state
    
    # Step 9: Execute updates
    execute_updates "$sql_file"
    
    # Step 10: Verify results
    verify_updates
    
    log_success "Vendor update process completed successfully!"
    log "Check log file for details: $LOG_FILE"
}

# Run main function
main "$@"
