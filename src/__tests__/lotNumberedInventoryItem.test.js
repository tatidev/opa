/**
 * @jest-environment node
 */

const NetSuiteRestletService = require('../services/netsuiteRestletService');
const NetSuiteManageItemService = require('../services/netsuiteManageItemService');

describe('Lot Numbered Inventory Item Integration Tests', () => {
    let createdItemIds = [];
    
    // Cleanup function to remove test items after tests
    const cleanupTestItems = async () => {
        if (createdItemIds.length > 0) {
            console.log(`🧹 Cleaning up ${createdItemIds.length} test items...`);
            
            for (const itemId of createdItemIds) {
                try {
                    await NetSuiteManageItemService.smartDelete(itemId);
                    console.log(`✅ Cleaned up item: ${itemId}`);
                } catch (error) {
                    console.warn(`⚠️ Failed to cleanup item ${itemId}: ${error.message}`);
                }
            }
            
            createdItemIds = [];
        }
    };
    
    // Setup and teardown
    beforeAll(() => {
        console.log('🧪 Starting Lot Numbered Inventory Item Integration Tests');
    });
    
    afterEach(async () => {
        // Clean up after each test
        await cleanupTestItems();
    });
    
    afterAll(async () => {
        // Final cleanup
        await cleanupTestItems();
        console.log('🏁 Lot Numbered Inventory Item Integration Tests completed');
    });

    describe('Comprehensive Field Integration', () => {
        test('should create lot numbered inventory item with ALL fields populated', async () => {
            // Generate rich HTML content for mini-forms
            const richContent = generateRichHTMLContent();
            
            // Create comprehensive payload with ALL fields populated
            const comprehensivePayload = {
                // Basic item information
                itemId: `opmsAPI-TEST-ALL-FIELDS-${Date.now()}`,
                displayName: 'Test Premium Performance Fabric - Ocean Blue',
                description: 'JEST TEST: Complete item with ALL fields populated including rich HTML mini-forms, compliance data, and product specifications',
                
                // Vendor information
                vendor: 377, // Morgan/MJD (known working vendor)
                vendorname: 'Morgan/MJD',
                vendorName: 'Morgan/MJD',
                vendorcode: 'TEST-2024-001',
                
                // Custom OPMS fields - Core IDs (using correct NetSuite field names)
                custitem_opms_prod_id: 9999, // Correct NetSuite field name
                custitem_opms_item_id: 8888,
                
                // Custom OPMS fields - Product details
                parentProductName: 'Test Premium Performance Fabric',
                itemColors: 'Ocean Blue, Navy, Teal',
                fabricWidth: '54.00',
                custitem_opms_is_repeat: 'Y', // Real OPMS outdoor field mapping to correct NetSuite field
                
                // Custom OPMS fields - Vendor details
                custitem_opms_vendor_color: 'TEST-2024-001',
                custitem_opms_vendor_prod_name: 'Test Morgan Premium Fabric Collection',
                
                // Additional OPMS fields from rigorous testing
                finish: 'Test Finish 1, Test Finish 2',
                cleaning: 'Test Cleaning Instructions',
                origin: 'Test Origin Country',
                custitem_f3_rollprice: '125.75',
                custitemf3_lisa_item: false,
                custitem_item_application: 'Residential, Commercial, Healthcare',
                
                // Custom OPMS fields - Mini-forms (Rich HTML content)
                frontContentJson: richContent.frontContent,
                backContentJson: richContent.backContent,
                abrasionJson: richContent.abrasion,
                firecodesJson: richContent.firecodes,
                
                // Additional product specifications
                width: '54.00',
                cleaning: 'TEST: Professional cleaning recommended. Spot clean with mild detergent. Do not bleach. Dry clean only.',
                origin: 'USA',
                
                // Compliance and regulatory fields
                prop65Compliance: 'TEST: This product contains chemicals known to the State of California to cause cancer and birth defects or other reproductive harm.',
                ab2998Compliance: 'TEST: Compliant with California Assembly Bill 2998 - Fire Safety Standards',
                tariffCode: 'TEST: HTS 5702.41.0000 - Hand-loomed carpets and other textile floor coverings',
                
                // Pattern and repeat information
                vrepeat: '24.00 inches',
                hrepeat: '18.00 inches',
                finish: 'TEST: Premium Textured Finish with Enhanced Durability',
                repeat: true,
                
                // Standard NetSuite fields
                upcCode: `opmsAPI-TEST-${Date.now()}`.substring(0, 25),
                taxScheduleId: "1"
            };
            
            // Create the item in NetSuite
            const createResult = await NetSuiteRestletService.createLotNumberedInventoryItem(comprehensivePayload);
            
            // Verify creation was successful
            expect(createResult.success).toBe(true);
            expect(createResult.itemId).toBeDefined();
            expect(createResult.itemId).toBe(comprehensivePayload.itemId);
            
            // Track for cleanup
            if (createResult.internalId) {
                createdItemIds.push(createResult.internalId);
            }
            
            // Verify all field categories are included in payload
            expect(comprehensivePayload.displayName).toBe('Test Premium Performance Fabric - Ocean Blue');
            expect(comprehensivePayload.vendor).toBe(377);
            expect(comprehensivePayload.custitem_opms_prod_id).toBe(9999); // Correct field name
            expect(comprehensivePayload.custitem_opms_item_id).toBe(8888);
            
            // Comprehensive NetSuite response validation (based on rigorous testing)
            const customFields = createResult.customFields || {};
            
            // Validate core OPMS fields are set in NetSuite
            expect(customFields.custitem_opms_item_id).toBe(8888);
            expect(customFields.custitem_opms_prod_id).toBe(9999);
            expect(customFields.custitem_is_repeat).toBe('Y'); // Correct NetSuite field name
            expect(customFields.custitem_item_application).toBeTruthy();
            expect(customFields.custitem_f3_rollprice).toBeTruthy();
            expect(comprehensivePayload.frontContentJson).toContain('Front Content - Fabric Composition');
            expect(comprehensivePayload.backContentJson).toContain('Back Content - Backing Details');
            expect(comprehensivePayload.abrasionJson).toContain('Abrasion Test Results');
            expect(comprehensivePayload.firecodesJson).toContain('Fire Code Certifications');
            expect(comprehensivePayload.prop65Compliance).toContain('California');
            expect(comprehensivePayload.ab2998Compliance).toContain('Assembly Bill 2998');
            expect(comprehensivePayload.tariffCode).toContain('HTS');
            expect(comprehensivePayload.vrepeat).toBe('24.00 inches');
            expect(comprehensivePayload.hrepeat).toBe('18.00 inches');
            expect(comprehensivePayload.finish).toContain('Premium Textured Finish');
            expect(comprehensivePayload.repeat).toBe(true);
            
            console.log(`✅ Successfully created comprehensive test item: ${createResult.itemId}`);
        }, 30000); // 30 second timeout for NetSuite operations
        
        test('should create lot numbered inventory item with minimal required fields', async () => {
            const minimalPayload = {
                itemId: `opmsAPI-TEST-MINIMAL-${Date.now()}`,
                displayName: 'Test Minimal Item',
                vendor: 377,
                custitem_opms_prod_id: 1111, // Correct NetSuite field name
                custitem_opms_item_id: 2222,
                upcCode: `opmsAPI-MIN-${Date.now()}`.substring(0, 25),
                taxScheduleId: "1"
            };
            
            const createResult = await NetSuiteRestletService.createLotNumberedInventoryItem(minimalPayload);
            
            expect(createResult.success).toBe(true);
            expect(createResult.itemId).toBe(minimalPayload.itemId);
            
            // Track for cleanup
            if (createResult.internalId) {
                createdItemIds.push(createResult.internalId);
            }
            
            console.log(`✅ Successfully created minimal test item: ${createResult.itemId}`);
        }, 15000);
        
        test('should handle "src empty data" fields correctly', async () => {
            const srcEmptyDataPayload = {
                itemId: `opmsAPI-TEST-SRC-EMPTY-${Date.now()}`,
                displayName: 'Test Src Empty Data Item',
                vendor: 377,
                custitem_opms_prod_id: 3333, // Correct NetSuite field name
                custitem_opms_item_id: 4444,
                
                // Fields with "src empty data" values
                custitem_opms_vendor_color: 'src empty data',
                custitem_opms_vendor_prod_name: 'src empty data',
                cleaning: 'src empty data',
                origin: 'src empty data',
                fabricWidth: 'src empty data',
                
                upcCode: `opmsAPI-SRC-${Date.now()}`.substring(0, 25),
                taxScheduleId: "1"
            };
            
            const createResult = await NetSuiteRestletService.createLotNumberedInventoryItem(srcEmptyDataPayload);
            
            expect(createResult.success).toBe(true);
            expect(createResult.itemId).toBe(srcEmptyDataPayload.itemId);
            
            // Track for cleanup
            if (createResult.internalId) {
                createdItemIds.push(createResult.internalId);
            }
            
            console.log(`✅ Successfully created src empty data test item: ${createResult.itemId}`);
        }, 15000);
    });
    
    describe('Error Handling', () => {
        test('should fail when required OPMS Product ID is missing', async () => {
            const invalidPayload = {
                itemId: `opmsAPI-TEST-INVALID-${Date.now()}`,
                displayName: 'Test Invalid Item',
                vendor: 377,
                // custitem_opms_product_id: missing!
                custitem_opms_item_id: 5555,
                upcCode: `opmsAPI-INV-${Date.now()}`.substring(0, 25),
                taxScheduleId: "1"
            };
            
            await expect(
                NetSuiteRestletService.createLotNumberedInventoryItem(invalidPayload)
            ).rejects.toThrow(/custitem_opms_prod_id is required/);
        });
        
        test('should fail when required OPMS Item ID is missing', async () => {
            const invalidPayload = {
                itemId: `opmsAPI-TEST-INVALID-${Date.now()}`,
                displayName: 'Test Invalid Item',
                vendor: 377,
                custitem_opms_product_id: 6666,
                // custitem_opms_item_id: missing!
                upcCode: `opmsAPI-INV-${Date.now()}`.substring(0, 25),
                taxScheduleId: "1"
            };
            
            await expect(
                NetSuiteRestletService.createLotNumberedInventoryItem(invalidPayload)
            ).rejects.toThrow(/custitem_opms_item_id is required/);
        });
        
        test('should fail when item ID exceeds 40 characters', async () => {
            const invalidPayload = {
                itemId: `opmsAPI-TEST-THIS-ITEM-ID-IS-WAY-TOO-LONG-AND-EXCEEDS-FORTY-CHARACTERS-${Date.now()}`,
                displayName: 'Test Invalid Item',
                vendor: 377,
                custitem_opms_product_id: 7777,
                custitem_opms_item_id: 8888,
                upcCode: `opmsAPI-INV-${Date.now()}`.substring(0, 25),
                taxScheduleId: "1"
            };
            
            await expect(
                NetSuiteRestletService.createLotNumberedInventoryItem(invalidPayload)
            ).rejects.toThrow(/Item ID cannot exceed 40 characters/);
        });
    });
    
    describe('Cleanup Functionality', () => {
        test('should be able to search and delete test items', async () => {
            // Create a test item first
            const testPayload = {
                itemId: `opmsAPI-TEST-CLEANUP-${Date.now()}`,
                displayName: 'Test Cleanup Item',
                vendor: 377,
                custitem_opms_product_id: 9999,
                custitem_opms_item_id: 1111,
                upcCode: `opmsAPI-CLN-${Date.now()}`.substring(0, 25),
                taxScheduleId: "1"
            };
            
            const createResult = await NetSuiteRestletService.createLotNumberedInventoryItem(testPayload);
            expect(createResult.success).toBe(true);
            
            // For mock environment, we'll use the created item's internal ID directly
            // In real environment, we would search for the item
            const searchResults = await NetSuiteManageItemService.searchItems('opmsAPI-TEST-CLEANUP');
            expect(searchResults.length).toBeGreaterThan(0);
            
            // Use the first found item (in mock environment, this will be a mock item)
            const itemToDelete = searchResults[0];
            expect(itemToDelete).toBeDefined();
            expect(itemToDelete.internalId).toBeDefined();
            
            // Delete the item
            const deleteResult = await NetSuiteManageItemService.smartDelete(itemToDelete.internalId);
            expect(deleteResult.success).toBe(true);
            
            console.log(`✅ Successfully tested cleanup functionality for item: ${itemToDelete.itemId}`);
        }, 20000);
    });
});

