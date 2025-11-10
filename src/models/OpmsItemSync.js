/**
 * OPMS Item Sync Model
 * Manages individual item synchronization status and history
 */

const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class OpmsItemSync extends BaseModel {
    constructor() {
        super('opms_item_sync_status');
    }

    /**
     * Update item sync status
     * @param {Object} syncData - Sync status information
     * @returns {Promise<Object>} - Updated sync status
     */
    async updateSyncStatus(syncData) {
        try {
            const {
                item_id,
                product_id,
                sync_status,
                last_sync_at = new Date(),
                netsuite_item_id = null,
                sync_error = null,
                sync_attempts = 1,
                field_validation_results = null
            } = syncData;

            // Upsert sync status record
            const query = `
                INSERT INTO opms_item_sync_status (
                    item_id, product_id, sync_status, last_sync_at, 
                    netsuite_item_id, sync_error, sync_attempts, 
                    field_validation_results, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    sync_status = VALUES(sync_status),
                    last_sync_at = VALUES(last_sync_at),
                    netsuite_item_id = VALUES(netsuite_item_id),
                    sync_error = VALUES(sync_error),
                    sync_attempts = sync_attempts + 1,
                    field_validation_results = VALUES(field_validation_results),
                    updated_at = NOW()
            `;

            await this.db.query(query, [
                item_id,
                product_id,
                sync_status,
                last_sync_at,
                netsuite_item_id,
                sync_error,
                sync_attempts,
                field_validation_results ? JSON.stringify(field_validation_results) : null
            ]);

            logger.info('Item sync status updated', {
                itemId: item_id,
                productId: product_id,
                syncStatus: sync_status,
                netsuiteItemId: netsuite_item_id
            });

            return await this.getSyncStatus(item_id);
        } catch (error) {
            logger.error('Failed to update item sync status', {
                error: error.message,
                syncData: syncData
            });
            throw error;
        }
    }

    /**
     * Get sync status for an item
     * @param {number} itemId - Item ID
     * @returns {Promise<Object|null>} - Sync status or null
     */
    async getSyncStatus(itemId) {
        try {
            const query = `
                SELECT 
                    item_id,
                    product_id,
                    sync_status,
                    last_sync_at,
                    netsuite_item_id,
                    sync_error,
                    sync_attempts,
                    field_validation_results,
                    created_at,
                    updated_at
                FROM opms_item_sync_status
                WHERE item_id = ?
            `;

            const [result] = await this.db.query(query, [itemId]);

            if (result) {
                return {
                    ...result,
                    field_validation_results: result.field_validation_results 
                        ? JSON.parse(result.field_validation_results)
                        : null
                };
            }

            return null;
        } catch (error) {
            logger.error('Failed to get item sync status', {
                error: error.message,
                itemId: itemId
            });
            throw error;
        }
    }

    /**
     * Get items that need synchronization
     * @param {Object} options - Query options
     * @returns {Promise<Array>} - Items needing sync
     */
    async getItemsNeedingSync(options = {}) {
        try {
            const {
                limit = 100,
                sync_status = ['FAILED', 'NEVER_SYNCED'],
                max_attempts = 5
            } = options;

            const statusPlaceholders = sync_status.map(() => '?').join(',');

            const query = `
                SELECT 
                    iss.item_id,
                    iss.product_id,
                    iss.sync_status,
                    iss.last_sync_at,
                    iss.sync_error,
                    iss.sync_attempts,
                    i.code as item_code,
                    p.name as product_name
                FROM opms_item_sync_status iss
                JOIN T_ITEM i ON iss.item_id = i.id
                JOIN T_PRODUCT p ON iss.product_id = p.id
                WHERE iss.sync_status IN (${statusPlaceholders})
                  AND iss.sync_attempts < ?
                  AND i.archived = 'N'
                  AND p.archived = 'N'
                ORDER BY 
                    CASE iss.sync_status 
                        WHEN 'FAILED' THEN 1 
                        WHEN 'NEVER_SYNCED' THEN 2 
                    END,
                    iss.last_sync_at ASC
                LIMIT ?
            `;

            const params = [...sync_status, max_attempts, limit];
            const [results] = await this.db.query(query, params);

            return results;
        } catch (error) {
            logger.error('Failed to get items needing sync', {
                error: error.message,
                options: options
            });
            throw error;
        }
    }

    /**
     * Get sync statistics
     * @param {Object} options - Query options
     * @returns {Promise<Object>} - Sync statistics
     */
    async getSyncStats(options = {}) {
        try {
            const { hours = 24 } = options;

            const query = `
                SELECT 
                    sync_status,
                    COUNT(*) as count,
                    AVG(sync_attempts) as avg_attempts,
                    MIN(last_sync_at) as earliest_sync,
                    MAX(last_sync_at) as latest_sync
                FROM opms_item_sync_status
                WHERE last_sync_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
                GROUP BY sync_status
                ORDER BY count DESC
            `;

            const [results] = await this.db.query(query, [hours]);

            const totalQuery = `
                SELECT 
                    COUNT(*) as total_items,
                    SUM(CASE WHEN sync_status = 'SUCCESS' THEN 1 ELSE 0 END) as successful_syncs,
                    SUM(CASE WHEN sync_status = 'FAILED' THEN 1 ELSE 0 END) as failed_syncs,
                    SUM(CASE WHEN sync_status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_syncs,
                    AVG(sync_attempts) as avg_sync_attempts
                FROM opms_item_sync_status
                WHERE last_sync_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
            `;

            const [totals] = await this.db.query(totalQuery, [hours]);

            const errorQuery = `
                SELECT 
                    sync_error,
                    COUNT(*) as error_count
                FROM opms_item_sync_status
                WHERE sync_status = 'FAILED'
                  AND last_sync_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
                  AND sync_error IS NOT NULL
                GROUP BY sync_error
                ORDER BY error_count DESC
                LIMIT 10
            `;

            const [errorStats] = await this.db.query(errorQuery, [hours]);

            return {
                totals: totals,
                by_status: results,
                common_errors: errorStats,
                success_rate: totals.total_items > 0 
                    ? (totals.successful_syncs / totals.total_items * 100).toFixed(2) + '%'
                    : '0%',
                period_hours: hours
            };
        } catch (error) {
            logger.error('Failed to get sync statistics', {
                error: error.message,
                options: options
            });
            throw error;
        }
    }

    /**
     * Get items with field validation issues
     * @param {Object} options - Query options
     * @returns {Promise<Array>} - Items with validation issues
     */
    async getItemsWithValidationIssues(options = {}) {
        try {
            const { limit = 50 } = options;

            const query = `
                SELECT 
                    iss.item_id,
                    iss.product_id,
                    iss.field_validation_results,
                    iss.last_sync_at,
                    i.code as item_code,
                    p.name as product_name
                FROM opms_item_sync_status iss
                JOIN T_ITEM i ON iss.item_id = i.id
                JOIN T_PRODUCT p ON iss.product_id = p.id
                WHERE iss.field_validation_results IS NOT NULL
                  AND JSON_EXTRACT(iss.field_validation_results, '$') IS NOT NULL
                  AND i.archived = 'N'
                  AND p.archived = 'N'
                ORDER BY iss.last_sync_at DESC
                LIMIT ?
            `;

            const [results] = await this.db.query(query, [limit]);

            return results.map(item => ({
                ...item,
                field_validation_results: item.field_validation_results 
                    ? JSON.parse(item.field_validation_results)
                    : null
            }));
        } catch (error) {
            logger.error('Failed to get items with validation issues', {
                error: error.message,
                options: options
            });
            throw error;
        }
    }

    /**
     * Mark items as never synced for initial setup
     * @param {Array} itemIds - Array of item IDs
     * @returns {Promise<number>} - Number of items marked
     */
    async markItemsAsNeverSynced(itemIds) {
        try {
            if (!itemIds || itemIds.length === 0) {
                return 0;
            }

            const placeholders = itemIds.map(() => '?').join(',');
            
            const query = `
                INSERT IGNORE INTO opms_item_sync_status (
                    item_id, product_id, sync_status, created_at, updated_at
                )
                SELECT 
                    i.id, 
                    i.product_id, 
                    'NEVER_SYNCED', 
                    NOW(), 
                    NOW()
                FROM T_ITEM i
                WHERE i.id IN (${placeholders})
                  AND i.archived = 'N'
            `;

            const [result] = await this.db.query(query, itemIds);

            logger.info('Items marked as never synced', {
                itemCount: result.affectedRows,
                requestedCount: itemIds.length
            });

            return result.affectedRows;
        } catch (error) {
            logger.error('Failed to mark items as never synced', {
                error: error.message,
                itemIds: itemIds
            });
            throw error;
        }
    }

    /**
     * Clean up old sync status records
     * @param {number} daysToKeep - Number of days to retain
     * @returns {Promise<number>} - Number of deleted records
     */
    async cleanupOldSyncStatus(daysToKeep = 90) {
        try {
            const query = `
                DELETE FROM opms_item_sync_status
                WHERE sync_status IN ('SUCCESS', 'FAILED')
                  AND updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)
            `;

            const [result] = await this.db.query(query, [daysToKeep]);

            logger.info('Cleaned up old sync status records', {
                deletedCount: result.affectedRows,
                daysToKeep: daysToKeep
            });

            return result.affectedRows;
        } catch (error) {
            logger.error('Failed to cleanup old sync status records', {
                error: error.message,
                daysToKeep: daysToKeep
            });
            throw error;
        }
    }
}

module.exports = OpmsItemSync;

