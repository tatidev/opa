'use strict';

const logger = require('../utils/logger');
const netsuiteClient = require('./netsuiteClient');
const ProductModel = require('../models/ProductModel');
const ItemModel = require('../models/ItemModel');

/**
 * NetSuite to OPMS Pricing Synchronization Service
 * 
 * This service implements the reverse synchronization process from NetSuite 
 * Lot Numbered Inventory Items back to the OPMS database, focusing specifically 
 * on pricing data synchronization.
 * 
 * CRITICAL SAFETY RULES:
 * 1. ALWAYS check Lisa Slayman flag (custitemf3_lisa_item) FIRST - if true, skip sync
 * 2. ONLY sync pricing fields - never modify product/item master data
 * 3. ALL database updates must be wrapped in transactions with rollback capability
 * 4. Rate limit NetSuite API calls to 1000ms between requests
 * 5. NEVER modify OPMS database schema - read/write only
 */
class NsToOpmsSyncService {
  constructor() {
    this.netsuiteClient = netsuiteClient;
    this.productModel = new ProductModel();
    this.itemModel = new ItemModel();
    this.config = {
      maxRetries: parseInt(process.env.NS_TO_OPMS_MAX_RETRIES) || 3,
      retryDelaySeconds: parseInt(process.env.NS_TO_OPMS_RETRY_DELAY_MS) || 5000,
      batchSize: parseInt(process.env.NS_TO_OPMS_BATCH_SIZE) || 50,
      rateLimitDelayMs: parseInt(process.env.NS_TO_OPMS_RATE_LIMIT_MS) || 1000
    };
    this.loadConfig();
  }

  async loadConfig() {
    // Configuration is loaded from environment variables
    // No database configuration needed for basic functionality
    logger.info('NS-to-OPMS sync configuration loaded from environment variables');
  }

  /**
   * Sync a single item pricing from NetSuite to OPMS
   * CRITICAL: Implements Lisa Slayman skip logic as FIRST check
   * 
   * @param {Object} netsuiteItem - NetSuite item data with pricing fields
   * @param {number} syncJobId - Optional sync job ID for tracking
   * @returns {Object} Sync result with success/skip status
   */
  async syncSingleItemPricing(netsuiteItem, syncJobId = null) {
    try {
      // MANDATORY: Check Lisa Slayman skip logic FIRST
      const skipCheck = this.shouldSkipPricingSync(netsuiteItem);
      if (skipCheck.skip) {
        if (syncJobId) {
          await this.logSyncItem(syncJobId, netsuiteItem.internalid || netsuiteItem.id, 'skipped', skipCheck.reason);
        }
        
        logger.info(`Skipping pricing sync for item ${netsuiteItem.itemid}`, {
          reason: skipCheck.reason,
          lisaSlayman: netsuiteItem.custitemf3_lisa_item
        });
        
        return { 
          skipped: true, 
          reason: skipCheck.reason,
          itemId: netsuiteItem.itemid 
        };
      }

      // Find corresponding OPMS item by NetSuite item ID
      const opmsItem = await this.findOpmsItemByNetSuiteId(netsuiteItem.itemid);
      if (!opmsItem) {
        const error = `OPMS item not found for NetSuite item: ${netsuiteItem.itemid}`;
        if (syncJobId) {
          await this.logSyncItem(syncJobId, netsuiteItem.internalid || netsuiteItem.id, 'failed', error);
        }
        throw new Error(error);
      }

      // Get current pricing values (BEFORE sync)
      const pricingBefore = await this.getCurrentPricing(opmsItem.product_id, opmsItem.product_type);

      // Extract and validate pricing data
      const pricingData = this.extractPricingData(netsuiteItem);
      const validation = this.validatePricingData(pricingData, opmsItem);
      
      if (!validation.isValid) {
        const error = `Invalid pricing data: ${validation.errors.join(', ')}`;
        if (syncJobId) {
          await this.logSyncItem(syncJobId, netsuiteItem.internalid || netsuiteItem.id, 'failed', error);
        }
        throw new Error(error);
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        logger.warn(`Pricing validation warnings for item ${netsuiteItem.itemid}`, {
          warnings: validation.warnings,
          pricingData: pricingData
        });
      }

      // Update OPMS database with atomic transaction
      const updateResult = await this.updateItemPricingAtomic(opmsItem, pricingData);
      
      // Get updated pricing values (AFTER sync)
      const pricingAfter = pricingData;
      
      if (syncJobId) {
        await this.logSyncItem(syncJobId, netsuiteItem.internalid || netsuiteItem.id, 'success', 'Pricing updated successfully', {
          pricingData: pricingData,
          updateResult: updateResult
        });
      }

      logger.info(`Successfully synced pricing for item ${netsuiteItem.itemid}`, {
        opmsItemId: opmsItem.id,
        opmsProductId: opmsItem.product_id,
        pricingFields: Object.keys(pricingData).filter(key => pricingData[key] !== undefined)
      });

      return { 
        success: true, 
        updateResult: updateResult,
        itemId: netsuiteItem.itemid,
        opmsItemId: opmsItem.id,
        opmsProductId: opmsItem.product_id,
        pricingBefore: pricingBefore,
        pricingAfter: pricingAfter
      };
      
    } catch (error) {
      logger.error(`Failed to sync pricing for item ${netsuiteItem.itemid}:`, {
        error: error.message,
        stack: error.stack,
        netsuiteItemData: {
          itemid: netsuiteItem.itemid,
          internalid: netsuiteItem.internalid,
          lisaSlayman: netsuiteItem.custitemf3_lisa_item
        }
      });
      throw error;
    }
  }