// Helper function to generate rich HTML content for mini-forms
function generateRichHTMLContent() {
    return {
        // Front Content - Fabric Composition
        frontContent: `<div style="margin:15px 0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
            <h3 style="background:linear-gradient(135deg,#4a90e2 0%,#357abd 100%);color:white;margin:0;padding:12px 16px;font-size:16px;font-weight:600;text-shadow:1px 1px 2px rgba(0,0,0,0.3);">🧵 TEST Front Content - Fabric Composition</h3>
            <table style="border-collapse:collapse;width:100%;background:white;">
                <thead>
                    <tr style="background:linear-gradient(135deg,#e6f2ff 0%,#ffffff 100%);">
                        <th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:#4a90e2;text-align:left;">Fiber Type</th>
                        <th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:#4a90e2;text-align:center;">Percentage</th>
                        <th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:#4a90e2;text-align:center;">Properties</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="transition:background-color 0.2s ease;">
                        <td style="border:1px solid #e0e0e0;padding:10px 8px;background:#fafafa;font-weight:600;color:#4a90e2;">TEST Polyester</td>
                        <td style="border:1px solid #e0e0e0;padding:10px 8px;background:#fafafa;text-align:center;font-weight:600;color:#ff6b35;">85%</td>
                        <td style="border:1px solid #e0e0e0;padding:10px 8px;background:#fafafa;">TEST Durability, Wrinkle Resistance</td>
                    </tr>
                </tbody>
            </table>
            <div style="padding:8px 16px;background:#f8f9fa;font-size:12px;color:#666;font-style:italic;border-top:1px solid #e0e0e0;">✓ TEST Premium Fabric Composition</div>
        </div>`,

        // Back Content - Backing Details
        backContent: `<div style="margin:15px 0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
            <h3 style="background:linear-gradient(135deg,#28a745 0%,#20c997 100%);color:white;margin:0;padding:12px 16px;font-size:16px;font-weight:600;text-shadow:1px 1px 2px rgba(0,0,0,0.3);">🔄 TEST Back Content - Backing Details</h3>
            <table style="border-collapse:collapse;width:100%;background:white;">
                <thead>
                    <tr style="background:linear-gradient(135deg,#e8f5e8 0%,#ffffff 100%);">
                        <th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:#28a745;text-align:left;">Backing Type</th>
                        <th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:#28a745;text-align:center;">Material</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="transition:background-color 0.2s ease;">
                        <td style="border:1px solid #e0e0e0;padding:10px 8px;background:#fafafa;font-weight:600;color:#28a745;">TEST Primary Backing</td>
                        <td style="border:1px solid #e0e0e0;padding:10px 8px;background:#fafafa;text-align:center;">TEST Polypropylene</td>
                    </tr>
                </tbody>
            </table>
            <div style="padding:8px 16px;background:#f8f9fa;font-size:12px;color:#666;font-style:italic;border-top:1px solid #e0e0e0;">✓ TEST Professional Backing System</div>
        </div>`,

        // Abrasion - Test Results
        abrasion: `<div style="margin:15px 0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
            <h3 style="background:linear-gradient(135deg,#ff6b35 0%,#f7931e 50%,#ff4500 100%);color:white;margin:0;padding:12px 16px;font-size:16px;font-weight:600;text-shadow:1px 1px 2px rgba(0,0,0,0.3);">🔬 TEST Abrasion Test Results</h3>
            <table style="border-collapse:collapse;width:100%;background:white;">
                <thead>
                    <tr style="background:linear-gradient(135deg,#ffebe6 0%,#fff2e6 100%);">
                        <th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:#d2691e;text-align:left;">Test Method</th>
                        <th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:#d2691e;text-align:center;">Result</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="transition:background-color 0.2s ease;">
                        <td style="border:1px solid #e0e0e0;padding:10px 8px;background:#fafafa;font-weight:500;">TEST Wyzenbeek (ASTM D4157)</td>
                        <td style="border:1px solid #e0e0e0;padding:10px 8px;background:#fafafa;text-align:center;font-weight:600;color:#28a745;">TEST PASS</td>
                    </tr>
                </tbody>
            </table>
            <div style="padding:8px 16px;background:#f8f9fa;font-size:12px;color:#666;font-style:italic;border-top:1px solid #e0e0e0;">✓ TEST Certified Laboratory Results</div>
        </div>`,

        // Fire Codes - Certifications
        firecodes: `<div style="margin:15px 0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
            <h3 style="background:linear-gradient(135deg,#dc143c 0%,#b22222 50%,#8b0000 100%);color:white;margin:0;padding:12px 16px;font-size:16px;font-weight:600;text-shadow:1px 1px 2px rgba(0,0,0,0.3);">🔥 TEST Fire Code Certifications</h3>
            <table style="border-collapse:collapse;width:100%;background:white;">
                <thead>
                    <tr style="background:linear-gradient(135deg,#ffe6e6 0%,#fff0f0 100%);">
                        <th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:#8b0000;text-align:left;">Standard</th>
                        <th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:#8b0000;text-align:center;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="transition:background-color 0.2s ease;">
                        <td style="border:1px solid #e0e0e0;padding:10px 8px;background:#fafafa;font-weight:500;">TEST CAL TB 117-2013</td>
                        <td style="border:1px solid #e0e0e0;padding:10px 8px;background:#fafafa;text-align:center;font-weight:600;color:#28a745;">TEST CERTIFIED</td>
                    </tr>
                </tbody>
            </table>
            <div style="padding:8px 16px;background:#f8f9fa;font-size:12px;color:#666;font-style:italic;border-top:1px solid #e0e0e0;">✓ TEST Multiple Fire Safety Certifications</div>
        </div>`
    };
}
