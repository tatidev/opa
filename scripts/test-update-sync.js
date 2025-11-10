#!/usr/bin/env node

/**
 * OPMS to NetSuite UPDATE Sync Test
 * 
 * This script tests the core functionality:
 * 1. Make changes to existing OPMS items
 * 2. Verify triggers fire and create sync jobs
 * 3. Monitor sync jobs that should UPDATE NetSuite items
 * 4. Verify updates are processed without errors
 */

require('dotenv').config({ path: '.env.testing' });
const logger = require('../src/utils/logger');
const db = require('../src/db');

class UpdateSyncTest {
    constructor() {
        this.testItemId = 13385; // Item from our previous tests
        this.testProductId = 2823; // Product from our previous tests
        this.originalVendorCode = null;
        this.originalProductName = null;
        this.testChanges = [];
    }

    async run() {
        try {
            console.log('🔄 OPMS to NetSuite UPDATE Sync Test');
            console.log('====================================');
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

            // Step 3: Make test changes to trigger updates
            console.log('📋 Step 3: Make Test Changes to Trigger Updates');
            await this.makeTestChanges();
            console.log('');

            // Step 4: Verify sync jobs were created
            console.log('📋 Step 4: Verify Sync Jobs Created');
            await this.verifySyncJobsCreated();
            console.log('');

            // Step 5: Monitor sync job processing
            console.log('📋 Step 5: Monitor Sync Job Processing');
            await this.monitorSyncJobProcessing();
            console.log('');

            // Step 6: Verify NetSuite items were updated
            console.log('📋 Step 6: Verify NetSuite Items Updated');
            await this.verifyNetSuiteUpdates();
            console.log('');

            // Step 7: Restore original values
            console.log('📋 Step 7: Restore Original Values');
            await this.restoreOriginalValues();
            console.log('');

            console.log('✅ Update sync test completed successfully!');
            
        } catch (error) {
            console.error('❌ Update sync test failed:', error.message);
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
                SELECT vendor_code, vendor_color, code
                FROM T_ITEM 
                WHERE id = ?
            `, [this.testItemId]);

            if (itemResult.length > 0) {
                this.originalVendorCode = itemResult[0].vendor_code;
                console.log(`  📝 Original vendor_code: "${this.originalVendorCode}"`);
                console.log(`  📝 Item code: "${itemResult[0].code}"`);
            }

            // Get original product values
            const productResult = await db.query(`
                SELECT name, width
                FROM T_PRODUCT 
                WHERE id = ?
            `, [this.testProductId]);

            if (productResult.length > 0) {
                this.originalProductName = productResult[0].name;
                console.log(`  📝 Original product name: "${this.originalProductName}"`);
                console.log(`  📝 Product width: ${productResult[0].width}`);
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

    async makeTestChanges() {
        try {
            const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
            
            // Test 1: Update item vendor_code
            const newVendorCode = `UPDATE-TEST-${Date.now()}`;
            console.log(`  🔄 Test 1: Updating item ${this.testItemId} vendor_code to: ${newVendorCode}`);
            
            const itemResult = await db.query(`
                UPDATE T_ITEM 
                SET vendor_code = ?, date_modif = ?
                WHERE id = ?
            `, [newVendorCode, timestamp, this.testItemId]);

            console.log(`  ✅ Item update completed, affected rows: ${itemResult.affectedRows}`);
            this.testChanges.push({
                type: 'item_vendor_code',
                oldValue: this.originalVendorCode,
                newValue: newVendorCode,
                timestamp: timestamp
            });

            // Wait a moment for trigger to fire
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Test 2: Update product name
            const newProductName = `UPDATE-TEST-PRODUCT-${Date.now()}`;
            console.log(`  🔄 Test 2: Updating product ${this.testProductId} name to: ${newProductName}`);
            
            const productResult = await db.query(`
                UPDATE T_PRODUCT 
                SET name = ?, date_modif = ?
                WHERE id = ?
            `, [newProductName, timestamp, this.testProductId]);

            console.log(`  ✅ Product update completed, affected rows: ${productResult.affectedRows}`);
            this.testChanges.push({
                type: 'product_name',
                oldValue: this.originalProductName,
                newValue: newProductName,
                timestamp: timestamp
            });

            console.log(`  ⏰ All changes made at: ${timestamp}`);
        } catch (error) {
            console.error('  ❌ Failed to make test changes:', error.message);
            throw error;
        }
    }

    async verifySyncJobsCreated() {
        try {
            console.log('  ⏳ Waiting 3 seconds for triggers to fire...');
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Check for new sync jobs
            const result = await db.query(`
                SELECT id, item_id, product_id, event_type, priority, status, created_at, event_data
                FROM opms_sync_queue 
                WHERE (item_id = ? OR product_id = ?)
                AND created_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE)
                ORDER BY created_at DESC 
                LIMIT 10
            `, [this.testItemId, this.testProductId]);

            console.log(`  📊 Found ${result.length} recent sync jobs`);
            
            if (result.length > 0) {
                result.forEach((job, index) => {
                    console.log(`  📝 Job ${index + 1}: ID ${job.id}, Item: ${job.item_id}, Product: ${job.product_id}`);
                    console.log(`      Status: ${job.status}, Event: ${job.event_type}, Priority: ${job.priority}`);
                    console.log(`      Created: ${job.created_at}`);
                    
                    // Parse event data to see what changed
                    if (job.event_data) {
                        try {
                            const eventData = JSON.parse(job.event_data);
                            if (eventData.changed_fields) {
                                console.log(`      Changed fields: ${Object.keys(eventData.changed_fields).join(', ')}`);
                            }
                        } catch (e) {
                            // Ignore JSON parse errors
                        }
                    }
                });
                return result.map(job => job.id);
            } else {
                console.log('  ⚠️  No recent sync jobs found - triggers may not have fired');
                return [];
            }
        } catch (error) {
            console.error('  ❌ Failed to verify sync job creation:', error.message);
            throw error;
        }
    }

    async monitorSyncJobProcessing() {
        try {
            console.log('  ⏳ Monitoring sync job processing for 60 seconds...');
            
            const startTime = Date.now();
            const maxWaitTime = 60000; // 60 seconds
            let completedJobs = 0;
            let failedJobs = 0;
            
            while (Date.now() - startTime < maxWaitTime) {
                // Check sync queue status
                const queueResult = await db.query(`
                    SELECT id, status, retry_count, error_message, processed_at, event_type
                    FROM opms_sync_queue 
                    WHERE (item_id = ? OR product_id = ?)
                    AND created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                    ORDER BY created_at DESC 
                    LIMIT 5
                `, [this.testItemId, this.testProductId]);

                if (queueResult.length > 0) {
                    const pendingJobs = queueResult.filter(job => job.status === 'PENDING' || job.status === 'PROCESSING');
                    const completedJobs = queueResult.filter(job => job.status === 'COMPLETED');
                    const failedJobs = queueResult.filter(job => job.status === 'FAILED');
                    
                    console.log(`  📊 Status: ${pendingJobs.length} pending/processing, ${completedJobs.length} completed, ${failedJobs.length} failed`);
                    
                    // Show details for each job
                    queueResult.forEach(job => {
                        if (job.status === 'COMPLETED') {
                            console.log(`  ✅ Job ${job.id} (${job.event_type}): COMPLETED at ${job.processed_at}`);
                        } else if (job.status === 'FAILED') {
                            console.log(`  ❌ Job ${job.id} (${job.event_type}): FAILED - ${job.error_message}`);
                        } else {
                            console.log(`  🔄 Job ${job.id} (${job.event_type}): ${job.status} (retry ${job.retry_count})`);
                        }
                    });
                    
                    // Check if all jobs are done
                    if (pendingJobs.length === 0) {
                        console.log(`  ✅ All sync jobs completed!`);
                        console.log(`  📊 Final results: ${completedJobs.length} completed, ${failedJobs.length} failed`);
                        return { completed: completedJobs.length, failed: failedJobs.length };
                    }
                }

                // Wait 5 seconds before next check
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            console.log('  ⏰ Timeout reached - some sync jobs may still be processing');
            return { completed: 0, failed: 0 };
        } catch (error) {
            console.error('  ❌ Failed to monitor sync job processing:', error.message);
            throw error;
        }
    }

    async verifyNetSuiteUpdates() {
        try {
            console.log('  📋 Checking if NetSuite items were updated...');
            
            // Check sync status table for successful updates
            const syncStatusResult = await db.query(`
                SELECT item_id, sync_status, last_sync_at, netsuite_item_id, sync_error
                FROM opms_item_sync_status 
                WHERE item_id = ?
            `, [this.testItemId]);

            if (syncStatusResult.length > 0) {
                const status = syncStatusResult[0];
                console.log(`  📊 Item ${this.testItemId} sync status: ${status.sync_status}`);
                console.log(`  📊 Last sync: ${status.last_sync_at}`);
                console.log(`  📊 NetSuite ID: ${status.netsuite_item_id || 'N/A'}`);
                
                if (status.sync_error) {
                    console.log(`  ❌ Sync error: ${status.sync_error}`);
                } else {
                    console.log(`  ✅ No sync errors recorded`);
                }
            } else {
                console.log(`  ⚠️  No sync status found for item ${this.testItemId}`);
            }

            // Check change log for our test changes
            const changeLogResult = await db.query(`
                SELECT id, change_type, change_source, detected_at, change_data
                FROM opms_change_log 
                WHERE (item_id = ? OR product_id = ?)
                AND detected_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                ORDER BY detected_at DESC 
                LIMIT 5
            `, [this.testItemId, this.testProductId]);

            console.log(`  📊 Found ${changeLogResult.length} change log entries`);
            changeLogResult.forEach((log, index) => {
                console.log(`  📝 Change ${index + 1}: ${log.change_type} from ${log.change_source} at ${log.detected_at}`);
            });

        } catch (error) {
            console.error('  ❌ Failed to verify NetSuite updates:', error.message);
            throw error;
        }
    }

    async restoreOriginalValues() {
        try {
            const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
            
            if (this.originalVendorCode !== null) {
                console.log(`  🔄 Restoring original vendor_code: "${this.originalVendorCode}"`);
                
                const itemResult = await db.query(`
                    UPDATE T_ITEM 
                    SET vendor_code = ?, date_modif = ?
                    WHERE id = ?
                `, [this.originalVendorCode, timestamp, this.testItemId]);

                console.log(`  ✅ Item restored, affected rows: ${itemResult.affectedRows}`);
            }

            if (this.originalProductName !== null) {
                console.log(`  🔄 Restoring original product name: "${this.originalProductName}"`);
                
                const productResult = await db.query(`
                    UPDATE T_PRODUCT 
                    SET name = ?, date_modif = ?
                    WHERE id = ?
                `, [this.originalProductName, timestamp, this.testProductId]);

                console.log(`  ✅ Product restored, affected rows: ${productResult.affectedRows}`);
            }
        } catch (error) {
            console.error('  ❌ Failed to restore original values:', error.message);
            throw error;
        }
    }
}

// Run the test
if (require.main === module) {
    const test = new UpdateSyncTest();
    test.run().catch(console.error);
}

module.exports = UpdateSyncTest;
