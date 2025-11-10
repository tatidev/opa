/**
 * OPMS Change Log Model
 * Tracks changes detected in OPMS for synchronization purposes
 */

const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class OpmsChangeLog extends BaseModel {
    constructor() {
        super('opms_change_log');
    }

    /**
     * Log a detected change in OPMS
     * @param {Object} changeData - Change information
     * @returns {Promise<Object>} - Created change log entry
     */
    async logChange(changeData) {
        try {
            const {
                item_id,
                product_id,
                change_type,
                change_source,
                change_data,
                detected_at = new Date()
            } = changeData;

            const query = `
                INSERT INTO opms_change_log (
                    item_id, product_id, change_type, change_source, 
                    change_data, detected_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, NOW())
            `;

            const result = await this.db.query(query, [
                item_id,
                product_id,
                change_type,
                change_source,
                JSON.stringify(change_data),
                detected_at
            ]);

            logger.info('OPMS change logged', {
                changeLogId: result.insertId,
                itemId: item_id,
                productId: product_id,
                changeType: change_type,
                changeSource: change_source
            });

            return {
                id: result.insertId,
                ...changeData,
                created_at: new Date()
            };
        } catch (error) {
            logger.error('Failed to log OPMS change', {
                error: error.message,
                changeData: changeData
            });
            throw error;
        }
    }

    /**
     * Get recent changes for monitoring
     * @param {Object} options - Query options
     * @returns {Promise<Array>} - Recent changes
     */
    async getRecentChanges(options = {}) {
        try {
            const {
                limit = 100,
                hours = 24,
                change_type = null,
                change_source = null
            } = options;

            let query = `
                SELECT 
                    id,
                    item_id,
                    product_id,
                    change_type,
                    change_source,
                    change_data,
                    detected_at,
                    created_at
                FROM opms_change_log
                WHERE detected_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
            `;

            const params = [hours];

            if (change_type) {
                query += ' AND change_type = ?';
                params.push(change_type);
            }

            if (change_source) {
                query += ' AND change_source = ?';
                params.push(change_source);
            }

            query += ' ORDER BY detected_at DESC LIMIT ?';
            params.push(limit);

            const [results] = await this.db.query(query, params);

            return results.map(row => ({
                ...row,
                change_data: typeof row.change_data === 'string' 
                    ? JSON.parse(row.change_data) 
                    : row.change_data
            }));
        } catch (error) {
            logger.error('Failed to get recent changes', {
                error: error.message,
                options: options
            });
            throw error;
        }
    }

    /**
     * Get change statistics for monitoring
     * @param {Object} options - Query options
     * @returns {Promise<Object>} - Change statistics
     */
    async getChangeStats(options = {}) {
        try {
            const { hours = 24 } = options;

            const query = `
                SELECT 
                    change_type,
                    change_source,
                    COUNT(*) as count,
                    MIN(detected_at) as first_change,
                    MAX(detected_at) as last_change
                FROM opms_change_log
                WHERE detected_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
                GROUP BY change_type, change_source
                ORDER BY count DESC
            `;

            const [results] = await this.db.query(query, [hours]);

            const totalQuery = `
                SELECT COUNT(*) as total_changes
                FROM opms_change_log
                WHERE detected_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
            `;

            const [totalResult] = await this.db.query(totalQuery, [hours]);

            return {
                total_changes: totalResult.total_changes,
                by_type_and_source: results,
                period_hours: hours
            };
        } catch (error) {
            logger.error('Failed to get change statistics', {
                error: error.message,
                options: options
            });
            throw error;
        }
    }

    /**
     * Clean up old change log entries
     * @param {number} daysToKeep - Number of days to retain
     * @returns {Promise<number>} - Number of deleted entries
     */
    async cleanupOldEntries(daysToKeep = 30) {
        try {
            const query = `
                DELETE FROM opms_change_log
                WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
            `;

            const [result] = await this.db.query(query, [daysToKeep]);

            logger.info('Cleaned up old change log entries', {
                deletedCount: result.affectedRows,
                daysToKeep: daysToKeep
            });

            return result.affectedRows;
        } catch (error) {
            logger.error('Failed to cleanup old change log entries', {
                error: error.message,
                daysToKeep: daysToKeep
            });
            throw error;
        }
    }
}

module.exports = OpmsChangeLog;

