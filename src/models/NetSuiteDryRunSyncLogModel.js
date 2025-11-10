const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

/**
 * NetSuite Dry Run Sync Log Model
 * Manages storage and retrieval of dry-run sync JSON payloads
 */
class NetSuiteDryRunSyncLogModel extends BaseModel {
    constructor() {
        super('netsuite_dry_run_sync_log');
    }

    /**
     * Store a dry-run sync payload in the database
     * @param {Object} params - Parameters for storing dry-run data
     * @param {number} params.opmsItemId - OPMS item ID
     * @param {string} params.opmsItemCode - OPMS item code
     * @param {number} params.opmsProductId - OPMS product ID
     * @param {string} params.syncType - Type of sync operation
     * @param {string} params.syncTrigger - What triggered the sync
     * @param {Object} params.jsonPayload - Complete JSON payload
     * @param {string} params.validationStatus - Validation result
     * @param {string} params.validationErrors - Any validation errors
     * @returns {Promise<Object>} - Created record
     */
    async storeDryRunPayload(params) {
        try {
            const {
                opmsItemId,
                opmsItemCode,
                opmsProductId,
                syncType = 'item_sync',
                syncTrigger = null,
                jsonPayload,
                validationStatus = 'passed',
                validationErrors = null,
                simulatedRestletResponse = null,
                simulatedValidationResults = null,
                wouldSucceed = true,
                simulatedErrors = null
            } = params;

            // Type validation
            if (!Number.isInteger(opmsItemId)) {
                throw new TypeError(`opmsItemId must be an integer, got: ${typeof opmsItemId}`);
            }
            if (typeof opmsItemCode !== 'string') {
                throw new TypeError(`opmsItemCode must be a string, got: ${typeof opmsItemCode}`);
            }
            if (!Number.isInteger(opmsProductId)) {
                throw new TypeError(`opmsProductId must be an integer, got: ${typeof opmsProductId}`);
            }
            if (typeof wouldSucceed !== 'boolean') {
                throw new TypeError(`wouldSucceed must be a boolean, got: ${typeof wouldSucceed}`);
            }

            // Calculate payload metrics
            const payloadJson = JSON.stringify(jsonPayload);
            const payloadSizeBytes = Buffer.byteLength(payloadJson, 'utf8');
            const fieldCount = Object.keys(jsonPayload).length;

            const insertData = {
                opms_item_id: opmsItemId,
                opms_item_code: opmsItemCode,
                opms_product_id: opmsProductId,
                sync_type: syncType,
                sync_trigger: syncTrigger,
                actual_json_payload: payloadJson,
                payload_size_bytes: payloadSizeBytes,
                field_count: fieldCount,
                validation_status: validationStatus,
                validation_errors: validationErrors,
                simulated_restlet_response: simulatedRestletResponse ? JSON.stringify(simulatedRestletResponse) : null,
                simulated_validation_results: simulatedValidationResults ? JSON.stringify(simulatedValidationResults) : null,
                would_succeed: wouldSucceed,
                simulated_errors: simulatedErrors
            };

            const result = await this.create(insertData);
            
            logger.info('Stored dry-run sync payload', {
                id: result.id,
                opmsItemId,
                opmsItemCode,
                payloadSizeBytes,
                fieldCount,
                validationStatus
            });

            return result;

        } catch (error) {
            logger.error('Failed to store dry-run sync payload', {
                error: error.message,
                opmsItemId: params.opmsItemId,
                opmsItemCode: params.opmsItemCode
            });
            throw error;
        }
    }

