#!/usr/bin/env node

/**
 * Debug script to investigate vendor data issue
 * Checks what vendor data is being sent to NetSuite
 */

const OpmsDataTransformService = require('./src/services/OpmsDataTransformService');

async function debugVendorData() {
    console.log('🔍 Debugging vendor data for item 44249...\n');
    
    try {
        const transformService = new OpmsDataTransformService();
        
        // Step 1: Extract OPMS data
        console.log('1️⃣ Extracting OPMS data...');
        const opmsData = await transformService.extractOpmsItemData(44249);
        console.log('OPMS Data:', JSON.stringify(opmsData, null, 2));
        
        // Step 2: Validate fields
        console.log('\n2️⃣ Validating fields...');
        const validatedData = await transformService.validateOpmsFields(opmsData);
        console.log('Validated Data:', JSON.stringify(validatedData, null, 2));
        
        // Step 3: Build NetSuite payload
        console.log('\n3️⃣ Building NetSuite payload...');
        const payload = await transformService.buildNetSuitePayload(validatedData);
        console.log('NetSuite Payload:', JSON.stringify(payload, null, 2));
        
        // Step 4: Check vendor-specific fields
        console.log('\n4️⃣ Vendor-specific fields:');
        console.log('vendor:', payload.vendor);
        console.log('vendorcode:', payload.vendorcode);
        console.log('vendorName:', payload.vendorName);
        console.log('custitem_opms_vendor_prod_name:', payload.custitem_opms_vendor_prod_name);
        console.log('custitem_opms_vendor_color:', payload.custitem_opms_vendor_color);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

debugVendorData();
