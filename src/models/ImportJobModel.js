const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

/**
 * ImportJobModel
 * Manages NetSuite import jobs with status tracking and progress counters
 */
class ImportJobModel extends BaseModel {
    constructor() {
        super('netsuite_import_jobs');
    }

    /**
     * Create a new import job
     * @param {Object} jobData - Job creation data
     * @param {string} jobData.job_uuid - Unique job identifier
     * @param {string} jobData.original_filename - Original CSV filename
     * @param {number} jobData.total_items - Total items to process
     * @param {number} jobData.created_by_user_id - User who created the job
     * @returns {Promise<number>} Job ID
     */
    async createJob(jobData) {
        try {
            const [result] = await this.db.query(`
                INSERT INTO ${this.tableName} 
                (job_uuid, original_filename, total_items, created_by_user_id, status, created_at)
                VALUES (?, ?, ?, ?, 'pending', NOW())
            `, [
                jobData.job_uuid,
                jobData.original_filename, 
                jobData.total_items,
                jobData.created_by_user_id
            ]);

            logger.info(`Created import job ${jobData.job_uuid} with ${jobData.total_items} items`);
            return result.insertId;
        } catch (error) {
            logger.error('Failed to create import job:', error);
            throw error;
        }
    }

    /**
     * Get job by UUID
     * @param {string} jobUuid - Job UUID
     * @returns {Promise<Object|null>} Job data or null if not found
     */
    async getJobByUuid(jobUuid) {
        try {
            const [rows] = await this.db.query(`
                SELECT * FROM ${this.tableName} WHERE job_uuid = ?
            `, [jobUuid]);
            
            return rows[0] || null;
        } catch (error) {
            logger.error(`Failed to get job ${jobUuid}:`, error);
            throw error;
        }
    }

    /**
     * Update job status
     * @param {string} jobUuid - Job UUID
     * @param {string} status - New status
     * @param {Object} additionalData - Additional fields to update
     * @returns {Promise<boolean>} Success status
     */
    async updateJobStatus(jobUuid, status, additionalData = {}) {
        try {
            let updateFields = ['status = ?'];
            let updateValues = [status];
            
            // Set timestamps based on status
            if (status === 'processing' && !additionalData.started_at) {
                updateFields.push('started_at = NOW()');
            } else if (['completed', 'failed', 'cancelled'].includes(status) && !additionalData.completed_at) {
                updateFields.push('completed_at = NOW()');
            }

            // Add additional fields to update
            Object.keys(additionalData).forEach(key => {
                updateFields.push(`${key} = ?`);
                updateValues.push(additionalData[key]);
            });

            updateValues.push(jobUuid); // For WHERE clause

            const [result] = await this.db.query(`
                UPDATE ${this.tableName} 
                SET ${updateFields.join(', ')} 
                WHERE job_uuid = ?
            `, updateValues);

            if (result.affectedRows > 0) {
                logger.info(`Updated job ${jobUuid} status to ${status}`);
                return true;
            } else {
                logger.warn(`Job ${jobUuid} not found for status update`);
                return false;
            }
        } catch (error) {
            logger.error(`Failed to update job ${jobUuid} status:`, error);
            throw error;
        }
    }

    /**
     * Update job counters (items processed, succeeded, failed)
     * @param {string} jobUuid - Job UUID
     * @param {Object} counters - Counter updates
     * @returns {Promise<boolean>} Success status
     */
    async updateJobCounters(jobUuid, counters) {
        try {
            const updateFields = [];
            const updateValues = [];

            Object.keys(counters).forEach(key => {
                updateFields.push(`${key} = ?`);
                updateValues.push(counters[key]);
            });

            updateValues.push(jobUuid);

            const [result] = await this.db.query(`
                UPDATE ${this.tableName} 
                SET ${updateFields.join(', ')} 
                WHERE job_uuid = ?
            `, updateValues);

            if (result.affectedRows > 0) {
                logger.debug(`Updated counters for job ${jobUuid}`, counters);
                return true;
            } else {
                logger.warn(`Job ${jobUuid} not found for counter update`);
                return false;
            }
        } catch (error) {
            logger.error(`Failed to update job ${jobUuid} counters:`, error);
            throw error;
        }
    }

    /**
     * Get job progress summary
     * @param {string} jobUuid - Job UUID
     * @returns {Promise<Object|null>} Progress data
     */
    async getJobProgress(jobUuid) {
        try {
            const job = await this.db(this.tableName)
                .select([
                    'job_uuid',
                    'status', 
                    'total_items',
                    'items_processed',
                    'items_succeeded', 
                    'items_failed_permanent',
                    'items_failed_retryable',
                    'created_at',
                    'started_at',
                    'completed_at'
                ])
                .where('job_uuid', jobUuid)
                .first();

            if (!job) return null;

            // Calculate additional progress metrics
            const progress = {
                ...job,
                percentage: job.total_items > 0 ? 
                    Math.round((job.items_processed / job.total_items) * 100 * 10) / 10 : 0,
                pending_items: job.total_items - job.items_processed,
                success_rate: job.items_processed > 0 ? 
                    Math.round((job.items_succeeded / job.items_processed) * 100 * 10) / 10 : 0
            };

            return progress;
        } catch (error) {
            logger.error(`Failed to get job progress ${jobUuid}:`, error);
            throw error;
        }
    }

    /**
     * Get recent jobs for a user
     * @param {number} userId - User ID (optional)
     * @param {number} limit - Maximum number of jobs to return
     * @returns {Promise<Array>} Array of job summaries
     */
    async getRecentJobs(userId = null, limit = 10) {
        try {
            let query = this.db(this.tableName)
                .select([
                    'job_uuid',
                    'original_filename',
                    'status',
                    'total_items', 
                    'items_succeeded',
                    'items_failed_permanent',
                    'items_failed_retryable',
                    'created_at',
                    'completed_at'
                ])
                .orderBy('created_at', 'desc')
                .limit(limit);

            if (userId) {
                query = query.where('created_by_user_id', userId);
            }

            const jobs = await query;
            
            // Add calculated fields
            return jobs.map(job => ({
                ...job,
                success_rate: job.items_succeeded > 0 && job.total_items > 0 ?
                    Math.round((job.items_succeeded / job.total_items) * 100 * 10) / 10 : 0,
                is_complete: ['completed', 'failed', 'cancelled'].includes(job.status)
            }));
        } catch (error) {
            logger.error('Failed to get recent jobs:', error);
            throw error;
        }
    }

    /**
     * Delete old completed jobs (cleanup)
     * @param {number} daysOld - Delete jobs older than this many days
     * @returns {Promise<number>} Number of jobs deleted
     */
    async cleanupOldJobs(daysOld = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const deleted = await this.db(this.tableName)
                .where('completed_at', '<', cutoffDate)
                .whereIn('status', ['completed', 'cancelled'])
                .del();

            if (deleted > 0) {
                logger.info(`Cleaned up ${deleted} old import jobs`);
            }

            return deleted;
        } catch (error) {
            logger.error('Failed to cleanup old jobs:', error);
            throw error;
        }
    }
}

module.exports = ImportJobModel;
