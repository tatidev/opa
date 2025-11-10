/**
 * NetSuite Sync Queue Service
 * Manages sync job queue processing with retry logic and rate limiting
 * 
 * Features:
 * - Priority-based queue processing
 * - Exponential backoff retry logic
 * - Rate limiting (10 requests/second max)
 * - Batch processing for efficiency
 * - Comprehensive error handling
 */

const logger = require('../utils/logger');
const NetSuiteSyncJob = require('../models/NetSuiteSyncJob');
const OpmsItemSync = require('../models/OpmsItemSync');
const OpmsDataTransformService = require('./OpmsDataTransformService');

class NetSuiteSyncQueueService {
    constructor(netsuiteRestletService) {
        this.netSuiteSyncJob = new NetSuiteSyncJob();
        this.opmsItemSync = new OpmsItemSync();
        this.dataTransformService = new OpmsDataTransformService();
        this.netsuiteRestletService = netsuiteRestletService;
        
        // Configuration - NetSuite rate limiting compliance (10 req/sec max per spec)
        this.config = {
            batchSize: 1, // Process one item at a time as per specification
            maxRetries: 3,
            rateLimit: 10, // 10 requests per second maximum per specification
            rateLimitWindow: 1000, // 1 second window
            processingInterval: 5000, // 5 seconds between batch checks
            retryDelayBase: 2000, // 2 seconds base delay
            maxRetryDelay: 30000, // 30 seconds max delay
            requestDelay: 100 // 100ms delay = 10 requests per second (spec compliant)
        };

        // State management
        this.isProcessing = false;
        this.processingIntervalId = null;
        this.rateLimiter = new Map(); // Simple rate limiter
        this.stats = {
            totalProcessed: 0,
            successCount: 0,
            failureCount: 0,
            retryCount: 0,
            startTime: null
        };
    }

