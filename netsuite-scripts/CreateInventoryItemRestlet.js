/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 * 
 * Create Inventory Item RESTlet
 * Handles creation of inventory items with proper field validation and error handling
 * Enhanced to support vendor information and color data
 */

define(['N/record', 'N/log'], function(record, log) {
    
    /**
     * Main POST handler for creating inventory items
     * @param {Object} requestBody - The request payload
     * @returns {Object} Response object with success status and created item ID
     */
    function post(requestBody) {
        log.debug('CreateInventoryItemRestlet', '🚀🚀🚀 VENDOR INTEGRATION RESTLET VERSION 3.0 🚀🚀🚀');
        log.debug('CreateInventoryItemRestlet', '🏢 NOW SUPPORTS NATIVE VENDOR FIELDS (vendor, vendorname, vendorcode) 🏢');
        log.debug('CreateInventoryItemRestlet', 'Processing request: ' + JSON.stringify(requestBody));
        
        try {
            // Check if this is a delete request disguised as POST
            if (requestBody.action === 'delete') {
                log.debug('CreateInventoryItemRestlet', 'Routing to delete handler');
                return doDelete(requestBody);
            }
            
            // Check if this is an inspection request
            if (requestBody.action === 'inspect') {
                log.debug('CreateInventoryItemRestlet', 'Routing to inspection handler');
                return doInspection(requestBody);
            }
            
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
            
            // Set OPMS custom fields if provided
            if (requestBody.opmsProductId) {
                setFieldValue(inventoryItem, 'custitem_opms_prod_id', requestBody.opmsProductId);
            }
            
            if (requestBody.opmsItemId) {
                setFieldValue(inventoryItem, 'custitem_opms_item_id', requestBody.opmsItemId);
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
            
            // Set default inventory settings
            setFieldValue(inventoryItem, 'isserialitem', false);
            setFieldValue(inventoryItem, 'islotitem', false);
            
            // Set asset account defaults if not specified
            if (!requestBody.incomeAccountId && !requestBody.cogsAccountId) {
                log.debug('CreateInventoryItemRestlet', 'Using default account settings');
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
                customFieldsResult.custitem_opms_prod_id = savedRecord.getValue({ fieldId: 'custitem_opms_prod_id' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_opms_prod_id: ' + customFieldsResult.custitem_opms_prod_id);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_opms_prod_id: ' + error.toString());
            }
            
            try {
                customFieldsResult.custitem_opms_item_id = savedRecord.getValue({ fieldId: 'custitem_opms_item_id' });
                log.debug('CreateInventoryItemRestlet', 'Read back custitem_opms_item_id: ' + customFieldsResult.custitem_opms_item_id);
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read custitem_opms_item_id: ' + error.toString());
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
            
            // Read back itemvendor sublist data
            try {
                var itemvendorLineCount = savedRecord.getLineCount({ sublistId: 'itemvendor' });
                customFieldsResult.itemvendorLineCount = itemvendorLineCount;
                log.debug('CreateInventoryItemRestlet', 'Read back itemvendor sublist line count: ' + itemvendorLineCount);
                
                if (itemvendorLineCount > 0) {
                    var itemvendorData = [];
                    for (var i = 0; i < itemvendorLineCount; i++) {
                        var lineData = {
                            vendor: savedRecord.getSublistValue({ sublistId: 'itemvendor', fieldId: 'vendor', line: i }),
                            vendorcode: savedRecord.getSublistValue({ sublistId: 'itemvendor', fieldId: 'vendorcode', line: i }),
                            preferredvendor: savedRecord.getSublistValue({ sublistId: 'itemvendor', fieldId: 'preferredvendor', line: i })
                        };
                        itemvendorData.push(lineData);
                        log.debug('CreateInventoryItemRestlet', 'Read back itemvendor line ' + i + ': ' + JSON.stringify(lineData));
                    }
                    customFieldsResult.itemvendorData = itemvendorData;
                }
            } catch (error) {
                log.error('CreateInventoryItemRestlet', 'Could not read itemvendor sublist: ' + error.toString());
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
            message: 'CreateInventoryItemRestlet is active and ready',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        };
    }
    
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
    
    /**
     * DELETE handler for removing inventory items
     * @param {Object} requestBody - The request payload with id field
     * @returns {Object} Response object
     */
    function doDelete(requestBody) {
        log.debug('CreateInventoryItemRestlet', 'DELETE request received - body: ' + JSON.stringify(requestBody));
        log.debug('CreateInventoryItemRestlet', 'DELETE requestBody type: ' + typeof requestBody);
        
        try {
            var itemId;
            
            // Extract ID from request body (standard for RESTlets)
            if (typeof requestBody === 'object' && requestBody !== null) {
                itemId = requestBody.id || requestBody.itemId;
                log.debug('CreateInventoryItemRestlet', 'ID extracted from object: ' + itemId);
            } else if (typeof requestBody === 'string') {
                try {
                    var parsed = JSON.parse(requestBody);
                    itemId = parsed.id || parsed.itemId;
                    log.debug('CreateInventoryItemRestlet', 'ID extracted from parsed JSON: ' + itemId);
                } catch (e) {
                    // If not JSON, treat the string as the ID itself
                    itemId = requestBody;
                    log.debug('CreateInventoryItemRestlet', 'Using string directly as ID: ' + itemId);
                }
            } else {
                itemId = requestBody;
                log.debug('CreateInventoryItemRestlet', 'Using requestBody directly as ID: ' + itemId);
            }
            
            log.debug('CreateInventoryItemRestlet', 'Extracted itemId: ' + itemId);
            
            if (!itemId) {
                log.error('CreateInventoryItemRestlet', 'No item ID found in request. RequestBody: ' + JSON.stringify(requestBody));
                return {
                    success: false,
                    error: 'Item ID is required for deletion. Received: ' + JSON.stringify(requestBody)
                };
            }
            
            // Convert ID to number (NetSuite expects numeric IDs)
            var numericId = parseInt(itemId, 10);
            if (isNaN(numericId)) {
                log.error('CreateInventoryItemRestlet', 'Invalid item ID format: ' + itemId);
                return {
                    success: false,
                    error: 'Invalid item ID format: ' + itemId
                };
            }
            
            // Load the record to verify it exists and check if it's API-created
            var inventoryItem = record.load({
                type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                id: numericId,
                isDynamic: false
            });
            
            // Get the item identifier to verify it's an API-created item
            var itemIdentifier = inventoryItem.getValue({ fieldId: 'itemid' });
            log.debug('CreateInventoryItemRestlet', 'Attempting to delete item: ' + itemIdentifier + ' (NetSuite ID: ' + itemId + ')');
            
            // Safety check: Only delete items with API naming patterns
            var apiPatterns = [
                // PRIMARY PATTERN - All new test items should use this
                /^opmsAPI.*$/,  // Allow any items starting with "opmsAPI" (with or without dash)
                /^opmsAPI-.*$/,  // Explicit pattern for opmsAPI- prefix
                
                // Legacy patterns (deprecated but maintained for cleanup)
                /^OPMS-\d+-ULTIMATE-\d+$/,
                /^REAL-OPMS-\d+-\d+$/,
                /^ACDC-.*$/,
                /^TEST-.*$/,
                /^RESTLET-TEST-.*$/,
                /^BULK-TEST-.*$/,
                /^FALLBACK-TEST-.*$/,
                /^DELETE-TEST-.*$/,
                /^ALL-FIELDS-TEST-.*$/,
                /^COLORS-CLEAN-ORIGIN-TEST-.*$/,
                /^FINISH-WIDTH-TEST-.*$/,
                /^PARENT-PRODUCT-NAME-TEST-.*$/,
                /^VENDOR-FIELDS-TEST-.*$/,
                /^HIGH-PRIORITY-TEST-.*$/,
                /^REAL-DATA-TEST-.*$/,
                /^MINI-FORM-MANUAL-.*$/,
                /^OPMS-COLORS-CLEAN-ORIGIN-.*$/,
                /^OPMS-PARENT-PRODUCT-.*$/,
                /^OPMS-FINISH-WIDTH-.*$/,
                /^OPMS-VENDOR-TEST-.*$/,
                /^OPMS-INTEGRATION-TEST-.*$/,
                /^TREST-.*$/,
                /^CUSTOM-\d+$/,
                /^DEBUG-\d+$/,
                /^ENH-\d+$/,
                /^MASTER-\d+$/,
                /^SUBLIST-\d+$/,
                /^UPDATED-\d+$/,
                /^PARENT-FINAL-\d+$/,
                /^OPMS-I-\d+$/,
                
                // Specific items from user's delete list (can be removed after cleanup)
                /^OPMS-INTEGRATION-TEST-001$/,
                /^OPMS-VENDOR-TEST-1755044277652$/,
                /^OPMS-VENDOR-TEST-1755044688822$/,
                /^TREST-1754701289$/,
                /^TREST-1754701539$/,
                /^TREST-1754701923$/
            ];
            
            var isApiCreated = false;
            for (var i = 0; i < apiPatterns.length; i++) {
                if (apiPatterns[i].test(itemIdentifier)) {
                    isApiCreated = true;
                    break;
                }
            }
            
            if (!isApiCreated) {
                log.error('CreateInventoryItemRestlet', 'Safety check failed: Item "' + itemIdentifier + '" does not match API-created patterns');
                return {
                    success: false,
                    error: 'Safety check failed: Item does not appear to be API-created',
                    itemId: itemIdentifier
                };
            }
            
            // Safety check relies solely on API naming patterns - no OPMS field validation needed
            log.audit('CreateInventoryItemRestlet', 'Item passed API naming pattern safety check: ' + itemIdentifier);
            
            // Perform the deletion
            record.delete({
                type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                id: numericId
            });
            
            log.audit('CreateInventoryItemRestlet', 'Successfully deleted inventory item: ' + itemIdentifier + ' (NetSuite ID: ' + itemId + ')');
            
            return {
                success: true,
                id: numericId,
                itemId: itemIdentifier,
                message: 'Inventory item deleted successfully'
            };
            
        } catch (error) {
            log.error('CreateInventoryItemRestlet', 'Failed to delete inventory item: ' + error.toString());
            return {
                success: false,
                error: 'Failed to delete inventory item: ' + error.toString()
            };
        }
    }
    
    /**
     * Inspection handler - inspects real NetSuite inventory item structure
     * @param {Object} requestBody - The request payload
     * @returns {Object} Inspection results
     */
    function doInspection(requestBody) {
        log.debug('CreateInventoryItemRestlet', '🔍🔍🔍 INSPECTING REAL INVENTORY ITEM STRUCTURE 🔍🔍🔍');
        
        try {
            // Create a new lot numbered inventory item to inspect its structure
            var inventoryItem = record.create({
                type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                isDynamic: true
            });
            
            log.debug('CreateInventoryItemRestlet', '✅ Created inventory item record for inspection');
            
            // Get all available fields
            log.debug('CreateInventoryItemRestlet', '🔍 INSPECTING AVAILABLE FIELDS...');
            var allFields = inventoryItem.getFields();
            log.debug('CreateInventoryItemRestlet', '📋 Total fields available: ' + allFields.length);
            log.debug('CreateInventoryItemRestlet', '📋 All fields: ' + JSON.stringify(allFields));
            
            // Look for vendor-related fields specifically
            var vendorFields = [];
            for (var i = 0; i < allFields.length; i++) {
                if (allFields[i].toLowerCase().indexOf('vendor') !== -1) {
                    vendorFields.push(allFields[i]);
                }
            }
            log.debug('CreateInventoryItemRestlet', '🏢 Vendor-related fields: ' + JSON.stringify(vendorFields));
            
            // Get all available sublists
            log.debug('CreateInventoryItemRestlet', '🔍 INSPECTING AVAILABLE SUBLISTS...');
            var allSublists = inventoryItem.getSublists();
            log.debug('CreateInventoryItemRestlet', '📋 Total sublists available: ' + allSublists.length);
            log.debug('CreateInventoryItemRestlet', '📋 All sublists: ' + JSON.stringify(allSublists));
            
            // Look for vendor-related sublists
            var vendorSublists = [];
            for (var j = 0; j < allSublists.length; j++) {
                if (allSublists[j].toLowerCase().indexOf('vendor') !== -1) {
                    vendorSublists.push(allSublists[j]);
                }
            }
            log.debug('CreateInventoryItemRestlet', '🏢 Vendor-related sublists: ' + JSON.stringify(vendorSublists));
            
            // For each vendor-related sublist, inspect its fields
            var sublistDetails = {};
            for (var k = 0; k < vendorSublists.length; k++) {
                var sublistId = vendorSublists[k];
                try {
                    var sublistFields = inventoryItem.getSublistFields({ sublistId: sublistId });
                    sublistDetails[sublistId] = sublistFields;
                    log.debug('CreateInventoryItemRestlet', '📋 Sublist "' + sublistId + '" fields: ' + JSON.stringify(sublistFields));
                } catch (e) {
                    log.debug('CreateInventoryItemRestlet', '❌ Could not get fields for sublist: ' + sublistId);
                }
            }
            
            // Also check if we can load an existing item to see its structure
            var existingItemData = null;
            if (requestBody.existingItemId) {
                try {
                    log.debug('CreateInventoryItemRestlet', '🔍 LOADING EXISTING ITEM: ' + requestBody.existingItemId);
                    var existingItem = record.load({
                        type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                        id: requestBody.existingItemId
                    });
                    
                    existingItemData = {};
                    
                    // Check vendor field value
                    try {
                        existingItemData.vendorField = existingItem.getValue({ fieldId: 'vendor' });
                        log.debug('CreateInventoryItemRestlet', '📋 Existing item vendor field: ' + existingItemData.vendorField);
                    } catch (e) {
                        log.debug('CreateInventoryItemRestlet', '❌ Could not read vendor field from existing item');
                    }
                    
                    // Check each vendor sublist
                    for (var l = 0; l < vendorSublists.length; l++) {
                        var sublistId = vendorSublists[l];
                        try {
                            var lineCount = existingItem.getLineCount({ sublistId: sublistId });
                            existingItemData[sublistId + '_lineCount'] = lineCount;
                            log.debug('CreateInventoryItemRestlet', '📊 Existing item sublist "' + sublistId + '" line count: ' + lineCount);
                            
                            // If there are lines, get the data
                            if (lineCount > 0) {
                                var lineData = [];
                                for (var m = 0; m < Math.min(lineCount, 3); m++) { // Only check first 3 lines
                                    var line = {};
                                    var sublistFieldsForLine = sublistDetails[sublistId] || [];
                                    for (var n = 0; n < sublistFieldsForLine.length; n++) {
                                        var fieldId = sublistFieldsForLine[n];
                                        try {
                                            line[fieldId] = existingItem.getSublistValue({
                                                sublistId: sublistId,
                                                fieldId: fieldId,
                                                line: m
                                            });
                                        } catch (e) {
                                            // Skip fields we can't read
                                        }
                                    }
                                    lineData.push(line);
                                }
                                existingItemData[sublistId + '_data'] = lineData;
                                log.debug('CreateInventoryItemRestlet', '📋 Existing item sublist "' + sublistId + '" data: ' + JSON.stringify(lineData));
                            }
                        } catch (e) {
                            log.debug('CreateInventoryItemRestlet', '❌ Could not inspect sublist "' + sublistId + '" on existing item');
                        }
                    }
                    
                } catch (e) {
                    log.debug('CreateInventoryItemRestlet', '❌ Could not load existing item: ' + e.toString());
                }
            }
            
            return {
                success: true,
                inspection: {
                    totalFields: allFields.length,
                    allFields: allFields,
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
            log.error('CreateInventoryItemRestlet', '❌ INSPECTION ERROR: ' + error.toString());
            return {
                success: false,
                error: error.toString(),
                message: 'Inspection failed'
            };
        }
    }
    
    // Export the functions that NetSuite will call
    return {
        get: get,
        post: post,
        put: put,
        'delete': doDelete
    };
}); 