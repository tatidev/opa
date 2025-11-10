/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

/**
 * VENDOR DIAGNOSTIC RESTLET
 * Detailed logging to diagnose vendor sublist issues
 */

define(['N/record', 'N/log'], function(record, log) {
    
    function post(requestBody) {
        log.debug('VendorDiagnostic', '🔍🔍🔍 VENDOR DIAGNOSTIC RESTLET 🔍🔍🔍');
        log.debug('VendorDiagnostic', '🚨 DETAILED VENDOR SUBLIST DEBUGGING 🚨');
        
        try {
            // Create lot numbered inventory item record
            var inventoryItem = record.create({
                type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                isDynamic: true
            });
            
            log.debug('VendorDiagnostic', '✅ Inventory item record created');
            
            // Set basic fields
            inventoryItem.setValue('itemid', requestBody.itemId);
            inventoryItem.setValue('displayname', requestBody.displayName || requestBody.itemId);
            inventoryItem.setValue('upccode', requestBody.upcCode || requestBody.itemId);
            inventoryItem.setValue('taxschedule', "1");
            
            log.debug('VendorDiagnostic', '✅ Basic fields set');
            
            // DETAILED VENDOR SUBLIST DEBUGGING
            if (requestBody.vendor) {
                var vendorId = parseInt(requestBody.vendor);
                log.debug('VendorDiagnostic', '🎯 Processing vendor ID: ' + vendorId);
                
                try {
                    // Check if itemvendor sublist exists
                    log.debug('VendorDiagnostic', '🔍 Checking if itemvendor sublist exists...');
                    
                    // Try to get current line count
                    var currentLineCount = inventoryItem.getLineCount({ sublistId: 'itemvendor' });
                    log.debug('VendorDiagnostic', '📊 Current itemvendor line count: ' + currentLineCount);
                    
                    // Try to select new line
                    log.debug('VendorDiagnostic', '🔄 Attempting to select new line...');
                    inventoryItem.selectNewLine({ sublistId: 'itemvendor' });
                    log.debug('VendorDiagnostic', '✅ New line selected successfully');
                    
                    // Try to set vendor field
                    log.debug('VendorDiagnostic', '🔄 Setting vendor field to: ' + vendorId);
                    inventoryItem.setCurrentSublistValue({
                        sublistId: 'itemvendor',
                        fieldId: 'vendor',
                        value: vendorId
                    });
                    log.debug('VendorDiagnostic', '✅ Vendor field set successfully');
                    
                    // Try to set vendor code if provided
                    if (requestBody.vendorcode) {
                        log.debug('VendorDiagnostic', '🔄 Setting vendor code: ' + requestBody.vendorcode);
                        inventoryItem.setCurrentSublistValue({
                            sublistId: 'itemvendor',
                            fieldId: 'vendorcode',
                            value: requestBody.vendorcode
                        });
                        log.debug('VendorDiagnostic', '✅ Vendor code set successfully');
                    }
                    
                    // Try to set preferred
                    log.debug('VendorDiagnostic', '🔄 Setting preferred to true...');
                    inventoryItem.setCurrentSublistValue({
                        sublistId: 'itemvendor',
                        fieldId: 'preferred',
                        value: true
                    });
                    log.debug('VendorDiagnostic', '✅ Preferred field set successfully');
                    
                    // Try to commit the line
                    log.debug('VendorDiagnostic', '🔄 Committing sublist line...');
                    inventoryItem.commitLine({ sublistId: 'itemvendor' });
                    log.debug('VendorDiagnostic', '✅ Sublist line committed successfully');
                    
                    // Check line count after commit
                    var newLineCount = inventoryItem.getLineCount({ sublistId: 'itemvendor' });
                    log.debug('VendorDiagnostic', '📊 Line count after commit: ' + newLineCount);
                    
                } catch (sublistError) {
                    log.error('VendorDiagnostic', '❌ SUBLIST ERROR: ' + sublistError.toString());
                    log.error('VendorDiagnostic', '❌ Error details: ' + JSON.stringify(sublistError));
                }
            }
            
            // Save the record
            log.debug('VendorDiagnostic', '💾 Saving record...');
            var itemId = inventoryItem.save();
            log.debug('VendorDiagnostic', '✅ Record saved with ID: ' + itemId);
            
            // Load the saved record and check vendor sublist
            log.debug('VendorDiagnostic', '🔍 Loading saved record for verification...');
            var savedRecord = record.load({
                type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                id: itemId
            });
            
            var finalLineCount = savedRecord.getLineCount({ sublistId: 'itemvendor' });
            log.debug('VendorDiagnostic', '📊 FINAL vendor sublist count: ' + finalLineCount);
            
            var vendorData = {};
            if (finalLineCount > 0) {
                for (var i = 0; i < finalLineCount; i++) {
                    var lineVendor = savedRecord.getSublistValue({
                        sublistId: 'itemvendor',
                        fieldId: 'vendor',
                        line: i
                    });
                    var lineVendorCode = savedRecord.getSublistValue({
                        sublistId: 'itemvendor',
                        fieldId: 'vendorcode',
                        line: i
                    });
                    var linePreferred = savedRecord.getSublistValue({
                        sublistId: 'itemvendor',
                        fieldId: 'preferred',
                        line: i
                    });
                    
                    vendorData['line_' + i] = {
                        vendor: lineVendor,
                        vendorcode: lineVendorCode,
                        preferred: linePreferred
                    };
                    
                    log.debug('VendorDiagnostic', '📋 Line ' + i + ' vendor data: ' + JSON.stringify(vendorData['line_' + i]));
                }
            } else {
                log.debug('VendorDiagnostic', '❌ NO VENDOR LINES FOUND IN SAVED RECORD');
            }
            
            return {
                success: true,
                id: itemId,
                itemId: requestBody.itemId,
                vendorSublistCount: finalLineCount,
                vendorData: vendorData,
                message: 'Diagnostic complete - check execution logs for details'
            };
            
        } catch (error) {
            log.error('VendorDiagnostic', '❌ MAIN ERROR: ' + error.toString());
            return {
                success: false,
                error: error.toString(),
                message: 'Diagnostic failed - check execution logs'
            };
        }
    }
    
    return {
        post: post
    };
});
