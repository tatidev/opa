#!/usr/bin/env node

/**
 * Check NetSuite vendor mapping and verify vendor exists
 */

const { transformToRestletPayload } = require('./src/services/netsuiteRestletService');

async function checkNetSuiteVendor() {
    console.log('🔍 Checking NetSuite vendor mapping...\n');
    
    try {
        
        // Test vendor ID 4324 (Mayer Fabrics)
        console.log('1️⃣ Testing NetSuite vendor ID: 4324');
        
        const testPayload = {
            itemId: 'TEST-VENDOR-CHECK-4324',
            displayname: 'Test Vendor Check',
            vendor: 4324,
            vendorcode: 'TEST-CODE',
            vendorName: 'Mayer Fabrics'
        };
        
        console.log('Test payload:', JSON.stringify(testPayload, null, 2));
        
        // Try to create a test item with this vendor
        const result = await restletService.createLotNumberedInventoryItem(testPayload);
        
        console.log('\n✅ Result:', JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        
        // Check if it's a vendor-related error
        if (error.message.includes('vendor') || error.message.includes('4324')) {
            console.log('\n🔍 This appears to be a vendor-related error');
            console.log('Possible issues:');
            console.log('- Vendor ID 4324 does not exist in NetSuite');
            console.log('- Vendor ID 4324 is inactive in NetSuite');
            console.log('- Vendor ID 4324 is archived in NetSuite');
            console.log('- NetSuite vendor name mismatch');
        }
    }
}

checkNetSuiteVendor();
