/**
 * Database Operation Executor Service
 * Executes database operations generated from CSV transformation
 */

const logger = require('../utils/logger');

class DatabaseOperationExecutor {
    constructor() {
        this.db = null; // Will be injected
    }

    /**
     * Set database connection
     * @param {Object} db - Database connection
     */
    setDatabase(db) {
        this.db = db;
    }

    /**
     * Execute a single database operation
     * @param {Object} operation - Database operation object
     * @returns {Promise<Object>} Execution result
     */
    async executeOperation(operation) {
        if (!this.db) {
            throw new Error('Database connection not set');
        }

        try {
            const { type, table, data, where } = operation;
            
            logger.info(`Executing operation: ${type} on ${table}`, {
                operationType: type,
                table: table,
                dataKeys: Object.keys(data || {}),
                whereKeys: Object.keys(where || {})
            });

            let result;
            switch (type) {
                case 'upsert_product':
                    result = await this.upsertProduct(data, where);
                    break;
                case 'upsert_item':
                    result = await this.upsertItem(data, where);
                    break;
                case 'upsert_product_various':
                    result = await this.upsertProductVarious(data, where);
                    break;
                case 'upsert_product_content_front':
                    result = await this.upsertProductContentFront(data, where);
                    break;
                case 'upsert_product_content_back':
                    result = await this.upsertProductContentBack(data, where);
                    break;
                case 'upsert_product_abrasion':
                    result = await this.upsertProductAbrasion(data, where);
                    break;
                case 'upsert_product_firecode':
                    result = await this.upsertProductFirecode(data, where);
                    break;
                case 'sync_item_colors':
                    result = await this.syncItemColors(data, where);
                    break;
                case 'sync_product_vendors':
                    result = await this.syncProductVendors(data, where);
                    break;
                case 'sync_product_finish':
                    result = await this.syncProductFinish(data, where);
                    break;
                case 'sync_product_cleaning':
                    result = await this.syncProductCleaning(data, where);
                    break;
                case 'sync_product_origin':
                    result = await this.syncProductOrigin(data, where);
                    break;
                case 'sync_product_use_(item_application)':
                    result = await this.syncProductUse(data, where);
                    break;
                default:
                    throw new Error(`Unknown operation type: ${type}`);
            }

            logger.info(`Operation ${type} completed successfully`, {
                operationType: type,
                table: table,
                result: result
            });

            return {
                success: true,
                operationType: type,
                table: table,
                result: result
            };

        } catch (error) {
            logger.error(`Operation ${operation.type} failed`, {
                operationType: operation.type,
                table: operation.table,
                error: error.message,
                data: operation.data
            });

            return {
                success: false,
                operationType: operation.type,
                table: operation.table,
                error: error.message
            };
        }
    }

