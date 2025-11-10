'use strict';

const logger = require('../utils/logger');
const NsToOpmsSyncService = require('./NsToOpmsSyncService');
const db = require('../config/database');
const SyncJobDAO = require('../models/SyncJobDAO');
const SyncItemDAO = require('../models/SyncItemDAO');

/**
 * NetSuite to OPMS Webhook Synchronization Service
 * 
 * Processes incoming webhooks from NetSuite for item pricing updates.
 * This service acts as a bridge between NetSuite webhooks and the 
 * pricing synchronization service.
 * 
 * CRITICAL SAFETY RULES:
 * 1. Validate webhook authenticity before processing
 * 2. Check Lisa Slayman flag before any sync operations
 * 3. Log all webhook events for audit purposes
 * 4. Continue processing even if individual items fail
 */
class NsToOpmsWebhookService {
  constructor() {
    this.pricingSyncService = new NsToOpmsSyncService();
    this.webhookStats = {
      received: 0,
      processed: 0,
      skipped: 0,
      failed: 0,
      lastProcessed: null
    };
  }
  
  /**
   * Process incoming webhook for item pricing update
   * 
   * @param {Object} webhookData - Webhook payload data
   * @returns {Object} Processing result
   */
  async processItemPricingWebhook(webhookData) {
    this.webhookStats.received++;
    
    let syncJob = null;
    let syncItem = null;
    
    try {
      const { itemData, timestamp } = webhookData;
      
      // Ensure database is initialized
      await db.initializeDatabase();
      
      // Initialize DAOs
      const syncJobDAO = new SyncJobDAO(db);
      const syncItemDAO = new SyncItemDAO(db);
      
      // Validate webhook data
      if (!this.validateWebhookData(itemData)) {
        throw new Error('Invalid webhook data structure');
      }
      
      // Create sync job for this webhook event
      syncJob = await syncJobDAO.createJob({
        job_type: 'webhook',
        status: 'running',
        total_items: 1,
        triggered_by: 'netsuite_webhook',
        source: 'webhook'
      });
      
      await syncJobDAO.markJobStarted(syncJob.id);
      
      logger.info('Processing pricing webhook', {
        jobId: syncJob.id,
        itemId: itemData.itemid,
        lisaSlayman: itemData.custitemf3_lisa_item,
        timestamp: timestamp
      });
      
      // Create sync item record
      syncItem = await syncItemDAO.createItem({
        sync_job_id: syncJob.id,
        netsuite_item_id: itemData.itemid,
        netsuite_internal_id: itemData.internalid || itemData.id,
        item_code: itemData.itemid,
        status: 'processing'
      });
      
      // Process the pricing sync
      const result = await this.pricingSyncService.syncSingleItemPricing(itemData, syncJob.id);
      
      // Update sync item and job based on result
      if (result.skipped) {
        this.webhookStats.skipped++;
        
        await syncItemDAO.markItemSkipped(syncItem.id, result.reason);
        await syncJobDAO.updateJobProgress(syncJob.id, {
          processed_items: 1,
          successful_items: 0,
          failed_items: 0,
          skipped_items: 1
        });
        await syncJobDAO.markJobCompleted(syncJob.id);
        
        logger.info('Webhook item skipped', {
          jobId: syncJob.id,
          itemId: itemData.itemid,
          reason: result.reason
        });
        
      } else if (result.success) {
        this.webhookStats.processed++;
        
        // Extract pricing data from NetSuite itemData (not from updateResult)
        const extractedPricing = this.pricingSyncService.extractPricingData(itemData);
        
        const pricingData = {
          customerCut: extractedPricing.p_res_cut,
          customerRoll: extractedPricing.p_hosp_roll,
          vendorCut: extractedPricing.cost_cut,
          vendorRoll: extractedPricing.cost_roll
        };
        
        const syncFields = {
          p_res_cut: extractedPricing.p_res_cut,
          p_hosp_roll: extractedPricing.p_hosp_roll,
          cost_cut: extractedPricing.cost_cut,
          cost_roll: extractedPricing.cost_roll
        };
        
        // Prepare before/after pricing for comparison display
        const pricingBefore = result.pricingBefore ? {
          customerCut: result.pricingBefore.p_res_cut,
          customerRoll: result.pricingBefore.p_hosp_roll,
          vendorCut: result.pricingBefore.cost_cut,
          vendorRoll: result.pricingBefore.cost_roll
        } : null;
        
        const pricingAfter = {
          customerCut: extractedPricing.p_res_cut,
          customerRoll: extractedPricing.p_hosp_roll,
          vendorCut: extractedPricing.cost_cut,
          vendorRoll: extractedPricing.cost_roll
        };
        
        await syncItemDAO.updateItemPricingData(syncItem.id, pricingData, syncFields, pricingBefore, pricingAfter);
        
        // Update item with OPMS IDs
        await db.query(
          'UPDATE netsuite_opms_sync_items SET opms_item_id = ?, opms_product_id = ? WHERE id = ?',
          [result.opmsItemId, result.opmsProductId, syncItem.id]
        );
        
        await syncJobDAO.updateJobProgress(syncJob.id, {
          processed_items: 1,
          successful_items: 1,
          failed_items: 0,
          skipped_items: 0
        });
        await syncJobDAO.markJobCompleted(syncJob.id);
        
        logger.info('Webhook item processed successfully', {
          jobId: syncJob.id,
          itemId: itemData.itemid,
          opmsItemId: result.opmsItemId,
          pricingData
        });
        
        // CASCADE: Trigger OPMS→NetSuite sync for all sibling items
        // After updating product pricing in OPMS, sync all items under this product back to NetSuite
        // DISABLED: Price cascading to sibling items has been commented out per user request
        // This prevents automatic price updates from cascading to all sibling items
        // The main NetSuite → OPMS sync still works, but OPMS → NetSuite sibling updates are disabled
        /*
        if (result.opmsProductId) {
          try {
            logger.info('Triggering cascade sync for product siblings', {
              productId: result.opmsProductId,
              sourceItemId: result.opmsItemId,
              reason: 'Product pricing updated via NetSuite webhook - syncing siblings'
            });
            
            // Import the change detection service to trigger sibling syncs
            const OpmsChangeDetectionService = require('./OpmsChangeDetectionService');
            const changeDetectionService = new OpmsChangeDetectionService();
            
            // Trigger sync for entire product (all items)
            // This will queue all items under this product for OPMS→NetSuite sync
            await changeDetectionService.manualTriggerProduct(
              result.opmsProductId,
              'Product pricing updated via NetSuite webhook - cascading to all items',
              'HIGH', // High priority for pricing cascades
              {
                source: 'ns_to_opms_webhook_cascade',
                webhook_job_id: syncJob.id,
                triggered_by_item: result.opmsItemId
              }
            );
            
            logger.info('Cascade sync triggered successfully', {
              productId: result.opmsProductId,
              cascadeReason: 'pricing_update_from_netsuite'
            });
            
          } catch (cascadeError) {
            // Log error but don't fail the webhook processing
            // The original pricing sync already succeeded
            logger.error('Failed to trigger cascade sync', {
              error: cascadeError.message,
              productId: result.opmsProductId,
              originalWebhookStillSuccessful: true
            });
          }
        }
        */
        
        // Log that cascading has been disabled
        logger.info('Price cascading disabled - sibling items will not be automatically updated', {
          productId: result.opmsProductId,
          sourceItemId: result.opmsItemId,
          reason: 'Price cascading functionality has been commented out per user request',
          note: 'Main NetSuite → OPMS sync still works, but OPMS → NetSuite sibling updates are disabled'
        });
      }
      
      this.webhookStats.lastProcessed = new Date();
      
      return {
        ...result,
        jobId: syncJob.id,
        syncItemId: syncItem.id
      };
      
    } catch (error) {
      this.webhookStats.failed++;
      
      // Mark sync item as failed if we created one
      if (syncItem) {
        const syncItemDAO = new SyncItemDAO(db);
        await syncItemDAO.updateItemStatus(syncItem.id, 'failed', error.message);
      }
      
      // Mark sync job as failed if we created one
      if (syncJob) {
        const syncJobDAO = new SyncJobDAO(db);
        await syncJobDAO.updateJobProgress(syncJob.id, {
          processed_items: 1,
          successful_items: 0,
          failed_items: 1,
          skipped_items: 0
        });
        await syncJobDAO.markJobFailed(syncJob.id, error.message);
      }
      
      logger.error('Webhook processing failed', {
        jobId: syncJob?.id,
        error: error.message,
        stack: error.stack,
        itemId: webhookData.itemData?.itemid,
        timestamp: webhookData.timestamp
      });
      
      throw error;
    }
  }
  
  /**
   * Validate webhook data structure
   * 
   * @param {Object} itemData - Item data from webhook
   * @returns {boolean} True if valid
   */
  validateWebhookData(itemData) {
    const requiredFields = ['itemid', 'internalid'];
    
    for (const field of requiredFields) {
      if (!itemData[field]) {
        logger.error(`Missing required field: ${field}`, itemData);
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Get webhook statistics
   * 
   * @returns {Object} Webhook processing statistics
   */
  getStats() {
    return {
      ...this.webhookStats,
      successRate: this.webhookStats.received > 0 
        ? (this.webhookStats.processed / this.webhookStats.received) * 100 
        : 0
    };
  }
  
  /**
   * Reset statistics
   */
  resetStats() {
    this.webhookStats = {
      received: 0,
      processed: 0,
      skipped: 0,
      failed: 0,
      lastProcessed: null
    };
  }
}

module.exports = NsToOpmsWebhookService;
