#!/usr/bin/env node

/**
 * Test Production OAuth Configuration
 * Validates that production OAuth tokens are properly configured
 */

const dotenv = require('dotenv');
dotenv.config();

console.log('🔍 Testing NetSuite Production OAuth Configuration...\n');

// Check environment variables
const requiredVars = [
    'NETSUITE_CONSUMER_KEY_PROD',
    'NETSUITE_CONSUMER_SECRET_PROD',
    'NETSUITE_TOKEN_ID_PROD',
    'NETSUITE_TOKEN_SECRET_PROD',
    'NETSUITE_ACCOUNT_ID_PROD'
];

let allPresent = true;
for (const varName of requiredVars) {
    const value = process.env[varName];
    if (!value) {
        console.log(`❌ Missing: ${varName}`);
        allPresent = false;
    } else {
        // Show partial value for security
        const partial = value.substring(0, 8) + '...' + value.substring(value.length - 4);
        console.log(`✅ ${varName}: ${partial}`);
    }
}

console.log(`\n📋 Account ID: ${process.env.NETSUITE_ACCOUNT_ID_PROD}`);
console.log(`🌐 RESTlet URL: https://${process.env.NETSUITE_ACCOUNT_ID_PROD}.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1762&deploy=1`);

if (!allPresent) {
    console.log('\n❌ Some required environment variables are missing!');
    process.exit(1);
}

console.log('\n✅ All environment variables are present!');
console.log('\n📋 Next steps to fix 401 error:');
console.log('   1. In NetSuite Production, go to the RESTlet deployment');
console.log('   2. Check the "Audience" tab - ensure your user/role is included');
console.log('   3. Verify the Integration Record has "TBA: Token-Based Authentication" enabled');
console.log('   4. Make sure the Access Token is "Active" and not expired');
console.log('   5. Verify the Integration has the "RESTlet" role/permission');


