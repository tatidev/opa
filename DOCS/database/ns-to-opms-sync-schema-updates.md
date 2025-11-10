# NetSuite-to-OPMS Sync Database Schema Updates

## Applied to Production: October 25, 2025

### Context
During production testing of NetSuite-to-OPMS pricing sync, discovered that production database was missing several columns and tables that exist in DEV. These updates were applied manually to production and need to be incorporated into setup scripts.

---

## Schema Changes Applied

### 1. netsuite_opms_sync_jobs Table - Added Columns

```sql
-- Add columns for webhook tracking
ALTER TABLE netsuite_opms_sync_jobs 
  ADD COLUMN triggered_by VARCHAR(100) DEFAULT 'system' AFTER job_type;

ALTER TABLE netsuite_opms_sync_jobs 
  ADD COLUMN source VARCHAR(100) DEFAULT 'webhook' AFTER triggered_by;

ALTER TABLE netsuite_opms_sync_jobs 
  ADD COLUMN skipped_items INT DEFAULT 0 AFTER failed_items;

ALTER TABLE netsuite_opms_sync_jobs 
  ADD COLUMN duration_seconds INT DEFAULT NULL AFTER completed_at;
```

**Purpose:** Track webhook source, who triggered sync, skipped items, and job duration

---

### 2. netsuite_opms_sync_items Table - Added Columns

```sql
-- Add columns for pricing comparison and retry logic
ALTER TABLE netsuite_opms_sync_items 
  ADD COLUMN pricing_before JSON COMMENT 'Pricing values before sync' AFTER pricing_data;

ALTER TABLE netsuite_opms_sync_items 
  ADD COLUMN pricing_after JSON COMMENT 'Pricing values after sync' AFTER pricing_before;

ALTER TABLE netsuite_opms_sync_items 
  ADD COLUMN retry_count INT NOT NULL DEFAULT 0 AFTER error_message;

ALTER TABLE netsuite_opms_sync_items 
  ADD COLUMN max_retries INT NOT NULL DEFAULT 3 AFTER retry_count;
```

**Purpose:** Track pricing changes and implement retry logic for failed syncs

---

### 3. netsuite_opms_sync_config Table - Created

```sql
CREATE TABLE IF NOT EXISTS netsuite_opms_sync_config (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_config_key (config_key)
) ENGINE=InnoDB 
COMMENT='Configuration settings for NetSuite to OPMS sync';
```

**Purpose:** Store sync configuration settings (webhooks, retry limits, etc.)

---

### 4. netsuite_opms_sync_logs Table - Created

```sql
CREATE TABLE IF NOT EXISTS netsuite_opms_sync_logs (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sync_job_id INT,
  sync_item_id INT,
  log_level ENUM('debug','info','warn','error') NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  details JSON,
  context VARCHAR(100),
  netsuite_item_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sync_job_id (sync_job_id),
  INDEX idx_sync_item_id (sync_item_id),
  INDEX idx_log_level (log_level),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB 
COMMENT='Detailed logs for sync operations and debugging';
```

**Purpose:** Detailed audit trail of sync operations for debugging and monitoring

---

## Action Items

### For Future Deployments

1. **Update Setup Scripts:**
   - Add these schema changes to appropriate setup SQL files
   - Ensure DEV and PROD schemas stay in sync

2. **Recommended Setup Script:**
   - Create `src/db/setup-netsuite-to-opms-sync.sql` with complete schema
   - Include in deployment documentation

3. **Schema Validation:**
   - Add schema validation checks to deployment scripts
   - Compare DEV vs PROD schemas before deployment

---

## Verification Queries

Run these on any environment to verify NS-to-OPMS sync schema is complete:

```sql
-- Check all required tables exist
SELECT TABLE_NAME, TABLE_ROWS
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME LIKE 'netsuite_opms_sync%';
-- Expected: 4 tables (jobs, items, config, logs)

-- Check netsuite_opms_sync_jobs has all columns
SELECT COLUMN_NAME 
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'netsuite_opms_sync_jobs'
ORDER BY ORDINAL_POSITION;
-- Expected columns: id, job_type, triggered_by, source, status, total_items,
--   processed_items, successful_items, failed_items, skipped_items, 
--   started_at, completed_at, duration_seconds, error_message, created_at, updated_at

-- Check netsuite_opms_sync_items has all columns
SELECT COLUMN_NAME 
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'netsuite_opms_sync_items'
ORDER BY ORDINAL_POSITION;
-- Expected columns: id, sync_job_id, netsuite_item_id, netsuite_internal_id,
--   opms_item_id, opms_product_id, item_code, status, sync_fields, pricing_data,
--   pricing_before, pricing_after, error_message, retry_count, max_retries,
--   skip_reason, processed_at, created_at, updated_at
```

---

## Testing Verification

After applying these changes, verify NS-to-OPMS sync works:

```bash
# Test webhook endpoint
curl -X POST https://api.opuzen-service.com/api/ns-to-opms/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <secret>" \
  -d '{
    "eventType": "item.pricing.updated",
    "itemData": {
      "itemid": "TEST-ITEM",
      "price_1_": 100.00,
      "custitemf3_lisa_item": false
    },
    "timestamp": "2025-10-25T00:00:00Z",
    "source": "test"
  }'

# Expected response:
# {"success": true, "message": "Webhook processed successfully", ...}
```

---

## Notes

- All changes were applied to production on October 25, 2025
- Tested and verified working with item 3600-0002
- Pricing successfully synced: $135.00 → $137.00
- No code changes required - schema updates only