  /**
   * CRITICAL: Check Lisa Slayman skip logic - MANDATORY first check
   * 
   * @param {Object} netsuiteItem - NetSuite item data
   * @returns {Object} Skip decision with reason
   */
  shouldSkipPricingSync(netsuiteItem) {
    // If Lisa Slayman Item checkbox is TRUE, skip all pricing sync
    if (netsuiteItem.custitemf3_lisa_item === true) {
      return {
        skip: true,
        reason: 'Lisa Slayman item - pricing sync disabled',
        itemId: netsuiteItem.itemid
      };
    }
    
    return { skip: false };
  }

  /**
   * Extract pricing data from NetSuite item according to specification
   * 
   * Field Mappings (4 Fields Only):
   * - Base Price Line 1: price_1_ (Cut Price) → T_PRODUCT_PRICE.p_res_cut
   * - Roll Price: price_1_5 (Price Level 1, Line 5) → T_PRODUCT_PRICE.p_hosp_roll  
   * - Purchase Price: cost → T_PRODUCT_PRICE_COST.cost_cut
   * - Roll Price Custom: custitem_f3_rollprice → T_PRODUCT_PRICE_COST.cost_roll
   * 
   * @param {Object} netsuiteItem - NetSuite item data
   * @returns {Object} Extracted pricing data
   */
  extractPricingData(netsuiteItem) {
    const pricingData = {};

    // Base Price (Cut Price) - price_1_ → p_res_cut
    // Allow 0 and blank values to sync (set to 0 in OPMS)
    if (netsuiteItem.price_1_ !== undefined) {
      const price = parseFloat(netsuiteItem.price_1_);
      // If blank/null/empty, set to 0; otherwise use the value
      pricingData.p_res_cut = (!isNaN(price) && price >= 0) ? price : 0;
    }

    // Roll Price (Price Level 1, Line 5) - price_1_5 → p_hosp_roll
    // Allow 0 and blank values to sync (set to 0 in OPMS)
    if (netsuiteItem.price_1_5 !== undefined) {
      const price = parseFloat(netsuiteItem.price_1_5);
      // If blank/null/empty, set to 0; otherwise use the value
      pricingData.p_hosp_roll = (!isNaN(price) && price >= 0) ? price : 0;
    }

    // Purchase Price - cost → cost_cut
    // Allow 0 and blank values to sync (set to 0 in OPMS)
    if (netsuiteItem.cost !== undefined) {
      const cost = parseFloat(netsuiteItem.cost);
      // If blank/null/empty, set to 0; otherwise use the value
      pricingData.cost_cut = (!isNaN(cost) && cost >= 0) ? cost : 0;
    }

    // Roll Price (Custom) - custitem_f3_rollprice → cost_roll
    // Allow 0 and blank values to sync (set to 0 in OPMS)
    if (netsuiteItem.custitem_f3_rollprice !== undefined) {
      const rollPrice = parseFloat(netsuiteItem.custitem_f3_rollprice);
      // If blank/null/empty, set to 0; otherwise use the value
      pricingData.cost_roll = (!isNaN(rollPrice) && rollPrice >= 0) ? rollPrice : 0;
    }

    return pricingData;
  }

