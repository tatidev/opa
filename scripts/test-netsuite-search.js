#!/usr/bin/env node

/**
 * Test script to check if item exists in NetSuite
 * This will use the existing sync service to test the search functionality
 */

const { createLotNumberedInventoryItem } = require('../src/services/netsuiteRestletService');

async function testNetSuiteSearch() {
  console.log('🔍 Testing NetSuite item search...');
  
  try {
    
    // Test data for item 13385
    const testItem = {
      item_id: 13385,
      product_id: 2823,
      item_code: '6148-4501',
      product_name: 'ACDC',
      color_name: 'Teal',
      vendor_name: 'ACDC',
      vendor_code: 'ACDC',
      vendor_color: 'Teal_PKL-TEST-01A',
      vendor_product_name: 'ACDC',
      width: '54.0'
    };
    
    console.log('📦 Test item data:', JSON.stringify(testItem, null, 2));
    
    // Test the RESTlet call directly
    console.log('🚀 Testing RESTlet call...');
    const result = await createLotNumberedInventoryItem(testItem, { skipTestPrefix: true });
    
    console.log('✅ RESTlet call completed');
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('📋 Error details:', error);
  }
}

testNetSuiteSearch();
