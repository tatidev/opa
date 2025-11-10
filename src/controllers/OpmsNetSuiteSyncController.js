/**
 * OPMS NetSuite Sync Controller
 * API endpoints for managing OPMS-to-NetSuite synchronization
 * 
 * Provides endpoints for:
 * - Manual sync triggers (item/product)
 * - Service status and monitoring
 * - Queue management
 * - Health checks and diagnostics
 */

const logger = require('../utils/logger');
const syncService = require('../services/OpmsToNetSuiteSyncService');
const syncConfigService = require('../services/SyncConfigService');
const OpmsDataTransformService = require('../services/OpmsDataTransformService');
const NetSuiteSyncJob = require('../models/NetSuiteSyncJob');
const OpmsChangeLog = require('../models/OpmsChangeLog');
const OpmsItemSync = require('../models/OpmsItemSync');

class OpmsNetSuiteSyncController {
    constructor() {
        this.dataTransformService = new OpmsDataTransformService();
        this.netSuiteSyncJob = new NetSuiteSyncJob();
        this.opmsChangeLog = new OpmsChangeLog();
        this.opmsItemSync = new OpmsItemSync();
    }

    /**
     * Cancel a pending sync job (PENDING only)
     * POST /api/opms-sync/cancel-job
     * Body: { jobId }
     */
    async cancelJob(req, res) {
        try {
            const { jobId } = req.body;
            const numericId = parseInt(jobId);
            if (!numericId || isNaN(numericId)) {
                return res.status(400).json({ success: false, error: 'jobId is required and must be an integer' });
            }

            const cancelled = await this.netSuiteSyncJob.cancelPendingJob(numericId);
            if (!cancelled) {
                return res.status(409).json({ success: false, error: 'Job not found or not in PENDING status' });
            }

            return res.json({ success: true, message: `Job ${numericId} cancelled` });
        } catch (error) {
            logger.error('Failed to cancel sync job', { error: error.message, jobId: req.body?.jobId });
            return res.status(500).json({ success: false, error: 'Failed to cancel job', message: error.message });
        }
    }

    /**
     * Get sync service status
     * GET /api/opms-sync/status
     */
    async getStatus(req, res) {
        try {
            const status = await syncService.getServiceStatus();
            
            res.json({
                success: true,
                data: status,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Failed to get sync service status', {
                error: error.message,
                endpoint: 'GET /api/opms-sync/status'
            });

            res.status(500).json({
                success: false,
                error: 'Failed to get service status',
                message: error.message
            });
        }
    }

    /**
     * Get detailed health check
     * GET /api/opms-sync/health
     */
    async getHealth(req, res) {
        try {
            const health = await syncService.performHealthCheck();
            
            const statusCode = health.overall_status === 'healthy' ? 200 : 
                              health.overall_status === 'degraded' ? 200 : 503;

            res.status(statusCode).json({
                success: health.overall_status !== 'unhealthy',
                data: health,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Health check failed', {
                error: error.message,
                endpoint: 'GET /api/opms-sync/health'
            });

            res.status(503).json({
                success: false,
                error: 'Health check failed',
                message: error.message,
                overall_status: 'unhealthy'
            });
        }
    }

