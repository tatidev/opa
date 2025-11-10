const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const DryRunSyncService = require('../services/DryRunSyncService');
const NetSuiteDryRunSyncLogModel = require('../models/NetSuiteDryRunSyncLogModel');
const SyncConfigService = require('../services/SyncConfigService');

/**
 * Dry Run Sync Controller
 * Handles API endpoints for dry-run sync operations that store actual JSON payloads
 */
class DryRunSyncController {
  
  /**
   * Perform dry-run sync for a single OPMS item
   * POST /api/dry-run/sync/item/:opmsItemId
   */
  static async syncSingleItem(req, res) {
    try {
      const { opmsItemId } = req.params;
      const { 
        syncType = 'item_sync', 
        syncTrigger = 'manual_test',
        storePayload = true 
      } = req.body;

      logger.info('Starting single item dry-run sync', { 
        opmsItemId: parseInt(opmsItemId),
        syncType,
        syncTrigger,
        storePayload
      });

      const dryRunService = new DryRunSyncService();
      const useProd = await SyncConfigService.isDryRunUseProdEnabled();
      
      const result = await dryRunService.performDryRunSync(parseInt(opmsItemId), {
        syncType,
        syncTrigger,
        storePayload,
        envOverride: useProd ? 'prod' : 'sandbox'
      });

      if (result.success) {
        logger.info('Single item dry-run sync completed', {
          opmsItemId: parseInt(opmsItemId),
          payloadSizeBytes: result.payloadMetrics.sizeBytes,
          fieldCount: result.payloadMetrics.fieldCount,
          validationStatus: result.validationResult.status,
          storedRecordId: result.storedRecordId
        });

        return res.json({
          success: true,
          message: 'Dry-run sync completed successfully',
          data: result
        });
      } else {
        logger.error('Single item dry-run sync failed', {
          opmsItemId: parseInt(opmsItemId),
          error: result.error
        });

        return res.status(400).json({
          success: false,
          message: 'Dry-run sync failed',
          error: result.error,
          data: result
        });
      }

    } catch (error) {
      logger.error('Single item dry-run sync error', {
        error: error.message,
        opmsItemId: req.params.opmsItemId,
        stack: error.stack
      });

      return res.status(500).json({
        success: false,
        message: 'Internal server error during dry-run sync',
        error: error.message
      });
    }
  }

  /**
   * Perform dry-run sync for multiple OPMS items
   * POST /api/dry-run/sync/batch
   */
  static async syncBatchItems(req, res) {
    try {
      const { 
        opmsItemIds, 
        syncType = 'batch_sync', 
        syncTrigger = 'manual_batch_test',
        storePayload = true,
        maxConcurrency = 5
      } = req.body;

      if (!Array.isArray(opmsItemIds) || opmsItemIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'opmsItemIds must be a non-empty array'
        });
      }

      logger.info('Starting batch dry-run sync', { 
        itemCount: opmsItemIds.length,
        syncType,
        syncTrigger,
        storePayload,
        maxConcurrency
      });

      const dryRunService = new DryRunSyncService();
      const useProd = await SyncConfigService.isDryRunUseProdEnabled();
      
      const result = await dryRunService.performBatchDryRunSync(opmsItemIds, {
        syncType,
        syncTrigger,
        storePayload,
        envOverride: useProd ? 'prod' : 'sandbox',
        maxConcurrency
      });

      logger.info('Batch dry-run sync completed', {
        totalItems: result.summary.totalItems,
        successfulItems: result.summary.successfulItems,
        failedItems: result.summary.failedItems,
        successRate: result.summary.successRate
      });

