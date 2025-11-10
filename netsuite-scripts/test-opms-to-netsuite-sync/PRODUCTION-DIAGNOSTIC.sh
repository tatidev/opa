#!/bin/bash

###############################################################################
# PRODUCTION DIAGNOSTIC SCRIPT
# Run this on EC2 production instance to diagnose Product 7797 sync issue
###############################################################################

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  PRODUCTION OPMS-to-NetSuite Sync Diagnostic                  ║"
echo "║  Product 7797 Investigation                                   ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Change to application directory
cd /home/ubuntu/opuzen-api || cd /var/www/opuzen-api || {
    echo -e "${RED}❌ Could not find application directory${NC}"
    exit 1
}

echo -e "${CYAN}Current directory: $(pwd)${NC}"
echo ""

# Check environment
echo -e "${CYAN}=== ENVIRONMENT CHECK ===${NC}"
echo "NODE_ENV: ${NODE_ENV:-not set}"
echo "Database: ${DB_NAME:-not set}"
echo ""

# Check PM2 process
echo -e "${CYAN}=== PM2 PROCESS STATUS ===${NC}"
pm2 list | grep opuzen || echo -e "${YELLOW}No PM2 process named 'opuzen' found${NC}"
echo ""

# Run Node diagnostic for Product 7797
echo -e "${CYAN}=== CHECKING PRODUCT 7797 ===${NC}"
echo ""

node -e "
const db = require('./src/config/database');

(async () => {
    try {
        // Show which database we're connected to
        const [dbInfo] = await db.query('SELECT DATABASE() as db_name, @@hostname as host');
        console.log('Connected to database:', dbInfo[0].db_name);
        console.log('MySQL host:', dbInfo[0].host);
        console.log('');
        
        // Check Product 7797
        const [product] = await db.query(\`
            SELECT id, name, date_modif, archived
            FROM T_PRODUCT 
            WHERE id = 7797
        \`);
        
        if (product.length === 0) {
            console.log('❌ Product 7797 NOT FOUND');
            
            // Show max product ID
            const [maxId] = await db.query('SELECT MAX(id) as max_id FROM T_PRODUCT');
            console.log('Highest product ID:', maxId[0].max_id);
            console.log('');
            
            // Show recent changes
            const [recent] = await db.query(\`
                SELECT id, name, date_modif
                FROM T_PRODUCT
                WHERE date_modif > DATE_SUB(NOW(), INTERVAL 1 HOUR)
                ORDER BY date_modif DESC
                LIMIT 10
            \`);
            
            if (recent.length > 0) {
                console.log('Products modified in last hour:');
                recent.forEach(p => {
                    const mins = Math.floor((new Date() - new Date(p.date_modif)) / 60000);
                    console.log(\`  \${p.id}: \"\${p.name}\" (\${mins} mins ago)\`);
                });
            } else {
                console.log('⚠️  No products modified in last hour');
            }
        } else {
            const p = product[0];
            const mins = Math.floor((new Date() - new Date(p.date_modif)) / 60000);
            console.log('✓ Product 7797 found:');
            console.log(\`  Name: \"\${p.name}\"\`);
            console.log(\`  Modified: \${p.date_modif} (\${mins} minutes ago)\`);
            console.log(\`  Archived: \${p.archived}\`);
            console.log('');
            
            // Check items
            const [items] = await db.query(\`
                SELECT id, code
                FROM T_ITEM
                WHERE product_id = 7797
                  AND archived = 'N'
                  AND code IS NOT NULL
                  AND code != ''
            \`);
            
            console.log(\`Active items: \${items.length}\`);
            if (items.length > 0) {
                items.slice(0, 3).forEach(i => console.log(\`  - Item \${i.id}: \${i.code}\`));
                if (items.length > 3) console.log(\`  ... and \${items.length - 3} more\`);
            }
            console.log('');
            
            // Check debounce table
            const [debounce] = await db.query(\`
                SELECT item_id, last_change_at, change_count, pending_fields
                FROM opms_sync_debounce
                WHERE product_id = 7797
            \`);
            
            console.log('Debounce entries:', debounce.length);
            if (debounce.length > 0) {
                debounce.forEach(d => {
                    const mins = Math.floor((new Date() - new Date(d.last_change_at)) / 60000);
                    console.log(\`  Item \${d.item_id}: \${d.change_count} changes, \${mins} mins ago\`);
                });
            } else {
                console.log('  ❌ NO debounce entries - trigger may not have fired');
            }
            console.log('');
            
            // Check sync queue
            const [queue] = await db.query(\`
                SELECT id, item_id, status, created_at
                FROM opms_sync_queue
                WHERE product_id = 7797
                ORDER BY created_at DESC
                LIMIT 5
            \`);
            
            console.log('Sync queue entries:', queue.length);
            if (queue.length > 0) {
                queue.forEach(q => {
                    const mins = Math.floor((new Date() - new Date(q.created_at)) / 60000);
                    console.log(\`  Job \${q.id}: Item \${q.item_id}, Status: \${q.status}, \${mins} mins ago\`);
                });
            } else {
                console.log('  ❌ NO sync queue entries');
            }
        }
        
        process.exit(0);
    } catch (error) {
        console.error('ERROR:', error.message);
        process.exit(1);
    }
})();
"

echo ""
echo -e "${CYAN}=== DEBOUNCE TABLE STATUS ===${NC}"
echo "Checking all pending debounce entries..."
echo ""

node -e "
const db = require('./src/config/database');
(async () => {
    const [total] = await db.query('SELECT COUNT(*) as count FROM opms_sync_debounce');
    console.log('Total debounce entries:', total[0].count);
    
    if (total[0].count > 0) {
        const [oldest] = await db.query('SELECT MIN(created_at) as oldest FROM opms_sync_debounce');
        const [newest] = await db.query('SELECT MAX(last_change_at) as newest FROM opms_sync_debounce');
        console.log('Oldest entry:', oldest[0].oldest);
        console.log('Newest change:', newest[0].newest);
        console.log('');
        console.log('⚠️  DEBOUNCE PROCESSOR IS NOT RUNNING!');
        console.log('   Changes are stuck in debounce table');
    }
    process.exit(0);
})();
"

echo ""
echo -e "${CYAN}=== SYNC SERVICE LOGS ===${NC}"
echo "Last 20 lines from PM2 logs:"
echo ""
pm2 logs opuzen-api --lines 20 --nostream 2>/dev/null || echo -e "${YELLOW}Could not retrieve PM2 logs${NC}"

echo ""
echo -e "${CYAN}=== RECOMMENDATIONS ===${NC}"
echo ""
echo "To manually trigger sync for Product 7797:"
echo -e "${GREEN}curl -X POST http://localhost:3000/api/opms-sync/trigger-product/7797${NC}"
echo ""
echo "To check sync service status:"
echo -e "${GREEN}curl http://localhost:3000/api/opms-sync/status | jq .${NC}"
echo ""
echo "To restart sync service:"
echo -e "${GREEN}pm2 restart opuzen-api${NC}"
echo ""

