'use strict';

const logger = require('../utils/logger');
const NetsuiteToOpmsSyncService = require('../services/NetsuiteToOpmsSyncService');

class NetsuiteToOpmsSyncController {
  constructor() {
    this.syncService = new NetsuiteToOpmsSyncService();
  }

  /**
   * Start initial bulk sync from NetSuite to OPMS
   * POST /api/sync/netsuite-to-opms/initial
   */
  async startInitialSync(req, res) {
    try {
      logger.info('Initial sync request received');
      
      const result = await this.syncService.startInitialSync();
      
      res.status(200).json({
        success: true,
        message: 'Initial sync started successfully',
        data: result
      });
    } catch (error) {
      logger.error('Failed to start initial sync:', error);
      
      res.status(400).json({
        success: false,
        message: 'Failed to start initial sync',
        error: error.message
      });
    }
  }

  /**
   * Get initial sync status
   * GET /api/sync/netsuite-to-opms/initial/status
   */
  async getInitialSyncStatus(req, res) {
    try {
      // Find the most recent initial sync job
      const { NetsuiteOpmsSyncJob } = require('../models');
      
      const latestJob = await NetsuiteOpmsSyncJob.findOne({
        where: { job_type: 'initial' },
        order: [['created_at', 'DESC']]
      });

      if (!latestJob) {
        return res.status(404).json({
          success: false,
          message: 'No initial sync job found'
        });
      }

      const status = await this.syncService.getSyncJobStatus(latestJob.id);
      
      res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Failed to get initial sync status:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get initial sync status',
        error: error.message
      });
    }
  }

  /**
   * Sync a single item from NetSuite to OPMS
   * POST /api/sync/netsuite-to-opms/item/:itemId
   */
  async syncSingleItem(req, res) {
    try {
      const { itemId } = req.params;
      
      if (!itemId) {
        return res.status(400).json({
          success: false,
          message: 'Item ID is required'
        });
      }

      logger.info(`Single item sync request received for item: ${itemId}`);

      // Create a sync job for this single item
      const { NetsuiteOpmsSyncJob } = require('../models');
      
      const syncJob = await NetsuiteOpmsSyncJob.create({
        job_type: 'item',
        status: 'pending',
        total_items: 1
      });

      // Get the item from NetSuite and sync it
      try {
        await syncJob.markStarted();
        
        // Fetch item from NetSuite
        const netsuiteItem = await this.syncService.netsuiteClient.getItem(itemId);
        
        if (!netsuiteItem) {
          throw new Error(`NetSuite item ${itemId} not found`);
        }

        // Sync the item
        await this.syncService.syncSingleItem(netsuiteItem, syncJob.id);
        
        await syncJob.updateProgress(1, 1, 0);
        await syncJob.markCompleted();
        
        res.status(200).json({
          success: true,
          message: `Item ${itemId} synced successfully`,
          data: {
            jobId: syncJob.id,
            itemId: itemId,
            status: 'completed'
          }
        });
      } catch (error) {
        await syncJob.updateProgress(1, 0, 1);
        await syncJob.markFailed(error.message);
        throw error;
      }
    } catch (error) {
      logger.error(`Failed to sync single item ${req.params.itemId}:`, error);
      
      res.status(400).json({
        success: false,
        message: 'Failed to sync item',
        error: error.message
      });
    }
  }

  /**
   * Get single item sync status
   * GET /api/sync/netsuite-to-opms/item/:itemId/status
   */
  async getSingleItemSyncStatus(req, res) {
    try {
      const { itemId } = req.params;
      
      if (!itemId) {
        return res.status(400).json({
          success: false,
          message: 'Item ID is required'
        });
      }

      // Find sync jobs for this item
      const { NetsuiteOpmsSyncItem } = require('../models');
      
      const syncItems = await NetsuiteOpmsSyncItem.findAll({
        where: { netsuite_item_id: itemId },
        include: [{
          model: require('../models').NetsuiteOpmsSyncJob,
          as: 'syncJob'
        }],
        order: [['created_at', 'DESC']],
        limit: 5
      });

      if (syncItems.length === 0) {
        return res.status(404).json({
          success: false,
          message: `No sync history found for item ${itemId}`
        });
      }

      const status = syncItems.map(item => ({
        syncId: item.id,
        jobId: item.sync_job_id,
        status: item.status,
        syncFields: item.sync_fields,
        errorMessage: item.error_message,
        processedAt: item.processed_at,
        createdAt: item.created_at,
        jobType: item.syncJob?.job_type
      }));

      res.status(200).json({
        success: true,
        data: {
          itemId: itemId,
          syncHistory: status
        }
      });
    } catch (error) {
      logger.error(`Failed to get single item sync status for ${req.params.itemId}:`, error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get item sync status',
        error: error.message
      });
    }
  }

  /**
   * Manual sync trigger
   * POST /api/sync/netsuite-to-opms/manual
   */
  async manualSync(req, res) {
    try {
      const { syncType, itemIds, filters } = req.body;
      
      logger.info('Manual sync request received', { syncType, itemIds, filters });

      let result;
      
      switch (syncType) {
        case 'initial':
          result = await this.syncService.startInitialSync();
          break;
          
        case 'specific_items':
          if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
            return res.status(400).json({
              success: false,
              message: 'itemIds array is required for specific_items sync'
            });
          }
          
          // Create a manual sync job for specific items
          const { NetsuiteOpmsSyncJob } = require('../models');
          
          const syncJob = await NetsuiteOpmsSyncJob.create({
            job_type: 'manual',
            status: 'pending',
            total_items: itemIds.length
          });

          // Process items asynchronously
          this.processManualSync(syncJob, itemIds).catch(error => {
            logger.error(`Manual sync job ${syncJob.id} failed:`, error);
            syncJob.markFailed(error.message).catch(logger.error);
          });

          result = {
            jobId: syncJob.id,
            status: 'started',
            message: `Manual sync started for ${itemIds.length} items`
          };
          break;
          
        case 'changed_since':
          if (!filters || !filters.lastModifiedDate) {
            return res.status(400).json({
              success: false,
              message: 'lastModifiedDate filter is required for changed_since sync'
            });
          }
          
          // This would implement a sync based on NetSuite's lastmodifieddate
          // For now, return a placeholder
          result = {
            status: 'not_implemented',
            message: 'Changed since sync not yet implemented'
          };
          break;
          
        default:
          return res.status(400).json({
            success: false,
            message: `Invalid sync type: ${syncType}. Valid types: initial, specific_items, changed_since`
          });
      }

      res.status(200).json({
        success: true,
        message: 'Manual sync request processed',
        data: result
      });
    } catch (error) {
      logger.error('Failed to process manual sync request:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to process manual sync request',
        error: error.message
      });
    }
  }

  /**
   * Force full sync (overrides running jobs)
   * POST /api/sync/netsuite-to-opms/force-full
   */
  async forceFullSync(req, res) {
    try {
      logger.info('Force full sync request received');

      // Cancel any running sync jobs
      const { NetsuiteOpmsSyncJob } = require('../models');
      
      const runningJobs = await NetsuiteOpmsSyncJob.findAll({
        where: { status: 'running' }
      });

      for (const job of runningJobs) {
        await job.markCancelled();
        await job.addLog('warn', 'Job cancelled due to force full sync request');
      }

      // Start new initial sync
      const result = await this.syncService.startInitialSync();
      
      res.status(200).json({
        success: true,
        message: 'Force full sync started successfully',
        data: {
          ...result,
          cancelledJobs: runningJobs.length
        }
      });
    } catch (error) {
      logger.error('Failed to start force full sync:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to start force full sync',
        error: error.message
      });
    }
  }

  /**
   * Get overall sync status
   * GET /api/sync/netsuite-to-opms/status
   */
  async getOverallStatus(req, res) {
    try {
      const status = await this.syncService.getOverallSyncStatus();
      
      res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Failed to get overall sync status:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get overall sync status',
        error: error.message
      });
    }
  }

  /**
   * Get sync operation logs
   * GET /api/sync/netsuite-to-opms/logs
   */
  async getSyncLogs(req, res) {
    try {
      const { jobId, level, limit = 100, offset = 0 } = req.query;
      
      const { NetsuiteOpmsSyncLog } = require('../models');
      
      const whereClause = {};
      if (jobId) whereClause.sync_job_id = jobId;
      if (level) whereClause.log_level = level;

      const logs = await NetsuiteOpmsSyncLog.findAll({
        where: whereClause,
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.status(200).json({
        success: true,
        data: {
          logs: logs.map(log => ({
            id: log.id,
            jobId: log.sync_job_id,
            level: log.log_level,
            message: log.message,
            details: log.details,
            createdAt: log.created_at
          })),
          total: logs.length,
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    } catch (error) {
      logger.error('Failed to get sync logs:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get sync logs',
        error: error.message
      });
    }
  }

  /**
   * Health check endpoint
   * GET /api/sync/netsuite-to-opms/health
   */
  async healthCheck(req, res) {
    try {
      // Check database connectivity
      const { NetsuiteOpmsSyncJob } = require('../models');
      await NetsuiteOpmsSyncJob.count();

      // Check NetSuite connectivity
      const netsuiteHealth = await this.syncService.netsuiteClient.testConnection();

      res.status(200).json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          database: 'connected',
          netsuite: netsuiteHealth ? 'connected' : 'disconnected'
        }
      });
    } catch (error) {
      logger.error('Health check failed:', error);
      
      res.status(503).json({
        success: false,
        data: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message
        }
      });
    }
  }

  /**
   * Process manual sync for specific items
   */
  async processManualSync(syncJob, itemIds) {
    try {
      await syncJob.markStarted();
      await syncJob.addLog('info', `Manual sync started for ${itemIds.length} items`);

      let processed = 0;
      let successful = 0;
      let failed = 0;

      for (const itemId of itemIds) {
        try {
          // Fetch item from NetSuite
          const netsuiteItem = await this.syncService.netsuiteClient.getItem(itemId);
          
          if (!netsuiteItem) {
            throw new Error(`NetSuite item ${itemId} not found`);
          }

          // Sync the item
          await this.syncService.syncSingleItem(netsuiteItem, syncJob.id);
          successful++;
        } catch (error) {
          logger.error(`Failed to sync item ${itemId}:`, error.message);
          failed++;
          
          await syncJob.addLog('error', `Failed to sync item ${itemId}: ${error.message}`, {
            itemId: itemId,
            error: error.message
          });
        }
        
        processed++;
        
        // Update progress
        if (processed % 10 === 0) {
          await syncJob.updateProgress(processed, successful, failed);
        }

        // Rate limiting
        await this.syncService.delay(this.syncService.config.rateLimitDelayMs);
      }

      // Final progress update
      await syncJob.updateProgress(processed, successful, failed);
      await syncJob.addLog('info', `Manual sync completed: ${successful} successful, ${failed} failed`);
      
      await syncJob.markCompleted();
      
      logger.info(`Manual sync job ${syncJob.id} completed successfully`);
    } catch (error) {
      logger.error(`Manual sync job ${syncJob.id} failed:`, error);
      await syncJob.markFailed(error.message);
      throw error;
    }
  }
}

module.exports = NetsuiteToOpmsSyncController;
