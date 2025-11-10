#!/usr/bin/env node

/**
 * Test script to debug dry-run sync functionality
 */

require('dotenv').config();
const DryRunSyncService = require('../src/services/DryRunSyncService');
const OpmsDataTransformService = require('../src/services/OpmsDataTransformService');
const logger = require('../src/utils/logger');

async function testDryRunSync() {
    try {
        console.log('🧪 Testing dry-run sync functionality...');
        
        // Test database connection first
        console.log('🔌 Testing database connection...');
        const dataTransformService = new OpmsDataTransformService();
        
        // Test the extractOpmsItemData method directly
        console.log('📋 Testing extractOpmsItemData method...');
        const opmsData = await dataTransformService.extractOpmsItemData(43992);
        
        console.log('📊 OPMS Data extracted:', opmsData);
        
        if (opmsData) {
            console.log('✅ OPMS data extraction successful');
            
            // Test the dry-run service
            console.log('🚀 Testing dry-run service...');
            const dryRunService = new DryRunSyncService();
            
            const result = await dryRunService.performDryRunSync(43992, {
                syncType: 'manual_test',
                syncTrigger: 'debug_test',
                storePayload: true
            });
            
            console.log('✅ Dry-run test completed!');
            console.log('Result:', JSON.stringify(result, null, 2));
        } else {
            console.log('❌ OPMS data extraction failed - no data returned');
        }
        
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
