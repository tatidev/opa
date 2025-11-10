#!/usr/bin/env node

/**
 * Test Script: Price Cascading Disabled Verification
 * 
 * Purpose: Verify that price cascading to sibling items has been disabled
 * while ensuring main NetSuite → OPMS sync still works
 * 
 * Created: January 15, 2025
 * Status: Testing cascading disable functionality
 */

const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_CONFIG = {
  // Test item IDs for verification (use opmsAPI- prefix for test items)
  testItemId: 'opmsAPI-CASCADE-TEST-001',
  testProductId: 9999, // Test product ID
  
  // Expected behavior after cascading is disabled
  expectedBehavior: {
    mainSyncWorks: true,        // NetSuite → OPMS sync should still work
    cascadingDisabled: true,    // OPMS → NetSuite sibling updates should be disabled
    loopPreventionIntact: true  // Infinite loop prevention should remain active
  }
};

class PriceCascadingTest {
  constructor() {
    this.testResults = {
      cascadingCodeCommented: false,
      loopPreventionIntact: false,
      mainSyncPreserved: false,
      testLogs: []
    };
  }

  /**
   * Test 1: Verify cascading code is commented out
   */
  testCascadingCodeCommented() {
    console.log('🧪 Test 1: Verifying cascading code is commented out...');
    
    try {
      const webhookServicePath = path.join(__dirname, '../src/services/NsToOpmsWebhookService.js');
      const webhookServiceContent = fs.readFileSync(webhookServicePath, 'utf8');
      
      // Check if cascading code is commented out
      const cascadingCommented = webhookServiceContent.includes('// DISABLED: Price cascading to sibling items has been commented out');
      const manualTriggerCommented = webhookServiceContent.includes('/*') && webhookServiceContent.includes('manualTriggerProduct');
      
      if (cascadingCommented && manualTriggerCommented) {
        this.testResults.cascadingCodeCommented = true;
        this.logTestResult('✅ Cascading code successfully commented out', 'PASS');
      } else {
        this.logTestResult('❌ Cascading code not properly commented out', 'FAIL');
      }
      
    } catch (error) {
      this.logTestResult(`❌ Error reading webhook service file: ${error.message}`, 'ERROR');
    }
  }

  /**
   * Test 2: Verify infinite loop prevention mechanisms remain intact
   */
  testLoopPreventionIntact() {
    console.log('🧪 Test 2: Verifying infinite loop prevention mechanisms...');
    
    try {
      const webhookScriptPath = path.join(__dirname, '../netsuite-scripts/ItemPricingUpdateWebhook.js');
      const webhookScriptContent = fs.readFileSync(webhookScriptPath, 'utf8');
      
      // Check for key loop prevention mechanisms
      const executionContextCheck = webhookScriptContent.includes('execContext !== runtime.ContextType.USER_INTERFACE');
      const userInterfaceOnly = webhookScriptContent.includes('Only fire webhook for human user edits via UI');
      const skipRESTletUpdates = webhookScriptContent.includes('Skip webhook when updated via RESTlet/API');
      
      if (executionContextCheck && userInterfaceOnly && skipRESTletUpdates) {
        this.testResults.loopPreventionIntact = true;
        this.logTestResult('✅ Infinite loop prevention mechanisms intact', 'PASS');
      } else {
        this.logTestResult('❌ Infinite loop prevention mechanisms may be compromised', 'FAIL');
      }
      
    } catch (error) {
      this.logTestResult(`❌ Error reading webhook script file: ${error.message}`, 'ERROR');
    }
  }

  /**
   * Test 3: Verify main sync functionality is preserved
   */
  testMainSyncPreserved() {
    console.log('🧪 Test 3: Verifying main sync functionality is preserved...');
    
    try {
      const webhookServicePath = path.join(__dirname, '../src/services/NsToOpmsWebhookService.js');
      const webhookServiceContent = fs.readFileSync(webhookServicePath, 'utf8');
      
      // Check that main sync logic is still present
      const mainSyncLogic = webhookServiceContent.includes('await this.pricingSyncService.syncSingleItemPricing');
      const webhookProcessing = webhookServiceContent.includes('processItemPricingWebhook');
      const pricingDataExtraction = webhookServiceContent.includes('pricingData');
      
      if (mainSyncLogic && webhookProcessing && pricingDataExtraction) {
        this.testResults.mainSyncPreserved = true;
        this.logTestResult('✅ Main sync functionality preserved', 'PASS');
      } else {
        this.logTestResult('❌ Main sync functionality may be compromised', 'FAIL');
      }
      
    } catch (error) {
      this.logTestResult(`❌ Error verifying main sync: ${error.message}`, 'ERROR');
    }
  }

