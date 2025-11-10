/**
 * OPMS-to-NetSuite Sync Routes
 * API routes for managing OPMS-to-NetSuite synchronization
 */

const express = require('express');
const router = express.Router();
const syncController = require('../controllers/OpmsNetSuiteSyncController');
const logger = require('../utils/logger');

// Middleware for request logging
router.use((req, res, next) => {
    logger.info('OPMS Sync API request', {
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    next();
});

// ============================================================================
// SERVICE STATUS & MONITORING ROUTES
// ============================================================================

/**
 * @swagger
 * /api/opms-sync/status:
 *   get:
 *     summary: Get sync service status
 *     description: Returns comprehensive status of the OPMS-to-NetSuite sync service
 *     tags: [OPMS Sync]
 *     responses:
 *       200:
 *         description: Service status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     service:
 *                       type: object
 *                     configuration:
 *                       type: object
 *                     change_detection:
 *                       type: object
 *                     queue_processing:
 *                       type: object
 *       500:
 *         description: Failed to get service status
 */
router.get('/status', syncController.getStatus.bind(syncController));

/**
 * @swagger
 * /api/opms-sync/health:
 *   get:
 *     summary: Get detailed health check
 *     description: Performs comprehensive health check of all sync components
 *     tags: [OPMS Sync]
 *     responses:
 *       200:
 *         description: Health check completed (service healthy or degraded)
 *       503:
 *         description: Service unhealthy
 */
router.get('/health', syncController.getHealth.bind(syncController));

/**
 * @swagger
 * /api/opms-sync/stats:
 *   get:
 *     summary: Get sync statistics
 *     description: Returns sync performance statistics for specified time period
 *     tags: [OPMS Sync]
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Number of hours to include in statistics
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get('/stats', syncController.getStats.bind(syncController));

/**
 * @swagger
 * /api/opms-sync/activity:
 *   get:
 *     summary: Get recent sync activity
 *     description: Returns recent sync changes and job activity
 *     tags: [OPMS Sync]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of activities to return
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Number of hours to look back
 *     responses:
 *       200:
 *         description: Activity retrieved successfully
 */
router.get('/activity', syncController.getActivity.bind(syncController));

// ============================================================================
// QUEUE MANAGEMENT ROUTES
// ============================================================================

/**
 * @swagger
 * /api/opms-sync/queue:
 *   get:
 *     summary: Get sync queue status
 *     description: Returns current sync queue statistics and status
 *     tags: [OPMS Sync]
 *     responses:
 *       200:
 *         description: Queue status retrieved successfully
 */
router.get('/queue', syncController.getQueueStatus.bind(syncController));

/**
 * @swagger
 * /api/opms-sync/job-status/:jobId:
 *   get:
 *     summary: Get status of a specific sync job
 *     description: Returns detailed status, progress, and result of a sync job by ID
 *     tags: [OPMS Sync]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Sync job ID
 *     responses:
 *       200:
 *         description: Job status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     status:
 *                       type: string
 *                       enum: [PENDING, PROCESSING, COMPLETED, FAILED]
 *                     item_id:
 *                       type: integer
 *                     product_id:
 *                       type: integer
 *                     created_at:
 *                       type: string
 *                     started_at:
 *                       type: string
 *                     completed_at:
 *                       type: string
 *                     error_message:
 *                       type: string
 *                     retry_count:
 *                       type: integer
 *       404:
 *         description: Job not found
 *       500:
 *         description: Failed to get job status
 */
router.get('/job-status/:jobId', syncController.getJobStatus.bind(syncController));

// ============================================================================
// MANUAL SYNC TRIGGER ROUTES
// ============================================================================

/**
 * @swagger
 * /api/opms-sync/trigger-item:
 *   post:
 *     summary: Manually trigger sync for an item
 *     description: Queue a specific OPMS item for immediate synchronization to NetSuite
 *     tags: [OPMS Sync]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - itemId
 *             properties:
 *               itemId:
 *                 type: integer
 *                 description: OPMS Item ID to sync
 *               reason:
 *                 type: string
 *                 default: "Manual API trigger"
 *                 description: Reason for manual sync
 *               priority:
 *                 type: string
 *                 enum: [HIGH, NORMAL, LOW]
 *                 default: HIGH
 *                 description: Sync priority level
 *     responses:
 *       200:
 *         description: Item queued for sync successfully
 *       400:
 *         description: Invalid request (missing itemId)
 *       404:
 *         description: Item not found or not syncable
 *       500:
 *         description: Failed to queue item for sync
 */
router.post('/trigger-item', syncController.triggerItemSync.bind(syncController));

/**
 * @swagger
 * /api/opms-sync/trigger-item-by-code:
 *   post:
 *     summary: Manually trigger sync for an item by its code
 *     description: Queue an OPMS item for synchronization to NetSuite using its item code
 *     tags: [OPMS Sync]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - itemCode
 *             properties:
 *               itemCode:
 *                 type: string
 *                 description: OPMS Item Code (T_ITEM.code) to sync
 *               reason:
 *                 type: string
 *                 default: "Manual API trigger by code"
 *                 description: Reason for manual sync
 *               priority:
 *                 type: string
 *                 enum: [HIGH, NORMAL, LOW]
 *                 default: HIGH
 *                 description: Sync priority level
 *     responses:
 *       200:
 *         description: Item queued for sync successfully
 *       400:
 *         description: Invalid request (missing itemCode)
 *       404:
 *         description: Item not found or not syncable
 *       500:
 *         description: Failed to queue item for sync
 */
router.post('/trigger-item-by-code', syncController.triggerItemSyncByCode.bind(syncController));

/**
 * @swagger
 * /api/opms-sync/trigger-product:
 *   post:
 *     summary: Manually trigger sync for all items in a product
 *     description: Queue all items in an OPMS product for synchronization to NetSuite
 *     tags: [OPMS Sync]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *             properties:
 *               productId:
 *                 type: integer
 *                 description: OPMS Product ID to sync
 *               reason:
 *                 type: string
 *                 default: "Manual API product trigger"
 *                 description: Reason for manual sync
 *               priority:
 *                 type: string
 *                 enum: [HIGH, NORMAL, LOW]
 *                 default: NORMAL
 *                 description: Sync priority level
 *     responses:
 *       200:
 *         description: Product items queued for sync successfully
 *       400:
 *         description: Invalid request (missing productId)
 *       404:
 *         description: Product not found or no syncable items
 *       500:
 *         description: Failed to queue product items for sync
 */
router.post('/trigger-product', syncController.triggerProductSync.bind(syncController));

/**
 * @swagger
 * /api/opms-sync/trigger-batch-resync:
 *   post:
 *     summary: Trigger batch re-sync of all valid code items
 *     description: Starts a batch re-sync of all OPMS items with valid "nnnn-nnnn" code format and vendor data
 *     tags: [OPMS Sync]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               priority:
 *                 type: string
 *                 enum: [HIGH, NORMAL, LOW]
 *                 default: NORMAL
 *               batchSize:
 *                 type: integer
 *                 default: 50
 *               delay:
 *                 type: integer
 *                 default: 1000
 *     responses:
 *       200:
 *         description: Batch re-sync started successfully
 *       500:
 *         description: Failed to start batch re-sync
 */
router.post('/trigger-batch-resync', syncController.triggerBatchResync.bind(syncController));

/**
 * @swagger
 * /api/opms-sync/stop-batch-resync:
 *   post:
 *     summary: Stop batch re-sync gracefully
 *     description: Stops the batch re-sync after the current batch completes
 *     tags: [OPMS Sync]
 *     responses:
 *       200:
 *         description: Batch re-sync stop requested successfully
 *       500:
 *         description: Failed to stop batch re-sync
 */
router.post('/stop-batch-resync', syncController.stopBatchResync.bind(syncController));

/**
 * @swagger
 * /api/opms-sync/batch-resync-status:
 *   get:
 *     summary: Get batch re-sync status
 *     description: Returns the current status of the batch re-sync process
 *     tags: [OPMS Sync]
 *     responses:
 *       200:
 *         description: Batch re-sync status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     running:
 *                       type: boolean
 *                     totalItems:
 *                       type: integer
 *                     queued:
 *                       type: integer
 *                     skipped:
 *                       type: integer
 *                     failed:
 *                       type: integer
 */
router.get('/batch-resync-status', syncController.getBatchResyncStatus.bind(syncController));

// ============================================================================
// VALIDATION & TESTING ROUTES
// ============================================================================

/**
 * @swagger
 * /api/opms-sync/validate-item:
 *   post:
 *     summary: Validate item for sync (test only)
 *     description: Test item transformation without actually syncing to NetSuite
 *     tags: [OPMS Sync]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - itemId
 *             properties:
 *               itemId:
 *                 type: integer
 *                 description: OPMS Item ID to validate
 *     responses:
 *       200:
 *         description: Item validation completed successfully
 *       400:
 *         description: Invalid request or item not syncable
 *       404:
 *         description: Item not found
 *       500:
 *         description: Validation failed
 */
router.post('/validate-item', syncController.validateItem.bind(syncController));

/**
 * @swagger
 * /api/opms-sync/validation-issues:
 *   get:
 *     summary: Get items with validation issues
 *     description: Returns items that have field validation problems
 *     tags: [OPMS Sync]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of items to return
 *     responses:
 *       200:
 *         description: Validation issues retrieved successfully
 */
router.get('/validation-issues', syncController.getValidationIssues.bind(syncController));

// ============================================================================
// SERVICE CONTROL ROUTES
// ============================================================================

/**
 * @swagger
 * /api/opms-sync/pause:
 *   post:
 *     summary: Pause sync processing
 *     description: Temporarily pause the sync queue processing
 *     tags: [OPMS Sync]
 *     responses:
 *       200:
 *         description: Sync processing paused successfully
 *       500:
 *         description: Failed to pause sync processing
 */
router.post('/pause', syncController.pauseSync.bind(syncController));

/**
 * @swagger
 * /api/opms-sync/resume:
 *   post:
 *     summary: Resume sync processing
 *     description: Resume the sync queue processing
 *     tags: [OPMS Sync]
 *     responses:
 *       200:
 *         description: Sync processing resumed successfully
 *       500:
 *         description: Failed to resume sync processing
 */
router.post('/resume', syncController.resumeSync.bind(syncController));

/**
 * @swagger
 * /api/opms-sync/restart:
 *   post:
 *     summary: Restart sync service
 *     description: Restart the entire sync service (requires confirmation)
 *     tags: [OPMS Sync]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - confirm
 *             properties:
 *               confirm:
 *                 type: string
 *                 enum: [RESTART_SYNC_SERVICE]
 *                 description: Confirmation string required for restart
 *     responses:
 *       200:
 *         description: Sync service restart initiated
 *       400:
 *         description: Missing or invalid confirmation
 *       500:
 *         description: Failed to restart sync service
 */
router.post('/restart', syncController.restartSync.bind(syncController));

/**
 * @swagger
 * /api/opms-sync/cancel-job:
 *   post:
 *     summary: Cancel a pending OPMS-to-NetSuite sync job
 *     description: Deletes a job from the queue if its status is PENDING
 *     tags: [OPMS Sync]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobId
 *             properties:
 *               jobId:
 *                 type: integer
 *                 description: Sync job ID
 *     responses:
 *       200:
 *         description: Job cancelled successfully
 *       409:
 *         description: Job not found or not pending
 *       500:
 *         description: Failed to cancel job
 */
router.post('/cancel-job', syncController.cancelJob.bind(syncController));

/**
 * @swagger
 * /api/opms-sync/enable:
 *   post:
 *     summary: Enable OPMS-to-NetSuite sync
 *     description: Enables automatic OPMS-to-NetSuite synchronization
 *     tags: [OPMS Sync]
 *     responses:
 *       200:
 *         description: Sync enabled successfully
 *       500:
 *         description: Failed to enable sync
 */
router.post('/enable', syncController.enableSync.bind(syncController));

/**
 * @swagger
 * /api/opms-sync/disable:
 *   post:
 *     summary: Disable OPMS-to-NetSuite sync
 *     description: Disables automatic OPMS-to-NetSuite synchronization
 *     tags: [OPMS Sync]
 *     responses:
 *       200:
 *         description: Sync disabled successfully
 *       500:
 *         description: Failed to disable sync
 */
router.post('/disable', syncController.disableSync.bind(syncController));

/**
 * @swagger
 * /api/opms-sync/config:
 *   get:
 *     summary: Get sync configuration
 *     description: Returns current sync enable/disable state
 *     tags: [OPMS Sync]
 *     responses:
 *       200:
 *         description: Configuration retrieved successfully
 *       500:
 *         description: Failed to get configuration
 */
router.get('/config', syncController.getSyncConfig.bind(syncController));

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

// Global error handler for sync routes
router.use((error, req, res, next) => {
    logger.error('OPMS Sync API error', {
        error: error.message,
        stack: error.stack,
        method: req.method,
        path: req.path,
        body: req.body,
        query: req.query
    });

    res.status(500).json({
        success: false,
        error: 'Internal server error in sync API',
        message: error.message,
        timestamp: new Date().toISOString()
    });
});

// 404 handler for unknown sync routes
router.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Sync API endpoint not found',
        path: req.originalUrl,
        available_endpoints: [
            'GET /api/opms-sync/status',
            'GET /api/opms-sync/health',
            'GET /api/opms-sync/stats',
            'GET /api/opms-sync/activity',
            'GET /api/opms-sync/queue',
            'GET /api/opms-sync/validation-issues',
            'GET /api/opms-sync/batch-resync-status',
            'POST /api/opms-sync/trigger-item',
            'POST /api/opms-sync/trigger-product',
            'POST /api/opms-sync/trigger-batch-resync',
            'POST /api/opms-sync/stop-batch-resync',
            'POST /api/opms-sync/validate-item',
            'POST /api/opms-sync/pause',
            'POST /api/opms-sync/resume',
            'POST /api/opms-sync/restart'
        ]
    });
});

module.exports = router;

