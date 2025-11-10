/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

/**
 * VENDOR SUBLIST TEST RESTLET
 * Test different sublist names to find the correct one
 */

define(['N/record', 'N/log'], function(record, log) {
    
    function post(requestBody) {
        log.debug('VendorSublistTest', '🧪🧪🧪 VENDOR SUBLIST NAME TEST 🧪🧪🧪');
        log.debug('VendorSublistTest', '🔍 TESTING DIFFERENT SUBLIST NAMES 🔍');
        
        try {
            // Create inventory item record
            var inventoryItem = record.create({
                type: record.Type.INVENTORY_ITEM,
                isDynamic: true
            });
            
            // Set basic fields
            inventoryItem.setValue('itemid', requestBody.itemId);
            inventoryItem.setValue('displayname', requestBody.displayName || requestBody.itemId);
            inventoryItem.setValue('upccode', requestBody.upcCode || requestBody.itemId);
            inventoryItem.setValue('taxschedule', "1");
            
            log.debug('VendorSublistTest', '✅ Basic fields set');
            
            // Test different sublist names
            var sublistNames = [
                'itemvendor',
                'itemVendorsList', 
                'vendor',
                'vendors',
                'itemvendors',
                'purchasevendor'
            ];
            
            var workingSublist = null;
            var vendorId = parseInt(requestBody.vendor || 326);
            
            for (var i = 0; i < sublistNames.length; i++) {
                var sublistName = sublistNames[i];
                log.debug('VendorSublistTest', '🧪 Testing sublist: ' + sublistName);
                
                try {
                    // Try to get line count
                    var lineCount = inventoryItem.getLineCount({ sublistId: sublistName });
                    log.debug('VendorSublistTest', '✅ Sublist "' + sublistName + '" exists! Line count: ' + lineCount);
                    
                    // Try to add a line
                    inventoryItem.selectNewLine({ sublistId: sublistName });
                    log.debug('VendorSublistTest', '✅ Successfully selected new line in: ' + sublistName);
                    
                    // Try to set vendor field
                    inventoryItem.setCurrentSublistValue({
                        sublistId: sublistName,
                        fieldId: 'vendor',
                        value: vendorId
                    });
                    log.debug('VendorSublistTest', '✅ Successfully set vendor field in: ' + sublistName);
                    
                    // Try to commit
                    inventoryItem.commitLine({ sublistId: sublistName });
                    log.debug('VendorSublistTest', '✅ Successfully committed line in: ' + sublistName);
                    
                    workingSublist = sublistName;
                    log.debug('VendorSublistTest', '🎉 WORKING SUBLIST FOUND: ' + sublistName);
                    break;
                    
                } catch (sublistError) {
                    log.debug('VendorSublistTest', '❌ Sublist "' + sublistName + '" failed: ' + sublistError.toString());
                }
            }
            
            if (!workingSublist) {
                log.debug('VendorSublistTest', '❌ NO WORKING SUBLIST FOUND - trying alternative approach');
                
                // Try setting vendor field directly (single vendor approach)
                try {
                    inventoryItem.setValue('vendor', vendorId);
                    log.debug('VendorSublistTest', '✅ Set vendor field directly: ' + vendorId);
                } catch (directError) {
                    log.debug('VendorSublistTest', '❌ Direct vendor field failed: ' + directError.toString());
                }
            }
            
            // Save the record
            log.debug('VendorSublistTest', '💾 Saving record...');
            var itemId = inventoryItem.save();
            log.debug('VendorSublistTest', '✅ Record saved with ID: ' + itemId);
            
            // Load and verify
            var savedRecord = record.load({
                type: record.Type.INVENTORY_ITEM,
                id: itemId
            });
            
            var results = {
                workingSublist: workingSublist,
                testedSublists: sublistNames,
                directVendorField: null
            };
            
            // Check if working sublist has data
            if (workingSublist) {
                var finalLineCount = savedRecord.getLineCount({ sublistId: workingSublist });
                results.finalLineCount = finalLineCount;
                log.debug('VendorSublistTest', '📊 Final line count in ' + workingSublist + ': ' + finalLineCount);
            }
            
            // Check direct vendor field
            try {
                var directVendor = savedRecord.getValue({ fieldId: 'vendor' });
                results.directVendorField = directVendor;
                log.debug('VendorSublistTest', '📋 Direct vendor field value: ' + directVendor);
            } catch (e) {
                log.debug('VendorSublistTest', '❌ Could not read direct vendor field');
            }
            
            return {
                success: true,
                id: itemId,
                itemId: requestBody.itemId,
                results: results,
                message: 'Sublist test complete - check logs for details'
            };
            
        } catch (error) {
            log.error('VendorSublistTest', '❌ MAIN ERROR: ' + error.toString());
            return {
                success: false,
                error: error.toString(),
                message: 'Sublist test failed'
            };
        }
    }
    
    return {
        post: post
    };
});
