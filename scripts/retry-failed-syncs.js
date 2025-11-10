#!/usr/bin/env node
/**
 * Retry Failed Sync Jobs
 * 
 * Resets FAILED jobs back to PENDING status so they can be retried.
 * Useful for resetting jobs that failed due to a bug that has been fixed.
 * 
 * Usage:
 *   node scripts/retry-failed-syncs.js [error_pattern]
 * 
 * Examples:
 *   node scripts/retry-failed-syncs.js colorInfo    # Retry all colorInfo failures
 *   node scripts/retry-failed-syncs.js              # Retry ALL failed jobs
 */

require('dotenv').config();
const db = require('../src/config/database');
const logger = require('../src/utils/logger');

async function retryFailedSyncs() {
    const errorPattern = process.argv[2] || '%'; // Default: all failures
    
    try {
        console.log('🔄 Retrying Failed Sync Jobs');
        console.log('============================');
        console.log(`Error Pattern: ${errorPattern === '%' ? 'ALL' : errorPattern}`);
        console.log('');
        
        // Count failed jobs matching pattern
        console.log('=== Counting Failed Jobs ===');
        const [countResult] = await db.query(`
            SELECT COUNT(*) as failed_count
            FROM opms_sync_queue
            WHERE status = 'FAILED'
            AND error_message LIKE ?
        `, [`%${errorPattern}%`]);
        
        const failedCount = countResult[0].failed_count;
        console.log(`Found ${failedCount} failed jobs matching pattern`);
        console.log('');
        
        if (failedCount === 0) {
            console.log('✅ No failed jobs to retry');
            process.exit(0);
        }
        
        // Show sample of jobs to be reset
        console.log('=== Sample Jobs to be Reset (first 5) ===');
        const [sampleJobs] = await db.query(`
            SELECT id, item_id, retry_count, 
                   SUBSTRING(error_message, 1, 80) as error_preview
            FROM opms_sync_queue
            WHERE status = 'FAILED'
            AND error_message LIKE ?
            LIMIT 5
        `, [`%${errorPattern}%`]);
        
        sampleJobs.forEach(job => {
            console.log(`Job ${job.id}: Item ${job.item_id}, Retries: ${job.retry_count}`);
            console.log(`  Error: ${job.error_preview}...`);
        });
        console.log('');
        
        // Reset jobs to PENDING
        console.log('=== Resetting Failed Jobs to PENDING ===');
        const [updateResult] = await db.query(`
            UPDATE opms_sync_queue
            SET 
                status = 'PENDING',
                retry_count = 0,
                error_message = NULL,
                processed_at = NULL
            WHERE status = 'FAILED'
            AND error_message LIKE ?
        `, [`%${errorPattern}%`]);
        
        console.log(`✅ Reset ${updateResult.affectedRows} jobs to PENDING`);
        console.log('');
        
        // Verify new state
        console.log('=== Queue Status After Reset ===');
        const [statusResult] = await db.query(`
            SELECT 
                status, 
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM opms_sync_queue), 2) as percentage
            FROM opms_sync_queue
            GROUP BY status
            ORDER BY status
        `);
        
        statusResult.forEach(row => {
            console.log(`${row.status}: ${row.count} (${row.percentage}%)`);
        });
        console.log('');
        
        console.log('✅ Jobs reset successfully!');
        console.log('📊 The sync queue will automatically process them');
        console.log(`⏱️  Estimated processing time: ${Math.ceil(failedCount / 10 / 60)} minutes (at 10 req/sec)`);
        
        await db.end();
        process.exit(0);
        
    } catch (error) {
        logger.error('Failed to retry sync jobs:', error);
        console.error('❌ Error:', error.message);
        await db.end();
        process.exit(1);
    }
}

retryFailedSyncs();

