#!/usr/bin/env node

/**
 * Simple Migration Runner for Dry Run Sync Log Table
 * Creates the netsuite_dry_run_sync_log table in local dev database
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function runMigration() {
    let connection;
    
    try {
        console.log('🚀 Starting dry-run sync log table migration...');
        
        // Create database connection using local .env config
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'opuzen_loc_master_app'
        });
        
        console.log('✅ Database connection established');
        console.log(`📊 Connected to database: ${process.env.DB_NAME}`);

        // Create the table
        const createTableSQL = `
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

        await connection.execute(createTableSQL);
        console.log('✅ Table created successfully');

        // Verify table was created
        const [tables] = await connection.execute(`
            SELECT TABLE_NAME, TABLE_ROWS, CREATE_TIME
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'netsuite_dry_run_sync_log'
        `);
        
        if (tables.length > 0) {
            console.log('✅ Table verification successful:');
            console.table(tables);
        } else {
            console.error('❌ Table verification failed - table not found');
        }

        // Show table structure
        const [structure] = await connection.execute(`
            DESCRIBE netsuite_dry_run_sync_log
        `);
        
        console.log('📋 Table structure:');
        console.table(structure);

        console.log('🎉 Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed');
        }
        process.exit(0);
    }
}

// Run migration if this script is executed directly
if (require.main === module) {
    runMigration();
}

module.exports = runMigration;