    /**
     * Start queue processing
     * @returns {Promise<void>}
     */
    async startProcessing() {
        try {
            if (this.isProcessing) {
                logger.warn('Queue processing is already active');
                return;
            }

            this.isProcessing = true;
            this.stats.startTime = new Date();

            // Start the processing loop
            this.processingIntervalId = setInterval(async () => {
                try {
                    await this.processNextBatch();
                } catch (error) {
                    logger.error('Queue processing error', {
                        error: error.message
                    });
                }
            }, this.config.processingInterval);

            logger.info('NetSuite sync queue processing started', {
                batchSize: this.config.batchSize,
                rateLimit: this.config.rateLimit,
                processingInterval: this.config.processingInterval
            });
        } catch (error) {
            logger.error('Failed to start queue processing', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Stop queue processing
     * @returns {void}
     */
    stopProcessing() {
        if (this.processingIntervalId) {
            clearInterval(this.processingIntervalId);
            this.processingIntervalId = null;
            this.isProcessing = false;

            const runtime = this.stats.startTime 
                ? Date.now() - this.stats.startTime.getTime()
                : 0;

            logger.info('NetSuite sync queue processing stopped', {
                runtimeMs: runtime,
                totalProcessed: this.stats.totalProcessed,
                successCount: this.stats.successCount,
                failureCount: this.stats.failureCount,
                successRate: this.stats.totalProcessed > 0 
                    ? (this.stats.successCount / this.stats.totalProcessed * 100).toFixed(2) + '%'
                    : '0%'
            });
        }
    }

    /**
     * Process next batch of sync jobs
     * @returns {Promise<void>}
     */
    async processNextBatch() {
        try {
            // Get next batch of pending jobs
            const jobs = await this.netSuiteSyncJob.getNextBatch(this.config.batchSize);

            if (jobs.length === 0) {
                logger.debug('No pending sync jobs found');
                return;
            }

            logger.info('Processing sync job batch', {
                batchSize: jobs.length,
                jobIds: jobs.map(j => j.id)
            });

            // Process jobs with rate limiting
            const results = await this.processJobsWithRateLimit(jobs);

            // Log batch results
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;

            logger.info('Batch processing completed', {
                totalJobs: jobs.length,
                successful: successful,
                failed: failed,
                successRate: (successful / jobs.length * 100).toFixed(2) + '%'
            });

            // Update stats
            this.stats.totalProcessed += jobs.length;
            this.stats.successCount += successful;
            this.stats.failureCount += failed;
        } catch (error) {
            logger.error('Batch processing failed', {
                error: error.message
            });
        }
    }

    /**
     * Process jobs with rate limiting
     * @param {Array} jobs - Array of sync jobs
     * @returns {Promise<Array>} - Processing results
     */
    async processJobsWithRateLimit(jobs) {
        const results = [];

        // Process jobs SEQUENTIALLY as per specification
        for (const job of jobs) {
            try {
                // Wait for rate limit availability before each job
                await this.waitForRateLimit();
                
                // Process the job individually
                const result = await this.processSingleJob(job);
                results.push(result);
                
                logger.debug('Job processed successfully', {
                    jobId: job.id,
                    itemId: job.item_id,
                    status: result.success ? 'success' : 'failed'
                });
            } catch (error) {
                logger.error('Job processing failed', {
                    jobId: job.id,
                    itemId: job.item_id,
                    error: error.message
                });
                
                results.push({
                    success: false,
                    jobId: job.id,
                    error: error.message
                });
            }
        }

        return results;
    }


    /**
     * Wait for rate limit availability
     * @returns {Promise<void>}
     */
    async waitForRateLimit() {
        const now = Date.now();
        const windowStart = now - this.config.rateLimitWindow;

        // Clean old entries
        for (const [timestamp] of this.rateLimiter) {
            if (timestamp < windowStart) {
                this.rateLimiter.delete(timestamp);
            }
        }

        // Check if we're at the rate limit
        if (this.rateLimiter.size >= this.config.rateLimit) {
            const oldestRequest = Math.min(...this.rateLimiter.keys());
            const waitTime = oldestRequest + this.config.rateLimitWindow - now + 100; // Add 100ms buffer

            if (waitTime > 0) {
                logger.debug('Rate limit reached, waiting', { waitTimeMs: waitTime });
                await this.sleep(waitTime);
            }
        }

        // Additional request delay for NetSuite compliance
        if (this.config.requestDelay > 0) {
            logger.debug('Adding NetSuite compliance delay', { delayMs: this.config.requestDelay });
            await this.sleep(this.config.requestDelay);
        }

        // Record this request
        this.rateLimiter.set(now, true);
    }

    /**
     * Process a single sync job
     * @param {Object} job - Sync job
     * @returns {Promise<Object>} - Processing result
     */
    async processSingleJob(job) {
        const startTime = Date.now();

        try {
            // CRITICAL: Check if sync is enabled at runtime
            const syncConfigService = require('./SyncConfigService');
            const isSyncEnabled = await syncConfigService.isSyncEnabled();
            // Parse event_data for manual override context
            let eventData = null;
            try {
                eventData = typeof job.event_data === 'string' ? JSON.parse(job.event_data) : job.event_data;
            } catch (e) {
                eventData = job.event_data || null;
            }
            
            if (!isSyncEnabled) {
                const isManual = eventData?.trigger_source === 'MANUAL_API' || eventData?.trigger_source === 'MANUAL_PRODUCT_API';
                // Allow manual jobs to proceed even when globally disabled, but they can still be configured as no-live
                if (isManual) {
                    logger.info('Global sync disabled, but proceeding due to manual trigger override', {
                        jobId: job.id,
                        itemId: job.item_id
                    });
                } else {
                logger.info('Sync disabled - skipping job processing', {
                    jobId: job.id,
                    itemId: job.item_id,
                    reason: 'OPMS-to-NetSuite sync is disabled via database configuration'
                });
                
                // Mark job as cancelled due to sync being disabled
                // Avoid using unsupported status values; mark as FAILED with message
                await this.netSuiteSyncJob.updateStatus(job.id, 'FAILED', {
                    error_message: 'Sync disabled by configuration'
                });
                return {
                    success: false,
                    error: 'Sync disabled',
                    jobId: job.id,
                    cancelled: true
                };
                }
            }

            logger.info('Processing sync job', {
                jobId: job.id,
                itemId: job.item_id,
                priority: job.priority,
                retryCount: job.retry_count
            });

            // Update job status to processing
            await this.netSuiteSyncJob.updateStatus(job.id, 'PROCESSING');

            // Update item sync status
            await this.opmsItemSync.updateSyncStatus({
                item_id: job.item_id,
                product_id: job.product_id,
                sync_status: 'IN_PROGRESS',
                last_sync_at: new Date()
            });

            // Safety check: Skip digital items (should not sync to NetSuite)
            const [itemCheck] = await this.netSuiteSyncJob.db.query(`
                SELECT code, product_type 
                FROM T_ITEM 
                WHERE id = ?
            `, [job.item_id]);
            
            if (itemCheck && itemCheck.length > 0) {
                const item = itemCheck[0];
                const itemCode = item.code || '';
                const productType = item.product_type || '';
                
                // Valid NetSuite item code format: nnnn-nnnn (4 digits, hyphen, 4 digits)
                const validCodePattern = /^\d{4}-\d{4}$/;
                
                const isDigitalType = productType === 'D';
                const codeContainsDigital = itemCode.toLowerCase().includes('digital');
                const invalidCodeFormat = itemCode && !validCodePattern.test(itemCode);
                
                if (isDigitalType || codeContainsDigital || invalidCodeFormat) {
                    logger.info('Skipping digital item during processing', {
                        jobId: job.id,
                        itemId: job.item_id,
                        itemCode: itemCode,
                        productType: productType,
                        skipReasons: {
                            digitalType: isDigitalType,
                            codeContainsDigital: codeContainsDigital,
                            invalidFormat: invalidCodeFormat
                        }
                    });
                    
                    // Mark as completed with skip flag
                    await this.netSuiteSyncJob.updateStatus(job.id, 'COMPLETED', {
                        processing_results: {
                            skipped: true,
                            reason: 'Digital item - not synced to NetSuite',
                            itemCode: itemCode,
                            productType: productType
                        }
                    });
                    
                    await this.opmsItemSync.updateSyncStatus({
                        item_id: job.item_id,
                        product_id: job.product_id,
                        sync_status: 'SKIPPED',
                        last_sync_at: new Date(),
                        sync_error: 'Digital item - not synced to NetSuite'
                    });
                    
                    return {
                        success: true,
                        skipped: true,
                        jobId: job.id,
                        itemId: job.item_id,
                        reason: 'Digital item'
                    };
                }
            }

            // Transform OPMS data to NetSuite format
            const netsuitePayload = await this.dataTransformService.transformItemForNetSuite(job.item_id);

            // If manual job requested NO live sync, complete without calling NetSuite
            const noLive = eventData && eventData.live_sync === false;
            let netsuiteResponse = null;
            if (noLive) {
                logger.info('Manual single-item set to No live Sync - skipping NetSuite call', {
                    jobId: job.id,
                    itemId: job.item_id
                });
            } else {
                // Determine environment override if provided
                const envOverride = eventData?.environment_override === 'prod' ? 'prod' : undefined;
                // Send to NetSuite
                netsuiteResponse = await this.sendToNetSuite(netsuitePayload, envOverride);
            }

            // Calculate processing time
            const processingTime = Date.now() - startTime;

            // Update job as completed
            await this.netSuiteSyncJob.updateStatus(job.id, 'COMPLETED', {
                processing_results: {
                    netsuite_response: netsuiteResponse,
                    processing_time_ms: processingTime,
                    payload_field_count: Object.keys(netsuitePayload).length,
                    validation_summary: netsuitePayload.custitem_opms_field_validation_summary,
                    no_live_sync: !!noLive,
                    environment_override: eventData?.environment_override || null
                }
            });

            // Update item sync status as successful
            await this.opmsItemSync.updateSyncStatus({
                item_id: job.item_id,
                product_id: job.product_id,
                sync_status: noLive ? 'SKIPPED' : 'SUCCESS',
                last_sync_at: new Date(),
                netsuite_item_id: netsuiteResponse ? (netsuiteResponse.itemId || netsuiteResponse.id) : null,
                sync_error: null,
                field_validation_results: netsuitePayload.custitem_opms_field_validation_summary
            });

            logger.info('Sync job completed successfully', {
                jobId: job.id,
                itemId: job.item_id,
                processingTimeMs: processingTime,
                netsuiteItemId: netsuiteResponse.itemId || netsuiteResponse.id
            });

            return {
                success: true,
                jobId: job.id,
                itemId: job.item_id,
                processingTimeMs: processingTime,
                netsuiteResponse: netsuiteResponse
            };
        } catch (error) {
            return await this.handleJobFailure(job, error, startTime);
        }
    }

    /**
     * Send payload to NetSuite via RESTlet
     * @param {Object} payload - NetSuite payload
     * @returns {Promise<Object>} - NetSuite response
     */
    async sendToNetSuite(payload, envOverride) {
        try {
            // Use existing NetSuite RESTlet service for UPSERT operations
            // The sync functionality upserts items (creates or updates as needed)
            // Mark as OPMS sync operation to ensure no prefixes are used for data integrity
            const response = await this.netsuiteRestletService.createLotNumberedInventoryItem(payload, { isOpmsSync: true, envOverride });

            if (response.error) {
                throw new Error(`NetSuite RESTlet error: ${response.error}`);
            }

            return response;
        } catch (error) {
            logger.error('NetSuite RESTlet call failed', {
                error: error.message,
                itemId: payload.custitem_opms_item_id,
                itemCode: payload.itemid
            });
            throw error;
        }
    }

    /**
     * Handle job failure with retry logic
     * @param {Object} job - Failed job
     * @param {Error} error - Error that occurred
     * @param {number} startTime - Job start time
     * @returns {Promise<Object>} - Failure handling result
     */
    async handleJobFailure(job, error, startTime) {
        const processingTime = Date.now() - startTime;
        const retryCount = job.retry_count + 1;

        logger.error('Sync job failed', {
            jobId: job.id,
            itemId: job.item_id,
            error: error.message,
            retryCount: retryCount,
            maxRetries: job.max_retries,
            processingTimeMs: processingTime
        });

        if (retryCount <= job.max_retries) {
            // Schedule for retry with exponential backoff
            const retryDelay = Math.min(
                this.config.retryDelayBase * Math.pow(2, retryCount - 1),
                this.config.maxRetryDelay
            );

            await this.netSuiteSyncJob.scheduleRetry(job.id, retryDelay, {
                retry_count: retryCount,
                last_error: error.message,
                processing_time_ms: processingTime
            });

            // Update item sync status for retry
            await this.opmsItemSync.updateSyncStatus({
                item_id: job.item_id,
                product_id: job.product_id,
                sync_status: 'FAILED',
                last_sync_at: new Date(),
                sync_error: `Retry ${retryCount}/${job.max_retries}: ${error.message}`
            });

            this.stats.retryCount++;

            logger.info('Job scheduled for retry', {
                jobId: job.id,
                itemId: job.item_id,
                retryCount: retryCount,
                retryDelayMs: retryDelay,
                retryAt: new Date(Date.now() + retryDelay)
            });

            return {
                success: false,
                jobId: job.id,
                itemId: job.item_id,
                action: 'retry_scheduled',
                retryCount: retryCount,
                retryDelayMs: retryDelay,
                error: error.message
            };
        } else {
            // Max retries exceeded - mark as permanently failed
            await this.netSuiteSyncJob.updateStatus(job.id, 'FAILED', {
                error_message: `Max retries exceeded: ${error.message}`,
                processing_results: {
                    final_error: error.message,
                    retry_count: retryCount,
                    processing_time_ms: processingTime
                }
            });

            // Update item sync status as permanently failed
            await this.opmsItemSync.updateSyncStatus({
                item_id: job.item_id,
                product_id: job.product_id,
                sync_status: 'FAILED',
                last_sync_at: new Date(),
                sync_error: `PERMANENT FAILURE after ${retryCount} attempts: ${error.message}`
            });

            logger.error('Job permanently failed', {
                jobId: job.id,
                itemId: job.item_id,
                retryCount: retryCount,
                error: error.message
            });

            return {
                success: false,
                jobId: job.id,
                itemId: job.item_id,
                action: 'permanent_failure',
                retryCount: retryCount,
                error: error.message
            };
        }
    }

    /**
     * Get queue processing statistics
     * @returns {Promise<Object>} - Queue statistics
     */
    async getQueueStats() {
        try {
            const jobStats = await this.netSuiteSyncJob.getJobStats({ hours: 24 });
            const itemStats = await this.opmsItemSync.getSyncStats({ hours: 24 });

            const runtime = this.stats.startTime 
                ? Date.now() - this.stats.startTime.getTime()
                : 0;

            return {
                processing: {
                    isActive: this.isProcessing,
                    runtimeMs: runtime,
                    runtimeHours: (runtime / (1000 * 60 * 60)).toFixed(2)
                },
                configuration: {
                    batchSize: this.config.batchSize,
                    rateLimit: this.config.rateLimit,
                    maxRetries: this.config.maxRetries,
                    processingIntervalMs: this.config.processingInterval
                },
                session_stats: {
                    totalProcessed: this.stats.totalProcessed,
                    successCount: this.stats.successCount,
                    failureCount: this.stats.failureCount,
                    retryCount: this.stats.retryCount,
                    successRate: this.stats.totalProcessed > 0 
                        ? (this.stats.successCount / this.stats.totalProcessed * 100).toFixed(2) + '%'
                        : '0%'
                },
                job_stats: jobStats,
                item_stats: itemStats
            };
        } catch (error) {
            logger.error('Failed to get queue statistics', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Get current queue status
     * @returns {Promise<Object>} - Current queue status
     */
    async getQueueStatus() {
        try {
            const statusQuery = `
                SELECT 
                    status,
                    priority,
                    COUNT(*) as count,
                    MIN(created_at) as oldest_job,
                    MAX(created_at) as newest_job
                FROM opms_sync_queue
                GROUP BY status, priority
                ORDER BY 
                    CASE status 
                        WHEN 'PROCESSING' THEN 1 
                        WHEN 'PENDING' THEN 2 
                        WHEN 'FAILED' THEN 3 
                        WHEN 'COMPLETED' THEN 4 
                    END,
                    CASE priority 
                        WHEN 'HIGH' THEN 1 
                        WHEN 'NORMAL' THEN 2 
                        WHEN 'LOW' THEN 3 
                    END
            `;

            const [queueStatus] = await this.netSuiteSyncJob.db.query(statusQuery);

            const totalQuery = `
                SELECT COUNT(*) as total_jobs
                FROM opms_sync_queue
                WHERE status IN ('PENDING', 'PROCESSING')
            `;

            const [totals] = await this.netSuiteSyncJob.db.query(totalQuery);

            return {
                active_jobs: totals.total_jobs,
                queue_breakdown: queueStatus,
                processing_active: this.isProcessing,
                rate_limit_active_requests: this.rateLimiter.size
            };
        } catch (error) {
            logger.error('Failed to get queue status', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Pause queue processing
     * @returns {void}
     */
    pauseProcessing() {
        if (this.isProcessing) {
            this.stopProcessing();
            logger.info('Queue processing paused');
        }
    }

    /**
     * Resume queue processing
     * @returns {Promise<void>}
     */
    async resumeProcessing() {
        if (!this.isProcessing) {
            await this.startProcessing();
            logger.info('Queue processing resumed');
        }
    }

    /**
     * Sleep utility function
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Shutdown the queue service
     * @returns {Promise<void>}
     */
    async shutdown() {
        try {
            logger.info('Shutting down NetSuite sync queue service');

            // Stop processing
            this.stopProcessing();

            // Clear rate limiter
            this.rateLimiter.clear();

            logger.info('NetSuite sync queue service shutdown completed');
        } catch (error) {
            logger.error('Error during queue service shutdown', {
                error: error.message
            });
            throw error;
        }
    }
}

module.exports = NetSuiteSyncQueueService;

