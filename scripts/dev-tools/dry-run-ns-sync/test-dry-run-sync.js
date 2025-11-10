#!/usr/bin/env node

/**
 * Test script to debug dry-run sync functionality
 */

require('dotenv').config();
const DryRunSyncService = require('../src/services/DryRunSyncService');
const logger = require('../src/utils/logger');

async function testDryRunSync() {
    try {
        console.log('🧪 Testing dry-run sync functionality...');
        
        const dryRunService = new DryRunSyncService();
        
        // Test with a known OPMS item ID
        const testItemId = 43992; // From the logs we saw earlier
        
        console.log(`📋 Testing with OPMS item ID: ${testItemId}`);
        
        const result = await dryRunService.performDryRunSync(testItemId, {
            syncType: 'manual_test',
            syncTrigger: 'debug_test',
            storePayload: true
        });
        
        console.log('✅ Test completed!');
        console.log('Result:', JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run test if this script is executed directly
if (require.main === module) {
    testDryRunSync().then(() => {
        process.exit(0);
    }).catch((error) => {
        console.error('Test script failed:', error);
        process.exit(1);
    });
}

module.exports = testDryRunSync;