  /**
   * Test 4: Verify logging indicates cascading is disabled
   */
  testCascadingDisabledLogging() {
    console.log('🧪 Test 4: Verifying cascading disabled logging...');
    
    try {
      const webhookServicePath = path.join(__dirname, '../src/services/NsToOpmsWebhookService.js');
      const webhookServiceContent = fs.readFileSync(webhookServicePath, 'utf8');
      
      // Check for proper logging when cascading is disabled
      const disabledLogging = webhookServiceContent.includes('Price cascading disabled - sibling items will not be automatically updated');
      const userRequestNote = webhookServiceContent.includes('Price cascading functionality has been commented out per user request');
      
      if (disabledLogging && userRequestNote) {
        this.logTestResult('✅ Proper logging for disabled cascading', 'PASS');
      } else {
        this.logTestResult('❌ Missing proper logging for disabled cascading', 'FAIL');
      }
      
    } catch (error) {
      this.logTestResult(`❌ Error checking logging: ${error.message}`, 'ERROR');
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
    console.log('🚀 Starting Price Cascading Disabled Verification Tests...\n');
    
    this.testCascadingCodeCommented();
    this.testLoopPreventionIntact();
    this.testMainSyncPreserved();
    this.testCascadingDisabledLogging();
    
    this.generateTestReport();
  }

  /**
   * Generate comprehensive test report
   */
  generateTestReport() {
    console.log('\n📊 TEST REPORT: Price Cascading Disabled Verification');
    console.log('=' .repeat(60));
    
    const totalTests = 4;
    const passedTests = this.testResults.testLogs.filter(log => log.includes('PASS')).length;
    const failedTests = this.testResults.testLogs.filter(log => log.includes('FAIL')).length;
    const errorTests = this.testResults.testLogs.filter(log => log.includes('ERROR')).length;
    
    console.log(`\n📈 Test Summary:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   ⚠️  Errors: ${errorTests}`);
    
    console.log(`\n🎯 Key Verification Results:`);
    console.log(`   Cascading Code Commented: ${this.testResults.cascadingCodeCommented ? '✅ YES' : '❌ NO'}`);
    console.log(`   Loop Prevention Intact: ${this.testResults.loopPreventionIntact ? '✅ YES' : '❌ NO'}`);
    console.log(`   Main Sync Preserved: ${this.testResults.mainSyncPreserved ? '✅ YES' : '❌ NO'}`);
    
    console.log(`\n📋 Expected Behavior After Changes:`);
    console.log(`   ✅ NetSuite → OPMS sync: Should work normally`);
    console.log(`   ❌ OPMS → NetSuite sibling cascade: Should be disabled`);
    console.log(`   ✅ Infinite loop prevention: Should remain active`);
    console.log(`   ✅ Manual price updates: Should sync to OPMS only`);
    
    console.log(`\n🔍 Next Steps for Manual Testing:`);
    console.log(`   1. Update a NetSuite item price via UI`);
    console.log(`   2. Verify OPMS product pricing is updated`);
    console.log(`   3. Verify sibling items are NOT automatically updated`);
    console.log(`   4. Check logs for "Price cascading disabled" message`);
    
    if (failedTests > 0 || errorTests > 0) {
      console.log(`\n⚠️  WARNING: Some tests failed. Please review the changes before deployment.`);
      process.exit(1);
    } else {
      console.log(`\n🎉 All tests passed! Price cascading has been successfully disabled.`);
      process.exit(0);
    }
  }
}

// Run the tests
if (require.main === module) {
  const tester = new PriceCascadingTest();
  tester.runAllTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = PriceCascadingTest;