    /**
     * Execute multiple database operations in a transaction
     * @param {Array} operations - Array of database operations
     * @returns {Promise<Object>} Execution results
     */
    async executeOperations(operations) {
        if (!this.db) {
            throw new Error('Database connection not set');
        }

        const results = {
            total: operations.length,
            successful: 0,
            failed: 0,
            results: []
        };

        logger.info(`Starting execution of ${operations.length} database operations`);

        // Track created IDs for dependency resolution
        const createdIds = {
            productId: null,
            itemId: null
        };

        // Execute operations in sequence (not parallel to avoid conflicts)
        for (let i = 0; i < operations.length; i++) {
            const operation = operations[i];
            
            // Inject dependencies if available
            if (operation.type === 'upsert_item' && createdIds.productId) {
                operation.data.product_id = createdIds.productId;
            }
            
            if (operation.type === 'upsert_product_various' && createdIds.productId) {
                operation.where.product_id = createdIds.productId;
            }
            
            if (operation.type === 'upsert_product_content_front' && createdIds.productId) {
                operation.where.product_id = createdIds.productId;
            }
            
            if (operation.type === 'upsert_product_content_back' && createdIds.productId) {
                operation.where.product_id = createdIds.productId;
            }
            
            if (operation.type === 'upsert_product_abrasion' && createdIds.productId) {
                operation.where.product_id = createdIds.productId;
            }
            
            if (operation.type === 'upsert_product_firecode' && createdIds.productId) {
                operation.where.product_id = createdIds.productId;
            }
            
            if (operation.type === 'sync_item_colors' && createdIds.itemId) {
                operation.where.item_id = createdIds.itemId;
            }
            
            if (operation.type === 'sync_product_vendors' && createdIds.productId) {
                operation.where.product_id = createdIds.productId;
            }
            
            if (operation.type === 'sync_product_finish' && createdIds.productId) {
                operation.where.product_id = createdIds.productId;
            }
            
            if (operation.type === 'sync_product_cleaning' && createdIds.productId) {
                operation.where.product_id = createdIds.productId;
            }
            
            if (operation.type === 'sync_product_origin' && createdIds.productId) {
                operation.where.product_id = createdIds.productId;
            }
            
            if (operation.type === 'sync_product_use_(item_application)' && createdIds.productId) {
                operation.where.product_id = createdIds.productId;
            }

            const result = await this.executeOperation(operation);
            
            // Store created IDs for dependency resolution
            if (result.success && result.result) {
                if (operation.type === 'upsert_product' && result.result.productId) {
                    createdIds.productId = result.result.productId;
                }
                if (operation.type === 'upsert_item' && result.result.itemId) {
                    createdIds.itemId = result.result.itemId;
                }
            }
            
            results.results.push(result);
            
            if (result.success) {
                results.successful++;
            } else {
                results.failed++;
            }

            // Log progress every 10 operations
            if ((i + 1) % 10 === 0 || i === operations.length - 1) {
                logger.info(`Progress: ${i + 1}/${operations.length} operations completed`, {
                    successful: results.successful,
                    failed: results.failed
                });
            }
        }

        logger.info(`Completed execution of ${operations.length} database operations`, {
            successful: results.successful,
            failed: results.failed
        });

        return results;
    }

    /**
     * Upsert product data
     * @param {Object} data - Product data
     * @param {Object} where - Where clause for upsert
     * @returns {Promise<Object>} Upsert result
     */
    async upsertProduct(data, where) {
        const { name } = where;
        
        // Check if product exists
        const [existing] = await this.db.query(
            'SELECT id FROM T_PRODUCT WHERE name = ?',
            [name]
        );

        if (existing.length > 0) {
            // Update existing product
            const [result] = await this.db.query(
                `UPDATE T_PRODUCT SET 
                    width = ?, vrepeat = ?, hrepeat = ?, outdoor = ?, 
                    archived = ?, type = ?, in_master = ?, date_modif = NOW()
                 WHERE name = ?`,
                [
                    data.width || null,
                    parseFloat(data.vrepeat) || null,
                    parseFloat(data.hrepeat) || null,
                    data.outdoor || 'N',
                    data.archived || 'N',
                    data.type || 'R',
                    data.in_master || 0,
                    name
                ]
            );
            
            return {
                action: 'updated',
                productId: existing[0].id,
                affectedRows: result.affectedRows
            };
        } else {
            // Insert new product
            const [result] = await this.db.query(
                `INSERT INTO T_PRODUCT 
                    (name, width, vrepeat, hrepeat, outdoor, archived, type, in_master, date_add, date_modif, user_id, seam_slippage, log_vers_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?)`,
                [
                    name,
                    data.width || null,
                    parseFloat(data.vrepeat) || null,
                    parseFloat(data.hrepeat) || null,
                    data.outdoor || 'N',
                    data.archived || 'N',
                    data.type || 'R',
                    data.in_master || 0,
                    1, // Default user_id
                    'Standard', // Default seam_slippage
                    1 // Default log_vers_id
                ]
            );
            
            return {
                action: 'inserted',
                productId: result.insertId,
                affectedRows: result.affectedRows
            };
        }
    }

