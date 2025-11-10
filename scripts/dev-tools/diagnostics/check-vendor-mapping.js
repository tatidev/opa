#!/usr/bin/env node

/**
 * Check vendor mapping table directly
 */

const BaseModel = require('./src/models/BaseModel');

async function checkVendorMapping() {
    console.log('🔍 Checking vendor mapping table...\n');
    
    try {
        const model = new BaseModel();
        
        // Check Mayer Fabrics mapping
        console.log('1️⃣ Checking Mayer Fabrics mapping...');
        const query = `
            SELECT 
                m.id,
                m.opms_vendor_id,
                m.opms_vendor_name,
                m.netsuite_vendor_id,
                m.netsuite_vendor_name,
                v.name as current_vendor_name,
                v.active,
                v.archived
            FROM opms_netsuite_vendor_mapping m
            LEFT JOIN Z_VENDOR v ON m.opms_vendor_id = v.id
            WHERE m.opms_vendor_id = 168 OR m.netsuite_vendor_id = 4324
        `;
        
        const results = await model.executeQuery(query);
        
        if (results.length > 0) {
            console.log('✅ Found mapping(s):');
            results.forEach((row, index) => {
                console.log(`\nMapping ${index + 1}:`);
                console.log(`  OPMS Vendor ID: ${row.opms_vendor_id}`);
                console.log(`  OPMS Vendor Name (mapping): ${row.opms_vendor_name}`);
                console.log(`  OPMS Vendor Name (current): ${row.current_vendor_name}`);
                console.log(`  NetSuite Vendor ID: ${row.netsuite_vendor_id}`);
                console.log(`  NetSuite Vendor Name: ${row.netsuite_vendor_name}`);
                console.log(`  Vendor Active: ${row.active}`);
                console.log(`  Vendor Archived: ${row.archived}`);
                
                // Check for mismatches
                if (row.opms_vendor_name !== row.current_vendor_name) {
                    console.log(`  ⚠️  MISMATCH: Mapping name "${row.opms_vendor_name}" != Current name "${row.current_vendor_name}"`);
                }
                if (row.opms_vendor_name !== row.netsuite_vendor_name) {
                    console.log(`  ⚠️  MISMATCH: OPMS name "${row.opms_vendor_name}" != NetSuite name "${row.netsuite_vendor_name}"`);
                }
            });
        } else {
            console.log('❌ No mapping found for Mayer Fabrics (vendor ID 168 or NetSuite ID 4324)');
        }
        
        // Check all vendor mappings
        console.log('\n2️⃣ All vendor mappings:');
        const allMappings = await model.executeQuery(`
            SELECT 
                m.opms_vendor_id,
                m.opms_vendor_name,
                m.netsuite_vendor_id,
                m.netsuite_vendor_name,
                v.name as current_vendor_name
            FROM opms_netsuite_vendor_mapping m
            LEFT JOIN Z_VENDOR v ON m.opms_vendor_id = v.id
            ORDER BY m.opms_vendor_id
        `);
        
        console.log(`Found ${allMappings.length} total mappings:`);
        allMappings.forEach(row => {
            console.log(`  OPMS ${row.opms_vendor_id} (${row.current_vendor_name}) → NetSuite ${row.netsuite_vendor_id} (${row.netsuite_vendor_name})`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

checkVendorMapping();
