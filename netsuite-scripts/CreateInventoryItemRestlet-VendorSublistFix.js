/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

/**
 * NetSuite Inventory Item Creation RESTlet - VENDOR SUBLIST FIX
 * Fixed to properly populate the Vendors sublist/table
 */

define(['N/record', 'N/log'], function(record, log) {
    
    function post(requestBody) {
        log.debug('CreateInventoryItemRestlet', '🚀🚀🚀 VENDOR SUBLIST FIX VERSION 🚀🚀🚀');
        log.debug('CreateInventoryItemRestlet', '🏢 NOW PROPERLY POPULATES VENDOR SUBLIST 🏢');
        log.debug('CreateInventoryItemRestlet', 'Processing request: ' + JSON.stringify(requestBody));
        
        try {
            // Validate required fields for item creation
            if (!requestBody.itemId) {
                throw new Error('itemId is required');
            }
            
            // Create lot numbered inventory item record
            var inventoryItem = record.create({
                type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                isDynamic: true
            });
            
            // Set basic required fields
            inventoryItem.setValue('itemid', requestBody.itemId);
            inventoryItem.setValue('displayname', requestBody.displayName || requestBody.itemId);
            inventoryItem.setValue('upccode', requestBody.upcCode || requestBody.itemId);
            
            // Set tax schedule (required)
            var taxScheduleId = requestBody.taxScheduleId || "1";
            inventoryItem.setValue('taxschedule', taxScheduleId);
            
            // CRITICAL: ADD VENDOR TO SUBLIST (not just vendor field)
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Vendor Sublist...');
            if (requestBody.vendor) {
                var vendorId = parseInt(requestBody.vendor);
                if (!isNaN(vendorId) && vendorId > 0) {
                    log.debug('CreateInventoryItemRestlet', '✓ Adding vendor to sublist: ' + vendorId);
                    
                    try {
                        // Add line to vendor sublist
                        inventoryItem.selectNewLine({ sublistId: 'itemvendor' });
                        inventoryItem.setCurrentSublistValue({
                            sublistId: 'itemvendor',
                            fieldId: 'vendor',
                            value: vendorId
                        });
                        
                        // Set vendor-specific fields if provided
                        if (requestBody.vendorcode) {
                            inventoryItem.setCurrentSublistValue({
                                sublistId: 'itemvendor',
                                fieldId: 'vendorcode',
                                value: requestBody.vendorcode
                            });
                        }
                        
                        // Set as preferred vendor
                        inventoryItem.setCurrentSublistValue({
                            sublistId: 'itemvendor',
                            fieldId: 'preferred',
                            value: true
                        });
                        
                        // Commit the sublist line
                        inventoryItem.commitLine({ sublistId: 'itemvendor' });
                        
                        log.debug('CreateInventoryItemRestlet', '✅ Vendor added to sublist successfully');
                        
                    } catch (sublistError) {
                        log.error('CreateInventoryItemRestlet', '❌ Error adding vendor to sublist: ' + sublistError.toString());
                    }
                }
            }
            
            // Set other vendor fields
            if (requestBody.vendorname) {
                inventoryItem.setValue('vendorname', requestBody.vendorname);
            }
            
            // Set width if provided
            if (requestBody.width) {
                inventoryItem.setValue('custitem1', requestBody.width);
            }
            
            // Set custom vendor color
            if (requestBody.custitem_opms_vendor_color) {
                inventoryItem.setValue('custitem_opms_vendor_color', requestBody.custitem_opms_vendor_color);
            }
            
            // Save the record
            log.debug('CreateInventoryItemRestlet', '💾 Saving inventory item...');
            var itemId = inventoryItem.save();
            log.debug('CreateInventoryItemRestlet', '✅ Inventory item saved with ID: ' + itemId);
            
            // Read back the saved record to verify vendor sublist
            var savedRecord = record.load({
                type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                id: itemId
            });
            
            // Check vendor sublist
            var vendorCount = savedRecord.getLineCount({ sublistId: 'itemvendor' });
            log.debug('CreateInventoryItemRestlet', '📊 Vendor sublist count: ' + vendorCount);
            
            var vendorInfo = {};
            if (vendorCount > 0) {
                vendorInfo.vendorId = savedRecord.getSublistValue({
                    sublistId: 'itemvendor',
                    fieldId: 'vendor',
                    line: 0
                });
                vendorInfo.vendorCode = savedRecord.getSublistValue({
                    sublistId: 'itemvendor',
                    fieldId: 'vendorcode',
                    line: 0
                });
                vendorInfo.preferred = savedRecord.getSublistValue({
                    sublistId: 'itemvendor',
                    fieldId: 'preferred',
                    line: 0
                });
                log.debug('CreateInventoryItemRestlet', '📋 Vendor sublist info: ' + JSON.stringify(vendorInfo));
            }
            
            return {
                success: true,
                id: itemId,
                itemId: requestBody.itemId,
                vendorSublistCount: vendorCount,
                vendorInfo: vendorInfo,
                message: 'Inventory item created successfully with vendor sublist'
            };
            
        } catch (error) {
            log.error('CreateInventoryItemRestlet', '❌ Error creating inventory item: ' + error.toString());
            return {
                success: false,
                error: error.toString(),
                message: 'Failed to create inventory item'
            };
        }
    }
    
    return {
        post: post
    };
});
