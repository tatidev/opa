#!/usr/bin/env node

/**
 * Clean Up Non-Fabric Supplier Vendor Mappings
 * 
 * This script deactivates vendor mappings that point to NetSuite vendors
 * that are NOT in the "Fabric Supplier" category.
 * 
 * These mappings were created when we had all 365 NetSuite vendors,
 * but are now invalid since we're only working with 162 Fabric Suppliers.
 */

const db = require('../src/db');
const logger = require('../src/utils/logger');

// NetSuite vendor IDs that are NOT in "Fabric Supplier" category
// (from the diagnostic report "NOT FOUND" entries)
const NON_FABRIC_SUPPLIER_IDS = [
    4305,  // Alois Tessitura Serica
    590,   // Anne Kirk Textiles
    4312,  // Edgar Fabrics
    4322,  // Libas
    441,   // Lisa Slayman Design
    4324,  // Mayer Fabrics
    569,   // Nassimi Textiles
    4327,  // Nelen & Delbeke
    4339,  // Opuzen
    4331,  // Spradling
    3820,  // Universal Textile Mills
    // Add any others identified in diagnostic report
];

async function cleanupNonFabricSupplierMappings() {
    try {
        console.log('\n🧹 Starting cleanup of non-Fabric Supplier vendor mappings...\n');
        console.log('════════════════════════════════════════════════════════════════');
        
        // Get current mappings that will be deactivated
        const currentMappings = await db.query(`
            SELECT 
                id,
                opms_vendor_id,
                opms_vendor_name,
                netsuite_vendor_id,
                netsuite_vendor_name
            FROM opms_netsuite_vendor_mapping
            WHERE netsuite_vendor_id IN (?)
            AND is_active = 1
        `, [NON_FABRIC_SUPPLIER_IDS]);
        
        if (currentMappings.length === 0) {
            console.log('✅ No mappings found to clean up. All mappings are valid!');
            return;
        }
        
        console.log(`⚠️  Found ${currentMappings.length} mappings to deactivate:\n`);
        currentMappings.forEach((mapping, index) => {
            console.log(`   ${index + 1}. ${mapping.opms_vendor_name} (OPMS ${mapping.opms_vendor_id})`);
            console.log(`      → ${mapping.netsuite_vendor_name} (NS ${mapping.netsuite_vendor_id})`);
            console.log(`      Mapping ID: ${mapping.id}\n`);
        });
        
        // Confirm with user
        console.log('════════════════════════════════════════════════════════════════');
        console.log(`\n⚠️  This will DEACTIVATE ${currentMappings.length} mappings.\n`);
        console.log('The mappings will remain in the database but marked as inactive.');
        console.log('This is reversible - you can reactivate them later if needed.\n');
        
        // Since this script might be run in automated mode, we'll proceed
        // In production, you might want to add readline-sync for manual confirmation
        
        console.log('🔄 Proceeding with deactivation...\n');
        
        // Deactivate mappings
        const result = await db.query(`
            UPDATE opms_netsuite_vendor_mapping
            SET is_active = 0,
                notes = CONCAT(
                    COALESCE(notes, ''),
                    ' | Deactivated: NetSuite vendor not in Fabric Supplier category (', 
                    NOW(),
                    ')'
                ),
                updated_at = NOW()
            WHERE netsuite_vendor_id IN (?)
            AND is_active = 1
        `, [NON_FABRIC_SUPPLIER_IDS]);
        
        logger.info(`✅ Deactivated ${result.affectedRows} vendor mappings`);
        
        console.log('\n════════════════════════════════════════════════════════════════');
        console.log('✅ Cleanup Complete!\n');
        console.log(`📊 Summary:`);
        console.log(`   - Mappings deactivated: ${result.affectedRows}`);
        console.log(`   - Reason: NetSuite vendors not in "Fabric Supplier" category`);
        console.log(`   - Status: Reversible (can reactivate if needed)\n`);
        
        console.log('🎯 Next Steps:');
        console.log('   1. Run diagnostic: node scripts/diagnose-vendor-mapping.js');
        console.log('   2. Verify pass rate improved to ~96%');
        console.log('   3. Review Tier 2 approvals');
        console.log('');
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error.message);
        logger.error('Cleanup error:', error);
        throw error;
    } finally {
        // Database connection pool will close automatically
        process.exit(0);
    }
}

// Run if executed directly
if (require.main === module) {
    cleanupNonFabricSupplierMappings()
        .then(() => {
            console.log('🎉 Cleanup completed successfully!\n');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Cleanup failed:', error.message);
            process.exit(1);
        });
}

module.exports = cleanupNonFabricSupplierMappings;

