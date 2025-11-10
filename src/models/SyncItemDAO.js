'use strict';

/**
 * Sync Item Data Access Object
 * 
 * Raw SQL DAO for managing individual sync item records
 * within NetSuite-to-OPMS sync jobs
 */

const logger = require('../utils/logger');

class SyncItemDAO {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create a new sync item record
   */
  async createItem(itemData) {
    const {
      sync_job_id,
      netsuite_item_id,
      netsuite_internal_id = null,
      opms_item_id = null,
      opms_product_id = null,
      item_code = null,
      status = 'pending',
      sync_fields = null,
      pricing_data = null
    } = itemData;

    try {
      const sql = `
        INSERT INTO netsuite_opms_sync_items 
        (sync_job_id, netsuite_item_id, netsuite_internal_id, opms_item_id, 
         opms_product_id, item_code, status, sync_fields, pricing_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await this.db.query(sql, [
        sync_job_id,
        netsuite_item_id,
        netsuite_internal_id,
        opms_item_id,
        opms_product_id,
        item_code,
        status,
        sync_fields ? (typeof sync_fields === 'string' ? sync_fields : JSON.stringify(sync_fields)) : null,
        pricing_data ? (typeof pricing_data === 'string' ? pricing_data : JSON.stringify(pricing_data)) : null
      ]);

      return {
        id: result.insertId,
        sync_job_id,
        netsuite_item_id,
        status
      };

    } catch (error) {
      logger.error('Failed to create sync item', {
        netsuite_item_id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update sync item status
   */
  async updateItemStatus(itemId, status, errorMessage = null, skipReason = null) {
    try {
      const sql = `
        UPDATE netsuite_opms_sync_items
        SET 
          status = ?,
          error_message = ?,
          skip_reason = ?,
          processed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      await this.db.query(sql, [status, errorMessage, skipReason, itemId]);

      logger.debug('Sync item status updated', {
        itemId,
        status,
        hasError: !!errorMessage
      });

    } catch (error) {
      logger.error('Failed to update sync item status', {
        itemId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update sync item with pricing data
   */
  async updateItemPricingData(itemId, pricingData, syncFields, pricingBefore = null, pricingAfter = null) {
    try {
      const sql = `
        UPDATE netsuite_opms_sync_items
        SET 
          pricing_data = ?,
          sync_fields = ?,
          pricing_before = ?,
          pricing_after = ?,
          status = 'success',
          processed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      await this.db.query(sql, [
        typeof pricingData === 'string' ? pricingData : JSON.stringify(pricingData),
        typeof syncFields === 'string' ? syncFields : JSON.stringify(syncFields),
        pricingBefore ? (typeof pricingBefore === 'string' ? pricingBefore : JSON.stringify(pricingBefore)) : null,
        pricingAfter ? (typeof pricingAfter === 'string' ? pricingAfter : JSON.stringify(pricingAfter)) : null,
        itemId
      ]);

      logger.debug('Sync item pricing data updated', { itemId });

    } catch (error) {
      logger.error('Failed to update sync item pricing data', {
        itemId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Mark item as skipped
   */
  async markItemSkipped(itemId, skipReason) {
    try {
      const sql = `
        UPDATE netsuite_opms_sync_items
        SET 
          status = 'skipped',
          skip_reason = ?,
          processed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      await this.db.query(sql, [skipReason, itemId]);

      logger.info('Sync item marked as skipped', { itemId, skipReason });

    } catch (error) {
      logger.error('Failed to mark item as skipped', {
        itemId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get items for a sync job
   */
  async getItemsByJobId(jobId, limit = 100) {
    try {
      const sql = `
        SELECT * FROM netsuite_opms_sync_items
        WHERE sync_job_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `;

      const [rows] = await this.db.query(sql, [jobId, limit]);
      
      // Parse JSON fields only if they're strings (MySQL 8 returns them as objects)
      return rows.map(row => ({
        ...row,
        sync_fields: row.sync_fields && typeof row.sync_fields === 'string' 
          ? JSON.parse(row.sync_fields) 
          : row.sync_fields,
        pricing_data: row.pricing_data && typeof row.pricing_data === 'string'
          ? JSON.parse(row.pricing_data)
          : row.pricing_data
      }));

    } catch (error) {
      logger.error('Failed to get items by job ID', {
        jobId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get recent successful pricing updates
   */
  async getRecentPricingUpdates(limit = 10, hoursBack = 24) {
    try {
      const sql = `
        SELECT 
          si.id,
          si.netsuite_item_id,
          si.item_code,
          si.opms_product_id,
          si.pricing_data,
          si.sync_fields,
          si.pricing_before,
          si.pricing_after,
          si.processed_at,
          sj.job_type,
          sj.source
        FROM netsuite_opms_sync_items si
        JOIN netsuite_opms_sync_jobs sj ON si.sync_job_id = sj.id
        WHERE si.status = 'success'
          AND si.processed_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
          AND si.pricing_data IS NOT NULL
        ORDER BY si.processed_at DESC
        LIMIT ?
      `;

      const [rows] = await this.db.query(sql, [hoursBack, limit]);
      
      // Parse JSON fields only if they're strings (MySQL 8 returns them as objects)
      return rows.map(row => ({
        ...row,
        sync_fields: row.sync_fields && typeof row.sync_fields === 'string'
          ? JSON.parse(row.sync_fields)
          : row.sync_fields,
        pricing_data: row.pricing_data && typeof row.pricing_data === 'string'
          ? JSON.parse(row.pricing_data)
          : row.pricing_data,
        pricing_before: row.pricing_before && typeof row.pricing_before === 'string'
          ? JSON.parse(row.pricing_before)
          : row.pricing_before,
        pricing_after: row.pricing_after && typeof row.pricing_after === 'string'
          ? JSON.parse(row.pricing_after)
          : row.pricing_after
      }));

    } catch (error) {
      logger.error('Failed to get recent pricing updates', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Add log entry for a sync item
   */
  async addItemLog(itemId, logData) {
    const {
      log_level = 'info',
      message,
      details = null,
      context = null
    } = logData;

    try {
      const sql = `
        INSERT INTO netsuite_opms_sync_logs
        (sync_item_id, log_level, message, details, context)
        VALUES (?, ?, ?, ?, ?)
      `;

      await this.db.query(sql, [
        itemId,
        log_level,
        message,
        details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
        context
      ]);

    } catch (error) {
      logger.error('Failed to add item log', {
        itemId,
        error: error.message
      });
      // Don't throw - logging failures shouldn't break the sync
    }
  }
}

module.exports = SyncItemDAO;

