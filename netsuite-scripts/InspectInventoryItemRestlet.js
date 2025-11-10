/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

/**
 * INSPECT INVENTORY ITEM RESTLET
 * Actually look at what fields and sublists exist on inventory items
 */

define(['N/record', 'N/log'], function(record, log) {
    
    function post(requestBody) {
        log.debug('InspectInventoryItem', '🔍🔍🔍 INSPECTING REAL INVENTORY ITEM STRUCTURE 🔍🔍🔍');
        
        try {
            // Create a new lot numbered inventory item to inspect its structure
            var inventoryItem = record.create({
                type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                isDynamic: true
            });
            
            log.debug('InspectInventoryItem', '✅ Created inventory item record for inspection');
            
            // Get all available fields
            log.debug('InspectInventoryItem', '🔍 INSPECTING AVAILABLE FIELDS...');
            var allFields = inventoryItem.getFields();
            log.debug('InspectInventoryItem', '📋 Total fields available: ' + allFields.length);
            log.debug('InspectInventoryItem', '📋 All fields: ' + JSON.stringify(allFields));
            
            // Look for vendor-related fields specifically
            var vendorFields = allFields.filter(function(field) {
                return field.toLowerCase().includes('vendor');
            });
            log.debug('InspectInventoryItem', '🏢 Vendor-related fields: ' + JSON.stringify(vendorFields));
            
            // Get all available sublists
            log.debug('InspectInventoryItem', '🔍 INSPECTING AVAILABLE SUBLISTS...');
            var allSublists = inventoryItem.getSublists();
            log.debug('InspectInventoryItem', '📋 Total sublists available: ' + allSublists.length);
            log.debug('InspectInventoryItem', '📋 All sublists: ' + JSON.stringify(allSublists));
            
            // Look for vendor-related sublists
            var vendorSublists = allSublists.filter(function(sublist) {
                return sublist.toLowerCase().includes('vendor');
            });
            log.debug('InspectInventoryItem', '🏢 Vendor-related sublists: ' + JSON.stringify(vendorSublists));
            
            // For each vendor-related sublist, inspect its fields
            var sublistDetails = {};
            for (var i = 0; i < vendorSublists.length; i++) {
                var sublistId = vendorSublists[i];
                try {
                    var sublistFields = inventoryItem.getSublistFields({ sublistId: sublistId });
                    sublistDetails[sublistId] = sublistFields;
                    log.debug('InspectInventoryItem', '📋 Sublist "' + sublistId + '" fields: ' + JSON.stringify(sublistFields));
                } catch (e) {
                    log.debug('InspectInventoryItem', '❌ Could not get fields for sublist: ' + sublistId);
                }
            }
            
            // Also check if we can load an existing item to see its structure
            var existingItemData = null;
            if (requestBody.existingItemId) {
                try {
                    log.debug('InspectInventoryItem', '🔍 LOADING EXISTING ITEM: ' + requestBody.existingItemId);
                    var existingItem = record.load({
                        type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                        id: requestBody.existingItemId
                    });
                    
                    existingItemData = {};
                    
                    // Check vendor field value
                    try {
                        existingItemData.vendorField = existingItem.getValue({ fieldId: 'vendor' });
                        log.debug('InspectInventoryItem', '📋 Existing item vendor field: ' + existingItemData.vendorField);
                    } catch (e) {
                        log.debug('InspectInventoryItem', '❌ Could not read vendor field from existing item');
                    }
                    
                    // Check each vendor sublist
                    for (var j = 0; j < vendorSublists.length; j++) {
                        var sublistId = vendorSublists[j];
                        try {
                            var lineCount = existingItem.getLineCount({ sublistId: sublistId });
                            existingItemData[sublistId + '_lineCount'] = lineCount;
                            log.debug('InspectInventoryItem', '📊 Existing item sublist "' + sublistId + '" line count: ' + lineCount);
                            
                            // If there are lines, get the data
                            if (lineCount > 0) {
                                var lineData = [];
                                for (var k = 0; k < Math.min(lineCount, 3); k++) { // Only check first 3 lines
                                    var line = {};
                                    var sublistFields = sublistDetails[sublistId] || [];
                                    for (var l = 0; l < sublistFields.length; l++) {
                                        var fieldId = sublistFields[l];
                                        try {
                                            line[fieldId] = existingItem.getSublistValue({
                                                sublistId: sublistId,
                                                fieldId: fieldId,
                                                line: k
                                            });
                                        } catch (e) {
                                            // Skip fields we can't read
                                        }
                                    }
                                    lineData.push(line);
                                }
                                existingItemData[sublistId + '_data'] = lineData;
                                log.debug('InspectInventoryItem', '📋 Existing item sublist "' + sublistId + '" data: ' + JSON.stringify(lineData));
                            }
                        } catch (e) {
                            log.debug('InspectInventoryItem', '❌ Could not inspect sublist "' + sublistId + '" on existing item');
                        }
                    }
                    
                } catch (e) {
                    log.debug('InspectInventoryItem', '❌ Could not load existing item: ' + e.toString());
                }
            }
            
            return {
                success: true,
                inspection: {
                    totalFields: allFields.length,
                    vendorFields: vendorFields,
                    totalSublists: allSublists.length,
                    allSublists: allSublists,
                    vendorSublists: vendorSublists,
                    sublistDetails: sublistDetails,
                    existingItemData: existingItemData
                },
                message: 'Inspection complete - check logs and response for real structure'
            };
            
        } catch (error) {
            log.error('InspectInventoryItem', '❌ INSPECTION ERROR: ' + error.toString());
            return {
                success: false,
                error: error.toString(),
                message: 'Inspection failed'
            };
        }
    }
    
    return {
        post: post
    };
});
