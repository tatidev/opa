#!/usr/bin/env node
/**
 * Direct Sync Service Test - Bypasses HTTP to see actual errors
 */

require('dotenv').config();

async function testDirectSync() {
  console.log('\n🔍 Direct Sync Service Test\n');
  console.log('Loading sync service...');
  
  try {
    const NsToOpmsWebhookService = require('../../src/services/NsToOpmsWebhookService');
    const webhookService = new NsToOpmsWebhookService();
    
    console.log('✅ Webhook service loaded\n');
    
    const testData = {
      itemData: {
        itemid: 'opmsAPI01',
        internalid: '43992',
        custitemf3_lisa_item: false,
        price_1_: 100.00,
        itemPriceLine2_itemPrice: 150.00,
        cost: 40.00,
        custitem_f3_rollprice: 50.00,
        lastmodifieddate: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('📤 Test Data:');
    console.log(JSON.stringify(testData, null, 2));
    console.log('\n🚀 Processing webhook...\n');
    
    const result = await webhookService.processItemPricingWebhook(testData);
    
    console.log('✅ SUCCESS!');
    console.log('Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.log('\n❌ ERROR CAUGHT:');
    console.log('Message:', error.message);
    console.log('\nStack Trace:');
    console.log(error.stack);
    
    if (error.cause) {
      console.log('\nCause:', error.cause);
    }
  }
}

testDirectSync()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });




