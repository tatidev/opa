#!/usr/bin/env node

/**
 * Test NetSuite Production Connection
 * 
 * This script tests if we can connect to the production NetSuite account
 * using the existing vendor lookup service.
 */

const dotenv = require('dotenv');
const NetSuiteVendorLookupService = require('../src/services/netsuiteVendorLookupService');

// Load environment variables
dotenv.config();

async function testProductionConnection() {
    try {
        console.log('🧪 Testing NetSuite Production Connection...');
        console.log('=' .repeat(50));
        
        // Temporarily override the account ID to use production
        const originalAccountId = process.env.NETSUITE_ACCOUNT_ID;
        process.env.NETSUITE_ACCOUNT_ID = process.env.NETSUITE_ACCOUNT_ID_PROD;
        
        console.log(`🔧 Using Production Account ID: ${process.env.NETSUITE_ACCOUNT_ID_PROD}`);
        
        // Create vendor lookup service instance
        const vendorService = new NetSuiteVendorLookupService();
        
        // Test with a known vendor name
        const testVendorName = "Anne Kirk Textiles";
        console.log(`🔍 Testing vendor lookup with: "${testVendorName}"`);
        
        const result = await vendorService.findVendorByName(testVendorName);
        
        if (result) {
            console.log('✅ SUCCESS: Production connection working!');
            console.log(`   Found vendor: ${result.name} (ID: ${result.id})`);
            return true;
        } else {
            console.log('⚠️  Connection successful but vendor not found');
            console.log('   This might be normal if the vendor doesn\'t exist in production');
            return true;
        }
        
    } catch (error) {
        console.error('❌ FAILED: Production connection failed');
        console.error(`   Error: ${error.message}`);
        
        if (error.message.includes('Missing required environment variable')) {
            console.error('   This suggests environment variables are not properly configured');
        } else if (error.message.includes('404')) {
            console.error('   This suggests the REST API endpoint is not available in production');
        } else if (error.message.includes('401') || error.message.includes('403')) {
            console.error('   This suggests authentication/authorization issues');
        }
        
        return false;
    }
}

// Run the test
if (require.main === module) {
    testProductionConnection()
        .then(success => {
            if (success) {
                console.log('\n🎉 Production connection test completed successfully!');
                process.exit(0);
            } else {
                console.log('\n❌ Production connection test failed!');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('\n💥 UNEXPECTED ERROR:', error);
            process.exit(1);
        });
}

module.exports = testProductionConnection;

