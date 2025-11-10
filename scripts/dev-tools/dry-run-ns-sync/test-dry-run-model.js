#!/usr/bin/env node

/**
 * Test script to debug database connection in NetSuiteDryRunSyncLogModel
 */

require('dotenv').config();
const NetSuiteDryRunSyncLogModel = require('../src/models/NetSuiteDryRunSyncLogModel');
const logger = require('../src/utils/logger');

async function testDatabaseConnection() {
    try {
        console.log('🧪 Testing database connection in NetSuiteDryRunSyncLogModel...');
        
        const model = new NetSuiteDryRunSyncLogModel();
        
        console.log('📊 Model created:', {
            tableName: model.tableName,
            dbType: typeof model.db,
            dbMethods: Object.getOwnPropertyNames(model.db)
        });
        
        // Test a simple query
        console.log('🔍 Testing simple query...');
        const result = await model.getRecentPayloads(5);
        
        console.log('✅ Query successful!');
        console.log('Result:', result);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run test if this script is executed directly
if (require.main === module) {
    testDatabaseConnection().then(() => {
        process.exit(0);
    }).catch((error) => {
        console.error('Test script failed:', error);
        process.exit(1);
    });
}

module.exports = testDatabaseConnection;
