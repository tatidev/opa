/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 * 
 * Inventory Item Management RESTlet
 * Specialized for item management operations: mark inactive, delete, bulk operations
 * Complements the creation RESTlet by handling post-creation management
 */

define(['N/record', 'N/log', 'N/search'], function(record, log, search) {
    
    /**
     * Main POST handler for item management operations
     * @param {Object} requestBody - The request payload
     * @returns {Object} Response object with success status
     */
    function post(requestBody) {
        log.audit('InventoryItemManagementRestlet', '🔧 INVENTORY ITEM MANAGEMENT RESTLET v1.0 🔧');
        log.debug('InventoryItemManagementRestlet', 'Processing management request: ' + JSON.stringify(requestBody));
        
        try {
            // Route based on action type
            log.debug('InventoryItemManagementRestlet', 'Received action: "' + requestBody.action + '"');
            
            // DIAGNOSTIC: Test specific actions first
            if (requestBody.action === 'test_action') {
                log.audit('InventoryItemManagementRestlet', 'DIAGNOSTIC: test_action matched!');
                return { success: true, message: 'test_action works!', diagnostic: true };
            }
            if (requestBody.action === 'search_items') {
                return doSearchItems(requestBody);
            }
            
            if (requestBody.action === 'mark_inactive') {
                return doMarkInactive(requestBody);
            } else if (requestBody.action === 'mark_active') {
                return doMarkActive(requestBody);
            } else if (requestBody.action === 'delete') {
                return doDelete(requestBody);
            } else if (requestBody.action === 'bulk_mark_inactive') {
                return doBulkMarkInactive(requestBody);
            } else if (requestBody.action === 'get_status') {
                return doGetStatus(requestBody);
            } else {
                return {
                    success: false,
                    error: 'Invalid action. Supported actions: mark_inactive, mark_active, delete, bulk_mark_inactive, get_status, search_items, test_action'
                };
            }
            
        } catch (error) {
            log.error('InventoryItemManagementRestlet', 'Management operation failed: ' + error.toString());
            return {
                success: false,
                error: 'Management operation failed: ' + error.message,
                details: error.toString()
            };
        }
    }

    /**
     * Mark a single item as inactive
     */
    function doMarkInactive(requestBody) {
        log.audit('InventoryItemManagementRestlet', 'Starting mark inactive operation');
        
        try {
            // Validate required fields
            if (!requestBody.id) {
                return {
                    success: false,
                    error: 'Missing required field: Item ID (id)'
                };
            }
            
            var itemId = parseInt(requestBody.id, 10);
            if (isNaN(itemId)) {
                return {
                    success: false,
                    error: 'Invalid item ID format: ' + requestBody.id
                };
            }
            
            // Load the item (try both record types)
            var inventoryItem = loadInventoryItem(itemId);
            if (!inventoryItem.record) {
                return {
                    success: false,
                    error: 'Item not found with ID: ' + itemId,
                    recordType: null
                };
            }
            
            var itemIdentifier = inventoryItem.record.getValue({ fieldId: 'itemid' }) || '[Unknown Item]';
            log.audit('InventoryItemManagementRestlet', 'Marking item inactive: ' + itemIdentifier + ' (ID: ' + itemId + ')');
            
            // Check if already inactive
            var currentStatus = inventoryItem.record.getValue({ fieldId: 'isinactive' });
            if (currentStatus === true) {
                log.debug('InventoryItemManagementRestlet', 'Item already inactive');
                return {
                    success: true,
                    message: 'Item was already inactive',
                    itemId: itemId,
                    itemIdentifier: itemIdentifier,
                    recordType: inventoryItem.recordType,
                    previousStatus: 'inactive',
                    newStatus: 'inactive'
                };
            }
            
            // Mark as inactive
            inventoryItem.record.setValue({ fieldId: 'isinactive', value: true });
            var savedId = inventoryItem.record.save();
            
            log.audit('InventoryItemManagementRestlet', 'Successfully marked item inactive: ' + itemIdentifier);
            
            return {
                success: true,
                message: 'Item marked inactive successfully',
                itemId: itemId,
                savedId: savedId,
                itemIdentifier: itemIdentifier,
                recordType: inventoryItem.recordType,
                previousStatus: 'active',
                newStatus: 'inactive'
            };
            
        } catch (error) {
            log.error('InventoryItemManagementRestlet', 'Mark inactive failed: ' + error.toString());
            return {
                success: false,
                error: 'Failed to mark item inactive: ' + error.message,
                itemId: requestBody.id
            };
        }
    }

    /**
     * Mark a single item as active
     */
    function doMarkActive(requestBody) {
        log.audit('InventoryItemManagementRestlet', 'Starting mark active operation');
        
        try {
            if (!requestBody.id) {
                return {
                    success: false,
                    error: 'Missing required field: Item ID (id)'
                };
            }
            
            var itemId = parseInt(requestBody.id, 10);
            if (isNaN(itemId)) {
                return {
                    success: false,
                    error: 'Invalid item ID format: ' + requestBody.id
                };
            }
            
            var inventoryItem = loadInventoryItem(itemId);
            if (!inventoryItem.record) {
                return {
                    success: false,
                    error: 'Item not found with ID: ' + itemId
                };
            }
            
            var itemIdentifier = inventoryItem.record.getValue({ fieldId: 'itemid' }) || '[Unknown Item]';
            
            // Check if already active
            var currentStatus = inventoryItem.record.getValue({ fieldId: 'isinactive' });
            if (currentStatus === false) {
                return {
                    success: true,
                    message: 'Item was already active',
                    itemId: itemId,
                    itemIdentifier: itemIdentifier,
                    recordType: inventoryItem.recordType,
                    previousStatus: 'active',
                    newStatus: 'active'
                };
            }
            
            // Mark as active
            inventoryItem.record.setValue({ fieldId: 'isinactive', value: false });
            var savedId = inventoryItem.record.save();
            
            log.audit('InventoryItemManagementRestlet', 'Successfully marked item active: ' + itemIdentifier);
            
            return {
                success: true,
                message: 'Item marked active successfully',
                itemId: itemId,
                savedId: savedId,
                itemIdentifier: itemIdentifier,
                recordType: inventoryItem.recordType,
                previousStatus: 'inactive',
                newStatus: 'active'
            };
            
        } catch (error) {
            log.error('InventoryItemManagementRestlet', 'Mark active failed: ' + error.toString());
            return {
                success: false,
                error: 'Failed to mark item active: ' + error.message,
                itemId: requestBody.id
            };
        }
    }

    /**
     * Attempt to delete an item
     */
    function doDelete(requestBody) {
        log.audit('InventoryItemManagementRestlet', 'Starting delete operation');
        
        try {
            if (!requestBody.id) {
                return {
                    success: false,
                    error: 'Missing required field: Item ID (id)'
                };
            }
            
            var itemId = parseInt(requestBody.id, 10);
            if (isNaN(itemId)) {
                return {
                    success: false,
                    error: 'Invalid item ID format: ' + requestBody.id
                };
            }
            
            // Load the item first to get details
            var inventoryItem = loadInventoryItem(itemId);
            if (!inventoryItem.record) {
                return {
                    success: false,
                    error: 'Item not found with ID: ' + itemId
                };
            }
            
            var itemIdentifier = inventoryItem.record.getValue({ fieldId: 'itemid' }) || '[Unknown Item]';
            log.audit('InventoryItemManagementRestlet', 'Attempting to delete item: ' + itemIdentifier + ' (ID: ' + itemId + ')');
            
            // Attempt deletion
            try {
                record.delete({
                    type: inventoryItem.recordTypeConstant,
                    id: itemId
                });
                
                log.audit('InventoryItemManagementRestlet', 'Successfully deleted item: ' + itemIdentifier);
                
                return {
                    success: true,
                    message: 'Item deleted successfully',
                    itemId: itemId,
                    itemIdentifier: itemIdentifier,
                    recordType: inventoryItem.recordType
                };
                
            } catch (deleteError) {
                log.debug('InventoryItemManagementRestlet', 'Direct deletion failed: ' + deleteError.toString());
                
                // If deletion fails due to dependencies, mark as inactive instead
                if (deleteError.toString().indexOf('dependent records') !== -1 || 
                    deleteError.toString().indexOf('cannot be deleted') !== -1) {
                    
                    log.debug('InventoryItemManagementRestlet', 'Item has dependencies - marking inactive instead');
                    
                    inventoryItem.record.setValue({ fieldId: 'isinactive', value: true });
                    var savedId = inventoryItem.record.save();
                    
                    return {
                        success: true,
                        message: 'Item has dependencies - marked inactive instead of deleting',
                        itemId: itemId,
                        savedId: savedId,
                        itemIdentifier: itemIdentifier,
                        recordType: inventoryItem.recordType,
                        operation: 'marked_inactive_fallback',
                        originalError: deleteError.message
                    };
                } else {
                    throw deleteError;
                }
            }
            
        } catch (error) {
            log.error('InventoryItemManagementRestlet', 'Delete operation failed: ' + error.toString());
            return {
                success: false,
                error: 'Failed to delete item: ' + error.message,
                itemId: requestBody.id
            };
        }
    }

    /**
     * Mark multiple items as inactive
     */
    function doBulkMarkInactive(requestBody) {
        log.audit('InventoryItemManagementRestlet', 'Starting bulk mark inactive operation');
        
        try {
            if (!requestBody.itemIds || !Array.isArray(requestBody.itemIds)) {
                return {
                    success: false,
                    error: 'Missing or invalid itemIds array'
                };
            }
            
            var results = {
                success: true,
                totalItems: requestBody.itemIds.length,
                successful: 0,
                failed: 0,
                items: []
            };
            
            log.debug('InventoryItemManagementRestlet', 'Processing ' + requestBody.itemIds.length + ' items for bulk inactive');
            
            for (var i = 0; i < requestBody.itemIds.length; i++) {
                var itemId = parseInt(requestBody.itemIds[i], 10);
                var itemResult = { itemId: itemId };
                
                try {
                    if (isNaN(itemId)) {
                        itemResult.success = false;
                        itemResult.error = 'Invalid item ID format';
                        results.failed++;
                    } else {
                        var inventoryItem = loadInventoryItem(itemId);
                        if (!inventoryItem.record) {
                            itemResult.success = false;
                            itemResult.error = 'Item not found';
                            results.failed++;
                        } else {
                            var itemIdentifier = inventoryItem.record.getValue({ fieldId: 'itemid' }) || '[Unknown Item]';
                            
                            var currentStatus = inventoryItem.record.getValue({ fieldId: 'isinactive' });
                            if (currentStatus === true) {
                                itemResult.success = true;
                                itemResult.message = 'Already inactive';
                                itemResult.itemIdentifier = itemIdentifier;
                                itemResult.operation = 'skipped';
                            } else {
                                inventoryItem.record.setValue({ fieldId: 'isinactive', value: true });
                                var savedId = inventoryItem.record.save();
                                
                                itemResult.success = true;
                                itemResult.message = 'Marked inactive';
                                itemResult.itemIdentifier = itemIdentifier;
                                itemResult.savedId = savedId;
                                itemResult.operation = 'updated';
                            }
                            
                            results.successful++;
                        }
                    }
                } catch (itemError) {
                    itemResult.success = false;
                    itemResult.error = itemError.message;
                    results.failed++;
                    log.error('InventoryItemManagementRestlet', 'Failed to process item ' + itemId + ': ' + itemError.toString());
                }
                
                results.items.push(itemResult);
            }
            
            if (results.failed > 0) {
                results.success = false;
            }
            
            log.audit('InventoryItemManagementRestlet', 'Bulk operation completed - Success: ' + results.successful + ', Failed: ' + results.failed);
            return results;
            
        } catch (error) {
            log.error('InventoryItemManagementRestlet', 'Bulk mark inactive failed: ' + error.toString());
            return {
                success: false,
                error: 'Bulk mark inactive operation failed: ' + error.message
            };
        }
    }

    /**
     * Get status of an item
     */
    function doGetStatus(requestBody) {
        try {
            if (!requestBody.id) {
                return {
                    success: false,
                    error: 'Missing required field: Item ID (id)'
                };
            }
            
            var itemId = parseInt(requestBody.id, 10);
            if (isNaN(itemId)) {
                return {
                    success: false,
                    error: 'Invalid item ID format: ' + requestBody.id
                };
            }
            
            var inventoryItem = loadInventoryItem(itemId);
            if (!inventoryItem.record) {
                return {
                    success: false,
                    error: 'Item not found with ID: ' + itemId
                };
            }
            
            var itemIdentifier = inventoryItem.record.getValue({ fieldId: 'itemid' });
            var displayName = inventoryItem.record.getValue({ fieldId: 'displayname' });
            var isInactive = inventoryItem.record.getValue({ fieldId: 'isinactive' });
            
            return {
                success: true,
                itemId: itemId,
                itemIdentifier: itemIdentifier,
                displayName: displayName,
                isInactive: isInactive,
                status: isInactive ? 'INACTIVE' : 'ACTIVE',
                recordType: inventoryItem.recordType
            };
            
        } catch (error) {
            log.error('InventoryItemManagementRestlet', 'Get status failed: ' + error.toString());
            return {
                success: false,
                error: 'Failed to get item status: ' + error.message,
                itemId: requestBody.id
            };
        }
    }

    /**
     * Load an inventory item record (handles both lot numbered and regular inventory items)
     */
    function loadInventoryItem(itemId) {
        var result = {
            record: null,
            recordType: null,
            recordTypeConstant: null
        };
        
        try {
            // Try lot numbered inventory item first
            result.record = record.load({
                type: record.Type.LOT_NUMBERED_INVENTORY_ITEM,
                id: itemId,
                isDynamic: false
            });
            result.recordType = 'LOT_NUMBERED_INVENTORY_ITEM';
            result.recordTypeConstant = record.Type.LOT_NUMBERED_INVENTORY_ITEM;
            log.debug('InventoryItemManagementRestlet', 'Loaded as lot numbered inventory item');
            
        } catch (lotError) {
            log.debug('InventoryItemManagementRestlet', 'Not a lot numbered item, trying regular inventory item');
            
            try {
                result.record = record.load({
                    type: record.Type.INVENTORY_ITEM,
                    id: itemId,
                    isDynamic: false
                });
                result.recordType = 'INVENTORY_ITEM';
                result.recordTypeConstant = record.Type.INVENTORY_ITEM;
                log.debug('InventoryItemManagementRestlet', 'Loaded as regular inventory item');
                
            } catch (regError) {
                log.debug('InventoryItemManagementRestlet', 'Item not found as either record type: ' + regError.toString());
                result.record = null;
            }
        }
        
        return result;
    }
    
    /**
     * Search for items by itemid pattern
     * @param {Object} requestBody - Request containing searchPattern and maxItems
     * @returns {Object} Response with found items
     */
    function doSearchItems(requestBody) {
        log.audit('InventoryItemManagementRestlet', '🔍 SEARCH_ITEMS ACTION CALLED SUCCESSFULLY!');
        log.debug('InventoryItemManagementRestlet', 'Payload received: ' + JSON.stringify(requestBody));
        
        try {
            var searchPattern = requestBody.searchPattern || 'opmsAPI-';
            var maxItems = parseInt(requestBody.maxItems) || 50;
            
            log.debug('InventoryItemManagementRestlet', 'Searching for items with pattern: ' + searchPattern + ', max: ' + maxItems);
            
            // Create search for items matching the pattern
            var itemSearch = search.create({
                type: search.Type.INVENTORY_ITEM,
                filters: [
                    ['itemid', 'startswith', searchPattern]
                ],
                columns: [
                    search.createColumn({ name: 'internalid', label: 'Internal ID' }),
                    search.createColumn({ name: 'itemid', label: 'Item ID' }),
                    search.createColumn({ name: 'displayname', label: 'Display Name' }),
                    search.createColumn({ name: 'isinactive', label: 'Is Inactive' })
                ]
            });
            
            // Also search for lot numbered inventory items
            var lotSearch = search.create({
                type: search.Type.LOT_NUMBERED_INVENTORY_ITEM,
                filters: [
                    ['itemid', 'startswith', searchPattern]
                ],
                columns: [
                    search.createColumn({ name: 'internalid', label: 'Internal ID' }),
                    search.createColumn({ name: 'itemid', label: 'Item ID' }),
                    search.createColumn({ name: 'displayname', label: 'Display Name' }),
                    search.createColumn({ name: 'isinactive', label: 'Is Inactive' })
                ]
            });
            
            var foundItems = [];
            var itemsFound = 0;
            
            // Execute regular inventory item search
            var regularResults = itemSearch.run().getRange({ start: 0, end: maxItems });
            for (var i = 0; i < regularResults.length && itemsFound < maxItems; i++) {
                var result = regularResults[i];
                foundItems.push({
                    internalId: result.getValue({ name: 'internalid' }),
                    itemId: result.getValue({ name: 'itemid' }),
                    displayName: result.getValue({ name: 'displayname' }),
                    isInactive: result.getValue({ name: 'isinactive' }),
                    recordType: 'INVENTORY_ITEM'
                });
                itemsFound++;
            }
            
            // Execute lot numbered inventory item search
            var lotResults = lotSearch.run().getRange({ start: 0, end: maxItems - itemsFound });
            for (var j = 0; j < lotResults.length && itemsFound < maxItems; j++) {
                var lotResult = lotResults[j];
                foundItems.push({
                    internalId: lotResult.getValue({ name: 'internalid' }),
                    itemId: lotResult.getValue({ name: 'itemid' }),
                    displayName: lotResult.getValue({ name: 'displayname' }),
                    isInactive: lotResult.getValue({ name: 'isinactive' }),
                    recordType: 'LOT_NUMBERED_INVENTORY_ITEM'
                });
                itemsFound++;
            }
            
            log.audit('InventoryItemManagementRestlet', 'Search completed. Found ' + itemsFound + ' items matching pattern: ' + searchPattern);
            
            return {
                success: true,
                message: 'Search completed successfully',
                searchPattern: searchPattern,
                maxItems: maxItems,
                itemsFound: itemsFound,
                items: foundItems
            };
            
        } catch (error) {
            log.error('InventoryItemManagementRestlet', 'Search failed: ' + error.toString());
            return {
                success: false,
                error: 'Search operation failed: ' + error.message,
                searchPattern: requestBody.searchPattern,
                maxItems: requestBody.maxItems
            };
        }
    }

    // Return the entry points for the RESTlet
    return {
        post: post
    };
});
