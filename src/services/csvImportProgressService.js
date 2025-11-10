/**
 * CSV Import Progress Tracking Service
 * Handles real-time progress tracking and job management for CSV imports
 */

const ImportJobModel = require('../models/ImportJobModel');
const ImportItemModel = require('../models/ImportItemModel');
const logger = require('../utils/logger');

class CsvImportProgressService {
    constructor() {
        this.activeJobs = new Map(); // Track active jobs in memory
        this.progressCallbacks = new Map(); // Store progress update callbacks
    }

    /**
     * Start tracking an import job
     * @param {number} jobId - Import job ID
     * @param {Object} jobData - Job data
     */
    startJobTracking(jobId, jobData) {
        // Don't overwrite existing job tracking
        if (this.activeJobs.has(jobId)) {
            logger.warn(`Job ${jobId} is already being tracked`);
            return;
        }

        const jobInfo = {
            id: jobId,
            uuid: jobData.job_uuid,
            status: 'processing',
            startTime: new Date(),
            totalItems: jobData.total_items,
            processedItems: 0,
            succeededItems: 0,
            failedItems: 0,
            currentRow: 0,
            errors: [],
            warnings: []
        };

        this.activeJobs.set(jobId, jobInfo);
        logger.info(`Started tracking import job ${jobId}`, jobInfo);
    }

    /**
     * Update job progress
     * @param {number} jobId - Import job ID
     * @param {Object} progress - Progress update data
     */
    updateJobProgress(jobId, progress) {
        const jobInfo = this.activeJobs.get(jobId);
        if (!jobInfo) {
            logger.warn(`Attempted to update progress for untracked job ${jobId}`);
            return;
        }

        // Update job progress
        Object.assign(jobInfo, progress);
        jobInfo.lastUpdate = new Date();

        // Update database
        this.updateJobInDatabase(jobId, progress);

        // Notify progress callbacks
        this.notifyProgressCallbacks(jobId, jobInfo);

        logger.debug(`Updated progress for job ${jobId}`, progress);
    }

    /**
     * Complete an import job
     * @param {number} jobId - Import job ID
     * @param {Object} finalStats - Final job statistics
     */
    async completeJob(jobId, finalStats) {
        const jobInfo = this.activeJobs.get(jobId);
        if (!jobInfo) {
            logger.warn(`Attempted to complete untracked job ${jobId}`);
            return;
        }

        // Update final status
        jobInfo.status = 'completed';
        jobInfo.completionTime = new Date();
        jobInfo.duration = jobInfo.completionTime - jobInfo.startTime;
        Object.assign(jobInfo, finalStats);

        // Update database
        await this.updateJobInDatabase(jobId, {
            status: 'completed',
            items_processed: jobInfo.totalItems,
            items_succeeded: jobInfo.succeededItems,
            items_failed_permanent: jobInfo.failedItems,
            completed_at: jobInfo.completionTime
        });

        // Notify final progress update
        this.notifyProgressCallbacks(jobId, jobInfo);

        // Clean up tracking
        this.activeJobs.delete(jobId);
        this.progressCallbacks.delete(jobId);

        logger.info(`Completed import job ${jobId}`, {
            duration: jobInfo.duration,
            successRate: `${((jobInfo.succeededItems / jobInfo.totalItems) * 100).toFixed(1)}%`
        });
    }

    /**
     * Fail an import job
     * @param {number} jobId - Import job ID
     * @param {Error} error - Error that caused the failure
     */
    async failJob(jobId, error) {
        const jobInfo = this.activeJobs.get(jobId);
        if (!jobInfo) {
            logger.warn(`Attempted to fail untracked job ${jobId}`);
            return;
        }

        // Update failure status
        jobInfo.status = 'failed';
        jobInfo.failureTime = new Date();
        jobInfo.error = error.message;
        jobInfo.duration = jobInfo.failureTime - jobInfo.startTime;

        // Update database
        await this.updateJobInDatabase(jobId, {
            status: 'failed',
            completed_at: jobInfo.failureTime
        });

        // Notify final progress update
        this.notifyProgressCallbacks(jobId, jobInfo);

        // Clean up tracking
        this.activeJobs.delete(jobId);
        this.progressCallbacks.delete(jobId);

        logger.error(`Failed import job ${jobId}`, {
            error: error.message,
            duration: jobInfo.duration
        });
    }

