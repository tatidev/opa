#!/usr/bin/env node

/**
 * Migration Runner for Dry Run Sync Log Table
 * Creates the netsuite_dry_run_sync_log table in local dev database
 */

const db = require('../index');
const logger = require('../../utils/logger');

async function runMigration() {
    try {
        logger.info('🚀 Starting dry-run sync log table migration...');
        
        // Initialize database connection
        await db.initialize();
        logger.info('✅ Database connection established');

        // Run the migration
        const migration = require('./20250120_create_dry_run_sync_log');
        await migration.up(db);
        
        logger.info('✅ Migration completed successfully');
        
        // Verify table was created
        const tableCheck = await db.query(`
            SELECT TABLE_NAME, TABLE_ROWS, CREATE_TIME
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'netsuite_dry_run_sync_log'
        `);
        
        if (tableCheck.length > 0) {
            logger.info('✅ Table verification successful:', tableCheck[0]);
        } else {
            logger.error('❌ Table verification failed - table not found');
        }

        // Show table structure
        const structure = await db.query(`
            DESCRIBE netsuite_dry_run_sync_log
        `);
        
        logger.info('📋 Table structure:');
        console.table(structure);

    } catch (error) {
        logger.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await db.end();
        logger.info('🔌 Database connection closed');
        process.exit(0);
    }
}

// Run migration if this script is executed directly
if (require.main === module) {
    runMigration();
}

module.exports = runMigration;
