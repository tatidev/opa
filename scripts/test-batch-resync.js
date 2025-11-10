#!/usr/bin/env node

/**
 * Test script for batch re-sync functionality
 * Tests the triggerBatchResync endpoint to verify items are queued properly
 */

require('dotenv').config({ path: '.env' });
const controller = require('../src/controllers/OpmsNetSuiteSyncController');
const logger = require('../src/utils/logger');

async function testBatchResync() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🧪 TESTING BATCH RE-SYNC FUNCTIONALITY');
    console.log('═══════════════════════════════════════════════════════════\n');
    const req = {
        body: {
            priority: 'NORMAL',
            batchSize: 50,
            delay: 1000
        }
    };

    // Mock response object
    const res = {
        status: (code) => ({
            json: (data) => {
                console.log(`\n📥 RESPONSE (Status ${code}):`);
                console.log(JSON.stringify(data, null, 2));
                return data;
            }
        }),
        json: (data) => {
            console.log('\n📥 RESPONSE:');
            console.log(JSON.stringify(data, null, 2));
            return data;
        }
    };

    try {
        console.log('▶️  Calling triggerBatchResync...');
        console.log('   Priority:', req.body.priority);
        console.log('   Batch Size:', req.body.batchSize);
        console.log('   Delay:', req.body.delay);
        console.log();

        await controller.triggerBatchResync(req, res);

        console.log('\n✅ TEST COMPLETED');
        console.log('\n📊 CHECKING QUEUE:');
        
        // Check opms_sync_queue for recent jobs
        const query = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END) as processing,
                SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN JSON_EXTRACT(event_data, '$.trigger_source') = 'BATCH_RESYNC_MANUAL' THEN 1 ELSE 0 END) as batch_resync_count
            FROM opms_sync_queue
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
        `;

        const [results] = await controller.dataTransformService.db.query(query);
        const stats = results[0];

        console.log('   Total jobs (last minute):', stats.total);
        console.log('   Pending:', stats.pending);
        console.log('   Processing:', stats.processing);
        console.log('   Completed:', stats.completed);
        console.log('   Failed:', stats.failed);
        console.log('   Batch Re-sync Source:', stats.batch_resync_count);

        // Show sample jobs
        const sampleQuery = `
            SELECT id, item_id, product_id, event_type, priority, status, created_at
            FROM opms_sync_queue
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
              AND JSON_EXTRACT(event_data, '$.trigger_source') = 'BATCH_RESYNC_MANUAL'
            ORDER BY id DESC
            LIMIT 5
        `;

        const [samples] = await controller.dataTransformService.db.query(sampleQuery);
        
        if (samples.length > 0) {
            console.log('\n📋 SAMPLE JOBS:');
            samples.forEach(job => {
                console.log(`   ID: ${job.id}, Item: ${job.item_id}, Product: ${job.product_id}, Priority: ${job.priority}, Status: ${job.status}`);
            });
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('✅ TEST VERIFICATION COMPLETE');
        console.log('═══════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('\n❌ TEST FAILED:');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run test
testBatchResync()
    .then(() => {
        console.log('Test script completed.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Test script failed:', error);
        process.exit(1);
    });

