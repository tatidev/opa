/**
 * Create netsuite_dry_run_sync_log table
 * Stores actual JSON payloads from dry-run sync operations for analysis and debugging
 */

exports.up = async function(db) {
    const sql = `
        CREATE TABLE IF NOT EXISTS netsuite_dry_run_sync_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            
            -- Item identification
            opms_item_id INT NOT NULL,
            opms_item_code VARCHAR(50) NOT NULL,
            opms_product_id INT NOT NULL,
            
            -- Sync context
            sync_type ENUM('item_sync', 'product_sync', 'batch_sync', 'manual_test') DEFAULT 'item_sync',
            sync_trigger VARCHAR(100) NULL COMMENT 'What triggered this sync (price_change, manual, etc.)',
            
            -- Actual JSON payload (the real data that would be sent to NetSuite)
            actual_json_payload JSON NOT NULL COMMENT 'Complete JSON payload that would be sent to NetSuite RESTlet',
            
            -- Metadata
            payload_size_bytes INT NOT NULL COMMENT 'Size of JSON payload in bytes',
            field_count INT NOT NULL COMMENT 'Number of fields in the payload',
            
            -- Validation results
            validation_status ENUM('passed', 'failed', 'partial') DEFAULT 'passed',
            validation_errors TEXT NULL COMMENT 'Any validation issues found',
            
            -- Timestamps
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            -- Indexes for performance
            INDEX idx_opms_item_id (opms_item_id),
            INDEX idx_opms_item_code (opms_item_code),
            INDEX idx_opms_product_id (opms_product_id),
            INDEX idx_sync_type (sync_type),
            INDEX idx_created_at (created_at),
            INDEX idx_validation_status (validation_status)
            
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Stores actual JSON payloads from dry-run sync operations for analysis and debugging';
    `;
    
    await db.query(sql);
    console.log('Created netsuite_dry_run_sync_log table');
};

exports.down = async function(db) {
    const sql = `DROP TABLE IF EXISTS netsuite_dry_run_sync_log;`;
    await db.query(sql);
    console.log('Dropped netsuite_dry_run_sync_log table');
};
