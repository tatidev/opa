/**
 * Test Script: Sales and Purchase Descriptions Auto-Generation
 * 
 * Tests the new sales/purchase descriptions feature with Product 7799 (AAA TEST PKL02)
 * Test items: 3940-1765 (Battered Blue), 4281-4920 (Maple Syrup)
 * 
 * Expected Results:
 * - Purchase description populated with pricing
 * - Sales description populated with item code and origin
 * - Multi-line format renders correctly with <br> tags
 * - Fields update on NetSuite
 * 
 * Usage:
 * node scripts/test-sales-purchase-descriptions.js [itemId]
 * 
 * Examples:
 * node scripts/test-sales-purchase-descriptions.js 11610  # Test item 3940-1765
 * node scripts/test-sales-purchase-descriptions.js 11609  # Test item 4281-4920
 */

require('dotenv').config();
const OpmsDataTransformService = require('../src/services/OpmsDataTransformService');
const NetSuiteRestletService = require('../src/services/netsuiteRestletService');
const logger = require('../src/utils/logger');

// Test configuration
const TEST_ITEMS = {
  '3940-1765': {
    opmsItemId: null,  // Will be looked up from database
    netsuiteItemId: 11610,
    expectedColor: 'Battered Blue',
    expectedProduct: 'AAA TEST PKL02'
  },
  '4281-4920': {
    opmsItemId: null,  // Will be looked up from database
    netsuiteItemId: 11609,
    expectedColor: 'Maple Syrup',
    expectedProduct: 'AAA TEST PKL02'
  }
};

/**
 * Find OPMS item ID by item code
 */
async function findOpmsItemId(itemCode) {
  const transformService = new OpmsDataTransformService();
  try {
    const query = `
      SELECT id FROM T_ITEM WHERE code = ? AND archived = 'N' LIMIT 1
    `;
    const [results] = await transformService.db.query(query, [itemCode]);
    return results?.id || null;
  } catch (error) {
    logger.error('Failed to find OPMS item ID', { error: error.message, itemCode });
    return null;
  }
}

/**
 * Test description generation for a single item
 */