    /**
     * Get current job progress
     * @param {number} jobId - Import job ID
     * @returns {Object|null} Current job progress or null if not found
     */
    getJobProgress(jobId) {
        const jobInfo = this.activeJobs.get(jobId);
        if (!jobInfo) {
            return null;
        }

        // Calculate progress percentage
        const progressPercent = jobInfo.totalItems > 0 
            ? Math.round((jobInfo.processedItems / jobInfo.totalItems) * 100)
            : 0;

        // Calculate estimated time remaining
        const estimatedTimeRemaining = this.calculateEstimatedTimeRemaining(jobInfo);

        return {
            ...jobInfo,
            progressPercent,
            estimatedTimeRemaining,
            isActive: jobInfo.status === 'processing'
        };
    }

    /**
     * Get all active jobs
     * @returns {Array} Array of active job progress
     */
    getAllActiveJobs() {
        return Array.from(this.activeJobs.values()).map(job => {
            const progressPercent = job.totalItems > 0 
                ? Math.round((job.processedItems / job.totalItems) * 100)
                : 0;

            return {
                ...job,
                progressPercent
            };
        });
    }

    /**
     * Register progress callback for a job
     * @param {number} jobId - Import job ID
     * @param {Function} callback - Progress update callback
     */
    registerProgressCallback(jobId, callback) {
        if (!this.progressCallbacks.has(jobId)) {
            this.progressCallbacks.set(jobId, []);
        }
        this.progressCallbacks.get(jobId).push(callback);
    }

    /**
     * Unregister progress callback for a job
     * @param {number} jobId - Import job ID
     * @param {Function} callback - Progress update callback to remove
     */
    unregisterProgressCallback(jobId, callback) {
        const callbacks = this.progressCallbacks.get(jobId);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Process a batch of CSV rows
     * @param {number} jobId - Import job ID
     * @param {Array} rows - Array of CSV rows to process
     * @param {Function} processor - Row processing function
     * @returns {Promise<Object>} Processing results
     */
    async processBatch(jobId, rows, processor) {
        const jobInfo = this.activeJobs.get(jobId);
        if (!jobInfo) {
            throw new Error(`Job ${jobId} is not being tracked`);
        }

        const batchSize = rows.length;
        const results = {
            processed: 0,
            succeeded: 0,
            failed: 0,
            errors: []
        };

        logger.info(`Processing batch of ${batchSize} rows for job ${jobId}`);

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNumber = jobInfo.currentRow + i + 1;

            try {
                // Process the row
                await processor(row, rowNumber);
                results.succeeded++;
                jobInfo.succeededItems++;
            } catch (error) {
                results.failed++;
                jobInfo.failedItems++;
                results.errors.push({
                    row: rowNumber,
                    error: error.message,
                    data: row
                });

                logger.error(`Failed to process row ${rowNumber} in job ${jobId}`, error);
            }

            results.processed++;
            jobInfo.processedItems++;

            // Update progress every 10 rows or at the end
            if ((i + 1) % 10 === 0 || i === rows.length - 1) {
                this.updateJobProgress(jobId, {
                    processedItems: jobInfo.processedItems,
                    succeededItems: jobInfo.succeededItems,
                    failedItems: jobInfo.failedItems,
                    currentRow: jobInfo.currentRow
                });
            }
        }

        // Update current row after batch processing
        jobInfo.currentRow += rows.length;

        logger.info(`Completed batch processing for job ${jobId}`, results);
        return results;
    }

    /**
     * Pause an import job
     * @param {number} jobId - Import job ID
     */
    async pauseJob(jobId) {
        const jobInfo = this.activeJobs.get(jobId);
        if (!jobInfo) {
            throw new Error(`Job ${jobId} is not being tracked`);
        }

        jobInfo.status = 'paused';
        jobInfo.pauseTime = new Date();

        await this.updateJobInDatabase(jobId, {
            status: 'paused'
        });

        this.notifyProgressCallbacks(jobId, jobInfo);
        logger.info(`Paused import job ${jobId}`);
    }

