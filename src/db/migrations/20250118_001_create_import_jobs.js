/**
 * Create netsuite_import_jobs table
 * Tracks bulk import jobs with status and progress counters
 */

exports.up = async function(db) {
    const sql = `
        CREATE TABLE IF NOT EXISTS netsuite_import_jobs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            job_uuid VARCHAR(36) UNIQUE NOT NULL,
            original_filename VARCHAR(255) NOT NULL,
            total_items INT NOT NULL,
            status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
            
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            started_at TIMESTAMP NULL,
            completed_at TIMESTAMP NULL,
            created_by_user_id INT NULL,
            
            -- Summary counters (updated as job progresses)
            items_processed INT DEFAULT 0,
            items_succeeded INT DEFAULT 0,
            items_failed_permanent INT DEFAULT 0,
            items_failed_retryable INT DEFAULT 0,
            
            -- Indices for performance
            INDEX idx_status (status),
            INDEX idx_created_at (created_at),
            INDEX idx_created_by_user_id (created_by_user_id)
            
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Tracks bulk import jobs with status and progress counters';
    `;
    
    await db.query(sql);
    console.log('Created netsuite_import_jobs table');
};

exports.down = async function(db) {
    const sql = `DROP TABLE IF EXISTS netsuite_import_jobs;`;
    await db.query(sql);
    console.log('Dropped netsuite_import_jobs table');
};
