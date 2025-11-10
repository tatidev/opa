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

define(['N/record', 'N/log'], function(record, log) {
    
    /**
     * Main POST handler for creating inventory items
     * @param {Object} requestBody - The request payload
     * @returns {Object} Response object with success status and created item ID
     */
    function post(requestBody) {
        log.debug('CreateInventoryItemRestlet', '🚀🚀🚀 VENDOR INTEGRATION RESTLET VERSION 3.1 🚀🚀🚀');
        log.debug('CreateInventoryItemRestlet', '🏢 NOW SUPPORTS NATIVE VENDOR FIELDS (vendor, vendorname, vendorcode) 🏢');
        log.debug('CreateInventoryItemRestlet', '🎯 FOCUSED ON ITEM CREATION ONLY 🎯');
        log.debug('CreateInventoryItemRestlet', 'Processing request: ' + JSON.stringify(requestBody));
        
        try {
            // This RESTlet is focused solely on item creation
            // For item management operations (mark inactive, delete, etc.), use RESTletManageInventoryItem.js
            
            // Validate required fields for item creation
            var validation = validateRequiredFields(requestBody);
            if (!validation.isValid) {
                log.error('CreateInventoryItemRestlet', 'Validation failed: ' + validation.error);
                return {
                    success: false,
                    error: validation.error
                };
            }
            
            // Create the lot numbered inventory item record
            var inventoryItem = record.create({
                type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                isDynamic: true
            });
            
            // Set required fields with error handling
            setFieldValue(inventoryItem, 'itemid', requestBody.itemId);
            setFieldValue(inventoryItem, 'upccode', requestBody.upcCode);
            
            // Set tax schedule if provided
            if (requestBody.taxScheduleId) {
                setFieldValue(inventoryItem, 'taxschedule', requestBody.taxScheduleId);
            }
            
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
            
            // Set OPMS Product ID field (custitem_opms_product_id) - REQUIRED
            var opmsProductId = parseInt(requestBody.custitem_opms_product_id || requestBody.opmsProductId);
            if (opmsProductId && !isNaN(opmsProductId)) {
                log.debug('CreateInventoryItemRestlet', '✓ Setting OPMS Product ID: ' + opmsProductId);
                setFieldValue(inventoryItem, 'custitem_opms_product_id', opmsProductId);
            } else {
                log.error('CreateInventoryItemRestlet', '❌ custitem_opms_product_id is required and must be a valid integer. Received: ' + requestBody.custitem_opms_product_id);
                throw new Error('custitem_opms_product_id is required and must be a valid integer');
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
            
            // Set VR (Vertical Repeat) field if provided
            log.debug('CreateInventoryItemRestlet', '🔄 Processing VR field...');
            log.debug('CreateInventoryItemRestlet', 'vrepeat value: ' + requestBody.vrepeat);
            try {
                if (requestBody.vrepeat) {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting VR field: ' + requestBody.vrepeat);
                    setFieldValue(inventoryItem, 'custitem_vertical_repeat', requestBody.vrepeat);
                    log.debug('CreateInventoryItemRestlet', '✅ VR field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ VR field is empty/null, skipping');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting VR field: ' + error.toString());
            }
            
            // Set HR (Horizontal Repeat) field if provided
            log.debug('CreateInventoryItemRestlet', '🔄 Processing HR field...');
            log.debug('CreateInventoryItemRestlet', 'hrepeat value: ' + requestBody.hrepeat);
            try {
                if (requestBody.hrepeat) {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting HR field: ' + requestBody.hrepeat);
                    setFieldValue(inventoryItem, 'custitem_horizontal_repeat', requestBody.hrepeat);
                    log.debug('CreateInventoryItemRestlet', '✅ HR field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ HR field is empty/null, skipping');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting HR field: ' + error.toString());
            }
            
            // Set Prop 65 Compliance field if provided
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Prop 65 field...');
            log.debug('CreateInventoryItemRestlet', 'prop65Compliance value: "' + requestBody.prop65Compliance + '" (length: ' + (requestBody.prop65Compliance ? requestBody.prop65Compliance.length : 0) + ')');
            try {
                if (requestBody.prop65Compliance && requestBody.prop65Compliance !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting Prop 65 field: "' + requestBody.prop65Compliance + '"');
                    setFieldValue(inventoryItem, 'custitem_prop65_compliance', requestBody.prop65Compliance);
                    log.debug('CreateInventoryItemRestlet', '✅ Prop 65 field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Prop 65 field is empty/null/undefined, skipping. Value was: "' + requestBody.prop65Compliance + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting Prop 65 field: ' + error.toString());
            }
            
            // Set AB 2998 Compliance field if provided
            log.debug('CreateInventoryItemRestlet', '🔄 Processing AB 2998 field...');
            log.debug('CreateInventoryItemRestlet', 'ab2998Compliance value: "' + requestBody.ab2998Compliance + '" (length: ' + (requestBody.ab2998Compliance ? requestBody.ab2998Compliance.length : 0) + ')');
            try {
                if (requestBody.ab2998Compliance && requestBody.ab2998Compliance !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting AB 2998 field: "' + requestBody.ab2998Compliance + '"');
                    setFieldValue(inventoryItem, 'custitem_ab2998_compliance', requestBody.ab2998Compliance);
                    log.debug('CreateInventoryItemRestlet', '✅ AB 2998 field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ AB 2998 field is empty/null/undefined, skipping. Value was: "' + requestBody.ab2998Compliance + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting AB 2998 field: ' + error.toString());
            }
            
            // Set Tariff/Harmonized Code field if provided
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Tariff field...');
            log.debug('CreateInventoryItemRestlet', 'tariffCode value: "' + requestBody.tariffCode + '" (length: ' + (requestBody.tariffCode ? requestBody.tariffCode.length : 0) + ')');
            try {
                if (requestBody.tariffCode && requestBody.tariffCode !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting Tariff field: "' + requestBody.tariffCode + '"');
                    setFieldValue(inventoryItem, 'custitem_tariff_harmonized_code', requestBody.tariffCode);
                    log.debug('CreateInventoryItemRestlet', '✅ Tariff field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Tariff field is empty/null/undefined, skipping. Value was: "' + requestBody.tariffCode + '"');
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
            
            // Set Parent Product Name field if provided
            log.debug('CreateInventoryItemRestlet', '🔄 Processing Parent Product Name field...');
            log.debug('CreateInventoryItemRestlet', 'parentProductName value: "' + requestBody.parentProductName + '" (length: ' + (requestBody.parentProductName ? requestBody.parentProductName.length : 0) + ')');
            try {
                if (requestBody.parentProductName && requestBody.parentProductName !== '') {
                    log.debug('CreateInventoryItemRestlet', '✓ Setting Parent Product Name field: "' + requestBody.parentProductName + '"');
                    setFieldValue(inventoryItem, 'custitem_opms_parent_product_name', requestBody.parentProductName);
                    log.debug('CreateInventoryItemRestlet', '✅ Parent Product Name field set successfully');
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Parent Product Name field is empty/null/undefined, skipping. Value was: "' + requestBody.parentProductName + '"');
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', '❌ Error setting Parent Product Name field: ' + error.toString());
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
            
            // Set display name if provided
            if (requestBody.displayName) {
                setFieldValue(inventoryItem, 'displayname', requestBody.displayName);
            }
            
            // ENHANCEMENT: Handle vendor information
            if (requestBody.vendorName) {
                // Try to set vendor name in searchable text field or notes
                setFieldValue(inventoryItem, 'memo', 'Vendor: ' + requestBody.vendorName + 
                    (requestBody.vendorAbbreviation ? ' (' + requestBody.vendorAbbreviation + ')' : ''));
            }
            
            // ENHANCEMENT: Handle color information
            if (requestBody.colors && requestBody.colors.length > 0) {
                var colorInfo = 'Colors: ';
                for (var i = 0; i < requestBody.colors.length; i++) {
                    var color = requestBody.colors[i];
                    colorInfo += color.colorName + ' (ID: ' + color.opmsColorId + ')';
                    if (i < requestBody.colors.length - 1) {
                        colorInfo += ', ';
                    }
                }
                
                // Add color info to purchasedescription field which is often visible
                setFieldValue(inventoryItem, 'purchasedescription', colorInfo);
                
                // Also try to set in salesdescription
                setFieldValue(inventoryItem, 'salesdescription', colorInfo);
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
                    log.debug('CreateInventoryItemRestlet', '✓ Adding vendor to itemvendor sublist: ' + vendorId);
                    try {
                        // Add line to itemvendor sublist
                        inventoryItem.selectNewLine({ sublistId: 'itemvendor' });
                        // Set vendor ID (required field)
                        inventoryItem.setCurrentSublistValue({
                            sublistId: 'itemvendor',
                            fieldId: 'vendor',
                            value: vendorId
                        });
                        log.debug('CreateInventoryItemRestlet', '✓ Set vendor field in sublist: ' + vendorId);
                        // Set vendor code if provided
                        if (requestBody.vendorcode) {
                            inventoryItem.setCurrentSublistValue({
                                sublistId: 'itemvendor',
                                fieldId: 'vendorcode',
                                value: requestBody.vendorcode
                            });
                            log.debug('CreateInventoryItemRestlet', '✓ Set vendorcode in sublist: ' + requestBody.vendorcode);
                        }
                        // Set as preferred vendor (using correct field name)
                        inventoryItem.setCurrentSublistValue({
                            sublistId: 'itemvendor',
                            fieldId: 'preferredvendor',
                            value: true
                        });
                        log.debug('CreateInventoryItemRestlet', '✓ Set preferredvendor to true');
                        // Commit the sublist line
                        inventoryItem.commitLine({ sublistId: 'itemvendor' });
                        log.debug('CreateInventoryItemRestlet', '✅ Vendor sublist line committed successfully');
                    } catch (sublistError) {
                        log.error('CreateInventoryItemRestlet', '❌ Error adding vendor to sublist: ' + sublistError.toString());
                    }
                } else {
                    log.debug('CreateInventoryItemRestlet', '⚠️ Invalid vendor ID for sublist, skipping: ' + requestBody.vendor);
                }
            } else {
                log.debug('CreateInventoryItemRestlet', '⚠️ No vendor provided for sublist');
            }

            // Save the record
            var recordId = inventoryItem.save();
            
            log.audit('CreateInventoryItemRestlet', 'Successfully created inventory item with ID: ' + recordId + ', ItemID: ' + requestBody.itemId);
            
            // ENHANCEMENT: Read back the saved record to verify custom fields
            var savedRecord = record.load({
                type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                id: recordId
            });
            
            // Read back custom fields to verify they were saved
            var customFieldsResult = {};
            
            try {
                customFieldsResult.custitem_opms_product_id = savedRecord.getValue({ fieldId: 'custitem_opms_product_id' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_opms_product_id (OPMS Product ID): ' + customFieldsResult.custitem_opms_product_id);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_opms_product_id (OPMS Product ID): ' + error.toString());
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
            
            // Read back vendor and color info
            var vendorInfo = null;
            var colorInfo = null;
            
            try {
                vendorInfo = savedRecord.getValue({ fieldId: 'memo' });
                log.debug('CreateInventoryItemRestlet', 'Read back vendor info: ' + vendorInfo);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read vendor info: ' + error.toString());
            }
            
            try {
                colorInfo = savedRecord.getValue({ fieldId: 'purchasedescription' });
                log.debug('CreateInventoryItemRestlet', 'Read back color info: ' + colorInfo);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read color info: ' + error.toString());
            }
            
            // Return enhanced response with all field information
            return {
                success: true,
                id: recordId,
                itemId: requestBody.itemId,
                message: 'Inventory item created successfully',
                customFields: customFieldsResult,
                vendorInfo: vendorInfo,
                colorInfo: colorInfo,
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

    // Export the functions that NetSuite will call
    return {
        get: get,
        post: post,
        put: put
    };
});