    /**
     * Resume a paused import job
     * @param {number} jobId - Import job ID
     */
    async resumeJob(jobId) {
        const jobInfo = this.activeJobs.get(jobId);
        if (!jobInfo) {
            throw new Error(`Job ${jobId} is not being tracked`);
        }

        jobInfo.status = 'processing';
        jobInfo.resumeTime = new Date();

        await this.updateJobInDatabase(jobId, {
            status: 'processing'
        });

        this.notifyProgressCallbacks(jobId, jobInfo);
        logger.info(`Resumed import job ${jobId}`);
    }

    /**
     * Cancel an import job
     * @param {number} jobId - Import job ID
     */
    async cancelJob(jobId) {
        const jobInfo = this.activeJobs.get(jobId);
        if (!jobInfo) {
            throw new Error(`Job ${jobId} is not being tracked`);
        }

        jobInfo.status = 'cancelled';
        jobInfo.cancelTime = new Date();
        jobInfo.duration = jobInfo.cancelTime - jobInfo.startTime;

        await this.updateJobInDatabase(jobId, {
            status: 'cancelled',
            completed_at: jobInfo.cancelTime
        });

        this.notifyProgressCallbacks(jobId, jobInfo);

        // Clean up tracking
        this.activeJobs.delete(jobId);
        this.progressCallbacks.delete(jobId);

        logger.info(`Cancelled import job ${jobId}`);
    }

    /**
     * Get job statistics
     * @param {number} jobId - Import job ID
     * @returns {Object} Job statistics
     */
    getJobStatistics(jobId) {
        const jobInfo = this.activeJobs.get(jobId);
        if (!jobInfo) {
            return null;
        }

        const successRate = jobInfo.totalItems > 0 
            ? (jobInfo.succeededItems / jobInfo.totalItems) * 100
            : 0;

        const failureRate = jobInfo.totalItems > 0 
            ? (jobInfo.failedItems / jobInfo.totalItems) * 100
            : 0;

        // Calculate duration from start time to now if no lastUpdate
        const now = new Date();
        const duration = jobInfo.lastUpdate 
            ? jobInfo.lastUpdate.getTime() - jobInfo.startTime.getTime()
            : now.getTime() - jobInfo.startTime.getTime();

        return {
            totalItems: jobInfo.totalItems,
            processedItems: jobInfo.processedItems,
            succeededItems: jobInfo.succeededItems,
            failedItems: jobInfo.failedItems,
            successRate: Math.round(successRate * 100) / 100,
            failureRate: Math.round(failureRate * 100) / 100,
            remainingItems: jobInfo.totalItems - jobInfo.processedItems,
            duration: duration
        };
    }

    /**
     * Private methods
     */

    /**
     * Update job in database
     * @param {number} jobId - Import job ID
     * @param {Object} updates - Updates to apply
     */
    async updateJobInDatabase(jobId, updates) {
        try {
            const importJobModel = new ImportJobModel();
            await importJobModel.update(jobId, updates);
        } catch (error) {
            logger.error(`Failed to update job ${jobId} in database`, error);
        }
    }

    /**
     * Notify progress callbacks
     * @param {number} jobId - Import job ID
     * @param {Object} progress - Progress data
     */
    notifyProgressCallbacks(jobId, progress) {
        const callbacks = this.progressCallbacks.get(jobId);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(progress);
                } catch (error) {
                    logger.error(`Error in progress callback for job ${jobId}`, error);
                }
            });
        }
    }

    /**
     * Calculate estimated time remaining
     * @param {Object} jobInfo - Job information
     * @returns {number|null} Estimated time remaining in milliseconds
     */
    calculateEstimatedTimeRemaining(jobInfo) {
        if (jobInfo.processedItems === 0 || jobInfo.processedItems === jobInfo.totalItems) {
            return null;
        }

        const elapsed = Date.now() - jobInfo.startTime;
        const itemsPerMs = jobInfo.processedItems / elapsed;
        const remainingItems = jobInfo.totalItems - jobInfo.processedItems;

        return Math.round(remainingItems / itemsPerMs);
    }
}

module.exports = CsvImportProgressService;
