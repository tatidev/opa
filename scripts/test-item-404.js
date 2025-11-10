#!/usr/bin/env node

require('dotenv').config();
const OpmsDataTransformService = require('../src/services/OpmsDataTransformService');

async function testItem404() {
    console.log('🔍 TESTING ITEM 404 EXTRACTION');
    console.log('===============================');
    
    try {
        const transformService = new OpmsDataTransformService();
        
        console.log('\n📊 Testing data extraction for item 404:');
        const opmsData = await transformService.extractOpmsItemData(404);
        
        console.log('✅ Item extracted successfully:');
        console.log('- Item ID:', opmsData.item_id);
        console.log('- Item Code:', opmsData.item_code);
        console.log('- Product Name:', opmsData.product_name);
        console.log('- Vendor Name:', opmsData.vendor_name);
        console.log('- NetSuite Vendor ID:', opmsData.netsuite_vendor_id);
        console.log('- Color Name:', opmsData.color_name);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('This explains why item 404 is "not syncable"');
    }
}

testItem404();
