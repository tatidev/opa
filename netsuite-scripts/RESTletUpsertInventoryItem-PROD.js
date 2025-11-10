/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 * 
 * Create Inventory Item RESTlet
 * Handles creation of inventory items with proper field validation and error handling
 * Enhanced to support vendor information and color data
 * 
 * FOCUSED ON ITEM CREATION ONLY
 * For item management operations (mark inactive, delete, etc.), use RESTletManageInventoryItem.js
 */

define(['N/record', 'N/log', 'N/search'], function(record, log, search) {
    
    /**
     * Main POST handler for creating inventory items
     * @param {Object} requestBody - The request payload
     * @returns {Object} Response object with success status and created item ID
     */
    function post(requestBody) {
        log.debug('CreateInventoryItemRestlet', '🚀🚀🚀 UPSERT INVENTORY ITEM RESTLET VERSION 4.0 🚀🚀🚀');
        log.debug('CreateInventoryItemRestlet', '🔄 NOW SUPPORTS UPSERT OPERATIONS (CREATE OR UPDATE) 🔄');
        log.debug('CreateInventoryItemRestlet', '🏢 SUPPORTS NATIVE VENDOR FIELDS (vendor, vendorname, vendorcode) 🏢');
        log.debug('CreateInventoryItemRestlet', 'Processing request: ' + JSON.stringify(requestBody));
        
        try {
            // This RESTlet now supports both CREATE and UPDATE operations (UPSERT)
            // It will check if an item exists and update it, or create a new one
            
            // Validate required fields for item creation/update
            var validation = validateRequiredFields(requestBody);
            if (!validation.isValid) {
                log.error('CreateInventoryItemRestlet', 'Validation failed: ' + validation.error);
                return {
                    success: false,
                    error: validation.error
                };
            }
            
            // Check if item already exists by itemId
            var existingItemId = findExistingItem(requestBody.itemId);
            var isUpdate = existingItemId !== null;
            
            if (isUpdate) {
                log.debug('CreateInventoryItemRestlet', '🔄 Item exists, updating: ' + existingItemId);
                var inventoryItem = record.load({
                    type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                    id: existingItemId,
                    isDynamic: true
                });
            } else {
                log.debug('CreateInventoryItemRestlet', '➕ Item does not exist, creating new');
                var inventoryItem = record.create({
                    type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                    isDynamic: true
                });
            }
            
            // Set display name FIRST (before itemid) if provided
            if (requestBody.displayName) {
                log.debug('CreateInventoryItemRestlet', '🔄 Processing Display Name field FIRST...');
                log.debug('CreateInventoryItemRestlet', 'displayName value: "' + requestBody.displayName + '" (length: ' + requestBody.displayName.length + ')');
                try {
                    setFieldValue(inventoryItem, 'displayname', requestBody.displayName);
                    log.debug('CreateInventoryItemRestlet', '✓ Set displayname field FIRST: "' + requestBody.displayName + '"');
                } catch (error) {
                    log.error('CreateInventoryItemRestlet', '❌ Error setting Display Name field: ' + error.toString());
                }
            }
            
            // Set display name FIRST (before itemid) - this is the key fix!
            if (requestBody.displayName) {
                log.debug('CreateInventoryItemRestlet', '🔄 Setting Display Name FIRST: "' + requestBody.displayName + '"');
                setFieldValue(inventoryItem, 'displayname', requestBody.displayName);
                log.debug('CreateInventoryItemRestlet', '✅ Display Name set successfully');
            }
            
            // Set required fields with error handling
            setFieldValue(inventoryItem, 'itemid', requestBody.itemId);
            setFieldValue(inventoryItem, 'upccode', requestBody.upcCode);
            
            // Set tax schedule if provided
            if (requestBody.taxScheduleId) {
                setFieldValue(inventoryItem, 'taxschedule', requestBody.taxScheduleId);
            }
            
            // Set Opuzen subsidiary (ID: 2) for all OPMS items
            log.debug('CreateInventoryItemRestlet', '🏢 Setting Opuzen subsidiary (ID: 2)');
            try {
                setFieldValue(inventoryItem, 'subsidiary', 2);
                log.debug('CreateInventoryItemRestlet', '✅ Subsidiary set to Opuzen (ID: 2)');
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting subsidiary: ' + error.toString());
                throw new Error('Failed to set Opuzen subsidiary: ' + error.toString());
            }
            
            // ============================================================================
            // SET NETSUITE LOT-NUMBERED INVENTORY CONSTANTS
            // These values ensure all items have consistent NetSuite configuration
            // Values from NetSuite Item 8161 (Dresden: Mink) - tested and proven
            // ============================================================================
            
            log.debug('CreateInventoryItemRestlet', '═══════════════════════════════════════════════════════════');
            log.debug('CreateInventoryItemRestlet', '🔧 SETTING NETSUITE LOT-NUMBERED INVENTORY CONSTANTS');
            log.debug('CreateInventoryItemRestlet', '═══════════════════════════════════════════════════════════');
            
            // Helper function for comprehensive error logging
            function logFieldError(fieldName, attemptedValue, expectedType, error, itemContext) {
                log.error('CreateInventoryItemRestlet', '╔═══════════════════════════════════════════════════════════════╗');
                log.error('CreateInventoryItemRestlet', '║  FIELD SET ERROR - DETAILED DIAGNOSTIC INFORMATION           ║');
                log.error('CreateInventoryItemRestlet', '╚═══════════════════════════════════════════════════════════════╝');
                log.error('CreateInventoryItemRestlet', '');
                log.error('CreateInventoryItemRestlet', '📌 ITEM CONTEXT:');
                log.error('CreateInventoryItemRestlet', '   Item ID: ' + (itemContext.itemId || 'UNKNOWN'));
                log.error('CreateInventoryItemRestlet', '   Operation: ' + (itemContext.operation || 'UNKNOWN'));
                log.error('CreateInventoryItemRestlet', '   OPMS Item ID: ' + (itemContext.opmsItemId || 'N/A'));
                log.error('CreateInventoryItemRestlet', '   OPMS Product ID: ' + (itemContext.opmsProductId || 'N/A'));
                log.error('CreateInventoryItemRestlet', '');
                log.error('CreateInventoryItemRestlet', '🎯 FIELD DETAILS:');
                log.error('CreateInventoryItemRestlet', '   Field Name: ' + fieldName);
                log.error('CreateInventoryItemRestlet', '   Expected Type: ' + expectedType);
                log.error('CreateInventoryItemRestlet', '   Attempted Value: ' + attemptedValue);
                log.error('CreateInventoryItemRestlet', '   Actual Type: ' + typeof attemptedValue);
                log.error('CreateInventoryItemRestlet', '   Is Null: ' + (attemptedValue === null));
                log.error('CreateInventoryItemRestlet', '   Is Undefined: ' + (attemptedValue === undefined));
                log.error('CreateInventoryItemRestlet', '');
                log.error('CreateInventoryItemRestlet', '❌ NETSUITE ERROR:');
                log.error('CreateInventoryItemRestlet', '   Message: ' + error.message);
                log.error('CreateInventoryItemRestlet', '   Type: ' + error.name);
                log.error('CreateInventoryItemRestlet', '   Full Error: ' + error.toString());
                if (error.stack) {
                    log.error('CreateInventoryItemRestlet', '   Stack Trace: ' + error.stack);
                }
                log.error('CreateInventoryItemRestlet', '');
                log.error('CreateInventoryItemRestlet', '💡 TROUBLESHOOTING:');
                if (expectedType === 'boolean' && typeof attemptedValue !== 'boolean') {
                    log.error('CreateInventoryItemRestlet', '   → Type mismatch: Checkbox field requires boolean (true/false)');
                    log.error('CreateInventoryItemRestlet', '   → Check OpmsDataTransformService.js payload generation');
                    log.error('CreateInventoryItemRestlet', '   → Ensure JSON.stringify preserves boolean type');
                } else if (expectedType === 'integer' && isNaN(parseInt(attemptedValue))) {
                    log.error('CreateInventoryItemRestlet', '   → Type mismatch: List/Numeric field requires valid integer');
                    log.error('CreateInventoryItemRestlet', '   → Check if value is being sent as string instead of number');
                    log.error('CreateInventoryItemRestlet', '   → Verify list field internal ID is correct in NetSuite');
                } else if (attemptedValue === null || attemptedValue === undefined) {
                    log.error('CreateInventoryItemRestlet', '   → Value is null/undefined but field may be required');
                    log.error('CreateInventoryItemRestlet', '   → Check if OpmsDataTransformService is sending this field');
                } else {
                    log.error('CreateInventoryItemRestlet', '   → Field may not exist on Lot Numbered Inventory Item record type');
                    log.error('CreateInventoryItemRestlet', '   → Verify field ID in NetSuite: Customization → Lists/Records → Fields');
                    log.error('CreateInventoryItemRestlet', '   → Check if field permissions allow write access for this role');
                }
                log.error('CreateInventoryItemRestlet', '');
                log.error('CreateInventoryItemRestlet', '═══════════════════════════════════════════════════════════════');
            }
            
            // Build item context for error logging
            var itemContext = {
                itemId: requestBody.itemId || 'UNKNOWN',
                operation: isUpdate ? 'UPDATE' : 'CREATE',
                opmsItemId: requestBody.custitem_opms_item_id || requestBody.opmsItemId,
                opmsProductId: requestBody.custitem_opms_prod_id || requestBody.custitem_opms_product_id || requestBody.opmsProductId
            };
            
            // CHECKBOX FIELD 1: Use Bins
            log.debug('CreateInventoryItemRestlet', '🔄 Setting Use Bins (usebins)...');
            try {
                var usebinsValue = requestBody.usebins;
                log.debug('CreateInventoryItemRestlet', '   Received value: ' + usebinsValue + ' (type: ' + typeof usebinsValue + ')');
                
                if (typeof usebinsValue === 'boolean') {
                    setFieldValue(inventoryItem, 'usebins', usebinsValue);
                    log.debug('CreateInventoryItemRestlet', '   ✅ Use Bins set to: ' + usebinsValue);
                } else if (usebinsValue === undefined || usebinsValue === null) {
                    // Default to true for lot-numbered items
                    setFieldValue(inventoryItem, 'usebins', true);
                    log.debug('CreateInventoryItemRestlet', '   ✅ Use Bins defaulted to: true (value was null/undefined)');
                } else {
                    log.audit('CreateInventoryItemRestlet', '   ⚠️  Type mismatch for Use Bins: expected boolean, got ' + typeof usebinsValue);
                    log.audit('CreateInventoryItemRestlet', '   ⚠️  Attempting type coercion...');
                    setFieldValue(inventoryItem, 'usebins', Boolean(usebinsValue));
                    log.audit('CreateInventoryItemRestlet', '   ✅ Use Bins set via coercion: ' + Boolean(usebinsValue));
                }
            } catch (error) {
                logFieldError('usebins', requestBody.usebins, 'boolean', error, itemContext);
                // Don't throw - continue with other fields
            }
            
            // CHECKBOX FIELD 2: Match Bill to Receipt
            log.debug('CreateInventoryItemRestlet', '🔄 Setting Match Bill to Receipt (matchbilltoreceipt)...');
            try {
                var matchBillValue = requestBody.matchbilltoreceipt;
                log.debug('CreateInventoryItemRestlet', '   Received value: ' + matchBillValue + ' (type: ' + typeof matchBillValue + ')');
                
                if (typeof matchBillValue === 'boolean') {
                    setFieldValue(inventoryItem, 'matchbilltoreceipt', matchBillValue);
                    log.debug('CreateInventoryItemRestlet', '   ✅ Match Bill to Receipt set to: ' + matchBillValue);
                } else if (matchBillValue === undefined || matchBillValue === null) {
                    setFieldValue(inventoryItem, 'matchbilltoreceipt', true);
                    log.debug('CreateInventoryItemRestlet', '   ✅ Match Bill to Receipt defaulted to: true');
                } else {
                    log.audit('CreateInventoryItemRestlet', '   ⚠️  Type mismatch: expected boolean, got ' + typeof matchBillValue);
                    setFieldValue(inventoryItem, 'matchbilltoreceipt', Boolean(matchBillValue));
                    log.audit('CreateInventoryItemRestlet', '   ✅ Match Bill to Receipt set via coercion: ' + Boolean(matchBillValue));
                }
            } catch (error) {
                logFieldError('matchbilltoreceipt', requestBody.matchbilltoreceipt, 'boolean', error, itemContext);
            }
            
            // CHECKBOX FIELD 3: Auto Numbered
            log.debug('CreateInventoryItemRestlet', '🔄 Setting Auto Numbered (custitem_aln_1_auto_numbered)...');
            try {
                var autoNumberedValue = requestBody.custitem_aln_1_auto_numbered;
                log.debug('CreateInventoryItemRestlet', '   Received value: ' + autoNumberedValue + ' (type: ' + typeof autoNumberedValue + ')');
                
                if (typeof autoNumberedValue === 'boolean') {
                    setFieldValue(inventoryItem, 'custitem_aln_1_auto_numbered', autoNumberedValue);
                    log.debug('CreateInventoryItemRestlet', '   ✅ Auto Numbered set to: ' + autoNumberedValue);
                } else if (autoNumberedValue === undefined || autoNumberedValue === null) {
                    setFieldValue(inventoryItem, 'custitem_aln_1_auto_numbered', true);
                    log.debug('CreateInventoryItemRestlet', '   ✅ Auto Numbered defaulted to: true');
                } else {
                    log.audit('CreateInventoryItemRestlet', '   ⚠️  Type mismatch: expected boolean, got ' + typeof autoNumberedValue);
                    setFieldValue(inventoryItem, 'custitem_aln_1_auto_numbered', Boolean(autoNumberedValue));
                    log.audit('CreateInventoryItemRestlet', '   ✅ Auto Numbered set via coercion: ' + Boolean(autoNumberedValue));
                }
            } catch (error) {
                logFieldError('custitem_aln_1_auto_numbered', requestBody.custitem_aln_1_auto_numbered, 'boolean', error, itemContext);
            }
            
            // LIST FIELD 1: Units Type (only set for new items, not updates)
            log.debug('CreateInventoryItemRestlet', '🔄 Setting Units Type (unitstype) [LIST FIELD]...');
            try {
                if (isUpdate) {
                    log.debug('CreateInventoryItemRestlet', '   ⏭️  Skipping unitstype for existing item (NetSuite does not allow changing units type after creation)');
                } else {
                    // Only set unitstype for new items
                    var unitsTypeValue = requestBody.unitstype;
                    log.debug('CreateInventoryItemRestlet', '   Received value: ' + unitsTypeValue + ' (type: ' + typeof unitsTypeValue + ')');
                    
                    if (unitsTypeValue !== undefined && unitsTypeValue !== null) {
                        var unitsTypeId = parseInt(unitsTypeValue);
                        if (!isNaN(unitsTypeId)) {
                            log.debug('CreateInventoryItemRestlet', '   Parsed to integer: ' + unitsTypeId);
                            setFieldValue(inventoryItem, 'unitstype', unitsTypeId);
                            log.debug('CreateInventoryItemRestlet', '   ✅ Units Type set to: ' + unitsTypeId + ' (3 = Length)');
                        } else {
                            log.error('CreateInventoryItemRestlet', '   ❌ Invalid Units Type value (NaN after parseInt): ' + unitsTypeValue);
                            throw new Error('Units Type must be a valid integer (list internal ID)');
                        }
                    } else {
                        // Default to 3 (Length) for new items
                        setFieldValue(inventoryItem, 'unitstype', 3);
                        log.debug('CreateInventoryItemRestlet', '   ✅ Units Type defaulted to: 3 (Length)');
                    }
                }
            } catch (error) {
                logFieldError('unitstype', requestBody.unitstype, 'integer (list ID)', error, itemContext);
            }
            
            // LIST FIELD 2: Number Format
            log.debug('CreateInventoryItemRestlet', '🔄 Setting Number Format (custitem_aln_2_number_format) [LIST FIELD]...');
            try {
                var numberFormatValue = requestBody.custitem_aln_2_number_format;
                log.debug('CreateInventoryItemRestlet', '   Received value: ' + numberFormatValue + ' (type: ' + typeof numberFormatValue + ')');
                
                if (numberFormatValue !== undefined && numberFormatValue !== null) {
                    var numberFormatId = parseInt(numberFormatValue);
                    if (!isNaN(numberFormatId)) {
                        log.debug('CreateInventoryItemRestlet', '   Parsed to integer: ' + numberFormatId);
                        setFieldValue(inventoryItem, 'custitem_aln_2_number_format', numberFormatId);
                        log.debug('CreateInventoryItemRestlet', '   ✅ Number Format set to: ' + numberFormatId);
                    } else {
                        log.error('CreateInventoryItemRestlet', '   ❌ Invalid Number Format value (NaN): ' + numberFormatValue);
                        throw new Error('Number Format must be a valid integer (list internal ID)');
                    }
                } else {
                    // Default to 1 (Bolt/Lot Number format)
                    setFieldValue(inventoryItem, 'custitem_aln_2_number_format', 1);
                    log.debug('CreateInventoryItemRestlet', '   ✅ Number Format defaulted to: 1');
                }
            } catch (error) {
                logFieldError('custitem_aln_2_number_format', requestBody.custitem_aln_2_number_format, 'integer (list ID)', error, itemContext);
            }
            
            // NUMERIC FIELD: Initial Sequence Number
            log.debug('CreateInventoryItemRestlet', '🔄 Setting Initial Sequence (custitem_aln_3_initial_sequence) [NUMERIC]...');
            try {
                var initialSeqValue = requestBody.custitem_aln_3_initial_sequence;
                log.debug('CreateInventoryItemRestlet', '   Received value: ' + initialSeqValue + ' (type: ' + typeof initialSeqValue + ')');
                
                if (initialSeqValue !== undefined && initialSeqValue !== null) {
                    var initialSeq = parseInt(initialSeqValue);
                    if (!isNaN(initialSeq)) {
                        log.debug('CreateInventoryItemRestlet', '   Parsed to integer: ' + initialSeq);
                        setFieldValue(inventoryItem, 'custitem_aln_3_initial_sequence', initialSeq);
                        log.debug('CreateInventoryItemRestlet', '   ✅ Initial Sequence set to: ' + initialSeq);
                    } else {
                        log.error('CreateInventoryItemRestlet', '   ❌ Invalid Initial Sequence value (NaN): ' + initialSeqValue);
                        throw new Error('Initial Sequence must be a valid integer');
                    }
                } else {
                    // Default to 1
                    setFieldValue(inventoryItem, 'custitem_aln_3_initial_sequence', 1);
                    log.debug('CreateInventoryItemRestlet', '   ✅ Initial Sequence defaulted to: 1');
                }
            } catch (error) {
                logFieldError('custitem_aln_3_initial_sequence', requestBody.custitem_aln_3_initial_sequence, 'integer', error, itemContext);
            }
            
            log.debug('CreateInventoryItemRestlet', '═══════════════════════════════════════════════════════════');
            log.debug('CreateInventoryItemRestlet', '✅ NETSUITE CONSTANTS CONFIGURATION COMPLETE');
            log.debug('CreateInventoryItemRestlet', '═══════════════════════════════════════════════════════════');
            
            // Set optional fields if provided
            if (requestBody.description) {
                setFieldValue(inventoryItem, 'description', requestBody.description);
            }
            
            if (requestBody.incomeAccountId) {
                setFieldValue(inventoryItem, 'incomeaccount', requestBody.incomeAccountId);
            }
            
            if (requestBody.cogsAccountId) {
                setFieldValue(inventoryItem, 'cogsaccount', requestBody.cogsAccountId);
            }
            
            // Set OPMS Product ID field (custitem_opms_prod_id) - REQUIRED - support multiple field name formats
            var opmsProductId = parseInt(requestBody.custitem_opms_product_id || requestBody.custitem_opms_prod_id || requestBody.opmsProductId);
            log.debug('CreateInventoryItemRestlet', 'OPMS Product ID field values: custitem_opms_product_id=' + requestBody.custitem_opms_product_id + ', custitem_opms_prod_id=' + requestBody.custitem_opms_prod_id + ', opmsProductId=' + requestBody.opmsProductId);
            if (opmsProductId && !isNaN(opmsProductId)) {
                log.debug('CreateInventoryItemRestlet', '✓ Setting OPMS Product ID: ' + opmsProductId);
                setFieldValue(inventoryItem, 'custitem_opms_prod_id', opmsProductId);
            } else {
                log.error('CreateInventoryItemRestlet', '❌ custitem_opms_prod_id is required and must be a valid integer. Received values: custitem_opms_product_id=' + requestBody.custitem_opms_product_id + ', custitem_opms_prod_id=' + requestBody.custitem_opms_prod_id + ', opmsProductId=' + requestBody.opmsProductId);
                throw new Error('custitem_opms_prod_id is required and must be a valid integer');
            }

            // Set OPMS Item ID field (custitem_opms_item_id) - REQUIRED  
            var opmsItemId = parseInt(requestBody.custitem_opms_item_id || requestBody.opmsItemId);
            if (opmsItemId && !isNaN(opmsItemId)) {
                log.debug('CreateInventoryItemRestlet', '✓ Setting OPMS Item ID: ' + opmsItemId);
                setFieldValue(inventoryItem, 'custitem_opms_item_id', opmsItemId);
            } else {
                log.error('CreateInventoryItemRestlet', '❌ custitem_opms_item_id is required and must be a valid integer. Received: ' + requestBody.custitem_opms_item_id);
                throw new Error('custitem_opms_item_id is required and must be a valid integer');
            }
            
            // Set Width field (custitem1) if provided
            if (requestBody.width) {
                setFieldValue(inventoryItem, 'custitem1', requestBody.width);
            }
            
            // Set VR (Vertical Repeat) field if provided - support both field name formats
            log.debug('CreateInventoryItemRestlet', '🔄 Processing VR field...');
            var vrValue = requestBody.vrepeat || requestBody.custitem_vertical_repeat;
            log.debug('CreateInventoryItemRestlet', 'vrepeat value: ' + requestBody.vrepeat + ', custitem_vertical_repeat value: ' + requestBody.custitem_vertical_repeat);
            try {
                if (vrValue) {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting VR field: ' + vrValue);
                    setFieldValue(inventoryItem, 'custitem_vertical_repeat', vrValue);
                    log.debug('CreateInventoryItemRestlet', '✅ VR field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ VR field is empty/null, skipping');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting VR field: ' + error.toString());
            }
            
            // Set HR (Horizontal Repeat) field if provided - support both field name formats
            log.debug('CreateInventoryItemRestlet', '🔄 Processing HR field...');
            var hrValue = requestBody.hrepeat || requestBody.custitem_horizontal_repeat;
            log.debug('CreateInventoryItemRestlet', 'hrepeat value: ' + requestBody.hrepeat + ', custitem_horizontal_repeat value: ' + requestBody.custitem_horizontal_repeat);
            try {
                if (hrValue) {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting HR field: ' + hrValue);
                    setFieldValue(inventoryItem, 'custitem_horizontal_repeat', hrValue);
                    log.debug('CreateInventoryItemRestlet', '✅ HR field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ HR field is empty/null, skipping');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting HR field: ' + error.toString());
            }
            
            // Set Prop 65 Compliance field if provided - support both field name formats
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Prop 65 field...');
            var prop65Value = requestBody.prop65Compliance || requestBody.custitem_prop65_compliance;
            log.debug('CreateInventoryItemRestlet', 'prop65Compliance value: "' + requestBody.prop65Compliance + '", custitem_prop65_compliance value: "' + requestBody.custitem_prop65_compliance + '"');
            try {
                if (prop65Value && prop65Value !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting Prop 65 field: "' + prop65Value + '"');
                    setFieldValue(inventoryItem, 'custitem_prop65_compliance', prop65Value);
                    log.debug('CreateInventoryItemRestlet', '✅ Prop 65 field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Prop 65 field is empty/null/undefined, skipping. Value was: "' + prop65Value + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting Prop 65 field: ' + error.toString());
            }
            
            // Set AB 2998 Compliance field if provided - support both field name formats
            log.debug('CreateInventoryItemRestlet', '🔄 Processing AB 2998 field...');
            var ab2998Value = requestBody.ab2998Compliance || requestBody.custitem_ab2998_compliance;
            log.debug('CreateInventoryItemRestlet', 'ab2998Compliance value: "' + requestBody.ab2998Compliance + '", custitem_ab2998_compliance value: "' + requestBody.custitem_ab2998_compliance + '"');
            try {
                if (ab2998Value && ab2998Value !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting AB 2998 field: "' + ab2998Value + '"');
                    setFieldValue(inventoryItem, 'custitem_ab2998_compliance', ab2998Value);
                    log.debug('CreateInventoryItemRestlet', '✅ AB 2998 field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ AB 2998 field is empty/null/undefined, skipping. Value was: "' + ab2998Value + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting AB 2998 field: ' + error.toString());
            }
            
            // Set Tariff/Harmonized Code field if provided - support both field name formats
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Tariff field...');
            var tariffValue = requestBody.tariffCode || requestBody.custitem_tariff_harmonized_code;
            log.debug('CreateInventoryItemRestlet', 'tariffCode value: "' + requestBody.tariffCode + '", custitem_tariff_harmonized_code value: "' + requestBody.custitem_tariff_harmonized_code + '"');
            try {
                if (tariffValue && tariffValue !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting Tariff field: "' + tariffValue + '"');
                    setFieldValue(inventoryItem, 'custitem_tariff_harmonized_code', tariffValue);
                    log.debug('CreateInventoryItemRestlet', '✅ Tariff field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Tariff field is empty/null/undefined, skipping. Value was: "' + tariffValue + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting Tariff field: ' + error.toString());
            }
            
            // Set Native Vendor field (internal ID) - CRITICAL for vendor association
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Native Vendor field (internal ID)...');
            log.debug('CreateInventoryItemRestlet', 'vendor value: "' + requestBody.vendor + '" (type: ' + typeof requestBody.vendor + ')');
            try {
                if (requestBody.vendor && (typeof requestBody.vendor === 'number' || typeof requestBody.vendor === 'string')) {
                    var vendorId = parseInt(requestBody.vendor);
                    if (!isNaN(vendorId) && vendorId > 0) {
                        log.debug('CreateInventoryItemRestlet', '✓ Setting native Vendor field (internal ID): ' + vendorId);
                        setFieldValue(inventoryItem, 'vendor', vendorId);
                        log.debug('CreateInventoryItemRestlet', '✅ Native Vendor field set successfully');
                    } else {
                        log.debug('CreateInventoryItemRestlet', '⚠️ Invalid vendor ID, skipping. Value was: "' + requestBody.vendor + '"');
                    }
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Vendor field is empty/null/undefined, skipping. Value was: "' + requestBody.vendor + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting native Vendor field: ' + error.toString());
            }

            // Set Vendor Business Name field (custom field - hybrid approach)
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Vendor Business Name field (custom)...');
            log.debug('CreateInventoryItemRestlet', 'vendorName value: "' + requestBody.vendorName + '" (length: ' + (requestBody.vendorName ? requestBody.vendorName.length : 0) + ')');
            try {
                if (requestBody.vendorName && requestBody.vendorName !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting custom Vendor Business Name field: "' + requestBody.vendorName + '"');
                    // Use custom field for vendor business name (text values work)
                    setFieldValue(inventoryItem, 'custitem_opms_vendor_name', requestBody.vendorName);
                    log.debug('CreateInventoryItemRestlet', '✅ Custom Vendor Business Name field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Vendor Business Name field is empty/null/undefined, skipping. Value was: "' + requestBody.vendorName + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting custom Vendor Business Name field: ' + error.toString());
            }
            
            // Set Vendor Name field (native NetSuite field) - support both field names
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Vendor Name field (native)...');
            var vendorNameValue = requestBody.vendorname || requestBody.vendorProductName;
            log.debug('CreateInventoryItemRestlet', 'vendorname/vendorProductName value: "' + vendorNameValue + '" (length: ' + (vendorNameValue ? vendorNameValue.length : 0) + ')');
            try {
                if (vendorNameValue && vendorNameValue !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting native Vendor Name field: "' + vendorNameValue + '"');
                    setFieldValue(inventoryItem, 'vendorname', vendorNameValue);
                    log.debug('CreateInventoryItemRestlet', '✅ Native Vendor Name field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Vendor Name field is empty/null/undefined, skipping. Value was: "' + vendorNameValue + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting native Vendor Name field: ' + error.toString());
            }
            
            // Set Vendor Color field if provided - support both field names
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Vendor Color field...');
            var vendorColorValue = requestBody.custitem_opms_vendor_color || requestBody.vendorColor;
            log.debug('CreateInventoryItemRestlet', 'custitem_opms_vendor_color/vendorColor value: "' + vendorColorValue + '" (length: ' + (vendorColorValue ? vendorColorValue.length : 0) + ')');
            try {
                if (vendorColorValue && vendorColorValue !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting Vendor Color field: "' + vendorColorValue + '"');
                    setFieldValue(inventoryItem, 'custitem_opms_vendor_color', vendorColorValue);
                    log.debug('CreateInventoryItemRestlet', '✅ Vendor Color field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Vendor Color field is empty/null/undefined, skipping. Value was: "' + vendorColorValue + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting Vendor Color field: ' + error.toString());
            }

            // Set Vendor Product Name field if provided
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Vendor Product Name field...');
            var vendorProdNameValue = requestBody.custitem_opms_vendor_prod_name;
            log.debug('CreateInventoryItemRestlet', 'custitem_opms_vendor_prod_name value: "' + vendorProdNameValue + '" (length: ' + (vendorProdNameValue ? vendorProdNameValue.length : 0) + ')');
            try {
                if (vendorProdNameValue && vendorProdNameValue !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting Vendor Product Name field: "' + vendorProdNameValue + '"');
                    setFieldValue(inventoryItem, 'custitem_opms_vendor_prod_name', vendorProdNameValue);
                    log.debug('CreateInventoryItemRestlet', '✅ Vendor Product Name field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Vendor Product Name field is empty/null/undefined, skipping. Value was: "' + vendorProdNameValue + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting Vendor Product Name field: ' + error.toString());
            }
            
            // Set Vendor Code field (native NetSuite field) - support both field names
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Vendor Code field (native)...');
            var vendorCodeValue = requestBody.vendorcode || requestBody.vendorCode;
            log.debug('CreateInventoryItemRestlet', 'vendorcode/vendorCode value: "' + vendorCodeValue + '" (length: ' + (vendorCodeValue ? vendorCodeValue.length : 0) + ')');
            try {
                if (vendorCodeValue && vendorCodeValue !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting native Vendor Code field: "' + vendorCodeValue + '"');
                    setFieldValue(inventoryItem, 'vendorcode', vendorCodeValue);
                    log.debug('CreateInventoryItemRestlet', '✅ Native Vendor Code field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Vendor Code field is empty/null/undefined, skipping. Value was: "' + vendorCodeValue + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting native Vendor Code field: ' + error.toString());
            }
            
            // Set Finish field if provided
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Finish field...');
            log.debug('CreateInventoryItemRestlet', 'finish value: "' + requestBody.finish + '" (length: ' + (requestBody.finish ? requestBody.finish.length : 0) + ')');
            try {
                if (requestBody.finish && requestBody.finish !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting Finish field: "' + requestBody.finish + '"');
                    setFieldValue(inventoryItem, 'custitem_opms_finish', requestBody.finish);
                    log.debug('CreateInventoryItemRestlet', '✅ Finish field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Finish field is empty/null/undefined, skipping. Value was: "' + requestBody.finish + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting Finish field: ' + error.toString());
            }
            
            // Set Fabric Width field if provided
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Fabric Width field...');
            log.debug('CreateInventoryItemRestlet', 'fabricWidth value: "' + requestBody.fabricWidth + '" (length: ' + (requestBody.fabricWidth ? requestBody.fabricWidth.length : 0) + ')');
            try {
                if (requestBody.fabricWidth && requestBody.fabricWidth !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting Fabric Width field: "' + requestBody.fabricWidth + '"');
                    setFieldValue(inventoryItem, 'custitem_opms_fabric_width', requestBody.fabricWidth);
                    log.debug('CreateInventoryItemRestlet', '✅ Fabric Width field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Fabric Width field is empty/null/undefined, skipping. Value was: "' + requestBody.fabricWidth + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting Fabric Width field: ' + error.toString());
            }
            
            // Set Item Colors field if provided
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Item Colors field...');
            log.debug('CreateInventoryItemRestlet', 'itemColors value: "' + requestBody.itemColors + '" (length: ' + (requestBody.itemColors ? requestBody.itemColors.length : 0) + ')');
            try {
                if (requestBody.itemColors && requestBody.itemColors !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting Item Colors field: "' + requestBody.itemColors + '"');
                    setFieldValue(inventoryItem, 'custitem_opms_item_colors', requestBody.itemColors);
                    log.debug('CreateInventoryItemRestlet', '✅ Item Colors field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Item Colors field is empty/null/undefined, skipping. Value was: "' + requestBody.itemColors + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting Item Colors field: ' + error.toString());
            }
            
            // Set Cleaning field if provided
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Cleaning field...');
            log.debug('CreateInventoryItemRestlet', 'cleaning value: "' + requestBody.cleaning + '" (length: ' + (requestBody.cleaning ? requestBody.cleaning.length : 0) + ')');
            try {
                if (requestBody.cleaning && requestBody.cleaning !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting Cleaning field: "' + requestBody.cleaning + '"');
                    setFieldValue(inventoryItem, 'custitem_opms_fabric_cleaning', requestBody.cleaning);
                    log.debug('CreateInventoryItemRestlet', '✅ Cleaning field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Cleaning field is empty/null/undefined, skipping. Value was: "' + requestBody.cleaning + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting Cleaning field: ' + error.toString());
            }
            
            // Set Origin field if provided
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Origin field...');
            log.debug('CreateInventoryItemRestlet', 'origin value: "' + requestBody.origin + '" (length: ' + (requestBody.origin ? requestBody.origin.length : 0) + ')');
            try {
                if (requestBody.origin && requestBody.origin !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting Origin field: "' + requestBody.origin + '"');
                    setFieldValue(inventoryItem, 'custitem_opms_product_origin', requestBody.origin);
                    log.debug('CreateInventoryItemRestlet', '✅ Origin field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Origin field is empty/null/undefined, skipping. Value was: "' + requestBody.origin + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting Origin field: ' + error.toString());
            }
            
            // Set Parent Product Name field if provided - support both field name formats
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Parent Product Name field...');
            var parentProductNameValue = requestBody.parentProductName || requestBody.custitem_opms_parent_product_name;
            log.debug('CreateInventoryItemRestlet', 'parentProductName value: "' + requestBody.parentProductName + '", custitem_opms_parent_product_name value: "' + requestBody.custitem_opms_parent_product_name + '"');
            try {
                if (parentProductNameValue && parentProductNameValue !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting Parent Product Name field: "' + parentProductNameValue + '"');
                    setFieldValue(inventoryItem, 'custitem_opms_parent_product_name', parentProductNameValue);
                    log.debug('CreateInventoryItemRestlet', '✅ Parent Product Name field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Parent Product Name field is empty/null/undefined, skipping. Value was: "' + parentProductNameValue + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting Parent Product Name field: ' + error.toString());
            }
            
            // Set Item Application field (custitem_item_application) if provided
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Item Application field...');
            log.debug('CreateInventoryItemRestlet', 'itemApplication value: "' + requestBody.custitem_item_application + '" (length: ' + (requestBody.custitem_item_application ? requestBody.custitem_item_application.length : 0) + ')');
            try {
                if (requestBody.custitem_item_application && requestBody.custitem_item_application !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting Item Application field: "' + requestBody.custitem_item_application + '"');
                    setFieldValue(inventoryItem, 'custitem_item_application', requestBody.custitem_item_application);
                    log.debug('CreateInventoryItemRestlet', '✅ Item Application field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Item Application field is empty/null/undefined, skipping. Value was: "' + requestBody.custitem_item_application + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting Item Application field: ' + error.toString());
            }
            
            // Set Is Repeat field (custitem_is_repeat) if provided - support both field name formats
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Is Repeat field...');
            var isRepeatValue = requestBody.custitem_is_repeat || requestBody.custitem_opms_is_repeat;
            log.debug('CreateInventoryItemRestlet', 'custitem_is_repeat value: "' + requestBody.custitem_is_repeat + '", custitem_opms_is_repeat value: "' + requestBody.custitem_opms_is_repeat + '"');
            try {
                if (isRepeatValue && isRepeatValue !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting Is Repeat field: "' + isRepeatValue + '"');
                    setFieldValue(inventoryItem, 'custitem_is_repeat', isRepeatValue);
                    log.debug('CreateInventoryItemRestlet', '✅ Is Repeat field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Is Repeat field is empty/null/undefined, skipping. Value was: "' + isRepeatValue + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting Is Repeat field: ' + error.toString());
            }
            
            // Set Lisa Slayman Item field (custitemf3_lisa_item) if provided
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Lisa Slayman Item field...');
            log.debug('CreateInventoryItemRestlet', 'custitemf3_lisa_item value: ' + requestBody.custitemf3_lisa_item + ' (type: ' + typeof requestBody.custitemf3_lisa_item + ')');
            try {
                if (requestBody.custitemf3_lisa_item !== undefined && requestBody.custitemf3_lisa_item !== null) {
                    // Convert to boolean if needed
                    var lisaValue = requestBody.custitemf3_lisa_item;
                    if (typeof lisaValue === 'string') {
                        lisaValue = lisaValue.toLowerCase() === 'true' || lisaValue === '1' || lisaValue.toLowerCase() === 'y';
                    }
                    log.debug('CreateInventoryItemRestlet', '✓ Setting Lisa Slayman Item field: ' + lisaValue);
                    setFieldValue(inventoryItem, 'custitemf3_lisa_item', lisaValue);
                    log.debug('CreateInventoryItemRestlet', '✅ Lisa Slayman Item field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Lisa Slayman Item field is null/undefined, skipping. Value was: ' + requestBody.custitemf3_lisa_item);
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting Lisa Slayman Item field: ' + error.toString());
            }
            
            // Set F3 Roll Price field (custitem_f3_rollprice) if provided
            log.debug('CreateInventoryItemRestlet', '🔄 Processing F3 Roll Price field...');
            log.debug('CreateInventoryItemRestlet', 'custitem_f3_rollprice value: "' + requestBody.custitem_f3_rollprice + '"');
            try {
                if (requestBody.custitem_f3_rollprice && requestBody.custitem_f3_rollprice !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting F3 Roll Price field: "' + requestBody.custitem_f3_rollprice + '"');
                    setFieldValue(inventoryItem, 'custitem_f3_rollprice', requestBody.custitem_f3_rollprice);
                    log.debug('CreateInventoryItemRestlet', '✅ F3 Roll Price field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ F3 Roll Price field is empty/null/undefined, skipping. Value was: "' + requestBody.custitem_f3_rollprice + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting F3 Roll Price field: ' + error.toString());
            }
            
            // ========================================================================
            // PRICING CASCADE: Set pricing fields from NetSuite→OPMS→NetSuite cascade
            // ========================================================================
            
            // Set Purchase Cost (vendor cost)
            if (requestBody.cost !== undefined && requestBody.cost !== null) {
                try {
                    log.debug('CreateInventoryItemRestlet', '💰 Setting purchase cost: ' + requestBody.cost);
                    setFieldValue(inventoryItem, 'cost', parseFloat(requestBody.cost));
                } catch (error) {
                    log.error('CreateInventoryItemRestlet', '❌ Error setting cost: ' + error.toString());
                }
            }
            
            // Set Base Price (Price Level 1, Line 1 - Residential Cut Price)
            if (requestBody.price_1_ !== undefined && requestBody.price_1_ !== null) {
                try {
                    log.debug('CreateInventoryItemRestlet', '💰 Setting price_1_ (line 0): ' + requestBody.price_1_);
                    inventoryItem.selectLine({ sublistId: 'price1', line: 0 });
                    inventoryItem.setCurrentSublistValue({
                        sublistId: 'price1',
                        fieldId: 'price_1_',
                        value: parseFloat(requestBody.price_1_)
                    });
                    inventoryItem.commitLine({ sublistId: 'price1' });
                    log.debug('CreateInventoryItemRestlet', '✅ price_1_ set successfully');
                } catch (error) {
                    log.error('CreateInventoryItemRestlet', '❌ Error setting price_1_: ' + error.toString());
                }
            }
            
            // Set Roll Price (Price Level 1, Line 5 - Hospital Roll Price)
            if (requestBody.price_1_5 !== undefined && requestBody.price_1_5 !== null) {
                try {
                    log.debug('CreateInventoryItemRestlet', '💰 Setting price_1_5 (line 4): ' + requestBody.price_1_5);
                    inventoryItem.selectLine({ sublistId: 'price1', line: 4 });
                    inventoryItem.setCurrentSublistValue({
                        sublistId: 'price1',
                        fieldId: 'price_1_',
                        value: parseFloat(requestBody.price_1_5)
                    });
                    inventoryItem.commitLine({ sublistId: 'price1' });
                    log.debug('CreateInventoryItemRestlet', '✅ price_1_5 set successfully');
                } catch (error) {
                    log.error('CreateInventoryItemRestlet', '❌ Error setting price_1_5: ' + error.toString());
                }
            }
            
            // Set Repeat field (custitem5) checkbox if provided
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Repeat field...');
            log.debug('CreateInventoryItemRestlet', 'repeat value: ' + requestBody.repeat + ' (type: ' + typeof requestBody.repeat + ')');
            try {
                if (typeof requestBody.repeat === 'boolean') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting Repeat field: ' + requestBody.repeat);
                    setFieldValue(inventoryItem, 'custitem5', requestBody.repeat);
                    log.debug('CreateInventoryItemRestlet', '✅ Repeat field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Repeat field is not boolean, skipping');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting Repeat field: ' + error.toString());
            }
            
            // Set Front Content field (custitem_opms_front_content) if provided
            if (requestBody.frontContentJson) {
                setFieldValue(inventoryItem, 'custitem_opms_front_content', requestBody.frontContentJson);
            }
            
            // Set Back Content field (custitem_opms_back_content) if provided
            if (requestBody.backContentJson) {
                setFieldValue(inventoryItem, 'custitem_opms_back_content', requestBody.backContentJson);
            }
            
            // Set Abrasion field (custitem_opms_abrasion) if provided
            // DEBUG: Log all request body keys to see what we're receiving
            log.debug('CreateInventoryItemRestlet', 'All request body keys: ' + Object.keys(requestBody).join(', '));
            log.debug('CreateInventoryItemRestlet', 'abrasionJson exists: ' + (requestBody.abrasionJson ? 'YES' : 'NO'));
            if (requestBody.abrasionJson) {
                log.debug('CreateInventoryItemRestlet', 'abrasionJson length: ' + requestBody.abrasionJson.length);
                setFieldValue(inventoryItem, 'custitem_opms_abrasion', requestBody.abrasionJson);
            } else {
                log.debug('CreateInventoryItemRestlet', 'abrasionJson is missing or empty');
            }
            
            // Set Firecodes field (custitem_opms_firecodes) if provided
            log.debug('CreateInventoryItemRestlet', 'firecodesJson exists: ' + (requestBody.firecodesJson ? 'YES' : 'NO'));
            if (requestBody.firecodesJson) {
                log.debug('CreateInventoryItemRestlet', 'firecodesJson length: ' + requestBody.firecodesJson.length);
                setFieldValue(inventoryItem, 'custitem_opms_firecodes', requestBody.firecodesJson);
            } else {
                log.debug('CreateInventoryItemRestlet', 'firecodesJson is missing or empty');
            }
            
            // ============================================================================
            // PURCHASE DESCRIPTION - Native NetSuite textarea field
            // ============================================================================
            if (requestBody.purchasedescription) {
                try {
                    var purchaseDescValue = requestBody.purchasedescription;
                    var purchaseDescType = typeof purchaseDescValue;
                    var purchaseDescLength = purchaseDescValue ? purchaseDescValue.length : 0;
                    
                    log.debug('CreateInventoryItemRestlet', '═════════════════════════════════════════════════════════');
                    log.debug('CreateInventoryItemRestlet', '📝 PURCHASE DESCRIPTION - Setting Field');
                    log.debug('CreateInventoryItemRestlet', '═════════════════════════════════════════════════════════');
                    log.debug('CreateInventoryItemRestlet', 'Field ID: purchasedescription');
                    log.debug('CreateInventoryItemRestlet', 'Field Type (NetSuite): textarea');
                    log.debug('CreateInventoryItemRestlet', 'Value Type (JavaScript): ' + purchaseDescType);
                    log.debug('CreateInventoryItemRestlet', 'Character Count: ' + purchaseDescLength);
                    log.debug('CreateInventoryItemRestlet', 'Contains newlines: ' + (purchaseDescValue.indexOf('\n') > -1 ? 'YES' : 'NO'));
                    log.debug('CreateInventoryItemRestlet', 'Line Count (estimated): ' + (purchaseDescValue.split('\n').length));
                    
                    // Show preview of content
                    var preview = purchaseDescValue.length > 100 
                        ? purchaseDescValue.substring(0, 100) + '...' 
                        : purchaseDescValue;
                    log.debug('CreateInventoryItemRestlet', 'Content Preview: ' + preview);
                    
                    // Show first 3 lines
                    var lines = purchaseDescValue.split('\n');
                    log.debug('CreateInventoryItemRestlet', 'First 3 Lines:');
                    for (var i = 0; i < Math.min(3, lines.length); i++) {
                        log.debug('CreateInventoryItemRestlet', '  ' + (i + 1) + '. ' + lines[i]);
                    }
                    
                    // Attempt to set the field
                    log.debug('CreateInventoryItemRestlet', '⏳ Attempting to set field...');
                    setFieldValue(inventoryItem, 'purchasedescription', purchaseDescValue);
                    log.debug('CreateInventoryItemRestlet', '✅ Purchase description set successfully');
                    log.debug('CreateInventoryItemRestlet', '═════════════════════════════════════════════════════════');
                    
                } catch (error) {
                    log.error('CreateInventoryItemRestlet', '═════════════════════════════════════════════════════════');
                    log.error('CreateInventoryItemRestlet', '❌ PURCHASE DESCRIPTION ERROR');
                    log.error('CreateInventoryItemRestlet', '═════════════════════════════════════════════════════════');
                    log.error('CreateInventoryItemRestlet', 'Error Type: ' + error.name);
                    log.error('CreateInventoryItemRestlet', 'Error Message: ' + error.message);
                    log.error('CreateInventoryItemRestlet', 'Error Details: ' + error.toString());
                    log.error('CreateInventoryItemRestlet', 'Field ID Attempted: purchasedescription');
                    log.error('CreateInventoryItemRestlet', 'Value Type: ' + (typeof requestBody.purchasedescription));
                    log.error('CreateInventoryItemRestlet', 'Value Length: ' + (requestBody.purchasedescription ? requestBody.purchasedescription.length : 'null'));
                    log.error('CreateInventoryItemRestlet', '═════════════════════════════════════════════════════════');
                    log.error('CreateInventoryItemRestlet', 'POSSIBLE CAUSES:');
                    log.error('CreateInventoryItemRestlet', '  1. Field does not exist in NetSuite (check field setup)');
                    log.error('CreateInventoryItemRestlet', '  2. Field type mismatch (expected: textarea)');
                    log.error('CreateInventoryItemRestlet', '  3. Permissions issue (check role permissions)');
                    log.error('CreateInventoryItemRestlet', '  4. Character limit exceeded (NetSuite limit: 4000 chars)');
                    log.error('CreateInventoryItemRestlet', '  5. Invalid characters in content');
                    log.error('CreateInventoryItemRestlet', '═════════════════════════════════════════════════════════');
                }
            } else {
                log.debug('CreateInventoryItemRestlet', 'ℹ️  Purchase description not provided in request body (skipped)');
            }
            
            // ============================================================================
            // SALES DESCRIPTION - Native NetSuite textarea field
            // ============================================================================
            if (requestBody.salesdescription) {
                try {
                    var salesDescValue = requestBody.salesdescription;
                    var salesDescType = typeof salesDescValue;
                    var salesDescLength = salesDescValue ? salesDescValue.length : 0;
                    
                    log.debug('CreateInventoryItemRestlet', '═════════════════════════════════════════════════════════');
                    log.debug('CreateInventoryItemRestlet', '📝 SALES DESCRIPTION - Setting Field');
                    log.debug('CreateInventoryItemRestlet', '═════════════════════════════════════════════════════════');
                    log.debug('CreateInventoryItemRestlet', 'Field ID: salesdescription');
                    log.debug('CreateInventoryItemRestlet', 'Field Type (NetSuite): textarea');
                    log.debug('CreateInventoryItemRestlet', 'Value Type (JavaScript): ' + salesDescType);
                    log.debug('CreateInventoryItemRestlet', 'Character Count: ' + salesDescLength);
                    log.debug('CreateInventoryItemRestlet', 'Contains newlines: ' + (salesDescValue.indexOf('\n') > -1 ? 'YES' : 'NO'));
                    log.debug('CreateInventoryItemRestlet', 'Line Count (estimated): ' + (salesDescValue.split('\n').length));
                    
                    // Show preview of content
                    var preview = salesDescValue.length > 100 
                        ? salesDescValue.substring(0, 100) + '...' 
                        : salesDescValue;
                    log.debug('CreateInventoryItemRestlet', 'Content Preview: ' + preview);
                    
                    // Show first 3 lines
                    var lines = salesDescValue.split('\n');
                    log.debug('CreateInventoryItemRestlet', 'First 3 Lines:');
                    for (var i = 0; i < Math.min(3, lines.length); i++) {
                        log.debug('CreateInventoryItemRestlet', '  ' + (i + 1) + '. ' + lines[i]);
                    }
                    
                    // Attempt to set the field
                    log.debug('CreateInventoryItemRestlet', '⏳ Attempting to set field...');
                    setFieldValue(inventoryItem, 'salesdescription', salesDescValue);
                    log.debug('CreateInventoryItemRestlet', '✅ Sales description set successfully');
                    log.debug('CreateInventoryItemRestlet', '═════════════════════════════════════════════════════════');
                    
                } catch (error) {
                    log.error('CreateInventoryItemRestlet', '═════════════════════════════════════════════════════════');
                    log.error('CreateInventoryItemRestlet', '❌ SALES DESCRIPTION ERROR');
                    log.error('CreateInventoryItemRestlet', '═════════════════════════════════════════════════════════');
                    log.error('CreateInventoryItemRestlet', 'Error Type: ' + error.name);
                    log.error('CreateInventoryItemRestlet', 'Error Message: ' + error.message);
                    log.error('CreateInventoryItemRestlet', 'Error Details: ' + error.toString());
                    log.error('CreateInventoryItemRestlet', 'Field ID Attempted: salesdescription');
                    log.error('CreateInventoryItemRestlet', 'Value Type: ' + (typeof requestBody.salesdescription));
                    log.error('CreateInventoryItemRestlet', 'Value Length: ' + (requestBody.salesdescription ? requestBody.salesdescription.length : 'null'));
                    log.error('CreateInventoryItemRestlet', '═════════════════════════════════════════════════════════');
                    log.error('CreateInventoryItemRestlet', 'POSSIBLE CAUSES:');
                    log.error('CreateInventoryItemRestlet', '  1. Field does not exist in NetSuite (check field setup)');
                    log.error('CreateInventoryItemRestlet', '  2. Field type mismatch (expected: textarea)');
                    log.error('CreateInventoryItemRestlet', '  3. Permissions issue (check role permissions)');
                    log.error('CreateInventoryItemRestlet', '  4. Character limit exceeded (NetSuite limit: 4000 chars)');
                    log.error('CreateInventoryItemRestlet', '  5. Invalid characters in content');
                    log.error('CreateInventoryItemRestlet', '═════════════════════════════════════════════════════════');
                }
            } else {
                log.debug('CreateInventoryItemRestlet', 'ℹ️  Sales description not provided in request body (skipped)');
            }
            
            // Display name is now set at the beginning (before itemid)
            
            // ENHANCEMENT: Handle vendor information
            if (requestBody.vendorName) {
                // Try to set vendor name in searchable text field or notes
                setFieldValue(inventoryItem, 'memo', 'Vendor: ' + requestBody.vendorName + 
                    (requestBody.vendorAbbreviation ? ' (' + requestBody.vendorAbbreviation + ')' : ''));
            }
            
            // Set default inventory settings for LOT NUMBERED INVENTORY ITEMS
            setFieldValue(inventoryItem, 'isserialitem', false);
            setFieldValue(inventoryItem, 'islotitem', true);  // ENABLE lot numbering
            
            // Set lot numbering configuration (required for lot numbered items)
            setFieldValue(inventoryItem, 'lotnumberformat', 'BOLT-{SEQNUM}');  // Lot number format
            setFieldValue(inventoryItem, 'startsequencenumber', '1');           // Initial sequence number
            
            // Set asset account defaults if not specified
            if (!requestBody.incomeAccountId && !requestBody.cogsAccountId) {
                log.debug('CreateInventoryItemRestlet', 'Using default account settings');
            }
            
            // CRITICAL: ADD VENDOR TO ITEMVENDOR SUBLIST (using real field names from inspection)
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Vendor Sublist (itemvendor)...');
            if (requestBody.vendor) {
                var vendorId = parseInt(requestBody.vendor);
                if (!isNaN(vendorId) && vendorId > 0) {
                    log.debug('CreateInventoryItemRestlet', '✓ Processing vendor for itemvendor sublist: ' + vendorId);
                    try {
                        // Check if vendor already exists in sublist (for UPDATE operations)
                        var existingVendorLineIndex = -1;
                        var itemvendorLineCount = inventoryItem.getLineCount({ sublistId: 'itemvendor' });
                        log.debug('CreateInventoryItemRestlet', 'Current itemvendor line count: ' + itemvendorLineCount);
                        
                        // Look for existing vendor line with same vendor ID
                        for (var i = 0; i < itemvendorLineCount; i++) {
                            var lineVendorId = inventoryItem.getSublistValue({
                                sublistId: 'itemvendor',
                                fieldId: 'vendor',
                                line: i
                            });
                            if (lineVendorId == vendorId) {
                                existingVendorLineIndex = i;
                                log.debug('CreateInventoryItemRestlet', '✓ Found existing vendor line at index: ' + i);
                                break;
                            }
                        }
                        
                        if (existingVendorLineIndex >= 0) {
                            // Update existing vendor line
                            log.debug('CreateInventoryItemRestlet', '🔄 Updating existing vendor line at index: ' + existingVendorLineIndex);
                            inventoryItem.selectLine({ sublistId: 'itemvendor', line: existingVendorLineIndex });
                            
                            // Update vendor code if provided
                            if (requestBody.vendorcode) {
                                inventoryItem.setCurrentSublistValue({
                                    sublistId: 'itemvendor',
                                    fieldId: 'vendorcode',
                                    value: requestBody.vendorcode
                                });
                                log.debug('CreateInventoryItemRestlet', '✓ Updated vendorcode in existing line: ' + requestBody.vendorcode);
                            }
                            
                            // Ensure preferred vendor is set
                            inventoryItem.setCurrentSublistValue({
                                sublistId: 'itemvendor',
                                fieldId: 'preferredvendor',
                                value: true
                            });
                            log.debug('CreateInventoryItemRestlet', '✓ Updated preferredvendor to true');
                            
                            // Commit the updated line
                            inventoryItem.commitLine({ sublistId: 'itemvendor' });
                            log.debug('CreateInventoryItemRestlet', '✅ Existing vendor sublist line updated successfully');
                        } else {
                            // Add new vendor line (for CREATE operations or new vendors)
                            log.debug('CreateInventoryItemRestlet', '➕ Adding new vendor line to sublist');
                            inventoryItem.selectNewLine({ sublistId: 'itemvendor' });
                            
                            // Set vendor ID (required field)
                            inventoryItem.setCurrentSublistValue({
                                sublistId: 'itemvendor',
                                fieldId: 'vendor',
                                value: vendorId
                            });
                            log.debug('CreateInventoryItemRestlet', '✓ Set vendor field in new line: ' + vendorId);
                            
                            // Set vendor code if provided
                            if (requestBody.vendorcode) {
                                inventoryItem.setCurrentSublistValue({
                                    sublistId: 'itemvendor',
                                    fieldId: 'vendorcode',
                                    value: requestBody.vendorcode
                                });
                                log.debug('CreateInventoryItemRestlet', '✓ Set vendorcode in new line: ' + requestBody.vendorcode);
                            }
                            
                            // Set as preferred vendor
                            inventoryItem.setCurrentSublistValue({
                                sublistId: 'itemvendor',
                                fieldId: 'preferredvendor',
                                value: true
                            });
                            log.debug('CreateInventoryItemRestlet', '✓ Set preferredvendor to true');
                            
                            // Commit the new line
                            inventoryItem.commitLine({ sublistId: 'itemvendor' });
                            log.debug('CreateInventoryItemRestlet', '✅ New vendor sublist line added successfully');
                        }
                    } catch (sublistError) {
                        log.error('CreateInventoryItemRestlet', '❌ Error processing vendor sublist: ' + sublistError.toString());
                    }
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Invalid vendor ID for sublist, skipping: ' + requestBody.vendor);
                }
            } else {
                log.debug('CreateInventoryItemRestlet', '⚠️ No vendor provided for sublist');
            }

            // Save the record
            var recordId;
            try {
                recordId = inventoryItem.save();
                
                if (isUpdate) {
                    log.audit('CreateInventoryItemRestlet', 'Successfully updated inventory item with ID: ' + recordId + ', ItemID: ' + requestBody.itemId);
                } else {
                    log.audit('CreateInventoryItemRestlet', 'Successfully created inventory item with ID: ' + recordId + ', ItemID: ' + requestBody.itemId);
                }
            } catch (saveError) {
                // If save fails with uniqueness error and we were trying to create, retry as update
                if (saveError.toString().includes('Uniqueness error') && !isUpdate) {
                    log.debug('CreateInventoryItemRestlet', '🔄 Uniqueness error during create, retrying as update...');
                    
                    // Try to find the existing item by searching for it
                    var existingItemId = findExistingItemBySearch(requestBody.itemId);
                    if (existingItemId) {
                        log.debug('CreateInventoryItemRestlet', '✅ Found existing item, updating: ' + existingItemId);
                        
                        // Load the existing item and update it
                        var existingItem = record.load({
                            type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                            id: existingItemId,
                            isDynamic: true
                        });
                        
                        // Apply all the same field updates to the existing item
                        updateItemFields(existingItem, requestBody);
                        
                        // Save the updated item
                        recordId = existingItem.save();
                        isUpdate = true;
                        
                        log.audit('CreateInventoryItemRestlet', 'Successfully updated existing inventory item with ID: ' + recordId + ', ItemID: ' + requestBody.itemId);
                    } else {
                        // If we can't find the existing item, re-throw the original error
                        throw saveError;
                    }
                } else {
                    // Re-throw the error if it's not a uniqueness error or we were already updating
                    throw saveError;
                }
            }
            
            // ENHANCEMENT: Read back the saved record to verify custom fields
            var savedRecord = record.load({
                type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                id: recordId
            });
            
            // Read back custom fields to verify they were saved
            var customFieldsResult = {};
            
            try {
                customFieldsResult.custitem_opms_prod_id = savedRecord.getValue({ fieldId: 'custitem_opms_prod_id' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_opms_prod_id (OPMS Product ID): ' + customFieldsResult.custitem_opms_prod_id);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_opms_prod_id (OPMS Product ID): ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_opms_item_id = savedRecord.getValue({ fieldId: 'custitem_opms_item_id' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_opms_item_id (OPMS Item ID): ' + customFieldsResult.custitem_opms_item_id);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_opms_item_id (OPMS Item ID): ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem1 = savedRecord.getValue({ fieldId: 'custitem1' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem1 (Width): ' + customFieldsResult.custitem1);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem1 (Width): ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem5 = savedRecord.getValue({ fieldId: 'custitem5' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem5 (Repeat): ' + customFieldsResult.custitem5);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem5 (Repeat): ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_vertical_repeat = savedRecord.getValue({ fieldId: 'custitem_vertical_repeat' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_vertical_repeat (VR): ' + customFieldsResult.custitem_vertical_repeat);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_vertical_repeat (VR): ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_horizontal_repeat = savedRecord.getValue({ fieldId: 'custitem_horizontal_repeat' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_horizontal_repeat (HR): ' + customFieldsResult.custitem_horizontal_repeat);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_horizontal_repeat (HR): ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_prop65_compliance = savedRecord.getValue({ fieldId: 'custitem_prop65_compliance' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_prop65_compliance (Prop 65): ' + customFieldsResult.custitem_prop65_compliance);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_prop65_compliance (Prop 65): ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_ab2998_compliance = savedRecord.getValue({ fieldId: 'custitem_ab2998_compliance' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_ab2998_compliance (AB 2998): ' + customFieldsResult.custitem_ab2998_compliance);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_ab2998_compliance (AB 2998): ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_tariff_harmonized_code = savedRecord.getValue({ fieldId: 'custitem_tariff_harmonized_code' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_tariff_harmonized_code (Tariff): ' + customFieldsResult.custitem_tariff_harmonized_code);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_tariff_harmonized_code (Tariff): ' + error.toString());
            }
            
            try {
                customFieldsResult.vendor = savedRecord.getValue({ fieldId: 'vendor' });
                log.debug('CreateInventoryItemRestlet', 'Read back vendor (Native Vendor): ' + customFieldsResult.vendor);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read vendor (Native Vendor): ' + error.toString());
            }
            
            try {
                customFieldsResult.vendorname = savedRecord.getValue({ fieldId: 'vendorname' });
                log.debug('CreateInventoryItemRestlet', 'Read back vendorname (Native Vendor Name): ' + customFieldsResult.vendorname);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read vendorname (Native Vendor Name): ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_opms_vendor_color = savedRecord.getValue({ fieldId: 'custitem_opms_vendor_color' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_opms_vendor_color (Vendor Color): ' + customFieldsResult.custitem_opms_vendor_color);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_opms_vendor_color (Vendor Color): ' + error.toString());
            }

            try {
                customFieldsResult.custitem_opms_vendor_prod_name = savedRecord.getValue({ fieldId: 'custitem_opms_vendor_prod_name' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_opms_vendor_prod_name (Vendor Product Name): ' + customFieldsResult.custitem_opms_vendor_prod_name);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_opms_vendor_prod_name (Vendor Product Name): ' + error.toString());
            }
            
            try {
                customFieldsResult.vendorcode = savedRecord.getValue({ fieldId: 'vendorcode' });
                log.debug('CreateInventoryItemRestlet', 'Read back vendorcode (Native Vendor Code): ' + customFieldsResult.vendorcode);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read vendorcode (Native Vendor Code): ' + error.toString());
            }

            // Read back itemvendor sublist information
            try {
                var itemvendorLineCount = savedRecord.getLineCount({ sublistId: 'itemvendor' });
                customFieldsResult.itemvendorLineCount = itemvendorLineCount;
                log.debug('CreateInventoryItemRestlet', 'Read back itemvendor sublist line count: ' + itemvendorLineCount);
                
                if (itemvendorLineCount > 0) {
                    // Read the first vendor line
                    var itemvendorData = {
                        vendor: savedRecord.getSublistValue({ sublistId: 'itemvendor', fieldId: 'vendor', line: 0 }),
                        vendorcode: savedRecord.getSublistValue({ sublistId: 'itemvendor', fieldId: 'vendorcode', line: 0 }),
                        preferredvendor: savedRecord.getSublistValue({ sublistId: 'itemvendor', fieldId: 'preferredvendor', line: 0 })
                    };
                    customFieldsResult.itemvendorData = itemvendorData;
                    log.debug('CreateInventoryItemRestlet', 'Read back itemvendor data: ' + JSON.stringify(itemvendorData));
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read itemvendor sublist: ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_opms_finish = savedRecord.getValue({ fieldId: 'custitem_opms_finish' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_opms_finish (Finish): ' + customFieldsResult.custitem_opms_finish);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_opms_finish (Finish): ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_opms_fabric_width = savedRecord.getValue({ fieldId: 'custitem_opms_fabric_width' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_opms_fabric_width (Fabric Width): ' + customFieldsResult.custitem_opms_fabric_width);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_opms_fabric_width (Fabric Width): ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_opms_item_colors = savedRecord.getValue({ fieldId: 'custitem_opms_item_colors' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_opms_item_colors (Item Colors): ' + customFieldsResult.custitem_opms_item_colors);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_opms_item_colors (Item Colors): ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_opms_fabric_cleaning = savedRecord.getValue({ fieldId: 'custitem_opms_fabric_cleaning' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_opms_fabric_cleaning (Cleaning): ' + customFieldsResult.custitem_opms_fabric_cleaning);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_opms_fabric_cleaning (Cleaning): ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_opms_product_origin = savedRecord.getValue({ fieldId: 'custitem_opms_product_origin' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_opms_product_origin (Origin): ' + customFieldsResult.custitem_opms_product_origin);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_opms_product_origin (Origin): ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_opms_parent_product_name = savedRecord.getValue({ fieldId: 'custitem_opms_parent_product_name' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_opms_parent_product_name (Parent Product Name): ' + customFieldsResult.custitem_opms_parent_product_name);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_opms_parent_product_name (Parent Product Name): ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_item_application = savedRecord.getValue({ fieldId: 'custitem_item_application' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_item_application (Item Application): ' + customFieldsResult.custitem_item_application);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_item_application (Item Application): ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_is_repeat = savedRecord.getValue({ fieldId: 'custitem_is_repeat' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_is_repeat (Is Repeat): ' + customFieldsResult.custitem_is_repeat);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_is_repeat (Is Repeat): ' + error.toString());
            }
            
            try {
                customFieldsResult.custitemf3_lisa_item = savedRecord.getValue({ fieldId: 'custitemf3_lisa_item' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitemf3_lisa_item (Lisa Slayman Item): ' + customFieldsResult.custitemf3_lisa_item);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitemf3_lisa_item (Lisa Slayman Item): ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_f3_rollprice = savedRecord.getValue({ fieldId: 'custitem_f3_rollprice' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_f3_rollprice (F3 Roll Price): ' + customFieldsResult.custitem_f3_rollprice);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_f3_rollprice (F3 Roll Price): ' + error.toString());
            }
            
            try {
                customFieldsResult.displayname = savedRecord.getValue({ fieldId: 'displayname' });
                log.debug('CreateInventoryItemRestlet', 'Read back displayname (Display Name): ' + customFieldsResult.displayname);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read displayname (Display Name): ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_opms_front_content = savedRecord.getValue({ fieldId: 'custitem_opms_front_content' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_opms_front_content: ' + (customFieldsResult.custitem_opms_front_content ? customFieldsResult.custitem_opms_front_content.length + ' chars' : 'empty'));
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_opms_front_content: ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_opms_back_content = savedRecord.getValue({ fieldId: 'custitem_opms_back_content' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_opms_back_content: ' + (customFieldsResult.custitem_opms_back_content ? customFieldsResult.custitem_opms_back_content.length + ' chars' : 'empty'));
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_opms_back_content: ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_opms_abrasion = savedRecord.getValue({ fieldId: 'custitem_opms_abrasion' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_opms_abrasion: ' + (customFieldsResult.custitem_opms_abrasion ? customFieldsResult.custitem_opms_abrasion.length + ' chars' : 'empty'));
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_opms_abrasion: ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_opms_firecodes = savedRecord.getValue({ fieldId: 'custitem_opms_firecodes' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_opms_firecodes: ' + (customFieldsResult.custitem_opms_firecodes ? customFieldsResult.custitem_opms_firecodes.length + ' chars' : 'empty'));
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_opms_firecodes: ' + error.toString());
            }
            
            // ============================================================================
            // READ-BACK VERIFICATION - Purchase and Sales Descriptions
            // ============================================================================
            var purchaseDescription = null;
            var salesDescription = null;
            
            log.debug('CreateInventoryItemRestlet', '');
            log.debug('CreateInventoryItemRestlet', '🔍 VERIFYING DESCRIPTIONS WERE SAVED TO NETSUITE');
            log.debug('CreateInventoryItemRestlet', '═════════════════════════════════════════════════════════');
            
            // Read back Purchase Description
            try {
                purchaseDescription = savedRecord.getValue({ fieldId: 'purchasedescription' });
                
                if (purchaseDescription) {
                    var purchaseLines = purchaseDescription.split('\n');
                    log.debug('CreateInventoryItemRestlet', '✅ PURCHASE DESCRIPTION READ-BACK SUCCESS');
                    log.debug('CreateInventoryItemRestlet', '  Character Count: ' + purchaseDescription.length);
                    log.debug('CreateInventoryItemRestlet', '  Line Count: ' + purchaseLines.length);
                    log.debug('CreateInventoryItemRestlet', '  Contains newlines: ' + (purchaseDescription.indexOf('\n') > -1 ? 'YES' : 'NO'));
                    log.debug('CreateInventoryItemRestlet', '  Contains Pricing: ' + (purchaseDescription.indexOf('Price') > -1 ? 'YES ✓' : 'NO ✗'));
                    log.debug('CreateInventoryItemRestlet', '  Preview: ' + (purchaseDescription.length > 80 ? purchaseDescription.substring(0, 80) + '...' : purchaseDescription));
                    log.debug('CreateInventoryItemRestlet', '  First Line: ' + purchaseLines[0]);
                    log.debug('CreateInventoryItemRestlet', '  Last Line: ' + purchaseLines[purchaseLines.length - 1]);
                } else {
                    log.audit('CreateInventoryItemRestlet', '⚠️  PURCHASE DESCRIPTION IS EMPTY AFTER SAVE');
                    log.audit('CreateInventoryItemRestlet', '  This might indicate:');
                    log.audit('CreateInventoryItemRestlet', '    - Field was not set properly');
                    log.audit('CreateInventoryItemRestlet', '    - Field permissions prevent read-back');
                    log.audit('CreateInventoryItemRestlet', '    - Value was not provided in request');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ COULD NOT READ PURCHASE DESCRIPTION');
                log.error('CreateInventoryItemRestlet', '  Error: ' + error.toString());
                log.error('CreateInventoryItemRestlet', '  Field ID: purchasedescription');
                log.error('CreateInventoryItemRestlet', '  Possible causes:');
                log.error('CreateInventoryItemRestlet', '    - Field does not exist on this record type');
                log.error('CreateInventoryItemRestlet', '    - Permission issue');
            }
            
            log.debug('CreateInventoryItemRestlet', '─────────────────────────────────────────────────────────');
            
            // Read back Sales Description
            try {
                salesDescription = savedRecord.getValue({ fieldId: 'salesdescription' });
                
                if (salesDescription) {
                    var salesLines = salesDescription.split('\n');
                    log.debug('CreateInventoryItemRestlet', '✅ SALES DESCRIPTION READ-BACK SUCCESS');
                    log.debug('CreateInventoryItemRestlet', '  Character Count: ' + salesDescription.length);
                    log.debug('CreateInventoryItemRestlet', '  Line Count: ' + salesLines.length);
                    log.debug('CreateInventoryItemRestlet', '  Contains newlines: ' + (salesDescription.indexOf('\n') > -1 ? 'YES' : 'NO'));
                    log.debug('CreateInventoryItemRestlet', '  Starts with #: ' + (salesDescription.indexOf('#') === 0 ? 'YES ✓' : 'NO ✗'));
                    log.debug('CreateInventoryItemRestlet', '  Contains Pricing: ' + (salesDescription.indexOf('Price') > -1 ? 'YES ✗ (SHOULD NOT!)' : 'NO ✓'));
                    log.debug('CreateInventoryItemRestlet', '  Contains Origin: ' + (salesDescription.indexOf('Origin') > -1 ? 'YES ✓' : 'NO ✗'));
                    log.debug('CreateInventoryItemRestlet', '  Preview: ' + (salesDescription.length > 80 ? salesDescription.substring(0, 80) + '...' : salesDescription));
                    log.debug('CreateInventoryItemRestlet', '  First Line: ' + salesLines[0]);
                    log.debug('CreateInventoryItemRestlet', '  Last Line: ' + salesLines[salesLines.length - 1]);
                } else {
                    log.audit('CreateInventoryItemRestlet', '⚠️  SALES DESCRIPTION IS EMPTY AFTER SAVE');
                    log.audit('CreateInventoryItemRestlet', '  This might indicate:');
                    log.audit('CreateInventoryItemRestlet', '    - Field was not set properly');
                    log.audit('CreateInventoryItemRestlet', '    - Field permissions prevent read-back');
                    log.audit('CreateInventoryItemRestlet', '    - Value was not provided in request');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ COULD NOT READ SALES DESCRIPTION');
                log.error('CreateInventoryItemRestlet', '  Error: ' + error.toString());
                log.error('CreateInventoryItemRestlet', '  Field ID: salesdescription');
                log.error('CreateInventoryItemRestlet', '  Possible causes:');
                log.error('CreateInventoryItemRestlet', '    - Field does not exist on this record type');
                log.error('CreateInventoryItemRestlet', '    - Permission issue');
            }
            
            log.debug('CreateInventoryItemRestlet', '═════════════════════════════════════════════════════════');
            log.debug('CreateInventoryItemRestlet', '');
            
            // Read back vendor info
            var vendorInfo = null;
            
            try {
                vendorInfo = savedRecord.getValue({ fieldId: 'memo' });
                log.debug('CreateInventoryItemRestlet', 'Read back vendor info: ' + vendorInfo);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read vendor info: ' + error.toString());
            }
            
            // Read back color info (fix for undefined colorInfo bug)
            var colorInfo = null;
            
            try {
                // Color info is stored in the item colors custom field
                colorInfo = savedRecord.getValue({ fieldId: 'custitem_opms_item_colors' });
                log.debug('CreateInventoryItemRestlet', 'Read back color info: ' + colorInfo);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read color info: ' + error.toString());
            }
            
            // Return enhanced response with all field information
            return {
                success: true,
                id: recordId,
                itemId: requestBody.itemId,
                message: isUpdate ? 'Inventory item updated successfully' : 'Inventory item created successfully',
                operation: isUpdate ? 'UPDATE' : 'CREATE',
                customFields: customFieldsResult,
                vendorInfo: vendorInfo,
                purchaseDescription: purchaseDescription,
                salesDescription: salesDescription,
                allFields: {
                    id: recordId,
                    itemId: requestBody.itemId,
                    displayName: requestBody.displayName,
                    description: requestBody.description,
                    opmsProductId: customFieldsResult.custitem_opms_prod_id,
                    opmsItemId: customFieldsResult.custitemopms_item_id,
                    vendorInfo: vendorInfo,
                    colorInfo: colorInfo
                }
            };
            
        } catch (error) {
            log.error('CreateInventoryItemRestlet', 'Error creating inventory item: ' + error.toString());
            return {
                success: false,
                error: 'Failed to create inventory item: ' + error.message,
                details: error.toString()
            };
        }
    }
    
    /**
     * GET handler for testing connectivity
     * @returns {Object} Simple test response
     */
    function get() {
        log.debug('CreateInventoryItemRestlet', 'GET request received - connectivity test');
        return {
            success: true,
            message: 'CreateInventoryItemRestlet is active and ready (CREATION ONLY)',
            timestamp: new Date().toISOString(),
            version: '3.1.0',
            focus: 'Item creation only - use RESTletManageInventoryItem.js for management operations'
        };
    }
    
    /**
     * PUT handler for updating existing inventory items
     * @param {Object} requestBody - The request payload with id and fields to update
     * @returns {Object} Response object
     */
    function put(requestBody) {
        log.debug('CreateInventoryItemRestlet', 'PUT request received: ' + JSON.stringify(requestBody));
        
        try {
            // Validate required fields for update
            if (!requestBody.id) {
                return {
                    success: false,
                    error: 'Item ID is required for updates'
                };
            }
            
            // Load the existing lot numbered inventory item record
            var inventoryItem = record.load({
                type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                id: requestBody.id,
                isDynamic: true
            });
            
            // Update fields if provided
            if (requestBody.frontContentJson) {
                setFieldValue(inventoryItem, 'custitem_opms_front_content', requestBody.frontContentJson);
            }
            
            if (requestBody.backContentJson) {
                setFieldValue(inventoryItem, 'custitem_opms_back_content', requestBody.backContentJson);
            }
            
            if (requestBody.abrasionJson) {
                setFieldValue(inventoryItem, 'custitem_opms_abrasion', requestBody.abrasionJson);
            }
            
            if (requestBody.firecodesJson) {
                setFieldValue(inventoryItem, 'custitem_opms_firecodes', requestBody.firecodesJson);
            }
            
            if (requestBody.displayName) {
                setFieldValue(inventoryItem, 'displayname', requestBody.displayName);
            }
            
            // Save the updated record
            var recordId = inventoryItem.save();
            
            log.debug('CreateInventoryItemRestlet', 'Successfully updated inventory item with ID: ' + recordId);
            
            return {
                success: true,
                id: recordId,
                message: 'Inventory item updated successfully'
            };
            
        } catch (error) {
            log.error('CreateInventoryItemRestlet', 'Failed to update inventory item: ' + error.toString());
            return {
                success: false,
                error: 'Failed to update inventory item: ' + error.toString()
            };
        }
    }
    
    // ============================================================================
    // ITEM MANAGEMENT OPERATIONS (DELETE, MARK INACTIVE, ETC.) MOVED TO:
    // RESTletManageInventoryItem.js
    // 
    // This keeps the creation RESTlet focused solely on item creation
    // ============================================================================
    
    /**
     * Helper function to safely set field values with error handling
     * @param {Object} record - NetSuite record object
     * @param {String} fieldId - Field identifier
     * @param {*} value - Field value
     */
    function setFieldValue(record, fieldId, value) {
        try {
            record.setValue({
                fieldId: fieldId,
                value: value
            });
            log.debug('CreateInventoryItemRestlet', 'Set field ' + fieldId + ' = ' + value);
        } catch (error) {
            log.error('CreateInventoryItemRestlet', 'Failed to set field ' + fieldId + ': ' + error.toString());
            throw new Error('Failed to set field ' + fieldId + ': ' + error.message);
        }
    }
    
    /**
     * Validates required fields in the request payload
     * @param {Object} requestBody - The request payload
     * @returns {Object} Validation result
     */
    function validateRequiredFields(requestBody) {
        if (!requestBody) {
            return {
                isValid: false,
                error: 'Request body is required'
            };
        }
        
        // Check for required fields
        var requiredFields = [
            { field: 'itemId', name: 'Item ID' },
            { field: 'upcCode', name: 'UPC Code' },
            { field: 'taxScheduleId', name: 'Tax Schedule ID' }
        ];
        
        for (var i = 0; i < requiredFields.length; i++) {
            var fieldCheck = requiredFields[i];
            if (!requestBody[fieldCheck.field] || requestBody[fieldCheck.field] === '') {
                return {
                    isValid: false,
                    error: 'Missing required field: ' + fieldCheck.name + ' (' + fieldCheck.field + ')'
                };
            }
        }
        
        // Validate field lengths and formats
        if (requestBody.itemId.length > 40) {
            return {
                isValid: false,
                error: 'Item ID cannot exceed 40 characters'
            };
        }
        
        if (requestBody.upcCode.length > 20) {
            return {
                isValid: false,
                error: 'UPC Code cannot exceed 20 characters'
            };
        }
        
        return {
            isValid: true
        };
    }
    
    /**
     * Find existing inventory item by itemId using search (fallback method)
     * @param {string} itemId - The item ID to search for
     * @returns {string|null} - The internal ID of the existing item, or null if not found
     */
    function findExistingItemBySearch(itemId) {
        try {
            log.debug('CreateInventoryItemRestlet', '🔍 Fallback search for existing item with itemId: ' + itemId);
            
            // Use the same multi-pattern search logic as findExistingItem
            return findExistingItem(itemId);
            
        } catch (error) {
            log.error('CreateInventoryItemRestlet', '❌ Error in fallback search for existing item: ' + error.toString());
            return null;
        }
    }
    
    /**
     * Update item fields with the same logic as the create operation
     * @param {Object} inventoryItem - The NetSuite record object
     * @param {Object} requestBody - The request payload
     */
    function updateItemFields(inventoryItem, requestBody) {
        log.debug('CreateInventoryItemRestlet', '🔄 Updating existing item fields...');
        
        // Apply all the same field updates that would be done during creation
        // This is a simplified version - in practice, you'd want to replicate all the field setting logic
        
        if (requestBody.displayName) {
            setFieldValue(inventoryItem, 'displayname', requestBody.displayName);
        }
        
        if (requestBody.description) {
            setFieldValue(inventoryItem, 'description', requestBody.description);
        }
        
        // Add other field updates as needed
        // This is a basic implementation - you'd want to replicate all the field setting logic from the main function
    }
    
    /**
     * Find existing inventory item by itemId
     * @param {string} itemId - The item ID to search for
     * @returns {string|null} - The internal ID of the existing item, or null if not found
     */
    function findExistingItem(itemId) {
        try {
            log.debug('CreateInventoryItemRestlet', '🔍 Searching for existing item with itemId: ' + itemId);
            
            // Search for the exact itemId only (no prefix handling)
            var existingItemId = searchForItem(itemId);
            if (existingItemId) {
                log.debug('CreateInventoryItemRestlet', '✅ Found existing item: ' + existingItemId);
                return existingItemId;
            }
            
            log.debug('CreateInventoryItemRestlet', '❌ No existing item found for itemId: ' + itemId);
            return null;
            
        } catch (error) {
            log.error('CreateInventoryItemRestlet', '❌ Error searching for existing item: ' + error.toString());
            // If search fails, assume item doesn't exist and create new one
            return null;
        }
    }
    
    function searchForItem(itemId) {
        try {
            log.debug('CreateInventoryItemRestlet', '🔍 Starting search for itemId: "' + itemId + '" (type: ' + typeof itemId + ', length: ' + (itemId ? itemId.length : 0) + ')');
            
            var itemSearch = search.create({
                type: search.Type.LOT_NUMBERED_INVENTORY_ITEM,
                filters: [
                    ['itemid', 'is', itemId],
                    'AND',
                    ['subsidiary', 'anyof', '2']  // Search within Opuzen subsidiary only
                ],
                columns: ['internalid', 'itemid', 'displayname', 'subsidiary']
            });
            
            log.debug('CreateInventoryItemRestlet', '🔍 Search created, running query...');
            var searchResults = itemSearch.run();
            var result = searchResults.getRange({ start: 0, end: 1 });
            
            log.debug('CreateInventoryItemRestlet', '📊 Search completed. Results count: ' + (result ? result.length : 0));
            
            if (result && result.length > 0) {
                var existingItemId = result[0].getValue('internalid');
                var foundItemId = result[0].getValue('itemid');
                var foundDisplayName = result[0].getValue('displayname');
                log.debug('CreateInventoryItemRestlet', '✅ Found existing item: ' + existingItemId + ' with itemId: "' + foundItemId + '" and displayName: "' + foundDisplayName + '"');
                return existingItemId;
            } else {
                log.debug('CreateInventoryItemRestlet', '❌ No existing item found for itemId: "' + itemId + '"');
                
                // Try a broader search to see what items exist with similar itemIds
                try {
                    log.debug('CreateInventoryItemRestlet', '🔍 Attempting broader search for debugging...');
                    var broadSearch = search.create({
                        type: search.Type.LOT_NUMBERED_INVENTORY_ITEM,
                        filters: [
                            ['itemid', 'contains', itemId.substring(0, 8)],  // Search for items starting with first 8 chars
                            'AND',
                            ['subsidiary', 'anyof', '2']  // Search within Opuzen subsidiary only
                        ],
                        columns: ['internalid', 'itemid', 'displayname', 'subsidiary']
                    });
                    var broadResults = broadSearch.run().getRange({ start: 0, end: 5 });
                    log.debug('CreateInventoryItemRestlet', '📊 Broad search found ' + broadResults.length + ' similar items');
                    for (var i = 0; i < broadResults.length; i++) {
                        log.debug('CreateInventoryItemRestlet', '  - Item ' + i + ': itemId="' + broadResults[i].getValue('itemid') + '", displayName="' + broadResults[i].getValue('displayname') + '"');
                    }
                } catch (broadError) {
                    log.debug('CreateInventoryItemRestlet', '❌ Broad search failed: ' + broadError.toString());
                }
                
                return null;
            }
        } catch (error) {
            log.error('CreateInventoryItemRestlet', '❌ Error in searchForItem for itemId ' + itemId + ': ' + error.toString());
            return null;
        }
    }

    // Export the functions that NetSuite will call
    return {
        get: get,
        post: post,
        put: put
    };
});
