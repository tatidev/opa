'use strict';

/**
 * Sync Job Data Access Object
 * 
 * Raw SQL DAO for managing NetSuite-to-OPMS sync jobs
 * Replaces Sequelize models with direct MySQL queries
 */

const logger = require('../utils/logger');

class SyncJobDAO {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create a new sync job
   */
  async createJob(jobData) {
    const {
      job_type = 'webhook',
      status = 'pending',
      total_items = 0,
      triggered_by = 'system',
      source = 'webhook'
    } = jobData;

    try {
      const sql = `
        INSERT INTO netsuite_opms_sync_jobs 
        (job_type, status, total_items, triggered_by, source)
        VALUES (?, ?, ?, ?, ?)
      `;

      const [result] = await this.db.query(sql, [
        job_type,
        status,
        total_items,
        triggered_by,
        source
      ]);

      logger.info('Sync job created', {
        jobId: result.insertId,
        job_type,
        total_items
      });

      return {
        id: result.insertId,
        job_type,
        status,
        total_items,
        triggered_by,
        source
      };

    } catch (error) {
      logger.error('Failed to create sync job', { error: error.message });
      throw error;
    }
  }

  /**
   * Update sync job progress
   */
  async updateJobProgress(jobId, progressData) {
    const {
      processed_items,
      successful_items,
      failed_items,
      skipped_items
    } = progressData;

    try {
      const sql = `
        UPDATE netsuite_opms_sync_jobs
        SET 
          processed_items = ?,
          successful_items = ?,
          failed_items = ?,
          skipped_items = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      await this.db.query(sql, [
        processed_items || 0,
        successful_items || 0,
        failed_items || 0,
        skipped_items || 0,
        jobId
      ]);

      logger.debug('Sync job progress updated', {
        jobId,
        processed_items,
        successful_items,
        failed_items,
        skipped_items
      });

    } catch (error) {
      logger.error('Failed to update sync job progress', {
        jobId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Mark job as started
   */
  async markJobStarted(jobId) {
    try {
      const sql = `
        UPDATE netsuite_opms_sync_jobs
        SET 
          status = 'running',
          started_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      await this.db.query(sql, [jobId]);
      logger.info('Sync job marked as started', { jobId });

    } catch (error) {
      logger.error('Failed to mark job as started', {
        jobId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Mark job as completed
   */
  async markJobCompleted(jobId) {
    try {
      const sql = `
        UPDATE netsuite_opms_sync_jobs
        SET 
          status = 'completed',
          completed_at = CURRENT_TIMESTAMP,
          duration_seconds = TIMESTAMPDIFF(SECOND, started_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      await this.db.query(sql, [jobId]);
      logger.info('Sync job marked as completed', { jobId });

    } catch (error) {
      logger.error('Failed to mark job as completed', {
        jobId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Mark job as failed
   */
  async markJobFailed(jobId, errorMessage) {
    try {
      const sql = `
        UPDATE netsuite_opms_sync_jobs
        SET 
          status = 'failed',
          completed_at = CURRENT_TIMESTAMP,
          duration_seconds = TIMESTAMPDIFF(SECOND, started_at, CURRENT_TIMESTAMP),
          error_message = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      await this.db.query(sql, [errorMessage, jobId]);
      logger.error('Sync job marked as failed', { jobId, errorMessage });

    } catch (error) {
      logger.error('Failed to mark job as failed', {
        jobId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async getJobById(jobId) {
    try {
      const sql = `
        SELECT * FROM netsuite_opms_sync_jobs
        WHERE id = ?
      `;

      const [rows] = await this.db.query(sql, [jobId]);
      return rows[0] || null;

    } catch (error) {
      logger.error('Failed to get job by ID', {
        jobId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get recent jobs
   */
  async getRecentJobs(limit = 20) {
    try {
      const sql = `
        SELECT * FROM netsuite_opms_sync_jobs
        ORDER BY created_at DESC
        LIMIT ?
      `;

      const [rows] = await this.db.query(sql, [limit]);
      return rows;

    } catch (error) {
      logger.error('Failed to get recent jobs', { error: error.message });
      throw error;
    }
  }

  /**
   * Get jobs statistics for a time period
   */
  async getJobsStats(hoursBack = 24) {
    try {
      const sql = `
        SELECT 
          COUNT(*) as total_jobs,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
          SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running_jobs,
          SUM(processed_items) as total_items_processed,
          SUM(successful_items) as total_items_successful,
          SUM(failed_items) as total_items_failed,
          SUM(skipped_items) as total_items_skipped,
          AVG(duration_seconds) as avg_duration_seconds
        FROM netsuite_opms_sync_jobs
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
      `;

      const [rows] = await this.db.query(sql, [hoursBack]);
      return rows[0] || {};

    } catch (error) {
      logger.error('Failed to get jobs stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Add log entry for a job
   */
  async addJobLog(jobId, logData) {
    const {
      log_level = 'info',
      message,
      details = null,
      context = null,
      netsuite_item_id = null
    } = logData;

    try {
      const sql = `
        INSERT INTO netsuite_opms_sync_logs
        (sync_job_id, log_level, message, details, context, netsuite_item_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      await this.db.query(sql, [
        jobId,
        log_level,
        message,
        details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
        context,
        netsuite_item_id
      ]);

    } catch (error) {
      logger.error('Failed to add job log', {
        jobId,
        error: error.message
      });
      // Don't throw - logging failures shouldn't break the sync
    }
  }
}

module.exports = SyncJobDAO;

