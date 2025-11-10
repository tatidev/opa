#!/bin/bash

# OPMS-NetSuite Sync Health Check Script
# Usage: ./scripts/sync-health-check.sh

set -e

echo "🔍 OPMS-NetSuite Sync Health Check"
echo "=================================="
echo "Timestamp: $(date)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server is running
echo "1. Checking if API server is running..."
if pgrep -f "node src/index.js" > /dev/null; then
    echo -e "${GREEN}✅ API server is running${NC}"
else
    echo -e "${RED}❌ API server is NOT running${NC}"
    echo "   Action: Run 'npm start' to start the server"
    exit 1
fi

# Check health endpoint
echo ""
echo "2. Checking API health endpoint..."
if curl -s -f http://localhost:3000/health > /dev/null; then
    HEALTH_STATUS=$(curl -s http://localhost:3000/health | jq -r '.status' 2>/dev/null || echo "unknown")
    if [ "$HEALTH_STATUS" = "healthy" ]; then
        echo -e "${GREEN}✅ API health: $HEALTH_STATUS${NC}"
    else
        echo -e "${YELLOW}⚠️  API health: $HEALTH_STATUS${NC}"
    fi
else
    echo -e "${RED}❌ API health endpoint not responding${NC}"
    exit 1
fi

# Check for critical null job processing issue
echo ""
echo "3. Checking for null job processing (critical issue)..."
SYNC_STATUS=$(curl -s http://localhost:3000/api/opms-sync/status 2>/dev/null || echo "{}")
if echo "$SYNC_STATUS" | grep -q '"jobIds":\[null'; then
    echo -e "${RED}❌ CRITICAL: Null job processing detected!${NC}"
    echo "   This is the exact issue we just fixed"
    echo "   Action: Restart the sync service immediately"
    echo "   Command: pkill -f 'node src/index.js' && npm start"
    exit 1
else
    echo -e "${GREEN}✅ No null job processing detected${NC}"
fi

# Check sync service status
echo ""
echo "4. Checking sync service status..."
if echo "$SYNC_STATUS" | jq -e '.isInitialized' > /dev/null 2>&1; then
    IS_INITIALIZED=$(echo "$SYNC_STATUS" | jq -r '.isInitialized')
    IS_RUNNING=$(echo "$SYNC_STATUS" | jq -r '.isRunning')
    
    if [ "$IS_INITIALIZED" = "true" ] && [ "$IS_RUNNING" = "true" ]; then
        echo -e "${GREEN}✅ Sync service is initialized and running${NC}"
    else
        echo -e "${YELLOW}⚠️  Sync service status: initialized=$IS_INITIALIZED, running=$IS_RUNNING${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Could not determine sync service status${NC}"
fi

# Check queue status (if database is accessible)
echo ""
echo "5. Checking queue status..."
if command -v mysql > /dev/null && [ -n "$DB_USER" ] && [ -n "$DB_PASS" ] && [ -n "$DB_NAME" ]; then
    QUEUE_STATS=$(mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END) as processing,
            SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
        FROM opms_sync_queue;
    " 2>/dev/null || echo "")
    
    if [ -n "$QUEUE_STATS" ]; then
        echo "$QUEUE_STATS"
        
        # Check for stuck jobs
        STUCK_JOBS=$(mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
            SELECT COUNT(*) as stuck_count
            FROM opms_sync_queue 
            WHERE status = 'PROCESSING' 
              AND TIMESTAMPDIFF(MINUTE, created_at, NOW()) > 5;
        " 2>/dev/null | tail -n 1 || echo "0")
        
        if [ "$STUCK_JOBS" -gt 0 ]; then
            echo -e "${YELLOW}⚠️  Found $STUCK_JOBS jobs stuck in PROCESSING for >5 minutes${NC}"
        else
            echo -e "${GREEN}✅ No stuck jobs detected${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Could not access database to check queue${NC}"
        echo "   Set DB_USER, DB_PASS, DB_NAME environment variables for queue checking"
    fi
else
    echo -e "${YELLOW}⚠️  MySQL not available or database credentials not set${NC}"
    echo "   Install mysql client and set DB_USER, DB_PASS, DB_NAME for queue checking"
fi

# Success summary
echo ""
echo "=================================="
echo -e "${GREEN}🎉 Health check completed successfully!${NC}"
echo ""
echo "Quick commands for troubleshooting:"
echo "  - Check sync status: curl -s http://localhost:3000/api/opms-sync/status | jq ."
echo "  - Restart service: pkill -f 'node src/index.js' && npm start"
echo "  - View logs: tail -f server.log"
echo ""
echo "For detailed troubleshooting, see: DOCS/ai-specs/sync-debugging-prevention-guide.md"