    /**
     * Manually trigger sync for a specific item
     * POST /api/opms-sync/trigger-item
     * Body: { itemId, reason?, priority? }
     */
    async triggerItemSync(req, res) {
        try {
            const { itemId, reason = 'Manual API trigger', priority = 'HIGH', source, env } = req.body;

            if (!itemId) {
                return res.status(400).json({
                    success: false,
                    error: 'itemId is required'
                });
            }

            // Get user information if available
            const triggeredBy = req.user ? {
                id: req.user.id,
                username: req.user.username || req.user.email,
                ip: req.ip,
                source: source,
                env: env === 'prod' ? 'prod' : null,
                live: env === 'prod'
            } : {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                source: source,
                env: env === 'prod' ? 'prod' : null,
                live: env === 'prod'
            };

            // Optional per-source gate
            if (source === 'sync-dashboard') {
                const allowed = await syncConfigService.isManualItemDashboardEnabled();
                if (!allowed) {
                    return res.status(403).json({
                        success: false,
                        error: 'Manual single-item sync (dashboard) is disabled by configuration'
                    });
                }
            } else if (source === 'item-index') {
                const allowed = await syncConfigService.isManualItemItemIndexEnabled();
                if (!allowed) {
                    return res.status(403).json({
                        success: false,
                        error: 'Manual single-item sync (item index) is disabled by configuration'
                    });
                }
            }

            const result = await syncService.manualTriggerItem(itemId, reason, triggeredBy);

            logger.info('Manual item sync triggered via API', {
                itemId: itemId,
                reason: reason,
                triggeredBy: triggeredBy,
                jobId: result.syncJob?.id
            });

            res.json({
                success: true,
                data: result,
                message: `Item ${itemId} queued for sync`,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Manual item sync trigger failed', {
                error: error.message,
                itemId: req.body.itemId,
                endpoint: 'POST /api/opms-sync/trigger-item'
            });

            const statusCode = error.message.includes('not found') ? 404 : 500;

            res.status(statusCode).json({
                success: false,
                error: 'Failed to trigger item sync',
                message: error.message
            });
        }
    }

    /**
     * Manually trigger sync for an item by its code
     * POST /api/opms-sync/trigger-item-by-code
     * Body: { itemCode, reason?, priority? }
     */
    async triggerItemSyncByCode(req, res) {
        try {
            const { itemCode, reason = 'Manual API trigger by code', priority = 'HIGH', source, env } = req.body;

            if (!itemCode) {
                return res.status(400).json({
                    success: false,
                    error: 'itemCode is required'
                });
            }

            // Get user information if available
            const triggeredBy = req.user ? {
                id: req.user.id,
                username: req.user.username || req.user.email,
                ip: req.ip,
                source: source,
                env: env === 'prod' ? 'prod' : null,
                live: env === 'prod'
            } : {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                source: source,
                env: env === 'prod' ? 'prod' : null,
                live: env === 'prod'
            };

            // Optional per-source gate
            if (source === 'sync-dashboard') {
                const allowed = await syncConfigService.isManualItemDashboardEnabled();
                if (!allowed) {
                    return res.status(403).json({
                        success: false,
                        error: 'Manual single-item sync (dashboard) is disabled by configuration'
                    });
                }
            } else if (source === 'item-index') {
                const allowed = await syncConfigService.isManualItemItemIndexEnabled();
                if (!allowed) {
                    return res.status(403).json({
                        success: false,
                        error: 'Manual single-item sync (item index) is disabled by configuration'
                    });
                }
            }

            // First, find the item by code to get its ID
            const itemQuery = `
                SELECT i.id, i.code, p.name as product_name, v.name as vendor_name
                FROM T_ITEM i
                JOIN T_PRODUCT p ON i.product_id = p.id
                JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
                JOIN Z_VENDOR v ON pv.vendor_id = v.id
                WHERE i.code = ? AND i.archived = 'N' AND p.archived = 'N' AND v.active = 'Y' AND v.archived = 'N'
                LIMIT 1
            `;

            const [items] = await this.dataTransformService.db.query(itemQuery, [itemCode]);

            if (items.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Item not found',
                    message: `No active item found with code: ${itemCode}`
                });
            }

            const item = items[0];
            const itemId = item.id;

            // Use the existing sync service to trigger the item sync
            const result = await syncService.manualTriggerItem(itemId, reason, triggeredBy);

            logger.info('Manual item sync triggered by code via API', {
                itemCode: itemCode,
                itemId: itemId,
                productName: item.product_name,
                vendorName: item.vendor_name,
                reason: reason,
                triggeredBy: triggeredBy,
                jobId: result.syncJob?.id
            });

            res.json({
                success: true,
                data: {
                    ...result,
                    itemCode: itemCode,
                    itemId: itemId,
                    productName: item.product_name,
                    vendorName: item.vendor_name
                },
                message: `Item ${itemCode} (ID: ${itemId}) queued for sync`,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Manual item sync trigger by code failed', {
                error: error.message,
                itemCode: req.body.itemCode,
                endpoint: 'POST /api/opms-sync/trigger-item-by-code'
            });

