#!/usr/bin/env node

require('dotenv').config();
const { transformToRestletPayload, createLotNumberedInventoryItem } = require('../src/services/netsuiteRestletService');

async function testNetSuiteItemSearch() {
    console.log('🔍 TESTING NETSUITE ITEM SEARCH');
    console.log('===============================');
    
    try {
        // Test with one of the failing items
        const testItemId = '6148-4506';
        
        console.log(`\n📊 Testing search for item: ${testItemId}`);
        
        // Create a minimal test payload
        const testPayload = {
            itemId: testItemId,
            displayName: 'TEST: Search Test',
            custitem_opms_item_id: 13636,
            custitem_opms_prod_id: 2823
        };
        
        console.log('Test payload:', JSON.stringify(testPayload, null, 2));
        
        // Try to upsert - this should find the existing item or create a new one
        const result = await createLotNumberedInventoryItem(testPayload, { isOpmsSync: true });
        
        console.log('\n✅ Result:', result);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

testNetSuiteItemSearch();