    /**
     * Get dry-run payloads by OPMS item ID
     * @param {number} opmsItemId - OPMS item ID
     * @param {number} limit - Maximum number of records to return
     * @returns {Promise<Array>} - Array of dry-run records
     */
    async getByOpmsItemId(opmsItemId, limit = 10, includePayload = false) {
        try {
            const columns = [
                'id',
                'opms_item_id',
                'opms_item_code',
                'opms_product_id',
                'sync_type',
                'sync_trigger',
                'payload_size_bytes',
                'field_count',
                'validation_status',
                'validation_errors',
                'would_succeed',
                'simulated_errors',
                'created_at'
            ];
            
            if (includePayload) {
                columns.push('actual_json_payload');
                columns.push('simulated_restlet_response');
                columns.push('simulated_validation_results');
            }
            
            const sql = `
                SELECT ${columns.join(', ')}
                FROM ${this.tableName}
                WHERE opms_item_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            `;

            const [results] = await this.db.query(sql, [opmsItemId, limit]);
            return results;

        } catch (error) {
            logger.error('Failed to get dry-run payloads by OPMS item ID', {
                error: error.message,
                opmsItemId
            });
            throw error;
        }
    }

    /**
     * Get dry-run payloads by OPMS item code
     * @param {string} opmsItemCode - OPMS item code
     * @param {number} limit - Maximum number of records to return
     * @returns {Promise<Array>} - Array of dry-run records
     */
    async getByOpmsItemCode(opmsItemCode, limit = 10, includePayload = false) {
        try {
            const columns = [
                'id',
                'opms_item_id',
                'opms_item_code',
                'opms_product_id',
                'sync_type',
                'sync_trigger',
                'payload_size_bytes',
                'field_count',
                'validation_status',
                'validation_errors',
                'would_succeed',
                'simulated_errors',
                'created_at'
            ];
            
            if (includePayload) {
                columns.push('actual_json_payload');
                columns.push('simulated_restlet_response');
                columns.push('simulated_validation_results');
            }
            
            const sql = `
                SELECT ${columns.join(', ')}
                FROM ${this.tableName}
                WHERE opms_item_code = ?
                ORDER BY created_at DESC
                LIMIT ?
            `;

            const [results] = await this.db.query(sql, [opmsItemCode, limit]);
            return results;

        } catch (error) {
            logger.error('Failed to get dry-run payloads by OPMS item code', {
                error: error.message,
                opmsItemCode
            });
            throw error;
        }
    }

    /**
     * Get recent dry-run payloads across all items
     * @param {number} limit - Maximum number of records to return
     * @param {string} syncType - Filter by sync type (optional)
     * @returns {Promise<Array>} - Array of dry-run records
     */
    async getRecentPayloads(limit = 50, syncType = null, includePayload = false) {
        try {
            const columns = [
                'id',
                'opms_item_id',
                'opms_item_code',
                'opms_product_id',
                'sync_type',
                'sync_trigger',
                'payload_size_bytes',
                'field_count',
                'validation_status',
                'validation_errors',
                'would_succeed',
                'simulated_errors',
                'created_at'
            ];
            
            if (includePayload) {
                columns.push('actual_json_payload');
                columns.push('simulated_restlet_response');
                columns.push('simulated_validation_results');
            }
            
            let sql = `SELECT ${columns.join(', ')} FROM ${this.tableName}`;

            const params = [];
            if (syncType) {
                sql += ' WHERE sync_type = ?';
                params.push(syncType);
            }

            sql += ' ORDER BY created_at DESC LIMIT ?';
            params.push(limit);

            const [results] = await this.db.query(sql, params);
            return results;

        } catch (error) {
            logger.error('Failed to get recent dry-run payloads', {
                error: error.message,
                limit,
                syncType
            });
            throw error;
        }
    }

