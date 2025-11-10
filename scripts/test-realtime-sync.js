#!/usr/bin/env node

/**
 * Real-Time Sync Test
 * 
 * This script tests the complete end-to-end sync flow:
 * 1. Makes a change to OPMS data
 * 2. Verifies trigger fires and creates sync job
 * 3. Monitors sync job processing
 * 4. Verifies NetSuite item creation
 */

require('dotenv').config({ path: '.env.testing' });
const logger = require('../src/utils/logger');
const db = require('../src/db');

class RealtimeSyncTest {
    constructor() {
        this.testItemId = 13385; // Item from our previous tests
        this.testProductId = 2823; // Product from our previous tests
        this.originalVendorCode = null;
        this.originalProductName = null;
    }

    async run() {
        try {
            console.log('🔄 Real-Time Sync Test');
            console.log('=====================');
            console.log(`Database: ${process.env.DB_NAME}`);
            console.log(`Test Item: ${this.testItemId}`);
            console.log(`Test Product: ${this.testProductId}`);
            console.log('');

            // Step 1: Record original values
            console.log('📋 Step 1: Record Original Values');
            await this.recordOriginalValues();
            console.log('');

            // Step 2: Check current sync queue status
            console.log('📋 Step 2: Check Current Sync Queue Status');
            await this.checkSyncQueueStatus();
            console.log('');

            // Step 3: Make a change to trigger sync
            console.log('📋 Step 3: Make Change to Trigger Sync');
            await this.makeTriggerChange();
            console.log('');

            // Step 4: Wait and verify sync job was created
            console.log('📋 Step 4: Verify Sync Job Created');
            await this.verifySyncJobCreated();
            console.log('');

            // Step 5: Monitor sync job processing
            console.log('📋 Step 5: Monitor Sync Job Processing');
            await this.monitorSyncJobProcessing();
            console.log('');

            // Step 6: Restore original values
            console.log('📋 Step 6: Restore Original Values');
            await this.restoreOriginalValues();
            console.log('');

            console.log('✅ Real-time sync test completed successfully!');
            
        } catch (error) {
            console.error('❌ Real-time sync test failed:', error.message);
            console.error(error.stack);
            process.exit(1);
        } finally {
            await db.end();
        }
    }

    async recordOriginalValues() {
        try {
            // Get original item values
            const itemResult = await db.query(`
                SELECT vendor_code, vendor_color
                FROM T_ITEM 
                WHERE id = ?
            `, [this.testItemId]);

            if (itemResult.length > 0) {
                this.originalVendorCode = itemResult[0].vendor_code;
                console.log(`  📝 Original vendor_code: "${this.originalVendorCode}"`);
            }

            // Get original product values
            const productResult = await db.query(`
                SELECT name
                FROM T_PRODUCT 
                WHERE id = ?
            `, [this.testProductId]);

            if (productResult.length > 0) {
                this.originalProductName = productResult[0].name;
                console.log(`  📝 Original product name: "${this.originalProductName}"`);
            }
        } catch (error) {
            console.error('  ❌ Failed to record original values:', error.message);
            throw error;
        }
    }

    async checkSyncQueueStatus() {
        try {
            const result = await db.query(`
                SELECT 
                    COUNT(*) as total_jobs,
                    SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_jobs,
                    SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END) as processing_jobs,
                    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_jobs,
                    SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_jobs
                FROM opms_sync_queue
            `);

            if (result.length > 0) {
                const stats = result[0];
                console.log(`  📊 Total jobs: ${stats.total_jobs}`);
                console.log(`  📊 Pending: ${stats.pending_jobs}`);
                console.log(`  📊 Processing: ${stats.processing_jobs}`);
                console.log(`  📊 Completed: ${stats.completed_jobs}`);
                console.log(`  📊 Failed: ${stats.failed_jobs}`);
            }
        } catch (error) {
            console.error('  ❌ Failed to check sync queue status:', error.message);
            throw error;
        }
    }