    /**
     * Upsert item data
     * @param {Object} data - Item data
     * @param {Object} where - Where clause for upsert
     * @returns {Promise<Object>} Upsert result
     */
    async upsertItem(data, where) {
        const { code } = where;
        
        // Check if item exists
        const [existing] = await this.db.query(
            'SELECT id FROM T_ITEM WHERE code = ?',
            [code]
        );

        if (existing.length > 0) {
            // Update existing item
            const [result] = await this.db.query(
                `UPDATE T_ITEM SET 
                    vendor_code = ?, vendor_color = ?, archived = ?, 
                    product_type = ?, in_ringset = ?, status_id = ?, stock_status_id = ?, date_modif = NOW()
                 WHERE code = ?`,
                [
                    data.vendor_code || null,
                    data.vendor_color || null,
                    data.archived || 'N',
                    data.product_type || 'R',
                    data.in_ringset || 0,
                    data.status_id || 1,
                    data.stock_status_id || 1,
                    code
                ]
            );
            
            return {
                action: 'updated',
                itemId: existing[0].id,
                affectedRows: result.affectedRows
            };
        } else {
            // Insert new item
            const [result] = await this.db.query(
                `INSERT INTO T_ITEM 
                    (code, vendor_code, vendor_color, archived, product_type, in_ringset, status_id, stock_status_id, date_add, date_modif, user_id, product_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?)`,
                [
                    code.substring(0, 9), // Truncate to max 9 characters
                    data.vendor_code || null,
                    data.vendor_color || null,
                    data.archived || 'N',
                    data.product_type || 'R',
                    data.in_ringset || 0,
                    data.status_id || 1,
                    data.stock_status_id || 1,
                    1, // Default user_id
                    data.product_id || null // Will be set after product creation
                ]
            );
            
            return {
                action: 'inserted',
                itemId: result.insertId,
                affectedRows: result.affectedRows
            };
        }
    }