    /**
     * Get dry-run payload statistics
     * @returns {Promise<Object>} - Statistics about stored payloads
     */
    async getPayloadStatistics() {
        try {
            const sql = `
                SELECT 
                    COUNT(*) as total_payloads,
                    COUNT(DISTINCT opms_item_id) as unique_items,
                    COUNT(DISTINCT opms_product_id) as unique_products,
                    AVG(payload_size_bytes) as avg_payload_size,
                    AVG(field_count) as avg_field_count,
                    MIN(created_at) as earliest_payload,
                    MAX(created_at) as latest_payload,
                    sync_type,
                    validation_status,
                    COUNT(*) as count
                FROM ${this.tableName}
                GROUP BY sync_type, validation_status
                ORDER BY sync_type, validation_status
            `;

            const [results] = await this.db.query(sql);
            return results;

        } catch (error) {
            logger.error('Failed to get dry-run payload statistics', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Delete a specific dry-run payload by ID
     * @param {number} payloadId - The ID of the payload to delete
     * @returns {Promise<boolean>} - True if deleted successfully
     */
    async deletePayloadById(payloadId) {
        try {
            const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
            const [result] = await this.db.query(sql, [payloadId]);
            
            if (result.affectedRows === 0) {
                logger.warn('No dry-run payload found to delete', { payloadId });
                return false;
            }

            logger.info('Dry-run payload deleted successfully', { payloadId });
            return true;
        } catch (error) {
            logger.error('Failed to delete dry-run payload', {
                error: error.message,
                payloadId
            });
            throw error;
        }
    }

    /**
     * Delete dry-run payloads by OPMS item ID
     * @param {number} opmsItemId - The OPMS item ID
     * @returns {Promise<number>} - Number of records deleted
     */
    async deletePayloadsByOpmsItemId(opmsItemId) {
        try {
            const sql = `DELETE FROM ${this.tableName} WHERE opms_item_id = ?`;
            const [result] = await this.db.query(sql, [opmsItemId]);
            const deletedCount = result.affectedRows;

            logger.info('Deleted dry-run payloads by OPMS item ID', {
                opmsItemId,
                deletedCount
            });

            return deletedCount;
        } catch (error) {
            logger.error('Failed to delete dry-run payloads by OPMS item ID', {
                error: error.message,
                opmsItemId
            });
            throw error;
        }
    }

    /**
     * Delete dry-run payloads by sync type
     * @param {string} syncType - The sync type to delete
     * @returns {Promise<number>} - Number of records deleted
     */
    async deletePayloadsBySyncType(syncType) {
        try {
            const sql = `DELETE FROM ${this.tableName} WHERE sync_type = ?`;
            const [result] = await this.db.query(sql, [syncType]);
            const deletedCount = result.affectedRows;

            logger.info('Deleted dry-run payloads by sync type', {
                syncType,
                deletedCount
            });

            return deletedCount;
        } catch (error) {
            logger.error('Failed to delete dry-run payloads by sync type', {
                error: error.message,
                syncType
            });
            throw error;
        }
    }

    /**
     * Delete all dry-run payloads (use with caution!)
     * @returns {Promise<number>} - Number of records deleted
     */
    async deleteAllPayloads() {
        try {
            const sql = `DELETE FROM ${this.tableName}`;
            const [result] = await this.db.query(sql);
            const deletedCount = result.affectedRows;

            logger.warn('Deleted ALL dry-run payloads', { deletedCount });
            return deletedCount;
        } catch (error) {
            logger.error('Failed to delete all dry-run payloads', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Clean up old dry-run payloads (older than specified days)
     * @param {number} daysOld - Number of days old to consider for cleanup
     * @returns {Promise<number>} - Number of records deleted
     */
    async cleanupOldPayloads(daysOld = 30) {
        try {
            const sql = `
                DELETE FROM ${this.tableName}
                WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
            `;

            const [result] = await this.db.query(sql, [daysOld]);
            const deletedCount = result.affectedRows;

            logger.info('Cleaned up old dry-run payloads', {
                deletedCount,
                daysOld
            });

            return deletedCount;

        } catch (error) {
            logger.error('Failed to cleanup old dry-run payloads', {
                error: error.message,
                daysOld
            });
            throw error;
        }
    }
}

module.exports = NetSuiteDryRunSyncLogModel;
