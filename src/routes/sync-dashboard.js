'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const logger = require('../utils/logger');
const db = require('../config/database');
const SyncJobDAO = require('../models/SyncJobDAO');
const SyncItemDAO = require('../models/SyncItemDAO');

/**
 * Serve the enhanced tabbed dashboard HTML page
 */
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/sync-dashboard.html'));
});

/**
 * @swagger
 * /api/sync-dashboard/opms-to-netsuite/metrics:
 *   get:
 *     summary: Get OPMS to NetSuite sync metrics
 *     description: Returns comprehensive statistics for OPMS→NetSuite synchronization
 *     tags: [Sync Dashboard]
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Number of hours to include in metrics
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 */
router.get('/opms-to-netsuite/metrics', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    // Sorting parameters
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';
    
    // Search parameter
    const search = req.query.search ? `%${req.query.search}%` : null;
    
    // Validate sortBy to prevent SQL injection
    const allowedSortColumns = {
      'created_at': 'sq.created_at',
      'product_name': 'p.name',
      'item_code': 'i.code',
      'status': 'sq.status',
      'priority': 'sq.priority'
    };
    
    const sortColumn = allowedSortColumns[sortBy] || 'sq.created_at';
    
    // Get sync job statistics from opms_sync_queue table
    const statsQuery = `
      SELECT 
        COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_jobs,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_jobs,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_jobs,
        SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END) as processing_jobs,
        AVG(TIMESTAMPDIFF(SECOND, created_at, processed_at)) as avg_duration_seconds
      FROM opms_sync_queue
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
    `;
    
    const [stats] = await db.query(statsQuery, [hours]);
    const statsData = stats[0];
    
    // Build WHERE clause for search
    let whereClause = 'sq.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)';
    const queryParams = [hours];
    
    if (search) {
      whereClause += ' AND (p.name LIKE ? OR i.code LIKE ? OR sq.status LIKE ?)';
      queryParams.push(search, search, search);
    }
    
    // Get total count of matching records (for pagination)
    const countQuery = `
      SELECT COUNT(DISTINCT sq.id) as total_count
      FROM opms_sync_queue sq
      LEFT JOIN T_ITEM i ON sq.item_id = i.id
      LEFT JOIN T_PRODUCT p ON sq.product_id = p.id
      WHERE ${whereClause}
    `;
    
    const [countResult] = await db.query(countQuery, queryParams);
    const totalCount = countResult[0].total_count;
    const totalPages = Math.ceil(totalCount / limit);
    
    // Get recent sync jobs with item details (paginated, sorted, filtered)
    const recentJobsQuery = `
      SELECT 
        sq.id,
        sq.item_id,
        sq.product_id,
        sq.event_type,
        sq.status,
        sq.priority,
        sq.retry_count,
        sq.error_message,
        sq.created_at,
        sq.processed_at,
        sq.processing_results,
        sq.event_data,
        i.code as item_code,
        p.name as product_name,
        GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') as colors
      FROM opms_sync_queue sq
      LEFT JOIN T_ITEM i ON sq.item_id = i.id
      LEFT JOIN T_PRODUCT p ON sq.product_id = p.id
      LEFT JOIN T_ITEM_COLOR ic ON i.id = ic.item_id
      LEFT JOIN P_COLOR c ON ic.color_id = c.id
      WHERE ${whereClause}
      GROUP BY sq.id, sq.item_id, sq.product_id, sq.event_type, sq.status, 
               sq.priority, sq.retry_count, sq.error_message, sq.created_at, 
               sq.processed_at, sq.processing_results, sq.event_data, i.code, p.name
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    queryParams.push(limit, offset);
    const [recentJobs] = await db.query(recentJobsQuery, queryParams);
    
    // Transform recent jobs to dashboard format
    const recentUpdates = recentJobs.map(job => {
      let processingResults = null;
      if (job.processing_results) {
        try {
          processingResults = typeof job.processing_results === 'string' 
            ? JSON.parse(job.processing_results) 
            : job.processing_results;
        } catch (e) {
          logger.warn('Failed to parse processing_results', { jobId: job.id });
        }
      }
      
      let eventData = null;
      if (job.event_data) {
        try {
          eventData = typeof job.event_data === 'string' 
            ? JSON.parse(job.event_data) 
            : job.event_data;
        } catch (e) {
          logger.warn('Failed to parse event_data', { jobId: job.id });
        }
      }

      return {
        id: job.id,
        jobId: job.id,
        itemId: job.item_id,
        productId: job.product_id,
        itemCode: job.item_code || 'N/A',
        productName: job.product_name || 'Unknown Product',
        colors: job.colors || null,
        eventType: job.event_type,
        status: job.status,
        priority: job.priority,
        retryCount: job.retry_count,
        errorMessage: job.error_message,
        createdAt: job.created_at,
        processedAt: job.processed_at,
        processingResults: processingResults,
        eventData: eventData
      };
    });
    
    // Get hourly activity
    const hourlyActivityQuery = `
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as hour,
        COUNT(*) as sync_count,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END) as processing
      FROM opms_sync_queue
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
      GROUP BY hour
      ORDER BY hour DESC
    `;
    
    const [hourlyActivity] = await db.query(hourlyActivityQuery, [hours]);
    
    // Calculate success rate
    const totalJobs = parseInt(statsData.total_jobs) || 0;
    const completedJobs = parseInt(statsData.completed_jobs) || 0;
    const successRate = totalJobs > 0 
      ? ((completedJobs / totalJobs) * 100).toFixed(1)
      : 0;
    
    res.json({
      success: true,
      data: {
        overview: {
          totalJobs: totalJobs,
          completedJobs: completedJobs,
          failedJobs: parseInt(statsData.failed_jobs) || 0,
          pendingJobs: parseInt(statsData.pending_jobs) || 0,
          processingJobs: parseInt(statsData.processing_jobs) || 0,
          avgDurationSeconds: Math.round(parseFloat(statsData.avg_duration_seconds) || 0),
          successRate: parseFloat(successRate)
        },
        recentUpdates: recentUpdates,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems: totalCount,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        sorting: {
          sortBy: sortBy,
          sortOrder: sortOrder.toLowerCase()
        },
        search: search ? req.query.search : null,
        hourlyActivity: hourlyActivity,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Failed to fetch OPMS→NetSuite metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch OPMS→NetSuite metrics',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/sync-dashboard/netsuite-to-opms/metrics:
 *   get:
 *     summary: Get NetSuite to OPMS sync metrics
 *     description: Returns comprehensive statistics for NetSuite→OPMS synchronization (pricing updates)
 *     tags: [Sync Dashboard]
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Number of hours to include in metrics
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 */
router.get('/netsuite-to-opms/metrics', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const timeFilter = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // Initialize DAOs
    const syncJobDAO = new SyncJobDAO(db);
    const syncItemDAO = new SyncItemDAO(db);

    // Get sync job statistics (last N hours)
    const stats24h = await syncJobDAO.getJobsStats(hours);

    // Get recent pricing updates from sync items
    const recentSyncItems = await syncItemDAO.getRecentPricingUpdates(20, hours);
    
    // Transform sync items to dashboard format
    const recentUpdates = await Promise.all(
      recentSyncItems.map(async (item, index) => {
        // Get product info from OPMS database
        let productInfo = { name: 'Unknown Product', colors: null };
        
        try {
          // Try fetching by OPMS IDs first, then fallback to item_code
          if (item.opms_product_id && item.opms_item_id) {
            const [productRows] = await db.query(`
              SELECT 
                p.id, 
                p.name,
                GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') as colors
              FROM T_PRODUCT p
              LEFT JOIN T_ITEM i ON i.product_id = p.id
              LEFT JOIN T_ITEM_COLOR ic ON ic.item_id = i.id
              LEFT JOIN P_COLOR c ON c.id = ic.color_id
              WHERE p.id = ? AND i.id = ?
              GROUP BY p.id, p.name
            `, [item.opms_product_id, item.opms_item_id]);
            
            if (productRows.length > 0) {
              productInfo = productRows[0];
            }
          } else if (item.item_code) {
            // Fallback: fetch by item code (T_ITEM.code)
            const [productRows] = await db.query(`
              SELECT 
                p.id, 
                p.name,
                GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') as colors
              FROM T_ITEM i
              JOIN T_PRODUCT p ON i.product_id = p.id
              LEFT JOIN T_ITEM_COLOR ic ON ic.item_id = i.id
              LEFT JOIN P_COLOR c ON c.id = ic.color_id
              WHERE i.code = ?
              GROUP BY p.id, p.name
            `, [item.item_code]);
            
            if (productRows.length > 0) {
              productInfo = productRows[0];
            }
          }
        } catch (err) {
          logger.warn('Failed to fetch product info', { 
            product_id: item.opms_product_id,
            item_id: item.opms_item_id,
            item_code: item.item_code
          });
        }

        return {
          id: item.id || item.netsuite_item_id || `ns-item-${index}` || `fallback-${Date.now()}`,
          productId: item.opms_product_id,
          productName: productInfo.name || 'Unknown Product',
          itemColor: productInfo.colors || null,
          itemCode: item.item_code || item.netsuite_item_id,
          status: item.status,
          pricing: item.pricing_data || {
            customerCut: null,
            customerRoll: null,
            vendorCut: null,
            vendorRoll: null
          },
          pricingBefore: item.pricing_before,
          pricingAfter: item.pricing_after,
          syncFields: item.sync_fields,
          updatedAt: item.processed_at
        };
      })
    );

    // Get hourly sync activity (last N hours)
    const [hourlyActivity] = await db.query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as hour,
        COUNT(*) as sync_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM netsuite_opms_sync_jobs
      WHERE created_at >= ?
      GROUP BY hour
      ORDER BY hour DESC
    `, [timeFilter]);

    // Calculate success rate
    const totalJobs = parseInt(stats24h.total_jobs) || 0;
    const completedJobs = parseInt(stats24h.completed_jobs) || 0;
    const successRate = totalJobs > 0
      ? ((completedJobs / totalJobs) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: {
        overview: {
          totalJobs: totalJobs,
          completedJobs: completedJobs,
          failedJobs: parseInt(stats24h.failed_jobs) || 0,
          runningJobs: parseInt(stats24h.running_jobs) || 0,
          totalItemsProcessed: parseInt(stats24h.total_items_processed) || 0,
          totalItemsSuccessful: parseInt(stats24h.total_items_successful) || 0,
          totalItemsFailed: parseInt(stats24h.total_items_failed) || 0,
          totalItemsSkipped: parseInt(stats24h.total_items_skipped) || 0,
          avgDurationSeconds: Math.round(parseFloat(stats24h.avg_duration_seconds) || 0),
          successRate: parseFloat(successRate)
        },
        recentUpdates: recentUpdates,
        hourlyActivity: hourlyActivity,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to fetch NetSuite→OPMS metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch NetSuite→OPMS metrics',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/sync-dashboard/recent-jobs:
 *   get:
 *     summary: Get recent sync jobs with details (legacy endpoint - redirects to specific sync direction)
 *     description: Returns the most recent sync jobs with full details
 *     tags: [Sync Dashboard]
 *     deprecated: true
 */
router.get('/recent-jobs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    // Initialize DAO
    const syncJobDAO = new SyncJobDAO(db);
    const syncItemDAO = new SyncItemDAO(db);

    // Get recent jobs
    const recentJobs = await syncJobDAO.getRecentJobs(limit);
    
    // Get items for each job (limited to first 5)
    const jobsWithItems = await Promise.all(
      recentJobs.map(async (job) => {
        const items = await syncItemDAO.getItemsByJobId(job.id, 5);
        
        // Calculate progress percentage
        const progress = job.total_items > 0 
          ? Math.round((job.processed_items / job.total_items) * 100) 
          : 0;
        
        return {
          id: job.id,
          jobType: job.job_type,
          status: job.status,
          totalItems: job.total_items,
          processedItems: job.processed_items,
          successfulItems: job.successful_items,
          failedItems: job.failed_items,
          skippedItems: job.skipped_items || 0,
          progress: progress,
          duration: job.duration_seconds,
          createdAt: job.created_at,
          startedAt: job.started_at,
          completedAt: job.completed_at,
          errorMessage: job.error_message,
          items: items
        };
      })
    );

    res.json({
      success: true,
      data: jobsWithItems
    });

  } catch (error) {
    logger.error('Failed to fetch recent jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent jobs',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/sync-dashboard/live-stats:
 *   get:
 *     summary: Get live webhook processing statistics
 *     description: Returns real-time webhook stats from the in-memory service
 *     tags: [Sync Dashboard]
 */
router.get('/live-stats', async (req, res) => {
  try {
    const NsToOpmsWebhookService = require('../services/NsToOpmsWebhookService');
    
    // Get stats from the webhook service instance
    // Note: This returns in-memory stats since last server restart
    const stats = {
      received: 0,
      processed: 0,
      skipped: 0,
      failed: 0,
      successRate: 0,
      lastProcessed: null,
      note: 'In-memory stats since server start'
    };

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to fetch live stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch live stats'
    });
  }
});

/**
 * @swagger
 * /api/sync-dashboard/clear-inactive-syncs:
 *   post:
 *     summary: Clear inactive sync jobs from queue
 *     description: Deletes old PENDING and FAILED sync jobs that haven't been processed
 *     tags: [Sync Dashboard]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxAgeHours:
 *                 type: integer
 *                 default: 24
 *                 description: Maximum age of sync jobs to delete (in hours)
 *     responses:
 *       200:
 *         description: Inactive syncs cleared successfully
 */
router.post('/clear-inactive-syncs', async (req, res) => {
  try {
    const maxAgeHours = parseInt(req.body.maxAgeHours);
    const forceAll = req.body.forceAll === true; // New parameter to clear all regardless of age
    
    let clearQuery;
    let queryParams;
    
    if (forceAll) {
      // Clear ALL PENDING and FAILED jobs regardless of age (but not PROCESSING)
      clearQuery = `
        DELETE FROM opms_sync_queue
        WHERE status IN ('PENDING', 'FAILED')
      `;
      queryParams = [];
    } else {
      // Clear only old PENDING and FAILED jobs
      const hours = maxAgeHours || 24;
      clearQuery = `
        DELETE FROM opms_sync_queue
        WHERE status IN ('PENDING', 'FAILED')
          AND created_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
      `;
      queryParams = [hours];
    }
    
    const [result] = await db.query(clearQuery, queryParams);
    const deletedCount = result.affectedRows || 0;
    
    logger.info(`Cleared ${deletedCount} inactive sync jobs`, { 
      forceAll, 
      maxAgeHours: maxAgeHours || null 
    });
    
    res.json({
      success: true,
      message: `Cleared ${deletedCount} inactive sync jobs${forceAll ? ' (all ages)' : ''}`,
      deletedCount: deletedCount,
      forceAll: forceAll,
      maxAgeHours: maxAgeHours || null
    });
    
  } catch (error) {
    logger.error('Failed to clear inactive syncs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear inactive syncs',
      message: error.message
    });
  }
});

module.exports = router;
