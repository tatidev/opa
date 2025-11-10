#!/bin/bash

###############################################################################
# Restart Vendor Matching - Fabric Suppliers Only
#
# This script re-runs the complete vendor matching process after deploying
# the updated RESTlet that filters for "Fabric Supplier" category only.
#
# Prerequisites:
# 1. VendorListRestlet.js has been updated and deployed to NetSuite
# 2. RESTlet is filtering by category = "Fabric Supplier"
# 3. NetSuite OAuth credentials are valid
#
# Usage: ./scripts/restart-vendor-matching-fabric-suppliers.sh
###############################################################################

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Restart Vendor Matching - Fabric Suppliers Only             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Confirm with user
echo -e "${YELLOW}⚠️  This will:${NC}"
echo "  1. Backup old vendor matching results"
echo "  2. Extract fresh vendor list from NetSuite (Fabric Suppliers only)"
echo "  3. Populate netsuite_vendors_reference table"
echo "  4. Run diagnostic analysis"
echo "  5. Run smart matching algorithm (Phases 1-3)"
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will replace all existing vendor matching data!${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${RED}❌ Aborted by user${NC}"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENDOR_EXTRACTION_DIR="$PROJECT_DIR/DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction"

echo -e "${BLUE}📂 Project directory: $PROJECT_DIR${NC}"
echo ""

###############################################################################
# Step 1: Backup old results
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Backup old vendor matching results${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -d "$VENDOR_EXTRACTION_DIR/vendor-matching" ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_DIR="$VENDOR_EXTRACTION_DIR/vendor-matching-BACKUP-all-vendors-$TIMESTAMP"
    
    echo "Creating backup: $BACKUP_DIR"
    mv "$VENDOR_EXTRACTION_DIR/vendor-matching" "$BACKUP_DIR"
    echo -e "${GREEN}✅ Backup created${NC}"
else
    echo "No existing vendor-matching directory found. Skipping backup."
fi

echo ""

###############################################################################
# Step 2: Test NetSuite connection
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Test NetSuite connection${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd "$PROJECT_DIR"

if node scripts/test-netsuite-production-connection.js; then
    echo -e "${GREEN}✅ NetSuite connection successful${NC}"
else
    echo -e "${RED}❌ NetSuite connection failed${NC}"
    echo -e "${RED}Please check your OAuth credentials and RESTlet deployment${NC}"
    exit 1
fi

echo ""

###############################################################################
# Step 3: Extract fresh vendor list
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Extract fresh vendor list from NetSuite${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if node scripts/extract-vendors-via-restlet-prod.js; then
    echo -e "${GREEN}✅ Vendor extraction complete${NC}"
else
    echo -e "${RED}❌ Vendor extraction failed${NC}"
    exit 1
fi

echo ""

###############################################################################
# Step 4: Populate reference table
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 4: Populate netsuite_vendors_reference table${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if node scripts/populate-netsuite-vendors-reference.js; then
    echo -e "${GREEN}✅ Reference table populated${NC}"
else
    echo -e "${RED}❌ Reference table population failed${NC}"
    exit 1
fi

echo ""

###############################################################################
# Step 5: Run diagnostics
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 5: Run diagnostic analysis${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if node scripts/diagnose-vendor-mapping.js; then
    echo -e "${GREEN}✅ Diagnostics complete${NC}"
else
    echo -e "${RED}❌ Diagnostics failed${NC}"
    exit 1
fi

echo ""

###############################################################################
# Step 6: Run smart matching (Phases 1-3)
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 6: Run smart matching algorithm${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if node scripts/smart-vendor-matching-phase3.js; then
    echo -e "${GREEN}✅ Smart matching complete${NC}"
else
    echo -e "${RED}❌ Smart matching failed${NC}"
    exit 1
fi

echo ""

###############################################################################
# Step 7: Display summary
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 7: Display summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

node scripts/diagnose-vendor-mapping.js 2>&1 | grep -A 30 "SUMMARY STATISTICS" || true

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   ✅ Vendor Matching Restart Complete!                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}📁 Results Location:${NC}"
echo "   $VENDOR_EXTRACTION_DIR/vendor-matching/"
echo ""
echo -e "${GREEN}📋 Next Steps:${NC}"
echo "   1. Review vendor-matching/csv/tier2-vendor-approvals.csv"
echo "   2. Check vendor-matching/reports/tier4-no-match-vendors.md"
echo "   3. Review vendor-matching/README.md for complete guide"
echo ""
echo -e "${YELLOW}⚠️  Old results backed up to:${NC}"
echo "   vendor-matching-BACKUP-all-vendors-*"
echo ""