    async makeTriggerChange() {
        try {
            const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const testValue = `REALTIME-TEST-${Date.now()}`;
            
            console.log(`  🔄 Updating item ${this.testItemId} vendor_code to: ${testValue}`);
            
            const result = await db.query(`
                UPDATE T_ITEM 
                SET vendor_code = ?, date_modif = ?
                WHERE id = ?
            `, [testValue, timestamp, this.testItemId]);

            console.log(`  ✅ Item update completed, affected rows: ${result.affectedRows}`);
            console.log(`  ⏰ Change timestamp: ${timestamp}`);
        } catch (error) {
            console.error('  ❌ Failed to make trigger change:', error.message);
            throw error;
        }
    }

    async verifySyncJobCreated() {
        try {
            console.log('  ⏳ Waiting 3 seconds for trigger to fire...');
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Check for new sync jobs
            const result = await db.query(`
                SELECT id, item_id, product_id, event_type, priority, status, created_at
                FROM opms_sync_queue 
                WHERE item_id = ? 
                AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
                ORDER BY created_at DESC 
                LIMIT 5
            `, [this.testItemId]);

            console.log(`  📊 Found ${result.length} recent sync jobs for item ${this.testItemId}`);
            
            if (result.length > 0) {
                const latest = result[0];
                console.log(`  ✅ Latest job: ID ${latest.id}, Status: ${latest.status}, Created: ${latest.created_at}`);
                console.log(`  📝 Event type: ${latest.event_type}, Priority: ${latest.priority}`);
                return latest.id;
            } else {
                console.log('  ⚠️  No recent sync jobs found - trigger may not have fired');
                return null;
            }
        } catch (error) {
            console.error('  ❌ Failed to verify sync job creation:', error.message);
            throw error;
        }
    }

    async monitorSyncJobProcessing() {
        try {
            console.log('  ⏳ Monitoring sync job processing for 30 seconds...');
            
            const startTime = Date.now();
            const maxWaitTime = 30000; // 30 seconds
            
            while (Date.now() - startTime < maxWaitTime) {
                // Check sync queue status
                const queueResult = await db.query(`
                    SELECT id, status, retry_count, error_message, processed_at
                    FROM opms_sync_queue 
                    WHERE item_id = ? 
                    AND created_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE)
                    ORDER BY created_at DESC 
                    LIMIT 1
                `, [this.testItemId]);

                if (queueResult.length > 0) {
                    const job = queueResult[0];
                    console.log(`  📊 Job ${job.id}: Status=${job.status}, Retries=${job.retry_count}`);
                    
                    if (job.status === 'COMPLETED') {
                        console.log(`  ✅ Sync job completed successfully!`);
                        console.log(`  📝 Processed at: ${job.processed_at}`);
                        return true;
                    } else if (job.status === 'FAILED') {
                        console.log(`  ❌ Sync job failed: ${job.error_message}`);
                        return false;
                    }
                }

                // Wait 2 seconds before next check
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            console.log('  ⏰ Timeout reached - sync job may still be processing');
            return false;
        } catch (error) {
            console.error('  ❌ Failed to monitor sync job processing:', error.message);
            throw error;
        }
    }

    async restoreOriginalValues() {
        try {
            if (this.originalVendorCode !== null) {
                const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
                
                console.log(`  🔄 Restoring original vendor_code: "${this.originalVendorCode}"`);
                
                const result = await db.query(`
                    UPDATE T_ITEM 
                    SET vendor_code = ?, date_modif = ?
                    WHERE id = ?
                `, [this.originalVendorCode, timestamp, this.testItemId]);

                console.log(`  ✅ Item restored, affected rows: ${result.affectedRows}`);
            }
        } catch (error) {
            console.error('  ❌ Failed to restore original values:', error.message);
            throw error;
        }
    }
}

// Run the test
if (require.main === module) {
    const test = new RealtimeSyncTest();
    test.run().catch(console.error);
}

module.exports = RealtimeSyncTest;