async function testItemDescriptions(opmsItemId, testInfo) {
  logger.info('========================================');
  logger.info(`Testing Item: ${testInfo.expectedProduct} - ${testInfo.expectedColor}`);
  logger.info(`OPMS Item ID: ${opmsItemId}`);
  logger.info(`NetSuite Item ID: ${testInfo.netsuiteItemId}`);
  logger.info('========================================');

  const transformService = new OpmsDataTransformService();
  
  try {
    // Step 1: Transform item data (includes description generation)
    logger.info('\n📊 Step 1: Transforming OPMS item data...');
    const netsuitePayload = await transformService.transformItemForNetSuite(opmsItemId);
    
    // Step 2: Verify purchase description
    logger.info('\n' + '═'.repeat(80));
    logger.info('📝 PURCHASE DESCRIPTION (Internal - With Pricing)');
    logger.info('═'.repeat(80));
    if (netsuitePayload.purchasedescription) {
      const purchaseLines = netsuitePayload.purchasedescription.split('<br>');
      purchaseLines.forEach((line, index) => {
        logger.info(`${(index + 1).toString().padStart(2, ' ')}. ${line}`);
      });
      logger.info('─'.repeat(80));
      logger.info(`✅ Generated successfully (${netsuitePayload.purchasedescription.length} chars, ${purchaseLines.length} lines)`);
      logger.info('\n🔍 RAW HTML (what NetSuite receives):');
      logger.info(netsuitePayload.purchasedescription);
    } else {
      logger.error('❌ Purchase description is empty or null');
    }
    
    // Step 3: Verify sales description
    logger.info('\n' + '═'.repeat(80));
    logger.info('📝 SALES DESCRIPTION (Customer-Facing - No Pricing)');
    logger.info('═'.repeat(80));
    if (netsuitePayload.salesdescription) {
      const salesLines = netsuitePayload.salesdescription.split('<br>');
      salesLines.forEach((line, index) => {
        logger.info(`${(index + 1).toString().padStart(2, ' ')}. ${line}`);
      });
      logger.info('─'.repeat(80));
      logger.info(`✅ Generated successfully (${netsuitePayload.salesdescription.length} chars, ${salesLines.length} lines)`);
      logger.info('\n🔍 RAW HTML (what NetSuite receives):');
      logger.info(netsuitePayload.salesdescription);
    } else {
      logger.error('❌ Sales description is empty or null');
    }
    
    // Step 4: Check for required fields
    logger.info('\n🔍 Verification Checklist:');
    const checks = {
      'Product name in descriptions': netsuitePayload.purchasedescription?.includes(testInfo.expectedProduct) && 
                                       netsuitePayload.salesdescription?.includes(testInfo.expectedProduct),
      'Color in descriptions': netsuitePayload.purchasedescription?.includes(testInfo.expectedColor) && 
                               netsuitePayload.salesdescription?.includes(testInfo.expectedColor),
      'Pricing in purchase desc': netsuitePayload.purchasedescription?.includes('Price'),
      'No pricing in sales desc': !netsuitePayload.salesdescription?.includes('Price'),
      'Item code in sales desc': netsuitePayload.salesdescription?.includes('#'),
      'Origin in sales desc': netsuitePayload.salesdescription?.includes('Country of Origin'),
      'Line breaks present': netsuitePayload.purchasedescription?.includes('<br>') && 
                             netsuitePayload.salesdescription?.includes('<br>')
    };
    
    Object.entries(checks).forEach(([check, passed]) => {
      logger.info(`${passed ? '✅' : '❌'} ${check}`);
    });
    
    // Step 5: Show full payload (for debugging)
    logger.info('\n📦 Complete Payload:');
    logger.debug(JSON.stringify({
      itemId: netsuitePayload.itemId,
      displayname: netsuitePayload.displayname,
      purchasedescription: netsuitePayload.purchasedescription,
      salesdescription: netsuitePayload.salesdescription,
      price_1_: netsuitePayload.price_1_,
      price_1_5: netsuitePayload.price_1_5
    }, null, 2));
    
    return {
      success: true,
      payload: netsuitePayload,
      checks: checks
    };
    
  } catch (error) {
    logger.error('Test failed', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test NetSuite sync (dry run)
 */
async function testNetSuiteSync(netsuitePayload, dryRun = true) {
  logger.info('\n🚀 Testing NetSuite Sync...');
  
  try {
    const result = await NetSuiteRestletService.createLotNumberedInventoryItem(netsuitePayload, { 
      dryRun: dryRun 
    });
    
    if (dryRun) {
      logger.info('✅ Dry run successful - payload would be sent to NetSuite');
      logger.debug('Payload:', JSON.stringify(result.payload, null, 2));
    } else {
      logger.info('✅ NetSuite sync successful');
      logger.info(`Operation: ${result.operation}`);
      logger.info(`NetSuite ID: ${result.id}`);
      logger.info(`Purchase Description: ${result.purchaseDescription ? 'Set' : 'Not set'}`);
      logger.info(`Sales Description: ${result.salesDescription ? 'Set' : 'Not set'}`);
    }
    
    return result;
    
  } catch (error) {
    logger.error('NetSuite sync failed', { error: error.message });
    throw error;
  }
}

/**
 * Main test execution
 */
async function runTests() {
  const args = process.argv.slice(2);
  const itemIdArg = args[0];
  const dryRun = args[1] !== '--live';
  
  logger.info('🧪 Sales and Purchase Descriptions Test Suite');
  logger.info('═'.repeat(80));
  
  if (dryRun) {
    logger.info('Mode: DRY RUN (no actual NetSuite updates)');
    logger.info('Use --live flag to perform actual sync');
  } else {
    logger.warn('Mode: LIVE SYNC (will update NetSuite items)');
  }
  
  logger.info('═'.repeat(80));
  
  try {
    // If specific item ID provided, test only that item
    if (itemIdArg) {
      logger.info(`\n🎯 Testing specific OPMS item ID: ${itemIdArg}`);
      const result = await testItemDescriptions(parseInt(itemIdArg), {
        expectedProduct: 'AAA TEST PKL02',
        expectedColor: 'Unknown'
      });
      
      if (result.success && !dryRun) {
        await testNetSuiteSync(result.payload, false);
      }
      return;
    }
    
    // Otherwise, test all configured items
    for (const [itemCode, testInfo] of Object.entries(TEST_ITEMS)) {
      // Look up OPMS item ID
      const opmsItemId = await findOpmsItemId(itemCode);
      
      if (!opmsItemId) {
        logger.error(`❌ Could not find OPMS item with code: ${itemCode}`);
        continue;
      }
      
      // Test description generation
      const result = await testItemDescriptions(opmsItemId, testInfo);
      
      if (result.success) {
        // Test NetSuite sync (dry run by default)
        await testNetSuiteSync(result.payload, dryRun);
      }
      
      logger.info('\n');
    }
    
    logger.info('═'.repeat(80));
    logger.info('✅ Test suite completed');
    logger.info('═'.repeat(80));
    
  } catch (error) {
    logger.error('Test suite failed', { error: error.message, stack: error.stack });
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  testItemDescriptions,
  testNetSuiteSync,
  findOpmsItemId
};

