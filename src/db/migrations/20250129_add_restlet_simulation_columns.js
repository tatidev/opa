/**
 * Add RESTlet simulation columns to netsuite_dry_run_sync_log table
 * Stores simulated validation results and mock RESTlet responses
 */

exports.up = async function(db) {
    const sql = `
        ALTER TABLE netsuite_dry_run_sync_log
        ADD COLUMN simulated_restlet_response JSON NULL COMMENT 'Mock RESTlet response based on validation',
        ADD COLUMN simulated_validation_results JSON NULL COMMENT 'Detailed validation check results',
        ADD COLUMN would_succeed BOOLEAN DEFAULT TRUE COMMENT 'Whether the RESTlet would likely succeed',
        ADD COLUMN simulated_errors TEXT NULL COMMENT 'Simulated error messages if validation fails',
        ADD INDEX idx_would_succeed (would_succeed)
    `;
    
    await db.query(sql);
    console.log('✅ Added RESTlet simulation columns to netsuite_dry_run_sync_log table');
};

exports.down = async function(db) {
    const sql = `
        ALTER TABLE netsuite_dry_run_sync_log
        DROP COLUMN simulated_restlet_response,
        DROP COLUMN simulated_validation_results,
        DROP COLUMN would_succeed,
        DROP COLUMN simulated_errors,
        DROP INDEX idx_would_succeed
    `;
    
    await db.query(sql);
    console.log('✅ Removed RESTlet simulation columns from netsuite_dry_run_sync_log table');
};

