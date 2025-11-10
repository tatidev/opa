/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

define(['N/record', 'N/log'], function(record, log) {
    
    function doPost(requestBody) {
        log.debug('VendorTestRestlet', '🚀🚀🚀 BRAND NEW VENDOR TEST RESTLET 🚀🚀🚀');
        log.debug('VendorTestRestlet', '🔥 THIS IS A COMPLETELY NEW SCRIPT 🔥');
        
        try {
            // Log all incoming data
            log.debug('VendorTestRestlet', 'Request body keys: ' + Object.keys(requestBody).join(', '));
            log.debug('VendorTestRestlet', 'vendor value: "' + requestBody.vendor + '" (type: ' + typeof requestBody.vendor + ')');
            log.debug('VendorTestRestlet', 'vendorname value: "' + requestBody.vendorname + '"');
            log.debug('VendorTestRestlet', 'vendorcode value: "' + requestBody.vendorcode + '"');
            
            // Create lot numbered inventory item
            var inventoryItem = record.create({
                type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                isDynamic: true
            });
            
            // Set basic fields
            inventoryItem.setValue('itemid', requestBody.itemId);
            inventoryItem.setValue('displayname', requestBody.displayName || requestBody.itemId);
            inventoryItem.setValue('upccode', requestBody.upcCode);
            
            // Test vendor fields with explicit logging
            log.debug('VendorTestRestlet', '🔄 Setting vendor field...');
            if (requestBody.vendor) {
                var vendorId = parseInt(requestBody.vendor);
                log.debug('VendorTestRestlet', 'Setting vendor to: ' + vendorId);
                inventoryItem.setValue('vendor', vendorId);
            }
            
            log.debug('VendorTestRestlet', '🔄 Setting vendorname field...');
            if (requestBody.vendorname) {
                log.debug('VendorTestRestlet', 'Setting vendorname to: ' + requestBody.vendorname);
                inventoryItem.setValue('vendorname', requestBody.vendorname);
            }
            
            log.debug('VendorTestRestlet', '🔄 Setting vendorcode field...');
            if (requestBody.vendorcode) {
                log.debug('VendorTestRestlet', 'Setting vendorcode to: ' + requestBody.vendorcode);
                inventoryItem.setValue('vendorcode', requestBody.vendorcode);
            }
            
            // Save the record
            var itemId = inventoryItem.save();
            log.debug('VendorTestRestlet', '✅ Item created with ID: ' + itemId);
            
            // Read back the vendor fields to verify
            var savedItem = record.load({
                type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                id: itemId
            });
            
            var readVendor = savedItem.getValue('vendor');
            var readVendorName = savedItem.getValue('vendorname');
            var readVendorCode = savedItem.getValue('vendorcode');
            
            log.debug('VendorTestRestlet', '📖 Read back vendor: ' + readVendor);
            log.debug('VendorTestRestlet', '📖 Read back vendorname: ' + readVendorName);
            log.debug('VendorTestRestlet', '📖 Read back vendorcode: ' + readVendorCode);
            
            return {
                success: true,
                id: itemId,
                message: 'Item created successfully',
                vendorData: {
                    vendor: readVendor,
                    vendorname: readVendorName,
                    vendorcode: readVendorCode
                }
            };
            
        } catch (error) {
            log.error('VendorTestRestlet', 'Error: ' + error.toString());
            return {
                success: false,
                error: error.toString()
            };
        }
    }
    
    function doGet(requestParams) {
        log.debug('VendorTestRestlet', '🚀 NEW VENDOR TEST RESTLET - GET request received');
        return {
            success: true,
            message: 'Brand new vendor test RESTlet is working!',
            timestamp: new Date().toISOString()
        };
    }
    
    return {
        get: doGet,
        post: doPost
    };
});

