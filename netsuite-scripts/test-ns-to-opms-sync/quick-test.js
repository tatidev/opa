#!/usr/bin/env node
require('dotenv').config({ path: '../../.env' });

async function test() {
  console.log('\n🔍 Direct Service Test with Console Output\n');
  
  const NsToOpmsSyncService = require('../../src/services/NsToOpmsSyncService');
  const service = new NsToOpmsSyncService();
  
  const testData = {
    itemid: 'opmsAPI01',
    internalid: '43992',
    custitemf3_lisa_item: false,
    price_1_: 100.00,
    itemPriceLine2_itemPrice: 150.00,
    cost: 40.00,
    custitem_f3_rollprice: 50.00
  };
  
  try {
    console.log('Test Data:', testData);
    console.log('\n🚀 Running sync...\n');
    
    const result = await service.syncSingleItemPricing(testData);
    
    console.log('\n✅ SUCCESS!');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.log('\n❌ ERROR:');
    console.log('Message:', error.message);
    console.log('\nFull Error:');
    console.error(error);
    process.exit(1);
  }
}

test();




