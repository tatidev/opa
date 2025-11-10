const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

/**
 * ImportItemModel
 * Manages individual items within NetSuite import jobs with retry tracking
 */
class ImportItemModel extends BaseModel {
    constructor() {
        super('netsuite_import_items');
    }

    /**
     * Create import items for a job
     * @param {number} jobId - Job ID
     * @param {Array} items - Array of item data
     * @returns {Promise<number>} Number of items created
     */
    async createItems(jobId, items) {
        try {
            if (!items || items.length === 0) {
                return 0;
            }

            const values = [];
            const placeholders = [];
            
            items.forEach((item, index) => {
                placeholders.push('(?, ?, ?, ?)');
                values.push(jobId, item.opms_item_id, item.opms_item_code, index + 1);
            });

            await this.db.query(`
                INSERT INTO ${this.tableName} 
                (job_id, opms_item_id, opms_item_code, csv_row_number)
                VALUES ${placeholders.join(', ')}
            `, values);

            logger.info(`Created ${items.length} import items for job ${jobId}`);
            return items.length;
        } catch (error) {
            logger.error(`Failed to create import items for job ${jobId}:`, error);
            throw error;
        }
    }

    /**
     * Get pending items for processing
     * @param {number} jobId - Job ID
     * @param {number} limit - Maximum items to return
     * @returns {Promise<Array>} Array of pending items
     */
    async getPendingItems(jobId, limit = 50) {
        try {
            const [rows] = await this.db.query(`
                SELECT * FROM ${this.tableName}
                WHERE job_id = ? 
                  AND status IN ('pending', 'failed_retryable')
                  AND attempt_count < max_retries
                ORDER BY csv_row_number ASC
                LIMIT ?
            `, [jobId, limit]);

            return rows;
        } catch (error) {
            logger.error(`Failed to get pending items for job ${jobId}:`, error);
            throw error;
        }
    }

    /**
     * Update item status and attempt tracking
     * @param {number} itemId - Item ID
     * @param {string} status - New status
     * @param {Object} data - Additional data to update
     * @returns {Promise<boolean>} Success status
     */
    async updateItemStatus(itemId, status, data = {}) {
        try {
            const updateFields = ['status = ?'];
            const updateValues = [status];

            // Add timestamp based on status
            if (status === 'processing') {
                if (!data.first_attempted_at) {
                    updateFields.push('first_attempted_at = NOW()');
                }
                updateFields.push('last_attempted_at = NOW()');
                updateFields.push('attempt_count = attempt_count + 1');
            } else if (status === 'success') {
                updateFields.push('succeeded_at = NOW()');
            }

            // Add any additional data
            Object.keys(data).forEach(key => {
                updateFields.push(`${key} = ?`);
                updateValues.push(data[key]);
            });

            updateValues.push(itemId);

            const [result] = await this.db.query(`
                UPDATE ${this.tableName} 
                SET ${updateFields.join(', ')} 
                WHERE id = ?
            `, updateValues);

            return result.affectedRows > 0;
        } catch (error) {
            logger.error(`Failed to update item ${itemId} status:`, error);
            throw error;
        }
    }

    /**
     * Get failed items for a job
     * @param {number} jobId - Job ID
     * @param {string} failureType - Type of failure ('retryable' or 'permanent')
     * @returns {Promise<Array>} Array of failed items
     */
    async getFailedItems(jobId, failureType = null) {
        try {
            let whereClause = 'WHERE job_id = ?';
            const params = [jobId];

            if (failureType === 'retryable') {
                whereClause += ' AND status = "failed_retryable"';
            } else if (failureType === 'permanent') {
                whereClause += ' AND status = "failed_permanent"';
            } else {
                whereClause += ' AND status IN ("failed_retryable", "failed_permanent")';
            }

            const [rows] = await this.db.query(`
                SELECT opms_item_code, status, attempt_count, last_error_type, 
                       last_error_message, last_attempted_at, csv_row_number
                FROM ${this.tableName}
                ${whereClause}
                ORDER BY csv_row_number ASC
            `, params);

            return rows;
        } catch (error) {
            logger.error(`Failed to get failed items for job ${jobId}:`, error);
            throw error;
        }
    }

