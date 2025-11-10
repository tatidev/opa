#!/usr/bin/env node

/**
 * Create Real NetSuite Item for Field Inspection
 * Creates actual NetSuite item with all 22 custom fields populated
 * Item will NOT be deleted - available for manual inspection
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000';
const NETSUITE_ENDPOINT = '/api/netsuite/items';

// Comprehensive test data with all fields populated
const inspectionItemData = {
    // Required fields
    itemId: `opmsAPI-INSPECT-ALL-FIELDS-${Date.now()}`,
    displayName: 'INSPECTION ITEM: All 22 Custom Fields Populated',
    
    // Core OPMS Data (17 fields) - using correct field names
    custitem_opms_item_id: 99999,
    custitem_opms_prod_id: 88888, // Correct NetSuite field name
    custitem_opms_parent_product_name: 'Inspection Test Product',
    fabricWidth: '54.00', // Maps to custitem_opms_fabric_width
    custitem_opms_is_repeat: 'Y', // Maps to custitem_is_repeat in NetSuite
    itemColors: 'Inspection Red, Inspection Blue', // Maps to custitem_opms_item_colors
    custitem_opms_vendor_color: 'INSPECT-COLOR-001',
    custitem_opms_vendor_prod_name: 'Inspection Vendor Product',
    finish: 'Inspection Finish 1, Inspection Finish 2', // Maps to custitem_opms_finish
    cleaning: 'Inspection Cleaning Instructions', // Maps to custitem_opms_fabric_cleaning
    origin: 'Inspection Origin Country', // Maps to custitem_opms_product_origin
    custitem_vertical_repeat: '25.00',
    custitem_horizontal_repeat: '15.00',
    custitem_prop65_compliance: 'Y',
    custitem_ab2998_compliance: 'N',
    custitem_tariff_harmonized_code: 'INSPECT.CODE.123',
    custitemf3_lisa_item: false,
    custitem_item_application: 'Inspection App 1, Inspection App 2',
    
    // Mini-Forms Rich Text (4 fields)
    frontContent: [
        { percentage: '70%', content: 'Inspection Front Material 1' },
        { percentage: '30%', content: 'Inspection Front Material 2' }
    ],
    backContent: [
        { percentage: '100%', content: 'Inspection Back Material' }
    ],
    abrasion: [
        { testMethod: 'Inspection Test Method', rubs: '50000', limit: '25000' }
    ],
    firecodes: [
        { certification: 'Inspection Fire Certification', passRate: 'Pass' }
    ],
    
    // NetSuite constants
    usebins: true,
    matchbilltoreceipt: true,
    taxschedule: "1",
    unitstype: "1",
    subsidiary: "2"
};

async function createInspectionItem() {
    console.log('🔍 CREATING REAL NETSUITE ITEM FOR FIELD INSPECTION');
    console.log('=' .repeat(80));
    console.log(`📅 Started: ${new Date().toISOString()}`);
    console.log(`🎯 Item ID: ${inspectionItemData.itemId}`);
    console.log('⚠️  WARNING: This item will NOT be automatically deleted');
    console.log('   You must manually delete it when inspection is complete');
    console.log('');

    try {
        console.log('📡 Creating real NetSuite item...');
        
        const response = await axios.post(`${API_BASE_URL}${NETSUITE_ENDPOINT}`, inspectionItemData, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'OPMS-Field-Inspection/1.0'
            },
            timeout: 60000
        });

        console.log('✅ SUCCESS! Real NetSuite item created for inspection');
        console.log(`   Status: ${response.status}`);
        console.log('');

        const responseData = response.data;
        console.log('📊 INSPECTION ITEM DETAILS:');
        console.log('-' .repeat(50));
        console.log(`✅ Success: ${responseData.success}`);
        console.log(`🆔 NetSuite Item ID: ${responseData.id}`);
        console.log(`📝 Item Name: ${inspectionItemData.itemId}`);
        console.log(`🏷️  Display Name: ${inspectionItemData.displayName}`);
        console.log('');

        if (responseData.customFields) {
            console.log('🔍 CUSTOM FIELDS POPULATED FOR INSPECTION:');
            console.log('-' .repeat(60));
            
            // Show key fields that should be populated
            const keyFields = [
                'custitem_opms_item_id',
                'custitem_opms_prod_id',
                'custitem_opms_parent_product_name',
                'custitem_opms_fabric_width',
                'custitem_is_repeat',
                'custitem_opms_item_colors',
                'custitem_opms_vendor_color',
                'custitem_opms_vendor_prod_name',
                'custitem_opms_finish',
                'custitem_opms_fabric_cleaning',
                'custitem_opms_product_origin',
                'custitem_vertical_repeat',
                'custitem_horizontal_repeat',
                'custitem_prop65_compliance',
                'custitem_ab2998_compliance',
                'custitem_tariff_harmonized_code',
                'custitemf3_lisa_item',
                'custitem_item_application',
                'custitem_opms_front_content',
                'custitem_opms_back_content',
                'custitem_opms_abrasion',
                'custitem_opms_firecodes'
            ];
            
            keyFields.forEach(field => {
                const value = responseData.customFields[field];
                const status = value !== undefined && value !== null && value !== '' ? '✅' : '❌';
                let displayValue = value;
                
                if (field.includes('content') || field.includes('abrasion') || field.includes('firecodes')) {
                    displayValue = value ? 'HTML Generated ✓' : 'NOT SET';
                } else if (typeof value === 'string' && value.length > 50) {
                    displayValue = value.substring(0, 50) + '...';
                }
                
                console.log(`   ${status} ${field}: ${displayValue}`);
            });
        }

        console.log('\n🎯 INSPECTION INSTRUCTIONS:');
        console.log('=' .repeat(50));
        console.log(`1. Go to NetSuite Sandbox`);
        console.log(`2. Navigate to: Items → Inventory Items`);
        console.log(`3. Search for: ${inspectionItemData.itemId}`);
        console.log(`4. Or go directly to Item ID: ${responseData.id}`);
        console.log(`5. Inspect all custom fields and their values`);
        console.log(`6. Verify field types and permissions`);
        console.log(`7. Check mini-forms HTML formatting`);
        console.log('');
        console.log('🗑️  CLEANUP: Manually delete this item when inspection complete');
        console.log(`   NetSuite Item ID: ${responseData.id}`);
        console.log(`   Item Name: ${inspectionItemData.itemId}`);

    } catch (error) {
        console.error('❌ ERROR creating inspection item:');
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Message: ${error.response.data?.error || error.response.statusText}`);
        } else {
            console.error(`   ${error.message}`);
        }
        process.exit(1);
    }
}

// Run the inspection item creation
if (require.main === module) {
    createInspectionItem()
        .then(() => {
            console.log('\n🎉 Inspection item created successfully!');
            console.log('📋 Item available for field inspection in NetSuite Sandbox');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Inspection item creation failed:', error.message);
            process.exit(1);
        });
}

module.exports = { createInspectionItem };