    /**
     * Upsert product various data
     * @param {Object} data - Product various data
     * @param {Object} where - Where clause for upsert
     * @returns {Promise<Object>} Upsert result
     */
    async upsertProductVarious(data, where) {
        const { product_id } = where;
        
        if (!product_id) {
            logger.warn('Product various upsert skipped - product_id not available');
            return {
                action: 'skipped',
                reason: 'product_id not available'
            };
        }

        // Check if product various exists
        const [existing] = await this.db.query(
            'SELECT product_id FROM T_PRODUCT_VARIOUS WHERE product_id = ?',
            [product_id]
        );

        if (existing.length > 0) {
            // Update existing
            const [result] = await this.db.query(
                `UPDATE T_PRODUCT_VARIOUS SET 
                    prop_65 = ?, ab_2998_compliant = ?, tariff_code = ?
                 WHERE product_id = ?`,
                [
                    data.prop_65 || null,
                    data.ab_2998_compliant || null,
                    data.tariff_code || null,
                    product_id
                ]
            );
            
            return {
                action: 'updated',
                productVariousId: product_id,
                affectedRows: result.affectedRows
            };
        } else {
            // Insert new - need to provide required fields
            const [result] = await this.db.query(
                `INSERT INTO T_PRODUCT_VARIOUS 
                    (product_id, vendor_product_name, yards_per_roll, lead_time, min_order_qty, tariff_code, prop_65, ab_2998_compliant, user_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    product_id,
                    'Default', // Required: vendor_product_name
                    'Standard', // Required: yards_per_roll
                    'Standard', // Required: lead_time
                    'Standard', // Required: min_order_qty
                    data.tariff_code || 'Standard', // Required: tariff_code
                    data.prop_65 || null,
                    data.ab_2998_compliant || null,
                    1 // Required: user_id
                ]
            );
            
            return {
                action: 'inserted',
                productVariousId: product_id,
                affectedRows: result.affectedRows
            };
        }
    }

    /**
     * Upsert product content front
     * @param {Object} data - Content data
     * @param {Object} where - Where clause for upsert
     * @returns {Promise<Object>} Upsert result
     */
    async upsertProductContentFront(data, where) {
        // Note: product_id will be null initially
        logger.warn('Product content front upsert skipped - product_id not yet available');
        return {
            action: 'skipped',
            reason: 'product_id not yet available'
        };
    }

    /**
     * Upsert product content back
     * @param {Object} data - Content data
     * @param {Object} where - Where clause for upsert
     * @returns {Promise<Object>} Upsert result
     */
    async upsertProductContentBack(data, where) {
        // Note: product_id will be null initially
        logger.warn('Product content back upsert skipped - product_id not yet available');
        return {
            action: 'skipped',
            reason: 'product_id not yet available'
        };
    }

    /**
     * Upsert product abrasion
     * @param {Object} data - Abrasion data
     * @param {Object} where - Where clause for upsert
     * @returns {Promise<Object>} Upsert result
     */
    async upsertProductAbrasion(data, where) {
        // Note: product_id will be null initially
        logger.warn('Product abrasion upsert skipped - product_id not yet available');
        return {
            action: 'skipped',
            reason: 'product_id not yet available'
        };
    }

    /**
     * Upsert product firecode
     * @param {Object} data - Firecode data
     * @param {Object} where - Where clause for upsert
     * @returns {Promise<Object>} Upsert result
     */
    async upsertProductFirecode(data, where) {
        // Note: product_id will be null initially
        logger.warn('Product firecode upsert skipped - product_id not yet available');
        return {
            action: 'skipped',
            reason: 'product_id not yet available'
        };
    }

    /**
     * Sync item colors
     * @param {Object} data - Color data
     * @param {Object} where - Where clause for sync
     * @returns {Promise<Object>} Sync result
     */
    async syncItemColors(data, where) {
        // Note: item_id will be null initially
        logger.warn('Item colors sync skipped - item_id not yet available');
        return {
            action: 'skipped',
            reason: 'item_id not yet available'
        };
    }

    /**
     * Sync product vendors
     * @param {Object} data - Vendor data
     * @param {Object} where - Where clause for sync
     * @returns {Promise<Object>} Sync result
     */
    async syncProductVendors(data, where) {
        // Note: product_id will be null initially
        logger.warn('Product vendors sync skipped - product_id not yet available');
        return {
            action: 'skipped',
            reason: 'product_id not yet available'
        };
    }

    /**
     * Sync product finish
     * @param {Object} data - Finish data
     * @param {Object} where - Where clause for sync
     * @returns {Promise<Object>} Sync result
     */
    async syncProductFinish(data, where) {
        // Note: product_id will be null initially
        logger.warn('Product finish sync skipped - product_id not yet available');
        return {
            action: 'skipped',
            reason: 'product_id not yet available'
        };
    }

    /**
     * Sync product cleaning
     * @param {Object} data - Cleaning data
     * @param {Object} where - Where clause for sync
     * @returns {Promise<Object>} Sync result
     */
    async syncProductCleaning(data, where) {
        // Note: product_id will be null initially
        logger.warn('Product cleaning sync skipped - product_id not yet available');
        return {
            action: 'skipped',
            reason: 'product_id not yet available'
        };
    }

    /**
     * Sync product origin
     * @param {Object} data - Origin data
     * @param {Object} where - Where clause for sync
     * @returns {Promise<Object>} Sync result
     */
    async syncProductOrigin(data, where) {
        // Note: product_id will be null initially
        logger.warn('Product origin sync skipped - product_id not yet available');
        return {
            action: 'skipped',
            reason: 'product_id not yet available'
        };
    }

    /**
     * Sync product use
     * @param {Object} data - Use data
     * @param {Object} where - Where clause for sync
     * @returns {Promise<Object>} Sync result
     */
    async syncProductUse(data, where) {
        // Note: product_id will be null initially
        logger.warn('Product use sync skipped - product_id not yet available');
        return {
            action: 'skipped',
            reason: 'product_id not yet available'
        };
    }
}

module.exports = DatabaseOperationExecutor;
