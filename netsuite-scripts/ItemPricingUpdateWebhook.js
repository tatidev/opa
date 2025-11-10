/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */

/**
 * NetSuite Item Pricing Update Webhook
 * 
 * This User Event Script triggers when inventory item pricing is updated
 * and sends a webhook to the Opuzen API for OPMS synchronization.
 * 
 * CRITICAL SAFETY RULES:
 * 1. Only process inventory items (not other item types)
 * 2. Only trigger on EDIT operations (not create/delete)
 * 3. Only send webhook if pricing fields actually changed
 * 4. Include Lisa Slayman flag for skip logic
 * 5. Handle webhook failures gracefully (log but don't block NetSuite)
 */
define(['N/https', 'N/log', 'N/runtime'], (https, log, runtime) => {
    
    /**
     * Executes after item record is updated
     * 
     * @param {Object} context - Script context
     * @param {Record} context.newRecord - New record
     * @param {Record} context.oldRecord - Old record  
     * @param {string} context.type - Trigger type
     */
    const afterSubmit = (context) => {
        try {
            // CRITICAL: Infinite Loop Prevention
            // Only fire webhook for human user edits via UI
            // Skip webhook when updated via RESTlet/API (OPMS→NetSuite sync)
            const execContext = runtime.executionContext;
            
            if (execContext !== runtime.ContextType.USER_INTERFACE) {
                log.debug('Webhook Skip - Infinite Loop Prevention', {
                    executionContext: execContext,
                    reason: 'Not a user interface edit (likely RESTlet/API update from OPMS sync)',
                    itemId: context.newRecord.getValue('itemid')
                });
                return;
            }
            
            // Only process edits (not creates or deletes)
            if (context.type !== context.UserEventType.EDIT) {
                log.debug('Webhook Skip', 'Not an edit operation: ' + context.type);
                return;
            }
            
            const newRecord = context.newRecord;
            const oldRecord = context.oldRecord;
            
            // Only process inventory items (including lot numbered inventory items)
            const validItemTypes = ['inventoryitem', 'lotnumberedinventoryitem'];
            if (!validItemTypes.includes(newRecord.type)) {
                log.debug('Webhook Skip', 'Not a supported inventory item type: ' + newRecord.type);
                return;
            }
            
            // Check if pricing fields changed
            const pricingFieldsChanged = checkPricingFieldsChanged(newRecord, oldRecord);
            if (!pricingFieldsChanged) {
                log.debug('Webhook Skip', 'No pricing fields changed for item: ' + newRecord.getValue('itemid'));
                return; // No pricing changes, skip webhook
            }
            
            // Extract current pricing data
            const itemData = {
                internalid: newRecord.id,
                itemid: newRecord.getValue('itemid'),
                lastmodifieddate: new Date().toISOString(),
                
                // Pricing fields - extract from sublist for lot numbered items
                price_1_: getPriceFromSublist(newRecord, 0), // Cut Price (Line 0 or 1)
                price_1_5: getPriceFromSublist(newRecord, 4), // Roll Price (Line 4 or 5)  
                cost: newRecord.getValue('cost'),
                custitem_f3_rollprice: newRecord.getValue('custitem_f3_rollprice'), // Custom roll price field
                
                // CRITICAL: Lisa Slayman skip logic flag
                custitemf3_lisa_item: newRecord.getValue('custitemf3_lisa_item')
            };
            
            // Get webhook configuration from script parameters
            const script = runtime.getCurrentScript();
            const webhookUrl = script.getParameter({ name: 'custscript_item_price_update_webhook' });
            const webhookSecret = script.getParameter({ name: 'custscript_price_update_webhook_secret' });
            
            if (!webhookUrl) {
                log.error('Webhook Configuration', 'Webhook URL not configured in script parameters');
                return;
            }
            
            if (!webhookSecret) {
                log.error('Webhook Configuration', 'Webhook secret not configured in script parameters');
                return;
            }
            
            log.audit('Sending Pricing Webhook', {
                itemId: itemData.itemid,
                internalId: itemData.internalid,
                lisaSlayman: itemData.custitemf3_lisa_item,
                changedFields: getChangedPricingFields(newRecord, oldRecord)
            });
            
            // Send webhook to Opuzen API
            const response = https.post({
                url: webhookUrl,
                body: JSON.stringify({
                    eventType: 'item.pricing.updated',
                    itemData: itemData,
                    timestamp: new Date().toISOString(),
                    source: 'netsuite_webhook'
                }),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${webhookSecret}`,
                    'User-Agent': 'NetSuite-Webhook/1.0'
                }
            });
            
            log.audit('Pricing Webhook Sent', {
                itemId: itemData.itemid,
                responseCode: response.code,
                responseBody: response.body ? response.body.substring(0, 200) : 'No body',
                lisaSlayman: itemData.custitemf3_lisa_item
            });
            
            // Log any non-200 responses as warnings (but don't throw)
            if (response.code !== 200) {
                log.error('Webhook Response Error', {
                    itemId: itemData.itemid,
                    responseCode: response.code,
                    responseBody: response.body,
                    url: webhookUrl
                });
            }
            
        } catch (error) {
            // Log error but don't throw - webhook failures shouldn't block NetSuite operations
            log.error('Webhook Error', {
                error: error.toString(),
                stack: error.stack,
                itemId: context.newRecord ? context.newRecord.getValue('itemid') : 'Unknown'
            });
        }
    };
    
    /**
     * Get price from pricing sublist for lot numbered inventory items
     * 
     * @param {Record} record - Inventory item record
     * @param {number} lineIndex - Line index in price1 sublist (0-based)
     * @returns {number|null} Price value or null
     */
    const getPriceFromSublist = (record, lineIndex) => {
        try {
            const lineCount = record.getLineCount({ sublistId: 'price1' });
            if (lineIndex < lineCount) {
                const price = record.getSublistValue({
                    sublistId: 'price1',
                    fieldId: 'price_1_',
                    line: lineIndex
                });
                return price;
            }
            return null;
        } catch (e) {
            // Fallback: try simple field access
            return record.getValue('price' + (lineIndex + 1));
        }
    };
    
    /**
     * Check if any pricing fields changed between old and new records
     * 
     * @param {Record} newRecord - New record
     * @param {Record} oldRecord - Old record
     * @returns {boolean} True if pricing fields changed
     */
    const checkPricingFieldsChanged = (newRecord, oldRecord) => {
        let hasChanges = false;
        
        // Standard pricing fields to check
        const standardFields = [
            'cost',                      // Purchase cost
            'custitem_f3_rollprice'      // Custom roll price field
        ];
        
        // Check standard pricing fields
        for (const field of standardFields) {
            const oldValue = oldRecord.getValue(field);
            const newValue = newRecord.getValue(field);
            
            const oldNum = oldValue ? parseFloat(oldValue) : 0;
            const newNum = newValue ? parseFloat(newValue) : 0;
            
            if (oldNum !== newNum) {
                log.debug('Pricing Field Changed', {
                    field: field,
                    oldValue: oldValue,
                    newValue: newValue
                });
                hasChanges = true;
            }
        }
        
        // Check pricing sublist (price1) for lot numbered items
        // This is where Cut Price and Roll Price are stored
        try {
            const priceLineCount = newRecord.getLineCount({ sublistId: 'price1' });
            log.debug('Price Sublist Info', {
                lineCount: priceLineCount,
                itemType: newRecord.type
            });
            
            for (let i = 0; i < priceLineCount; i++) {
                const oldPrice = oldRecord.getSublistValue({
                    sublistId: 'price1',
                    fieldId: 'price_1_',
                    line: i
                });
                const newPrice = newRecord.getSublistValue({
                    sublistId: 'price1',
                    fieldId: 'price_1_',
                    line: i
                });
                
                const oldNum = oldPrice ? parseFloat(oldPrice) : 0;
                const newNum = newPrice ? parseFloat(newPrice) : 0;
                
                if (oldNum !== newNum) {
                    log.debug('Price Sublist Changed', {
                        sublistId: 'price1',
                        line: i,
                        fieldId: 'price_1_',
                        oldValue: oldPrice,
                        newValue: newPrice
                    });
                    hasChanges = true;
                }
            }
        } catch (e) {
            // If sublist check fails, that's okay - we already checked standard fields
            log.debug('Price Sublist Check Failed', {
                error: e.toString(),
                message: 'Falling back to standard field checks only'
            });
        }
        
        if (!hasChanges) {
            log.debug('No Pricing Changes Detected', {
                itemId: newRecord.getValue('itemid'),
                itemType: newRecord.type
            });
        }
        
        return hasChanges;
    };
    
    /**
     * Get list of changed pricing fields for logging
     * 
     * @param {Record} newRecord - New record
     * @param {Record} oldRecord - Old record
     * @returns {Array} Array of changed field names
     */
    const getChangedPricingFields = (newRecord, oldRecord) => {
        const pricingFields = [
            'price1',                    // Base price line 1 (Cut Price)
            'price_1_5',                // Roll Price (Price Level 1, Line 5)
            'cost',                      // Purchase cost
            'custitem_f3_rollprice'      // Custom roll price field
        ];
        
        const changedFields = [];
        
        for (const field of pricingFields) {
            const oldValue = oldRecord.getValue(field);
            const newValue = newRecord.getValue(field);
            
            const oldNum = oldValue ? parseFloat(oldValue) : 0;
            const newNum = newValue ? parseFloat(newValue) : 0;
            
            if (oldNum !== newNum) {
                changedFields.push({
                    field: field,
                    oldValue: oldValue,
                    newValue: newValue
                });
            }
        }
        
        return changedFields;
    };
    
    return { afterSubmit };
});