      return res.json({
        success: true,
        message: 'Batch dry-run sync completed',
        data: result
      });

    } catch (error) {
      logger.error('Batch dry-run sync error', {
        error: error.message,
        itemCount: req.body.opmsItemIds?.length,
        stack: error.stack
      });

      return res.status(500).json({
        success: false,
        message: 'Internal server error during batch dry-run sync',
        error: error.message
      });
    }
  }

  /**
   * Get stored dry-run payloads
   * GET /api/dry-run/payloads
   */
  static async getStoredPayloads(req, res) {
    try {
      const { 
        opmsItemId, 
        opmsItemCode, 
        syncType, 
        limit = 50,
        includePayload = true 
      } = req.query;

      logger.info('Retrieving stored dry-run payloads', { 
        opmsItemId,
        opmsItemCode,
        syncType,
        limit: parseInt(limit),
        includePayload: includePayload === 'true'
      });

      const dryRunService = new DryRunSyncService();
      
      const result = await dryRunService.getStoredPayloads({
        opmsItemId: opmsItemId ? parseInt(opmsItemId) : undefined,
        opmsItemCode,
        syncType,
        limit: parseInt(limit),
        includePayload: includePayload === 'true'
      });

      logger.info('Retrieved stored dry-run payloads', {
        payloadCount: result.payloads.length,
        statisticsCount: result.statistics.length
      });

      return res.json({
        success: true,
        message: 'Stored payloads retrieved successfully',
        data: result
      });

    } catch (error) {
      logger.error('Get stored payloads error', {
        error: error.message,
        query: req.query,
        stack: error.stack
      });

      return res.status(500).json({
        success: false,
        message: 'Internal server error retrieving stored payloads',
        error: error.message
      });
    }
  }

  /**
   * Get dry-run payload statistics
   * GET /api/dry-run/statistics
   */
  static async getStatistics(req, res) {
    try {
      logger.info('Retrieving dry-run payload statistics');

      const dryRunService = new DryRunSyncService();
      
      const result = await dryRunService.getStoredPayloads({
        limit: 1000 // Get more data for statistics
      });

      logger.info('Retrieved dry-run payload statistics', {
        statisticsCount: result.statistics.length
      });

      return res.json({
        success: true,
        message: 'Statistics retrieved successfully',
        data: {
          statistics: result.statistics,
          summary: {
            totalPayloads: result.payloads.length,
            latestPayload: result.payloads.length > 0 ? result.payloads[0].created_at : null,
            oldestPayload: result.payloads.length > 0 ? result.payloads[result.payloads.length - 1].created_at : null
          }
        }
      });

    } catch (error) {
      logger.error('Get statistics error', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        success: false,
        message: 'Internal server error retrieving statistics',
        error: error.message
      });
    }
  }

  /**
   * Run dry-run sync by item lookup (code, ID, or product name)
   * POST /api/dry-run/sync/by-code
   */
  static async syncByItemCode(req, res) {
    try {
      const { itemCode, syncType = 'manual_test', syncTrigger = 'web_interface', storePayload = true } = req.body;

      if (!itemCode) {
        return res.status(400).json({
          success: false,
          message: 'itemCode (or item ID or product name) is required'
        });
      }

      logger.info('Dry-run sync by lookup', { itemCode, syncType, syncTrigger });

      const db = require('../config/database');
      let items;
      let lookupMethod = '';
      const MAX_ITEMS = 10; // Reasonable limit

      // Try 1: Lookup by item code (exact match - most common)
      [items] = await db.query(
        'SELECT id, code FROM T_ITEM WHERE code = ? AND archived = ? LIMIT 1',
        [itemCode, 'N']
      );

      if (items && items.length > 0) {
        lookupMethod = 'item_code';
      } else if (!isNaN(itemCode)) {
        // Try 2: Lookup by item ID (exact match if numeric)
        [items] = await db.query(
          'SELECT id, code FROM T_ITEM WHERE id = ? AND archived = ? LIMIT 1',
          [parseInt(itemCode), 'N']
        );
        lookupMethod = 'item_id';
      }

      if (!items || items.length === 0) {
        // Try 3: Lookup by product name (partial match - returns multiple)
        [items] = await db.query(
          `SELECT i.id, i.code 
           FROM T_ITEM i 
           JOIN T_PRODUCT p ON i.product_id = p.id 
           WHERE p.name LIKE ? AND i.archived = ? 
           LIMIT ?`,
          [`%${itemCode}%`, 'N', MAX_ITEMS]
        );
        lookupMethod = 'product_name';
      }

      if (!items || items.length === 0) {
        // Try 4: Lookup by vendor name (partial match - returns multiple)
        [items] = await db.query(
          `SELECT i.id, i.code 
           FROM T_ITEM i 
           JOIN T_PRODUCT p ON i.product_id = p.id
           JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
           JOIN Z_VENDOR v ON pv.vendor_id = v.id
           WHERE v.name LIKE ? AND i.archived = ? 
           LIMIT ?`,
          [`%${itemCode}%`, 'N', MAX_ITEMS]
        );
        lookupMethod = 'vendor_name';
      }

      if (!items || items.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Item not found with: ${itemCode}. Try item code (e.g., "8000-1003"), item ID, product name, or vendor name.`
        });
      }

      logger.info('Found items by lookup', { 
        input: itemCode, 
        lookupMethod, 
        itemCount: items.length,
        itemCodes: items.map(i => i.code).join(', ')
      });

      // Run dry-run for ALL matching items
      const dryRunService = new DryRunSyncService();
      const useProd = await SyncConfigService.isDryRunUseProdEnabled();
      const results = [];
      const errors = [];

      for (const item of items) {
        try {
          const result = await dryRunService.performDryRunSync(item.id, {
            syncType,
            syncTrigger,
            storePayload,
            envOverride: useProd ? 'prod' : 'sandbox'
          });
          results.push({
            opmsItemId: item.id,
            itemCode: item.code,
            success: true,
            storedRecordId: result.storedRecordId
          });
        } catch (error) {
          logger.error('Dry-run failed for item', { itemId: item.id, itemCode: item.code, error: error.message });
          errors.push({
            opmsItemId: item.id,
            itemCode: item.code,
            error: error.message
          });
        }
      }

      return res.json({
        success: true,
        message: `Dry-run sync completed for ${results.length} items (found by ${lookupMethod})`,
        data: {
          totalItems: items.length,
          successfulItems: results.length,
          failedItems: errors.length,
          results,
          errors,
          lookup: {
            input: itemCode,
            method: lookupMethod,
            matchedItems: items.length
          }
        }
      });

    } catch (error) {
      logger.error('Error in dry-run sync by lookup', {
        error: error.message,
        itemCode: req.body.itemCode,
        stack: error.stack
      });

      return res.status(500).json({
        success: false,
        message: 'Internal server error during dry-run sync',
        error: error.message
      });
    }
  }

  /**
   * Test dry-run sync with a sample OPMS item
   * POST /api/dry-run/test
   */
  static async testDryRunSync(req, res) {
    try {
      const { 
        opmsItemId = null,
        syncType = 'manual_test', 
        syncTrigger = 'api_test'
      } = req.body;

      // If no item ID provided, find a sample item from OPMS
      let testItemId = opmsItemId;
      if (!testItemId) {
        // Find a sample item from OPMS database using the data transform service
        const dataTransformService = new (require('../services/OpmsDataTransformService'))();
        
        // Use a known test item ID
        testItemId = 43992; // Known test item from our earlier testing
        
        logger.info('Using sample OPMS item for test', {
          testItemId,
          itemCode: 'opmsAPI01',
          productId: 7756
        });
      }

      logger.info('Starting test dry-run sync', { 
        testItemId,
        syncType,
        syncTrigger
      });

      const dryRunService = new DryRunSyncService();
      const useProd = await SyncConfigService.isDryRunUseProdEnabled();
      
      const result = await dryRunService.performDryRunSync(testItemId, {
        syncType,
        syncTrigger,
        storePayload: true,
        envOverride: useProd ? 'prod' : 'sandbox'
      });

      if (result.success) {
        logger.info('Test dry-run sync completed', {
          testItemId,
          payloadSizeBytes: result.payloadMetrics.sizeBytes,
          fieldCount: result.payloadMetrics.fieldCount,
          validationStatus: result.validationResult.status,
          storedRecordId: result.storedRecordId
        });

        return res.json({
          success: true,
          message: 'Test dry-run sync completed successfully',
          data: result
        });
      } else {
        logger.error('Test dry-run sync failed', {
          testItemId,
          error: result.error
        });

        return res.status(400).json({
          success: false,
          message: 'Test dry-run sync failed',
          error: result.error,
          data: result
        });
      }

    } catch (error) {
      logger.error('Test dry-run sync error', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        success: false,
        message: 'Internal server error during test dry-run sync',
        error: error.message
      });
    }
  }

  /**
   * Get/Set dry-run configuration for NetSuite environment override
   */
  static async getDryRunConfig(req, res) {
    try {
      const useProd = await SyncConfigService.isDryRunUseProdEnabled();
      return res.json({
        success: true,
        data: { useProduction: useProd }
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to get dry-run config', error: error.message });
    }
  }

  static async setDryRunConfig(req, res) {
    try {
      const { useProduction } = req.body || {};
      if (typeof useProduction !== 'boolean') {
        return res.status(400).json({ success: false, message: 'useProduction boolean is required' });
      }
      if (useProduction) {
        await SyncConfigService.enableDryRunUseProd();
      } else {
        await SyncConfigService.disableDryRunUseProd();
      }
      return res.json({ success: true, data: { useProduction } });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to set dry-run config', error: error.message });
    }
  }

  /**
   * Serve the dry-run payload viewer web interface
   * GET /api/dry-run/viewer
   */
  static async serveViewer(req, res) {
    try {
      const path = require('path');
      const fs = require('fs');
      
      const viewerPath = path.join(__dirname, '../public/dry-run-viewer.html');
      
      if (fs.existsSync(viewerPath)) {
        res.sendFile(viewerPath);
      } else {
        res.status(404).json({
          success: false,
          message: 'Dry-run viewer not found'
        });
      }
    } catch (error) {
      logger.error('Error serving dry-run viewer', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        success: false,
        message: 'Internal server error serving viewer',
        error: error.message
      });
    }
  }

  /**
   * Delete a specific dry-run payload by ID
   * DELETE /api/dry-run/payloads/:payloadId
   */
  static async deletePayloadById(req, res) {
    try {
      const { payloadId } = req.params;
      const payloadIdNum = parseInt(payloadId);

      if (isNaN(payloadIdNum) || payloadIdNum <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payload ID. Must be a positive integer.'
        });
      }

      logger.info('Deleting dry-run payload', { payloadId: payloadIdNum });

      const dryRunLogModel = new NetSuiteDryRunSyncLogModel();
      const deleted = await dryRunLogModel.deletePayloadById(payloadIdNum);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Dry-run payload not found'
        });
      }

      logger.info('Dry-run payload deleted successfully', { payloadId: payloadIdNum });

      return res.json({
        success: true,
        message: 'Dry-run payload deleted successfully',
        data: { payloadId: payloadIdNum }
      });

    } catch (error) {
      logger.error('Error deleting dry-run payload', {
        error: error.message,
        stack: error.stack,
        payloadId: req.params.payloadId
      });

      return res.status(500).json({
        success: false,
        message: 'Internal server error deleting dry-run payload',
        error: error.message
      });
    }
  }

  /**
   * Delete dry-run payloads by OPMS item ID
   * DELETE /api/dry-run/payloads/by-item/:opmsItemId
   */
  static async deletePayloadsByOpmsItemId(req, res) {
    try {
      const { opmsItemId } = req.params;
      const opmsItemIdNum = parseInt(opmsItemId);

      if (isNaN(opmsItemIdNum) || opmsItemIdNum <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid OPMS item ID. Must be a positive integer.'
        });
      }

      logger.info('Deleting dry-run payloads by OPMS item ID', { opmsItemId: opmsItemIdNum });

      const dryRunLogModel = new NetSuiteDryRunSyncLogModel();
      const deletedCount = await dryRunLogModel.deletePayloadsByOpmsItemId(opmsItemIdNum);

      logger.info('Dry-run payloads deleted by OPMS item ID', { 
        opmsItemId: opmsItemIdNum, 
        deletedCount 
      });

      return res.json({
        success: true,
        message: `Deleted ${deletedCount} dry-run payload(s) for OPMS item ID ${opmsItemIdNum}`,
        data: { opmsItemId: opmsItemIdNum, deletedCount }
      });

    } catch (error) {
      logger.error('Error deleting dry-run payloads by OPMS item ID', {
        error: error.message,
        stack: error.stack,
        opmsItemId: req.params.opmsItemId
      });

      return res.status(500).json({
        success: false,
        message: 'Internal server error deleting dry-run payloads',
        error: error.message
      });
    }
  }

  /**
   * Delete dry-run payloads by sync type
   * DELETE /api/dry-run/payloads/by-type/:syncType
   */
  static async deletePayloadsBySyncType(req, res) {
    try {
      const { syncType } = req.params;

      if (!syncType || typeof syncType !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Invalid sync type. Must be a valid string.'
        });
      }

      logger.info('Deleting dry-run payloads by sync type', { syncType });

      const dryRunLogModel = new NetSuiteDryRunSyncLogModel();
      const deletedCount = await dryRunLogModel.deletePayloadsBySyncType(syncType);

      logger.info('Dry-run payloads deleted by sync type', { 
        syncType, 
        deletedCount 
      });

      return res.json({
        success: true,
        message: `Deleted ${deletedCount} dry-run payload(s) for sync type '${syncType}'`,
        data: { syncType, deletedCount }
      });

    } catch (error) {
      logger.error('Error deleting dry-run payloads by sync type', {
        error: error.message,
        stack: error.stack,
        syncType: req.params.syncType
      });

      return res.status(500).json({
        success: false,
        message: 'Internal server error deleting dry-run payloads',
        error: error.message
      });
    }
  }

  /**
   * Delete all dry-run payloads (use with caution!)
   * DELETE /api/dry-run/payloads/all
   */
  static async deleteAllPayloads(req, res) {
    try {
      logger.warn('Deleting ALL dry-run payloads', { 
        requestedBy: req.ip,
        userAgent: req.get('User-Agent')
      });

      const dryRunLogModel = new NetSuiteDryRunSyncLogModel();
      const deletedCount = await dryRunLogModel.deleteAllPayloads();

      logger.warn('ALL dry-run payloads deleted', { 
        deletedCount,
        requestedBy: req.ip
      });

      return res.json({
        success: true,
        message: `Deleted ALL ${deletedCount} dry-run payload(s)`,
        data: { deletedCount }
      });

    } catch (error) {
      logger.error('Error deleting all dry-run payloads', {
        error: error.message,
        stack: error.stack,
        requestedBy: req.ip
      });

      return res.status(500).json({
        success: false,
        message: 'Internal server error deleting all dry-run payloads',
        error: error.message
      });
    }
  }

  /**
   * Clean up old dry-run payloads
   * DELETE /api/dry-run/payloads/cleanup?days=30
   */
  static async cleanupOldPayloads(req, res) {
    try {
      const daysOld = parseInt(req.query.days) || 30;

      if (isNaN(daysOld) || daysOld < 1) {
        return res.status(400).json({
          success: false,
          message: 'Invalid days parameter. Must be a positive integer.'
        });
      }

      logger.info('Cleaning up old dry-run payloads', { daysOld });

      const dryRunLogModel = new NetSuiteDryRunSyncLogModel();
      const deletedCount = await dryRunLogModel.cleanupOldPayloads(daysOld);

      logger.info('Old dry-run payloads cleaned up', { 
        daysOld, 
        deletedCount 
      });

      return res.json({
        success: true,
        message: `Cleaned up ${deletedCount} dry-run payload(s) older than ${daysOld} days`,
        data: { daysOld, deletedCount }
      });

    } catch (error) {
      logger.error('Error cleaning up old dry-run payloads', {
        error: error.message,
        stack: error.stack,
        daysOld: req.query.days
      });

      return res.status(500).json({
        success: false,
        message: 'Internal server error cleaning up old dry-run payloads',
        error: error.message
      });
    }
  }
}

// Define routes
router.post('/sync/item/:opmsItemId', DryRunSyncController.syncSingleItem);
router.post('/sync/batch', DryRunSyncController.syncBatchItems);
router.get('/payloads', DryRunSyncController.getStoredPayloads);
router.get('/statistics', DryRunSyncController.getStatistics);
router.post('/sync/by-code', DryRunSyncController.syncByItemCode);
router.post('/test', DryRunSyncController.testDryRunSync);
router.get('/viewer', DryRunSyncController.serveViewer);
router.get('/config', DryRunSyncController.getDryRunConfig);
router.post('/config', DryRunSyncController.setDryRunConfig);

// Delete endpoints
router.delete('/payloads/cleanup', DryRunSyncController.cleanupOldPayloads);
router.delete('/payloads/all', DryRunSyncController.deleteAllPayloads);
router.delete('/payloads/by-item/:opmsItemId', DryRunSyncController.deletePayloadsByOpmsItemId);
router.delete('/payloads/by-type/:syncType', DryRunSyncController.deletePayloadsBySyncType);
router.delete('/payloads/:payloadId', DryRunSyncController.deletePayloadById);

module.exports = router;
