/**
 * Create netsuite_import_items table
 * Tracks individual items within import jobs with detailed failure tracking
 */

exports.up = async function(db) {
    const sql = `
        CREATE TABLE IF NOT EXISTS netsuite_import_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            job_id INT NOT NULL,
            
            -- OPMS item identity
            opms_item_id INT NOT NULL,
            opms_item_code VARCHAR(50) NOT NULL,
            
            -- NetSuite results (filled on success)
            netsuite_item_id INT NULL,
            netsuite_internal_id VARCHAR(50) NULL,
            
            -- Status and retry tracking
            status ENUM('pending', 'processing', 'success', 'failed_retryable', 'failed_permanent') DEFAULT 'pending',
            attempt_count INT DEFAULT 0,
            max_retries INT DEFAULT 3,
            
            -- Error information
            last_error_type VARCHAR(100) NULL,
            last_error_message TEXT NULL,
            last_netsuite_response TEXT NULL,
            
            -- Timestamps
            first_attempted_at TIMESTAMP NULL,
            last_attempted_at TIMESTAMP NULL,
            succeeded_at TIMESTAMP NULL,
            
            -- Resume capability
            csv_row_number INT NOT NULL,
            
            -- Foreign key and indices
            FOREIGN KEY (job_id) REFERENCES netsuite_import_jobs(id) ON DELETE CASCADE,
            INDEX idx_job_status (job_id, status),
            INDEX idx_opms_item_code (opms_item_code),
            INDEX idx_attempt_count (attempt_count),
            INDEX idx_csv_row_number (csv_row_number)
            
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Tracks individual items within import jobs with detailed failure tracking';
    `;
    
    await db.query(sql);
    console.log('Created netsuite_import_items table');
};

exports.down = async function(db) {
    const sql = `DROP TABLE IF EXISTS netsuite_import_items;`;
    await db.query(sql);
    console.log('Dropped netsuite_import_items table');
};
