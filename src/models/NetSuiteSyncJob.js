/**
 * NetSuite Sync Job Model
 * Manages sync job lifecycle and status tracking
 */

const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class NetSuiteSyncJob extends BaseModel {
    constructor() {
        super('opms_sync_queue');
    }

    /**
     * Create a new sync job
     * @param {Object} jobData - Sync job information
     * @returns {Promise<Object>} - Created sync job
     */
    async createSyncJob(jobData) {
        try {
            const {
                item_id,
                product_id,
                event_type = 'UPDATE',
                event_data = {},
                priority = 'NORMAL',
                max_retries = 3
            } = jobData;

            // Check for existing pending/processing job for this item
            const existingJob = await this.getActiveJobForItem(item_id);
            if (existingJob) {
                logger.info('Sync job already exists for item', {
                    itemId: item_id,
                    existingJobId: existingJob.id,
                    existingStatus: existingJob.status
                });
                return existingJob;
            }

            const query = `
                INSERT INTO opms_sync_queue (
                    item_id, product_id, event_type, event_data, 
                    priority, status, retry_count, max_retries, created_at
                ) VALUES (?, ?, ?, ?, ?, 'PENDING', 0, ?, NOW())
            `;

            const [result] = await this.db.query(query, [
                item_id,
                product_id,
                event_type,
                JSON.stringify(event_data),
                priority,
                max_retries
            ]);

            const newJob = {
                id: result.insertId,
                item_id,
                product_id,
                event_type,
                event_data,
                priority,
                status: 'PENDING',
                retry_count: 0,
                max_retries,
                created_at: new Date()
            };

            logger.info('Sync job created', {
                jobId: newJob.id,
                itemId: item_id,
                productId: product_id,
                priority: priority
            });

            return newJob;
        } catch (error) {
            logger.error('Failed to create sync job', {
                error: error.message,
                jobData: jobData
            });
            throw error;
        }
    }

    /**
     * Get active job for an item (PENDING or PROCESSING)
     * @param {number} itemId - Item ID
     * @returns {Promise<Object|null>} - Active job or null
     */
    async getActiveJobForItem(itemId) {
        try {
            const query = `
                SELECT * FROM opms_sync_queue
                WHERE item_id = ? AND status IN ('PENDING', 'PROCESSING')
                ORDER BY created_at DESC
                LIMIT 1
            `;

            const [rows] = await this.db.query(query, [itemId]);

            if (rows && rows.length > 0) {
                const result = rows[0];
                return {
                    ...result,
                    event_data: typeof result.event_data === 'string' 
                        ? JSON.parse(result.event_data) 
                        : result.event_data
                };
            }

            return null;
        } catch (error) {
            logger.error('Failed to get active job for item', {
                error: error.message,
                itemId: itemId
            });
            throw error;
        }
    }

    /**
     * Get job by ID
     * @param {number} jobId - Job ID
     * @returns {Promise<Object|null>} - Job data or null
     */
    async getJobById(jobId) {
        try {
            const query = `
                SELECT * FROM opms_sync_queue
                WHERE id = ?
                LIMIT 1
            `;

            const [rows] = await this.db.query(query, [jobId]);

            if (rows && rows.length > 0) {
                const result = rows[0];
                return {
                    ...result,
                    event_data: typeof result.event_data === 'string' 
                        ? JSON.parse(result.event_data) 
                        : result.event_data,
                    processing_results: typeof result.processing_results === 'string'
                        ? JSON.parse(result.processing_results)
                        : result.processing_results
                };
            }

            return null;
        } catch (error) {
            logger.error('Failed to get job by ID', {
                error: error.message,
                jobId: jobId
            });
            throw error;
        }
    }

    /**
     * Get next batch of jobs to process
     * @param {number} batchSize - Number of jobs to retrieve
     * @returns {Promise<Array>} - Batch of jobs
     */
    async getNextBatch(batchSize = 50) {
        try {
            // Use FOR UPDATE SKIP LOCKED to prevent race conditions with multiple ALB nodes
            // SKIP LOCKED ensures each node gets different items, no duplicate processing
            const query = `
                SELECT * FROM opms_sync_queue
                WHERE status = 'PENDING'
                ORDER BY 
                    CASE priority 
                        WHEN 'HIGH' THEN 1 
                        WHEN 'NORMAL' THEN 2 
                        WHEN 'LOW' THEN 3 
                    END,
                    created_at ASC
                LIMIT ?
                FOR UPDATE SKIP LOCKED
            `;

            const [results] = await this.db.query(query, [batchSize]);

            return results.map(job => ({
                ...job,
                event_data: typeof job.event_data === 'string' 
                    ? JSON.parse(job.event_data) 
                    : job.event_data
            }));
        } catch (error) {
            logger.error('Failed to get next batch of jobs', {
                error: error.message,
                batchSize: batchSize
            });
            throw error;
        }
    }

    /**
     * Update job status
     * @param {number} jobId - Job ID
     * @param {string} status - New status
     * @param {Object} updateData - Additional data to update
     * @returns {Promise<boolean>} - Success status
     */
    async updateStatus(jobId, status, updateData = {}) {
        try {
            let query = 'UPDATE opms_sync_queue SET status = ?';
            const params = [status, jobId];

            // Add processed_at timestamp for completed/failed jobs
            if (status === 'COMPLETED' || status === 'FAILED') {
                query += ', processed_at = NOW()';
            }

            // Add retry count if provided
            if (updateData.retry_count !== undefined) {
                query += ', retry_count = ?';
                params.splice(-1, 0, updateData.retry_count);
            }

            // Add error message if provided
            if (updateData.error_message) {
                query += ', error_message = ?';
                params.splice(-1, 0, updateData.error_message);
            }

            // Add processing results if provided
            if (updateData.processing_results) {
                query += ', processing_results = ?';
                params.splice(-1, 0, JSON.stringify(updateData.processing_results));
            }

            query += ' WHERE id = ?';

            const [result] = await this.db.query(query, params);

            if (result.affectedRows === 0) {
                logger.warn('No job found to update', { jobId: jobId });
                return false;
            }

            logger.info('Sync job status updated', {
                jobId: jobId,
                status: status,
                updateData: updateData
            });

            return true;
        } catch (error) {
            logger.error('Failed to update job status', {
                error: error.message,
                jobId: jobId,
                status: status,
                updateData: updateData
            });
            throw error;
        }
    }

    /**
     * Cancel a pending sync job by deleting it from the queue
     * Only jobs in PENDING status can be cancelled
     * @param {number} jobId
     * @returns {Promise<boolean>}
     */
    async cancelPendingJob(jobId) {
        try {
            const [result] = await this.db.query(
                `DELETE FROM opms_sync_queue WHERE id = ? AND status = 'PENDING'`,
                [jobId]
            );

            const deleted = result.affectedRows > 0;
            if (deleted) {
                logger.info('Cancelled pending sync job', { jobId });
            } else {
                logger.warn('No pending job cancelled (not found or not pending)', { jobId });
            }
            return deleted;
        } catch (error) {
            logger.error('Failed to cancel pending sync job', { jobId, error: error.message });
            throw error;
        }
    }

    /**
     * Schedule job for retry with delay
     * @param {number} jobId - Job ID
     * @param {number} delayMs - Delay in milliseconds
     * @param {Object} retryData - Retry information
     * @returns {Promise<boolean>} - Success status
     */
    async scheduleRetry(jobId, delayMs, retryData = {}) {
        try {
            const retryAt = new Date(Date.now() + delayMs);

            const query = `
                UPDATE opms_sync_queue 
                SET status = 'PENDING', 
                    retry_count = ?,
                    retry_at = ?,
                    error_message = ?
                WHERE id = ?
            `;

            const result = await this.db.query(query, [
                retryData.retry_count || 0,
                retryAt,
                retryData.last_error || null,
                jobId
            ]);

            if (result.affectedRows === 0) {
                logger.warn('No job found to schedule retry', { jobId: jobId });
                return false;
            }

            logger.info('Sync job scheduled for retry', {
                jobId: jobId,
                retryAt: retryAt,
                delayMs: delayMs,
                retryCount: retryData.retry_count
            });

            return true;
        } catch (error) {
            logger.error('Failed to schedule job retry', {
                error: error.message,
                jobId: jobId,
                delayMs: delayMs,
                retryData: retryData
            });
            throw error;
        }
    }

    /**
     * Get sync job statistics
     * @param {Object} options - Query options
     * @returns {Promise<Object>} - Job statistics
     */
    async getJobStats(options = {}) {
        try {
            const { hours = 24 } = options;

            const query = `
                SELECT 
                    status,
                    priority,
                    COUNT(*) as count,
                    AVG(TIMESTAMPDIFF(SECOND, created_at, processed_at)) as avg_processing_seconds
                FROM opms_sync_queue
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
                GROUP BY status, priority
                ORDER BY status, priority
            `;

            const [results] = await this.db.query(query, [hours]);

            const totalQuery = `
                SELECT 
                    COUNT(*) as total_jobs,
                    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_jobs,
                    SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_jobs,
                    SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_jobs,
                    SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END) as processing_jobs
                FROM opms_sync_queue
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
            `;

            const [totals] = await this.db.query(totalQuery, [hours]);

            return {
                totals: totals,
                by_status_priority: results,
                success_rate: totals.total_jobs > 0 
                    ? (totals.completed_jobs / totals.total_jobs * 100).toFixed(2) + '%'
                    : '0%',
                period_hours: hours
            };
        } catch (error) {
            logger.error('Failed to get job statistics', {
                error: error.message,
                options: options
            });
            throw error;
        }
    }

    /**
     * Clean up old completed/failed jobs
     * @param {number} daysToKeep - Number of days to retain
     * @returns {Promise<number>} - Number of deleted jobs
     */
    async cleanupOldJobs(daysToKeep = 7) {
        try {
            const query = `
                DELETE FROM opms_sync_queue
                WHERE status IN ('COMPLETED', 'FAILED')
                  AND processed_at < DATE_SUB(NOW(), INTERVAL ? DAY)
            `;

            const [result] = await this.db.query(query, [daysToKeep]);

            logger.info('Cleaned up old sync jobs', {
                deletedCount: result.affectedRows,
                daysToKeep: daysToKeep
            });

            return result.affectedRows;
        } catch (error) {
            logger.error('Failed to cleanup old sync jobs', {
                error: error.message,
                daysToKeep: daysToKeep
            });
            throw error;
        }
    }
}

module.exports = NetSuiteSyncJob;

