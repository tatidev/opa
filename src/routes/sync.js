'use strict';

const express = require('express');
const router = express.Router();
const NetsuiteToOpmsSyncController = require('../controllers/NetsuiteToOpmsSyncController');
const auth = require('../middleware/auth');

const syncController = new NetsuiteToOpmsSyncController();

/**
 * @swagger
 * /api/sync/netsuite-to-opms/initial:
 *   post:
 *     summary: Start initial bulk sync from NetSuite to OPMS
 *     description: Initiates a one-time bulk sync of all NetSuite items to OPMS with pricing data
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Initial sync started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Initial sync started successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: integer
 *                       description: ID of the created sync job
 *                     status:
 *                       type: string
 *                       example: started
 *       400:
 *         description: Bad request - sync already in progress
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/netsuite-to-opms/initial', auth, syncController.startInitialSync.bind(syncController));

/**
 * @swagger
 * /api/sync/netsuite-to-opms/initial/status:
 *   get:
 *     summary: Get initial sync status
 *     description: Retrieves the status of the most recent initial sync job
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Initial sync status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: integer
 *                       description: ID of the sync job
 *                     status:
 *                       type: string
 *                       example: running
 *                     progress:
 *                       type: integer
 *                       description: Progress percentage (0-100)
 *                     totalItems:
 *                       type: integer
 *                       description: Total number of items to sync
 *                     processedItems:
 *                       type: integer
 *                       description: Number of items processed so far
 *       404:
 *         description: No initial sync job found
 *       500:
 *         description: Internal server error
 */
router.get('/netsuite-to-opms/initial/status', auth, syncController.getInitialSyncStatus.bind(syncController));

/**
 * @swagger
 * /api/sync/netsuite-to-opms/item/{itemId}:
 *   post:
 *     summary: Sync a single item from NetSuite to OPMS
 *     description: Syncs pricing data for a specific NetSuite item to OPMS
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: NetSuite item ID to sync
 *     responses:
 *       200:
 *         description: Item synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Item 12345 synced successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: integer
 *                       description: ID of the sync job
 *                     itemId:
 *                       type: string
 *                       description: NetSuite item ID
 *                     status:
 *                       type: string
 *                       example: completed
 *       400:
 *         description: Bad request - item ID required or sync failed
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/netsuite-to-opms/item/:itemId', auth, syncController.syncSingleItem.bind(syncController));

/**
 * @swagger
 * /api/sync/netsuite-to-opms/item/{itemId}/status:
 *   get:
 *     summary: Get single item sync status
 *     description: Retrieves sync history for a specific NetSuite item
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: NetSuite item ID to check status for
 *     responses:
 *       200:
 *         description: Item sync status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: string
 *                       description: NetSuite item ID
 *                     syncHistory:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           syncId:
 *                             type: integer
 *                             description: ID of the sync operation
 *                           status:
 *                             type: string
 *                             example: success
 *                           syncFields:
 *                             type: object
 *                             description: Fields that were synced
 *                           errorMessage:
 *                             type: string
 *                             description: Error message if sync failed
 *       404:
 *         description: No sync history found for item
 *       500:
 *         description: Internal server error
 */
router.get('/netsuite-to-opms/item/:itemId/status', auth, syncController.getSingleItemSyncStatus.bind(syncController));

/**
 * @swagger
 * /api/sync/netsuite-to-opms/manual:
 *   post:
 *     summary: Manual sync trigger
 *     description: Manually trigger various types of sync operations
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - syncType
 *             properties:
 *               syncType:
 *                 type: string
 *                 enum: [initial, specific_items, changed_since]
 *                 description: Type of sync to perform
 *               itemIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of NetSuite item IDs (required for specific_items sync)
 *               filters:
 *                 type: object
 *                 properties:
 *                   lastModifiedDate:
 *                     type: string
 *                     format: date-time
 *                     description: Date to sync items changed since (required for changed_since sync)
 *     responses:
 *       200:
 *         description: Manual sync request processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Manual sync request processed
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: integer
 *                       description: ID of the created sync job
 *                     status:
 *                       type: string
 *                       example: started
 *       400:
 *         description: Bad request - invalid sync type or missing parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/netsuite-to-opms/manual', auth, syncController.manualSync.bind(syncController));

/**
 * @swagger
 * /api/sync/netsuite-to-opms/force-full:
 *   post:
 *     summary: Force full sync (overrides running jobs)
 *     description: Cancels any running sync jobs and starts a new initial sync
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Force full sync started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Force full sync started successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: integer
 *                       description: ID of the new sync job
 *                     status:
 *                       type: string
 *                       example: started
 *                     cancelledJobs:
 *                       type: integer
 *                       description: Number of jobs cancelled
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/netsuite-to-opms/force-full', auth, syncController.forceFullSync.bind(syncController));

/**
 * @swagger
 * /api/sync/netsuite-to-opms/status:
 *   get:
 *     summary: Get overall sync status
 *     description: Retrieves overall status of all sync operations in the last 24 hours
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overall sync status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalJobs:
 *                       type: integer
 *                       description: Total number of sync jobs
 *                     runningJobs:
 *                       type: integer
 *                       description: Number of currently running jobs
 *                     completedJobs:
 *                       type: integer
 *                       description: Number of completed jobs
 *                     failedJobs:
 *                       type: integer
 *                       description: Number of failed jobs
 *                     recentJobs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             description: Job ID
 *                           type:
 *                             type: string
 *                             description: Job type
 *                           status:
 *                             type: string
 *                             description: Job status
 *                           progress:
 *                             type: integer
 *                             description: Job progress percentage
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/netsuite-to-opms/status', auth, syncController.getOverallStatus.bind(syncController));

/**
 * @swagger
 * /api/sync/netsuite-to-opms/logs:
 *   get:
 *     summary: Get sync operation logs
 *     description: Retrieves logs for sync operations with optional filtering
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: jobId
 *         schema:
 *           type: integer
 *         description: Filter logs by specific sync job ID
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [debug, info, warn, error]
 *         description: Filter logs by log level
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of logs to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of logs to skip
 *     responses:
 *       200:
 *         description: Sync logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     logs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             description: Log entry ID
 *                           jobId:
 *                             type: integer
 *                             description: Associated sync job ID
 *                           level:
 *                             type: string
 *                             description: Log level
 *                           message:
 *                             type: string
 *                             description: Log message
 *                           details:
 *                             type: object
 *                             description: Additional log details
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             description: When the log was created
 *                     total:
 *                       type: integer
 *                       description: Total number of logs returned
 *                     limit:
 *                       type: integer
 *                       description: Maximum number of logs requested
 *                     offset:
 *                       type: integer
 *                       description: Number of logs skipped
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/netsuite-to-opms/logs', auth, syncController.getSyncLogs.bind(syncController));

/**
 * @swagger
 * /api/sync/netsuite-to-opms/health:
 *   get:
 *     summary: Health check for sync system
 *     description: Checks the health of the sync system including database and NetSuite connectivity
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync system is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: healthy
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       description: Current timestamp
 *                     database:
 *                       type: string
 *                       example: connected
 *                       description: Database connection status
 *                     netsuite:
 *                       type: string
 *                       example: connected
 *                       description: NetSuite connection status
 *       503:
 *         description: Sync system is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: unhealthy
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       description: Current timestamp
 *                     error:
 *                       type: string
 *                       description: Error message describing the health issue
 */
router.get('/netsuite-to-opms/health', auth, syncController.healthCheck.bind(syncController));

module.exports = router;