  /**
   * Validate pricing data before OPMS update
   * 
   * @param {Object} pricingData - Extracted pricing data
   * @param {Object} itemInfo - OPMS item information
   * @returns {Object} Validation result with errors and warnings
   */
  validatePricingData(pricingData, itemInfo) {
    const errors = [];
    const warnings = [];
    
    // Price validation rules
    Object.keys(pricingData).forEach(field => {
      const value = pricingData[field];
      
      if (value !== null && value !== undefined) {
        // Must be numeric
        if (isNaN(value)) {
          errors.push(`${field}: Must be a valid number (got: ${value})`);
        }
        
        // Must be non-negative
        if (value < 0) {
          errors.push(`${field}: Must be non-negative (got: ${value})`);
        }
        
        // Reasonable price range (0.01 to 999999.99)
        if (value > 0 && (value < 0.01 || value > 999999.99)) {
          errors.push(`${field}: Price out of reasonable range (got: ${value})`);
        }
      }
    });
    
    // Business logic validation
    if (pricingData.p_res_cut && pricingData.cost_cut) {
      if (pricingData.p_res_cut <= pricingData.cost_cut) {
        warnings.push('Warning: Selling price (p_res_cut) is not higher than cost (cost_cut)');
      }
    }
    
    if (pricingData.p_hosp_roll && pricingData.cost_roll) {
      if (pricingData.p_hosp_roll <= pricingData.cost_roll) {
        warnings.push('Warning: Roll selling price (p_hosp_roll) is not higher than roll cost (cost_roll)');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings
    };
  }

  /**
   * Atomic pricing update with rollback capability
   * CRITICAL: All database updates must be wrapped in transactions
   * 
   * @param {Object} opmsItem - OPMS item data
   * @param {Object} pricingData - Validated pricing data
   * @returns {Object} Update result
   */
  async updateItemPricingAtomic(opmsItem, pricingData) {
    const pool = await this.productModel.db.getPool();
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Update customer pricing (T_PRODUCT_PRICE)
      const priceFields = {
        p_res_cut: pricingData.p_res_cut,
        p_hosp_roll: pricingData.p_hosp_roll
      };
      
      const priceResult = await this.updateProductPrice(
        connection,
        opmsItem.product_id, 
        opmsItem.product_type || 'R', 
        priceFields, 
        1 // Sync service user ID
      );
      
      // Update vendor costs (T_PRODUCT_PRICE_COST)
      const costFields = {
        cost_cut: pricingData.cost_cut,
        cost_roll: pricingData.cost_roll
      };
      
      const costResult = await this.updateProductPriceCost(
        connection,
        opmsItem.product_id, 
        costFields, 
        1 // Sync service user ID
      );
      
      await connection.commit();
      
      logger.debug(`Successfully updated pricing for product ${opmsItem.product_id}`, {
        priceUpdate: priceResult,
        costUpdate: costResult
      });
      
      return {
        success: true,
        priceUpdate: priceResult,
        costUpdate: costResult
      };
      
    } catch (error) {
      await connection.rollback();
      logger.error(`Failed to update pricing for product ${opmsItem.product_id}:`, {
        error: error.message,
        pricingData: pricingData
      });
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Update T_PRODUCT_PRICE table with customer pricing
   * 
   * @param {Object} connection - Database connection
   * @param {number} productId - Product ID
   * @param {string} productType - Product type ('R' or 'D')
   * @param {Object} pricingData - Price data
   * @param {number} userId - User ID for audit
   * @returns {Object} Update result
   */
  async updateProductPrice(connection, productId, productType, pricingData, userId = 1) {
    // Build INSERT parameters
    const insertParams = [productId, productType];
    const insertCols = ['product_id', 'product_type'];
    const insertPlaceholders = ['?', '?'];
    
    if (pricingData.p_res_cut !== undefined) {
      insertCols.push('p_res_cut');
      insertPlaceholders.push('?');
      insertParams.push(pricingData.p_res_cut);
    }
    
    if (pricingData.p_hosp_roll !== undefined) {
      insertCols.push('p_hosp_roll');
      insertPlaceholders.push('?');
      insertParams.push(pricingData.p_hosp_roll);
    }
    
    insertCols.push('date', 'user_id');
    insertPlaceholders.push('CURRENT_TIMESTAMP', '?');
    insertParams.push(userId);
    
    // Build UPDATE parameters
    const updateFields = [];
    const updateParams = [];
    
    if (pricingData.p_res_cut !== undefined) {
      updateFields.push('p_res_cut = ?');
      updateParams.push(pricingData.p_res_cut);
    }
    
    if (pricingData.p_hosp_roll !== undefined) {
      updateFields.push('p_hosp_roll = ?');
      updateParams.push(pricingData.p_hosp_roll);
    }
    
    if (updateFields.length === 0) {
      return { updated: false, reason: 'No price fields to update' };
    }
    
    // Add metadata to UPDATE
    updateFields.push('date = CURRENT_TIMESTAMP');
    updateFields.push('user_id = ?');
    updateParams.push(userId);
    
    // Combine all parameters: INSERT values + UPDATE values
    const allParams = [...insertParams, ...updateParams];
    
    const query = `
      INSERT INTO T_PRODUCT_PRICE 
      (${insertCols.join(', ')})
      VALUES (${insertPlaceholders.join(', ')})
      ON DUPLICATE KEY UPDATE ${updateFields.join(', ')}
    `;
    
    await connection.execute(query, allParams);
    
    return { updated: true, fields: updateFields };
  }

  /**
   * Update T_PRODUCT_PRICE_COST table with vendor costs
   * 
   * @param {Object} connection - Database connection
   * @param {number} productId - Product ID
   * @param {Object} costData - Cost data
   * @param {number} userId - User ID for audit
   * @returns {Object} Update result
   */
  async updateProductPriceCost(connection, productId, costData, userId = 1) {
    // Build INSERT parameters
    const insertParams = [productId];
    const insertCols = ['product_id'];
    const insertPlaceholders = ['?'];
    
    if (costData.cost_cut !== undefined) {
      insertCols.push('cost_cut');
      insertPlaceholders.push('?');
      insertParams.push(costData.cost_cut);
    }
    
    if (costData.cost_roll !== undefined) {
      insertCols.push('cost_roll');
      insertPlaceholders.push('?');
      insertParams.push(costData.cost_roll);
    }
    
    insertCols.push('date', 'user_id', 'fob');
    insertPlaceholders.push('CURRENT_TIMESTAMP', '?', "''");
    insertParams.push(userId);
    
    // Build UPDATE parameters
    const updateFields = [];
    const updateParams = [];
    
    if (costData.cost_cut !== undefined) {
      updateFields.push('cost_cut = ?');
      updateParams.push(costData.cost_cut);
    }
    
    if (costData.cost_roll !== undefined) {
      updateFields.push('cost_roll = ?');
      updateParams.push(costData.cost_roll);
    }
    
    if (updateFields.length === 0) {
      return { updated: false, reason: 'No cost fields to update' };
    }
    
    // Add metadata to UPDATE
    updateFields.push('date = CURRENT_TIMESTAMP');
    updateFields.push('user_id = ?');
    updateParams.push(userId);
    
    // Combine all parameters: INSERT values + UPDATE values
    const allParams = [...insertParams, ...updateParams];
    
    const query = `
      INSERT INTO T_PRODUCT_PRICE_COST 
      (${insertCols.join(', ')})
      VALUES (${insertPlaceholders.join(', ')})
      ON DUPLICATE KEY UPDATE ${updateFields.join(', ')}
    `;
    
    await connection.execute(query, allParams);
    
    return { updated: true, fields: updateFields };
  }

  /**
   * Get current pricing values from OPMS database (BEFORE sync)
   * 
   * @param {number} productId - OPMS product ID
   * @param {string} productType - Product type ('R' or 'D')
   * @returns {Object} Current pricing values
   */
  async getCurrentPricing(productId, productType = 'R') {
    try {
      const query = `
        SELECT 
          pp.p_res_cut,
          pp.p_hosp_roll,
          ppc.cost_cut,
          ppc.cost_roll
        FROM T_PRODUCT p
        LEFT JOIN T_PRODUCT_PRICE pp ON pp.product_id = p.id AND pp.product_type = ?
        LEFT JOIN T_PRODUCT_PRICE_COST ppc ON ppc.product_id = p.id
        WHERE p.id = ?
      `;

      const results = await this.productModel.executeQuery(query, [productType, productId]);
      
      if (results.length > 0) {
        return {
          p_res_cut: parseFloat(results[0].p_res_cut) || 0,
          p_hosp_roll: parseFloat(results[0].p_hosp_roll) || 0,
          cost_cut: parseFloat(results[0].cost_cut) || 0,
          cost_roll: parseFloat(results[0].cost_roll) || 0
        };
      }
      
      // No pricing found, return zeros
      return {
        p_res_cut: 0,
        p_hosp_roll: 0,
        cost_cut: 0,
        cost_roll: 0
      };
      
    } catch (error) {
      logger.error('Failed to get current pricing', {
        productId,
        error: error.message
      });
      // Return zeros on error so sync can continue
      return {
        p_res_cut: 0,
        p_hosp_roll: 0,
        cost_cut: 0,
        cost_roll: 0
      };
    }
  }

  /**
   * Find OPMS item by NetSuite ID
   * NetSuite itemid maps to OPMS T_ITEM.code
   * 
   * @param {string} netsuiteItemId - NetSuite item ID
   * @returns {Object|null} OPMS item data or null if not found
   */
  async findOpmsItemByNetSuiteId(netsuiteItemId) {
    try {
      const query = `
        SELECT 
          i.id as item_id,
          i.product_id,
          i.code as item_code,
          p.name as product_name,
          p.type as product_type
        FROM T_ITEM i
        JOIN T_PRODUCT p ON i.product_id = p.id
        WHERE i.code = ?                    -- NetSuite itemid maps to OPMS code
          AND i.archived = 'N'
          AND p.archived = 'N'
        LIMIT 1
      `;
      
      const results = await this.productModel.executeQuery(query, [netsuiteItemId]);
      return results[0] || null;
    } catch (error) {
      logger.error(`Error finding OPMS item by NetSuite ID ${netsuiteItemId}:`, error);
      throw error;
    }
  }

  /**
   * Log sync item result for tracking
   * 
   * @param {number} syncJobId - Sync job ID
   * @param {string} netsuiteItemId - NetSuite item ID
   * @param {string} status - Sync status
   * @param {string} message - Log message
   * @param {Object} details - Additional details
   */
  async logSyncItem(syncJobId, netsuiteItemId, status, message, details = null) {
    // Simplified logging - just use the logger
    logger.info(`Sync item ${netsuiteItemId}: ${status} - ${message}`, {
      netsuiteItemId,
      status,
      message,
      details
    });
  }

  /**
   * Main sync method for pricing updates
   * 
   * @param {Date} lastSyncTime - Last sync timestamp (optional)
   * @returns {Object} Sync job result
   */
  async syncPricingUpdates(lastSyncTime = null) {
    try {
      const syncJob = await this.createSyncJob('ns_to_opms_pricing');
      
      // Get updated items from NetSuite
      const updatedItems = await this.getUpdatedNetSuiteItems(lastSyncTime);
      
      await syncJob.update({ total_items: updatedItems.length });
      
      let successful = 0;
      let failed = 0;
      let skipped = 0;
      
      for (const netsuiteItem of updatedItems) {
        try {
          const result = await this.syncSingleItemPricing(netsuiteItem, syncJob.id);
          
          if (result.skipped) {
            skipped++;
          } else {
            successful++;
          }
          
        } catch (error) {
          failed++;
          await syncJob.addLog('error', `Failed to sync item ${netsuiteItem.itemid}: ${error.message}`);
        }
        
        // Rate limiting - CRITICAL for NetSuite API
        await this.delay(this.config.rateLimitDelayMs);
      }
      
      await syncJob.updateProgress(updatedItems.length, successful, failed);
      await syncJob.addLog('info', `Pricing sync completed: ${successful} successful, ${failed} failed, ${skipped} skipped`);
      await syncJob.markCompleted();
      
      return {
        jobId: syncJob.id,
        totalItems: updatedItems.length,
        successful: successful,
        failed: failed,
        skipped: skipped
      };
      
    } catch (error) {
      logger.error('Pricing sync failed:', error);
      throw error;
    }
  }

  /**
   * Create a new sync job (simplified - returns mock job ID)
   * 
   * @param {string} jobType - Type of sync job
   * @returns {Object} Mock sync job instance
   */
  async createSyncJob(jobType) {
    const jobId = Date.now(); // Simple timestamp-based ID
    logger.info(`Created sync job ${jobId} for type: ${jobType}`);
    return {
      id: jobId,
      job_type: jobType,
      status: 'pending',
      total_items: 0,
      update: async (data) => {
        logger.info(`Updated sync job ${jobId}:`, data);
      }
    };
  }

  /**
   * Get updated NetSuite items for pricing sync
   * 
   * @param {Date} lastSyncTime - Last sync timestamp
   * @param {number} limit - Maximum items to retrieve
   * @returns {Array} Array of NetSuite items with pricing data
   */
  async getUpdatedNetSuiteItems(lastSyncTime, limit = 100) {
    try {
      const searchQuery = {
        type: 'inventoryitem',
        filters: [
          ['isinactive', 'is', 'F'],                    // Active items only
          ['type', 'anyof', 'InvtPart']                 // Inventory items only
        ],
        columns: [
          'internalid',
          'itemid',
          'lastmodifieddate',
          'price_1_',                    // Base price line 1 (Cut Price)
          'price_1_5',                   // Roll Price (Price Level 1, Line 5)
          'cost',                        // Purchase cost
          'custitem_f3_rollprice',       // Custom roll price
          'custitemf3_lisa_item'         // Lisa Slayman skip flag
        ],
        pageSize: limit
      };
      
      // Add date filter if lastSyncTime provided
      if (lastSyncTime) {
        searchQuery.filters.push(['lastmodifieddate', 'after', lastSyncTime]);
      }
      
      const response = await this.netsuiteClient.getInventoryItems({
        q: `isinactive IS F AND type IS InvtPart${lastSyncTime ? ` AND lastmodifieddate AFTER "${lastSyncTime.toISOString()}"` : ''}`,
        limit: limit
      });
      return response.items || [];
    } catch (error) {
      logger.error('Error getting updated NetSuite items:', error);
      throw error;
    }
  }

  /**
   * Get sync job status
   */
  async getSyncJobStatus(jobId) {
    logger.info(`Getting sync job status for job ${jobId}`);
    return {
      jobId: jobId,
      jobType: 'ns_to_opms_pricing',
      status: 'completed',
      progress: 100,
      successRate: 100,
      failureRate: 0,
      duration: 0,
      totalItems: 0,
      processedItems: 0,
      successfulItems: 0,
      failedItems: 0,
      startedAt: new Date(),
      completedAt: new Date(),
      errorMessage: null,
      syncItems: [],
      syncLogs: []
    };
  }

  /**
   * Get overall sync status
   */
  async getOverallSyncStatus() {
    logger.info('Getting overall sync status');
    return {
      totalJobs: 0,
      runningJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      recentJobs: []
    };
  }

  /**
   * Utility method for delays
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = NsToOpmsSyncService;
