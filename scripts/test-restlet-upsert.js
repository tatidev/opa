#!/usr/bin/env node

/**
 * Test script to verify RESTlet UPSERT functionality
 * This will call the RESTlet directly to see if it's working
 */

const https = require('https');
const querystring = require('querystring');

// Test payload - same as what the sync service sends
const testPayload = {
  "itemId": "6148-4501",
  "upcCode": "6148-4501", 
  "taxScheduleId": "1",
  "description": "ACDC: Teal",
  "displayName": "ACDC: Teal",
  "vendor": "302",
  "vendorcode": "ACDC",
  "custitem_opms_vendor_color": "Teal_PKL-TEST-01A",
  "custitem_opms_vendor_prod_name": "ACDC",
  "custitem_vertical_repeat": "26.00",
  "custitem_horizontal_repeat": "27.50",
  "custitem_prop65_compliance": "Don't Know",
  "custitem_ab2998_compliance": "Yes",
  "custitem_tariff_harmonized_code": "5801.37.5010",
  "custitem_item_application": "Pillows, Upholstery",
  "custitem_opms_parent_product_name": "ACDC",
  "custitem_opms_item_id": 13385,
  "custitem_opms_prod_id": 2823,
  "custitem_is_repeat": true
};

// RESTlet URL with updated deployment
const restletUrl = 'https://11516011-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1471&deploy=6';

// OAuth credentials (you'll need to set these)
const credentials = {
  consumerKey: process.env.NETSUITE_CONSUMER_KEY,
  consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
  tokenId: process.env.NETSUITE_TOKEN_ID,
  tokenSecret: process.env.NETSUITE_TOKEN_SECRET,
  accountId: process.env.NETSUITE_ACCOUNT_ID_SANDBOX
};

console.log('🧪 Testing RESTlet UPSERT functionality...');
console.log('📡 RESTlet URL:', restletUrl);
console.log('📦 Test Payload:', JSON.stringify(testPayload, null, 2));

// Simple OAuth 1.0a implementation for testing
function generateOAuthHeader(method, url, params) {
  const oauthParams = {
    oauth_consumer_key: credentials.consumerKey,
    oauth_token: credentials.tokenId,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: Math.random().toString(36).substring(2, 15),
    oauth_version: '1.0'
  };

  // Create signature base string
  const allParams = { ...oauthParams, ...params };
  const sortedParams = Object.keys(allParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
    .join('&');
  
  const signatureBaseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  
  // Generate signature
  const signingKey = `${encodeURIComponent(credentials.consumerSecret)}&${encodeURIComponent(credentials.tokenSecret)}`;
  const crypto = require('crypto');
  const signature = crypto.createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');
  
  oauthParams.oauth_signature = signature;
  
  // Create Authorization header
  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');
    
  return authHeader;
}

function testRestlet() {
  const postData = JSON.stringify(testPayload);
  
  const options = {
    hostname: '11516011-sb1.restlets.api.netsuite.com',
    port: 443,
    path: '/app/site/hosting/restlet.nl?script=1471&deploy=6',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Authorization': generateOAuthHeader('POST', restletUrl, testPayload)
    }
  };

  console.log('🔐 OAuth Header:', options.headers.Authorization);

  const req = https.request(options, (res) => {
    console.log(`📡 Response Status: ${res.statusCode} ${res.statusMessage}`);
    console.log('📋 Response Headers:', res.headers);
    
    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      console.log('📥 Response Body:', responseData);
      
      try {
        const parsedResponse = JSON.parse(responseData);
        console.log('✅ Parsed Response:', JSON.stringify(parsedResponse, null, 2));
        
        if (parsedResponse.success) {
          console.log('🎉 SUCCESS! RESTlet responded successfully');
          console.log('🔄 Operation:', parsedResponse.operation || 'Unknown');
          console.log('🆔 Item ID:', parsedResponse.id || 'Unknown');
        } else {
          console.log('❌ FAILED! RESTlet returned error:', parsedResponse.error);
        }
      } catch (error) {
        console.log('❌ Failed to parse response as JSON:', error.message);
        console.log('📄 Raw response:', responseData);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request failed:', error.message);
  });

  req.write(postData);
  req.end();
}

// Check if credentials are available
if (!credentials.consumerKey || !credentials.consumerSecret || !credentials.tokenId || !credentials.tokenSecret) {
  console.log('❌ Missing OAuth credentials. Please set the following environment variables:');
  console.log('   NETSUITE_CONSUMER_KEY');
  console.log('   NETSUITE_CONSUMER_SECRET'); 
  console.log('   NETSUITE_TOKEN_ID');
  console.log('   NETSUITE_TOKEN_SECRET');
  console.log('   NETSUITE_ACCOUNT_ID_SANDBOX');
  process.exit(1);
}

testRestlet();
