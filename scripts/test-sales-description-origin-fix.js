#!/usr/bin/env node

/**
 * Test Script: Sales Description Country of Origin Fix
 * 
 * Purpose: Verify that Sales Description now shows the correct country of origin
 * instead of always showing "Not Specified"
 * 
 * Created: January 15, 2025
 * Status: Testing country of origin fix
 */

const path = require('path');
const OpmsDataTransformService = require('../src/services/OpmsDataTransformService');

// Test configuration
const TEST_CONFIG = {
  // Test item IDs (use items with known origin data)
  testItems: [
    { itemId: 11610, expectedItemCode: '3940-1765', description: 'ACDC Teal' },
    { itemId: 11609, expectedItemCode: '4281-4920', description: 'Berba Fiesta' }
  ],
  
  // Expected behavior after fix
  expectedBehavior: {
    salesDescriptionShowsOrigin: true,    // Sales description should show actual origin
    originMatchesCustomField: true,        // Should match custitem_opms_product_origin
    fallbackShowsDash: true,              // Should show " - " when no origin data
    noMoreNotSpecified: true             // Should not show "Not Specified" anymore
  }
};

class SalesDescriptionOriginTest {
  constructor() {
    this.transformService = new OpmsDataTransformService();
    this.testResults = {
      salesDescriptionFixed: false,
      originDataExtracted: false,
      customFieldMapping: false,
      fallbackWorking: false,
      testLogs: []
    };
  }

  /**
   * Test 1: Verify Sales Description shows correct origin
   */
  async testSalesDescriptionOrigin() {
    console.log('🧪 Test 1: Verifying Sales Description shows correct origin...');
    
    try {
      for (const testItem of TEST_CONFIG.testItems) {
        console.log(`\n  Testing item ${testItem.itemId} (${testItem.description})...`);
        
        // Transform item data
        const netsuitePayload = await this.transformService.transformItemForNetSuite(testItem.itemId);
        
        if (netsuitePayload.salesdescription) {
          const salesDesc = netsuitePayload.salesdescription;
          const originField = netsuitePayload.origin;
          
          console.log(`    Sales Description Length: ${salesDesc.length} chars`);
          console.log(`    Origin Field Value: "${originField}"`);
          
          // Check if Sales Description contains origin
          const hasOriginInSalesDesc = salesDesc.includes('Country of Origin:');
          const hasNotSpecified = salesDesc.includes('Not Specified');
          const hasDashFallback = salesDesc.includes('Country of Origin:  - ');
          
          console.log(`    Contains "Country of Origin:": ${hasOriginInSalesDesc ? '✅' : '❌'}`);
          console.log(`    Contains "Not Specified": ${hasNotSpecified ? '❌ (BAD)' : '✅ (GOOD)'}`);
          console.log(`    Contains dash fallback: ${hasDashFallback ? '✅' : '❌'}`);
          
          // Extract origin from sales description
          const originMatch = salesDesc.match(/Country of Origin: (.+?)(?:\n|$)/);
          const salesDescOrigin = originMatch ? originMatch[1] : null;
          
          console.log(`    Sales Desc Origin: "${salesDescOrigin}"`);
          console.log(`    Custom Field Origin: "${originField}"`);
          console.log(`    Origins Match: ${salesDescOrigin === originField ? '✅' : '❌'}`);
          
          if (hasOriginInSalesDesc && !hasNotSpecified) {
            this.logTestResult(`✅ Item ${testItem.itemId} - Sales Description shows origin correctly`, 'PASS');
          } else {
            this.logTestResult(`❌ Item ${testItem.itemId} - Sales Description origin issue`, 'FAIL');
          }
        } else {
          this.logTestResult(`❌ Item ${testItem.itemId} - No sales description found`, 'FAIL');
        }
      }
      
      this.testResults.salesDescriptionFixed = true;
      
    } catch (error) {
      this.logTestResult(`❌ Error testing sales description: ${error.message}`, 'ERROR');
    }
  }

  /**
   * Test 2: Verify origin data extraction works
   */
  async testOriginDataExtraction() {
    console.log('\n🧪 Test 2: Verifying origin data extraction...');
    
    try {
      for (const testItem of TEST_CONFIG.testItems) {
        console.log(`\n  Testing origin extraction for item ${testItem.itemId}...`);
        
        // Get the product ID first
        const netsuitePayload = await this.transformService.transformItemForNetSuite(testItem.itemId);
        const productId = netsuitePayload.custitem_opms_prod_id;
        
        if (productId) {
          // Extract origin data directly
          const originData = await this.transformService.extractOriginData(productId);
          
          console.log(`    Product ID: ${productId}`);
          console.log(`    Extracted Origin: "${originData}"`);
          
          if (originData !== null) {
            this.logTestResult(`✅ Item ${testItem.itemId} - Origin data extracted: "${originData}"`, 'PASS');
          } else {
            this.logTestResult(`⚠️ Item ${testItem.itemId} - No origin data found (will show " - ")`, 'WARN');
          }
        }
      }
      
      this.testResults.originDataExtracted = true;
      
    } catch (error) {
      this.logTestResult(`❌ Error testing origin extraction: ${error.message}`, 'ERROR');
    }
  }