            const statusCode = error.message.includes('not found') ? 404 : 500;

            res.status(statusCode).json({
                success: false,
                error: 'Failed to trigger item sync by code',
                message: error.message
            });
        }
    }

    /**
     * Manually trigger sync for all items in a product
     * POST /api/opms-sync/trigger-product
     * Body: { productId, reason?, priority? }
     */
    async triggerProductSync(req, res) {
        try {
            const { productId, reason = 'Manual API product trigger', priority = 'NORMAL' } = req.body;

            if (!productId) {
                return res.status(400).json({
                    success: false,
                    error: 'productId is required'
                });
            }

            // Get user information if available
            const triggeredBy = req.user ? {
                id: req.user.id,
                username: req.user.username || req.user.email,
                ip: req.ip
            } : {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            };

            const result = await syncService.manualTriggerProduct(productId, reason, triggeredBy);

            logger.info('Manual product sync triggered via API', {
                productId: productId,
                reason: reason,
                triggeredBy: triggeredBy,
                itemCount: result.totalItems
            });

            res.json({
                success: true,
                data: result,
                message: `Product ${productId} with ${result.totalItems} items queued for sync`,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Manual product sync trigger failed', {
                error: error.message,
                productId: req.body.productId,
                endpoint: 'POST /api/opms-sync/trigger-product'
            });

            const statusCode = error.message.includes('not found') ? 404 : 500;

            res.status(statusCode).json({
                success: false,
                error: 'Failed to trigger product sync',
                message: error.message
            });
        }
    }

    /**
     * Get sync queue status
     * GET /api/opms-sync/queue
     */
    async getQueueStatus(req, res) {
        try {
            const queueStats = await syncService.queueService.getQueueStats();
            const queueStatus = await syncService.queueService.getQueueStatus();

            res.json({
                success: true,
                data: {
                    stats: queueStats,
                    status: queueStatus
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Failed to get queue status', {
                error: error.message,
                endpoint: 'GET /api/opms-sync/queue'
            });

            res.status(500).json({
                success: false,
                error: 'Failed to get queue status',
                message: error.message
            });
        }
    }

    /**
     * Get status of a specific sync job
     * GET /api/opms-sync/job-status/:jobId
     */
    async getJobStatus(req, res) {
        try {
            const jobId = parseInt(req.params.jobId);
            
            if (!jobId || isNaN(jobId)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid job ID',
                    message: 'Job ID must be a valid integer'
                });
            }

            // Get job details from database
            const job = await this.netSuiteSyncJob.getJobById(jobId);
            
            if (!job) {
                return res.status(404).json({
                    success: false,
                    error: 'Job not found',
                    message: `Sync job ${jobId} does not exist`
                });
            }

            // Get item details if available
            let itemDetails = null;
            if (job.item_id) {
                try {
                    itemDetails = await this.opmsItemSync.getItemDetails(job.item_id);
                } catch (error) {
                    logger.warn('Could not fetch item details for job', {
                        jobId: jobId,
                        itemId: job.item_id,
                        error: error.message
                    });
                }
            }

            res.json({
                success: true,
                data: {
                    ...job,
                    item_details: itemDetails,
                    duration_ms: job.completed_at && job.started_at 
                        ? new Date(job.completed_at) - new Date(job.started_at)
                        : job.started_at 
                        ? Date.now() - new Date(job.started_at)
                        : null
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Failed to get job status', {
                error: error.message,
                jobId: req.params.jobId,
                endpoint: 'GET /api/opms-sync/job-status/:jobId'
            });

            res.status(500).json({
                success: false,
                error: 'Failed to get job status',
                message: error.message
            });
        }
    }

    /**
     * Get sync statistics
     * GET /api/opms-sync/stats?hours=24
     */
    async getStats(req, res) {
        try {
            const hours = parseInt(req.query.hours) || 24;

            const [jobStats, itemStats, changeStats] = await Promise.all([
                this.netSuiteSyncJob.getJobStats({ hours }),
                this.opmsItemSync.getSyncStats({ hours }),
                this.opmsChangeLog.getChangeStats({ hours })
            ]);

            res.json({
                success: true,
                data: {
                    period_hours: hours,
                    jobs: jobStats,
                    items: itemStats,
                    changes: changeStats
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Failed to get sync statistics', {
                error: error.message,
                endpoint: 'GET /api/opms-sync/stats'
            });

            res.status(500).json({
                success: false,
                error: 'Failed to get sync statistics',
                message: error.message
            });
        }
    }

    /**
     * Get recent sync activity
     * GET /api/opms-sync/activity?limit=50
     */
    async getActivity(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 50;
            const hours = parseInt(req.query.hours) || 24;

            const [recentChanges, recentJobs] = await Promise.all([
                this.opmsChangeLog.getRecentChanges({ limit: limit, hours }),
                // Get recent jobs - we'll need to add this method or use existing ones
                this.getRecentJobs(limit, hours)
            ]);

            res.json({
                success: true,
                data: {
                    changes: recentChanges,
                    jobs: recentJobs,
                    period_hours: hours,
                    limit: limit
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Failed to get sync activity', {
                error: error.message,
                endpoint: 'GET /api/opms-sync/activity'
            });

            res.status(500).json({
                success: false,
                error: 'Failed to get sync activity',
                message: error.message
            });
        }
    }

    /**
     * Get items with validation issues
     * GET /api/opms-sync/validation-issues?limit=50
     */
    async getValidationIssues(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 50;

            const itemsWithIssues = await this.opmsItemSync.getItemsWithValidationIssues({ limit });

            res.json({
                success: true,
                data: {
                    items: itemsWithIssues,
                    count: itemsWithIssues.length,
                    limit: limit
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Failed to get validation issues', {
                error: error.message,
                endpoint: 'GET /api/opms-sync/validation-issues'
            });

            res.status(500).json({
                success: false,
                error: 'Failed to get validation issues',
                message: error.message
            });
        }
    }

    /**
     * Validate item for sync (test transformation without syncing)
     * POST /api/opms-sync/validate-item
     * Body: { itemId }
     */
    async validateItem(req, res) {
        try {
            const { itemId } = req.body;

            if (!itemId) {
                return res.status(400).json({
                    success: false,
                    error: 'itemId is required'
                });
            }

            // Validate item is syncable
            const validation = await this.dataTransformService.validateItemForSync(itemId);

            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    error: 'Item is not syncable',
                    validation: validation
                });
            }

            // Transform data to see what would be sent to NetSuite
            const transformedData = await this.dataTransformService.transformItemForNetSuite(itemId);

            res.json({
                success: true,
                data: {
                    validation: validation,
                    transformed_data: transformedData,
                    field_count: Object.keys(transformedData).length
                },
                message: 'Item validation completed successfully',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Item validation failed', {
                error: error.message,
                itemId: req.body.itemId,
                endpoint: 'POST /api/opms-sync/validate-item'
            });

            const statusCode = error.message.includes('not found') ? 404 : 500;

            res.status(statusCode).json({
                success: false,
                error: 'Item validation failed',
                message: error.message
            });
        }
    }

    /**
     * Pause sync processing
     * POST /api/opms-sync/pause
     */
    async pauseSync(req, res) {
        try {
            await syncService.pauseSync();

            logger.info('Sync processing paused via API', {
                triggeredBy: req.user?.username || req.ip
            });

            res.json({
                success: true,
                message: 'Sync processing paused',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Failed to pause sync processing', {
                error: error.message,
                endpoint: 'POST /api/opms-sync/pause'
            });

            res.status(500).json({
                success: false,
                error: 'Failed to pause sync processing',
                message: error.message
            });
        }
    }

    /**
     * Resume sync processing
     * POST /api/opms-sync/resume
     */
    async resumeSync(req, res) {
        try {
            await syncService.resumeSync();

            logger.info('Sync processing resumed via API', {
                triggeredBy: req.user?.username || req.ip
            });

            res.json({
                success: true,
                message: 'Sync processing resumed',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Failed to resume sync processing', {
                error: error.message,
                endpoint: 'POST /api/opms-sync/resume'
            });

            res.status(500).json({
                success: false,
                error: 'Failed to resume sync processing',
                message: error.message
            });
        }
    }

    /**
     * Restart sync service
     * POST /api/opms-sync/restart
     */
    async restartSync(req, res) {
        try {
            // This is a potentially dangerous operation, so require explicit confirmation
            const { confirm } = req.body;

            if (confirm !== 'RESTART_SYNC_SERVICE') {
                return res.status(400).json({
                    success: false,
                    error: 'Restart requires explicit confirmation',
                    required_confirmation: 'RESTART_SYNC_SERVICE'
                });
            }

            logger.warn('Sync service restart triggered via API', {
                triggeredBy: req.user?.username || req.ip,
                userAgent: req.get('User-Agent')
            });

            // Start restart in background to avoid timeout
            setImmediate(async () => {
                try {
                    await syncService.restart();
                } catch (error) {
                    logger.error('Sync service restart failed', {
                        error: error.message
                    });
                }
            });

            res.json({
                success: true,
                message: 'Sync service restart initiated',
                warning: 'Service will be unavailable during restart',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Failed to restart sync service', {
                error: error.message,
                endpoint: 'POST /api/opms-sync/restart'
            });

            res.status(500).json({
                success: false,
                error: 'Failed to restart sync service',
                message: error.message
            });
        }
    }

    /**
     * Get recent sync jobs (helper method)
     * @param {number} limit - Number of jobs to retrieve
     * @param {number} hours - Hours to look back
     * @returns {Promise<Array>} - Recent jobs
     */
    async getRecentJobs(limit, hours) {
        try {
            const query = `
                SELECT 
                    sq.id,
                    sq.item_id,
                    sq.product_id,
                    sq.event_type,
                    sq.priority,
                    sq.status,
                    sq.retry_count,
                    sq.created_at,
                    sq.processed_at,
                    sq.error_message,
                    i.code as item_code,
                    p.name as product_name
                FROM opms_sync_queue sq
                LEFT JOIN T_ITEM i ON sq.item_id = i.id
                LEFT JOIN T_PRODUCT p ON sq.product_id = p.id
                WHERE sq.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
                ORDER BY sq.created_at DESC
                LIMIT ?
            `;

            const jobs = await this.netSuiteSyncJob.db.query(query, [hours, limit]);

            return jobs.map(job => ({
                ...job,
                event_data: job.event_data ? JSON.parse(job.event_data) : null,
                processing_results: job.processing_results ? JSON.parse(job.processing_results) : null
            }));
        } catch (error) {
            logger.error('Failed to get recent jobs', {
                error: error.message,
                limit: limit,
                hours: hours
            });
            return [];
        }
    }

    /**
     * Trigger batch re-sync of all valid code items
     * POST /api/opms-sync/trigger-batch-resync
     */
    async triggerBatchResync(req, res) {
        try {
            const { priority = 'NORMAL', batchSize = 50, delay = 1000 } = req.body;

            // Get count of items to sync first
            const countQuery = `
                SELECT COUNT(DISTINCT i.id) as total
                FROM T_ITEM i
                JOIN T_PRODUCT p ON i.product_id = p.id
                JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
                JOIN Z_VENDOR v ON pv.vendor_id = v.id
                JOIN opms_netsuite_vendor_mapping m ON v.id = m.opms_vendor_id
                WHERE 
                    i.code REGEXP '^[0-9]{4}-[0-9]{4}$'
                    AND i.archived = 'N'
                    AND p.archived = 'N'
                    AND v.active = 'Y'
                    AND v.archived = 'N'
                    AND i.code IS NOT NULL
                    AND p.name IS NOT NULL
                    AND v.name IS NOT NULL
                    AND m.netsuite_vendor_id IS NOT NULL
                    AND m.opms_vendor_name = m.netsuite_vendor_name
            `;

            const [countResult] = await this.dataTransformService.db.query(countQuery);
            const totalItems = countResult[0]?.total || 0;

            logger.info('Starting batch re-sync: Background processing', {
                totalItems,
                priority,
                batchSize,
                delay
            });

            // Return immediately - process in background
            res.json({
                success: true,
                message: `Batch re-sync started: ${totalItems} items will be queued in background`,
                data: {
                    totalItems,
                    status: 'processing',
                    note: 'Items are being queued in the background. Use batch-resync-status endpoint to monitor progress.'
                }
            });

            // Process items in background (don't await)
            this._processBatchResyncInBackground(priority, totalItems).catch(error => {
                logger.error('Background batch re-sync failed', {
                    error: error.message,
                    stack: error.stack
                });
            });

        } catch (error) {
            logger.error('Failed to trigger batch re-sync', {
                error: error.message,
                stack: error.stack,
                endpoint: 'POST /api/opms-sync/trigger-batch-resync'
            });

            res.status(500).json({
                success: false,
                error: 'Failed to trigger batch re-sync',
                message: error.message
            });
        }
    }

    async _processBatchResyncInBackground(priority, totalItems) {
        const query = `
            SELECT DISTINCT 
                i.id as item_id,
                i.code as item_code,
                i.product_id,
                p.name as product_name,
                v.id as vendor_id,
                v.name as vendor_name,
                m.netsuite_vendor_id
            FROM T_ITEM i
            JOIN T_PRODUCT p ON i.product_id = p.id
            JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
            JOIN Z_VENDOR v ON pv.vendor_id = v.id
            JOIN opms_netsuite_vendor_mapping m ON v.id = m.opms_vendor_id
            WHERE 
                i.code REGEXP '^[0-9]{4}-[0-9]{4}$'
                AND i.archived = 'N'
                AND p.archived = 'N'
                AND v.active = 'Y'
                AND v.archived = 'N'
                AND i.code IS NOT NULL
                AND p.name IS NOT NULL
                AND v.name IS NOT NULL
                AND m.netsuite_vendor_id IS NOT NULL
                AND m.opms_vendor_name = m.netsuite_vendor_name
        `;

        const [items] = await this.dataTransformService.db.query(query);
        let queuedCount = 0;
        let skippedCount = 0;

        for (const item of items) {
            try {
                // Check if job already exists for this item
                const existingJob = await this.netSuiteSyncJob.getActiveJobForItem(item.item_id);
                if (existingJob) {
                    const existingEventData = typeof existingJob.event_data === 'string' 
                        ? JSON.parse(existingJob.event_data) 
                        : existingJob.event_data;
                    
                    if (existingEventData?.trigger_source === 'BATCH_RESYNC_MANUAL' && 
                        existingJob.status === 'PENDING') {
                        await this.netSuiteSyncJob.db.query(
                            'DELETE FROM opms_sync_queue WHERE id = ?',
                            [existingJob.id]
                        );
                    } else {
                        skippedCount++;
                        continue;
                    }
                }

                // Create sync job in queue
                await this.netSuiteSyncJob.createSyncJob({
                    item_id: item.item_id,
                    product_id: item.product_id,
                    event_type: 'UPDATE',
                    event_data: {
                        item_id: item.item_id,
                        product_id: item.product_id,
                        item_code: item.item_code,
                        product_name: item.product_name,
                        vendor_name: item.vendor_name,
                        change_fields: ['item_data'],
                        trigger_source: 'BATCH_RESYNC_MANUAL'
                    },
                    priority: priority,
                    max_retries: 3
                });

                queuedCount++;

                // Log progress every 100 items
                if (queuedCount % 100 === 0) {
                    logger.info(`Batch re-sync progress: ${queuedCount}/${totalItems} items queued`);
                }
            } catch (error) {
                logger.error('Failed to queue item for batch re-sync', {
                    itemId: item.item_id,
                    itemCode: item.item_code,
                    error: error.message
                });
                skippedCount++;
            }
        }

        logger.info('Batch re-sync queueing complete', {
            totalItems,
            queued: queuedCount,
            skipped: skippedCount
        });
    }

    /**
     * Stop batch re-sync gracefully
     * POST /api/opms-sync/stop-batch-resync
     */
    async stopBatchResync(req, res) {
        try {
            // Since the script runs in the terminal, stopping it requires signal handling
            // The script itself handles SIGINT gracefully
            logger.info('Batch re-sync stop requested via API', {
                note: 'Use Ctrl+C in terminal to stop the running script'
            });

            res.json({
                success: true,
                message: 'Batch re-sync stop requested',
                instructions: 'Use Ctrl+C in the terminal where the script is running'
            });
        } catch (error) {
            logger.error('Failed to stop batch re-sync', {
                error: error.message,
                endpoint: 'POST /api/opms-sync/stop-batch-resync'
            });

            res.status(500).json({
                success: false,
                error: 'Failed to stop batch re-sync',
                message: error.message
            });
        }
    }

    /**
     * Get batch re-sync status
     * GET /api/opms-sync/batch-resync-status
     */
    async getBatchResyncStatus(req, res) {
        try {
            // Check if there are recent batch operations
            const query = `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as queued,
                    SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
                    SUM(CASE WHEN status IN ('PENDING', 'PROCESSING') THEN 1 ELSE 0 END) as running
                FROM opms_sync_queue
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
            `;

            const [results] = await this.dataTransformService.db.query(query);
            const stats = results[0];

            res.json({
                success: true,
                data: {
                    running: (stats.running || 0) > 0,
                    totalItems: stats.total || 0,
                    queued: stats.queued || 0,
                    skipped: 0,
                    failed: stats.failed || 0
                }
            });
        } catch (error) {
            logger.error('Failed to get batch re-sync status', {
                error: error.message,
                endpoint: 'GET /api/opms-sync/batch-resync-status'
            });

            res.status(500).json({
                success: false,
                error: 'Failed to get batch re-sync status',
                message: error.message
            });
        }
    }

    /**
     * Enable sync
     * POST /api/opms-sync/enable
     */
    async enableSync(req, res) {
        try {
            await syncConfigService.enableSync();
            
            const config = await syncConfigService.getSyncConfig();
            
            res.json({
                success: true,
                message: 'OPMS-to-NetSuite sync ENABLED',
                data: {
                    enabled: true,
                    config: config
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Failed to enable sync', {
                error: error.message,
                endpoint: 'POST /api/opms-sync/enable'
            });

            res.status(500).json({
                success: false,
                error: 'Failed to enable sync',
                message: error.message
            });
        }
    }

    /**
     * Disable sync
     * POST /api/opms-sync/disable
     */
    async disableSync(req, res) {
        try {
            await syncConfigService.disableSync();
            
            const config = await syncConfigService.getSyncConfig();
            
            res.json({
                success: true,
                message: 'OPMS-to-NetSuite sync DISABLED',
                data: {
                    enabled: false,
                    config: config
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Failed to disable sync', {
                error: error.message,
                endpoint: 'POST /api/opms-sync/disable'
            });

            res.status(500).json({
                success: false,
                error: 'Failed to disable sync',
                message: error.message
            });
        }
    }

    /**
     * Get sync configuration
     * GET /api/opms-sync/config
     */
    async getSyncConfig(req, res) {
        try {
            const config = await syncConfigService.getSyncConfig();
            const isEnabled = await syncConfigService.isSyncEnabled();
            const manualDash = await syncConfigService.isManualItemDashboardEnabled();
            const manualItemIndex = await syncConfigService.isManualItemItemIndexEnabled();
            
            res.json({
                success: true,
                data: {
                    enabled: isEnabled,
                    manualItemDashboardEnabled: manualDash,
                    manualItemItemIndexEnabled: manualItemIndex,
                    config: config
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Failed to get sync config', {
                error: error.message,
                endpoint: 'GET /api/opms-sync/config'
            });

            res.status(500).json({
                success: false,
                error: 'Failed to get sync config',
                message: error.message
            });
        }
    }
}

module.exports = new OpmsNetSuiteSyncController();

