#!/usr/bin/env node

require('dotenv').config();
const OpmsDataTransformService = require('../src/services/OpmsDataTransformService');

async function debugPayloadFieldNames() {
    console.log('🔍 DEBUGGING PAYLOAD FIELD NAMES');
    console.log('=================================');
    
    try {
        const transformService = new OpmsDataTransformService();
        
        // Test the payload generation for item 13636
        console.log('\n📊 Generating payload for item 13636:');
        const payload = await transformService.transformItemForNetSuite(13636);
        
        console.log('\n🔍 Checking critical field names:');
        console.log('payload.itemId:', payload.itemId);
        console.log('payload.itemid:', payload.itemid);
        console.log('payload.displayname:', payload.displayname);
        console.log('payload.displayName:', payload.displayName);
        
        console.log('\n📋 All payload keys:');
        console.log(Object.keys(payload).sort());
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

debugPayloadFieldNames();