    /**
     * Reset retryable failed items for retry
     * @param {number} jobId - Job ID
     * @param {boolean} resetAttemptCount - Whether to reset attempt count
     * @returns {Promise<number>} Number of items reset
     */
    async resetRetryableItems(jobId, resetAttemptCount = false) {
        try {
            let updateFields = ['status = "pending"'];
            if (resetAttemptCount) {
                updateFields.push('attempt_count = 0');
            }

            const [result] = await this.db.query(`
                UPDATE ${this.tableName} 
                SET ${updateFields.join(', ')}
                WHERE job_id = ? AND status = 'failed_retryable'
            `, [jobId]);

            logger.info(`Reset ${result.affectedRows} retryable items for job ${jobId}`);
            return result.affectedRows;
        } catch (error) {
            logger.error(`Failed to reset retryable items for job ${jobId}:`, error);
            throw error;
        }
    }

    /**
     * Find items by job ID with pagination
     * @param {number} jobId - Job ID
     * @param {Object} options - Query options
     * @param {number} options.limit - Maximum items to return
     * @param {number} options.offset - Number of items to skip
     * @returns {Promise<Array>} Array of items
     */
    async findByJobId(jobId, options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;
            
            const [rows] = await this.db.query(`
                SELECT * FROM ${this.tableName}
                WHERE job_id = ?
                ORDER BY csv_row_number ASC
                LIMIT ? OFFSET ?
            `, [jobId, limit, offset]);

            return rows;
        } catch (error) {
            logger.error(`Failed to find items for job ${jobId}:`, error);
            throw error;
        }
    }

    /**
     * Update import item by job ID and row number
     * @param {number} jobId - Job ID
     * @param {number} rowNumber - CSV row number
     * @param {Object} updateData - Data to update
     * @returns {Promise<number>} Number of affected rows
     */
    async updateByJobAndRow(jobId, rowNumber, updateData) {
        try {
            const updateFields = [];
            const values = [];
            
            Object.entries(updateData).forEach(([key, value]) => {
                updateFields.push(`${key} = ?`);
                values.push(value);
            });
            
            // Add WHERE clause parameters
            values.push(jobId, rowNumber);
            
            const [result] = await this.db.query(`
                UPDATE ${this.tableName} 
                SET ${updateFields.join(', ')}
                WHERE job_id = ? AND csv_row_number = ?
            `, values);

            logger.debug(`Updated import item for job ${jobId}, row ${rowNumber}`, {
                affectedRows: result.affectedRows,
                updateFields: Object.keys(updateData)
            });
            
            return result.affectedRows;
        } catch (error) {
            logger.error(`Failed to update import item for job ${jobId}, row ${rowNumber}:`, error);
            throw error;
        }
    }

    /**
     * Bulk create import items
     * @param {Array} items - Array of item data
     * @returns {Promise<Array>} Array of created items
     */
    async bulkCreate(items) {
        try {
            if (!items || items.length === 0) {
                return [];
            }

            const values = [];
            const placeholders = [];
            
            items.forEach(item => {
                placeholders.push('(?, ?, ?, ?, ?, ?, ?)');
                values.push(
                    item.job_id,
                    item.opms_item_id,
                    item.opms_item_code,
                    item.csv_row_number,
                    item.status,
                    item.last_error_message,
                    item.max_retries || 3
                );
            });

            const [result] = await this.db.query(`
                INSERT INTO ${this.tableName} 
                (job_id, opms_item_id, opms_item_code, csv_row_number, status, last_error_message, max_retries)
                VALUES ${placeholders.join(', ')}
            `, values);

            logger.info(`Bulk created ${items.length} import items`);
            return items;
        } catch (error) {
            logger.error(`Failed to bulk create import items:`, error);
            throw error;
        }
    }
}

module.exports = ImportItemModel;