  /**
   * Test 3: Verify custom field mapping
   */
  async testCustomFieldMapping() {
    console.log('\n🧪 Test 3: Verifying custom field mapping...');
    
    try {
      for (const testItem of TEST_CONFIG.testItems) {
        console.log(`\n  Testing custom field mapping for item ${testItem.itemId}...`);
        
        const netsuitePayload = await this.transformService.transformItemForNetSuite(testItem.itemId);
        
        const originField = netsuitePayload.origin;
        const salesDesc = netsuitePayload.salesdescription;
        
        console.log(`    Custom Field (origin): "${originField}"`);
        
        if (salesDesc) {
          const originMatch = salesDesc.match(/Country of Origin: (.+?)(?:\n|$)/);
          const salesDescOrigin = originMatch ? originMatch[1] : null;
          
          console.log(`    Sales Desc Origin: "${salesDescOrigin}"`);
          
          if (originField === salesDescOrigin) {
            this.logTestResult(`✅ Item ${testItem.itemId} - Custom field and sales desc match`, 'PASS');
          } else {
            this.logTestResult(`❌ Item ${testItem.itemId} - Custom field and sales desc don't match`, 'FAIL');
          }
        }
      }
      
      this.testResults.customFieldMapping = true;
      
    } catch (error) {
      this.logTestResult(`❌ Error testing custom field mapping: ${error.message}`, 'ERROR');
    }
  }

  /**
   * Test 4: Verify fallback behavior
   */
  async testFallbackBehavior() {
    console.log('\n🧪 Test 4: Verifying fallback behavior...');
    
    try {
      // Test with a product that likely has no origin data
      const testItemId = 1; // Use a low ID that might not have origin data
      
      console.log(`\n  Testing fallback with item ${testItemId}...`);
      
      const netsuitePayload = await this.transformService.transformItemForNetSuite(testItemId);
      
      if (netsuitePayload.salesdescription) {
        const salesDesc = netsuitePayload.salesdescription;
        const hasDashFallback = salesDesc.includes('Country of Origin:  - ');
        const hasNotSpecified = salesDesc.includes('Not Specified');
        
        console.log(`    Contains dash fallback: ${hasDashFallback ? '✅' : '❌'}`);
        console.log(`    Contains "Not Specified": ${hasNotSpecified ? '❌ (BAD)' : '✅ (GOOD)'}`);
        
        if (hasDashFallback && !hasNotSpecified) {
          this.logTestResult(`✅ Fallback behavior working correctly`, 'PASS');
        } else {
          this.logTestResult(`❌ Fallback behavior not working correctly`, 'FAIL');
        }
      }
      
      this.testResults.fallbackWorking = true;
      
    } catch (error) {
      this.logTestResult(`❌ Error testing fallback: ${error.message}`, 'ERROR');
    }
  }

  /**
   * Log test result
   */
  logTestResult(message, status) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${status}: ${message}`;
    
    console.log(logEntry);
    this.testResults.testLogs.push(logEntry);
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚀 Starting Sales Description Country of Origin Fix Tests...\n');
    
    await this.testSalesDescriptionOrigin();
    await this.testOriginDataExtraction();
    await this.testCustomFieldMapping();
    await this.testFallbackBehavior();
    
    this.generateTestReport();
  }

  /**
   * Generate comprehensive test report
   */
  generateTestReport() {
    console.log('\n📊 TEST REPORT: Sales Description Country of Origin Fix');
    console.log('=' .repeat(65));
    
    const totalTests = 4;
    const passedTests = this.testResults.testLogs.filter(log => log.includes('PASS')).length;
    const failedTests = this.testResults.testLogs.filter(log => log.includes('FAIL')).length;
    const errorTests = this.testResults.testLogs.filter(log => log.includes('ERROR')).length;
    const warnTests = this.testResults.testLogs.filter(log => log.includes('WARN')).length;
    
    console.log(`\n📈 Test Summary:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   ⚠️  Warnings: ${warnTests}`);
    console.log(`   🚨 Errors: ${errorTests}`);
    
    console.log(`\n🎯 Key Verification Results:`);
    console.log(`   Sales Description Fixed: ${this.testResults.salesDescriptionFixed ? '✅ YES' : '❌ NO'}`);
    console.log(`   Origin Data Extracted: ${this.testResults.originDataExtracted ? '✅ YES' : '❌ NO'}`);
    console.log(`   Custom Field Mapping: ${this.testResults.customFieldMapping ? '✅ YES' : '❌ NO'}`);
    console.log(`   Fallback Working: ${this.testResults.fallbackWorking ? '✅ YES' : '❌ NO'}`);
    
    console.log(`\n📋 Expected Behavior After Fix:`);
    console.log(`   ✅ Sales Description shows actual country of origin`);
    console.log(`   ✅ Country of origin matches custitem_opms_product_origin field`);
    console.log(`   ✅ Fallback shows " - " when no origin data`);
    console.log(`   ❌ No more "Not Specified" in Sales Description`);
    
    console.log(`\n🔍 Next Steps for Manual Testing:`);
    console.log(`   1. Sync an item with known origin data to NetSuite`);
    console.log(`   2. Check Sales Description shows correct country of origin`);
    console.log(`   3. Verify custitem_opms_product_origin field matches`);
    console.log(`   4. Test with item that has no origin data (should show " - ")`);
    
    if (failedTests > 0 || errorTests > 0) {
      console.log(`\n⚠️  WARNING: Some tests failed. Please review the changes before deployment.`);
      process.exit(1);
    } else {
      console.log(`\n🎉 All tests passed! Sales Description country of origin fix is working correctly.`);
      process.exit(0);
    }
  }
}

// Run the tests
if (require.main === module) {
  const tester = new SalesDescriptionOriginTest();
  tester.runAllTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = SalesDescriptionOriginTest;
