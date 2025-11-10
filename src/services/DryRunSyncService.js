const NetSuiteDryRunSyncLogModel = require('../models/NetSuiteDryRunSyncLogModel');
const OpmsDataTransformService = require('./OpmsDataTransformService');
const RestletValidationSimulator = require('./RestletValidationSimulator');
const logger = require('../utils/logger');

/**
 * Enhanced Dry-Run Sync Service
 * Intercepts actual JSON payloads from sync operations and stores them in database
 */
class DryRunSyncService {
    constructor() {
        this.dryRunLogModel = new NetSuiteDryRunSyncLogModel();
        this.dataTransformService = new OpmsDataTransformService();
        this.restletSimulator = new RestletValidationSimulator();
    }

    /**
     * Perform dry-run sync for a single OPMS item and store the actual JSON payload
     * @param {number} opmsItemId - OPMS item ID to sync
     * @param {Object} options - Options for dry-run
     * @param {string} options.syncType - Type of sync operation
     * @param {string} options.syncTrigger - What triggered the sync
     * @param {boolean} options.storePayload - Whether to store payload in database
     * @returns {Promise<Object>} - Dry-run result with actual JSON payload
     */
    async performDryRunSync(opmsItemId, options = {}) {
        const {
            syncType = 'item_sync',
            syncTrigger = 'manual_test',
            storePayload = true,
            envOverride = null
        } = options;

        try {
            logger.info('Starting dry-run sync', {
                opmsItemId,
                syncType,
                syncTrigger
            });

            // Step 1-4: Use EXACT SAME flow as real sync
            // Transform OPMS data
            const itemData = await this.dataTransformService.transformItemForNetSuite(opmsItemId);
            
            if (!itemData) {
                throw new Error(`Failed to transform item ID: ${opmsItemId}`);
            }
            
            // Call createLotNumberedInventoryItem with dryRun=true
            // This ensures EXACT same processing as real sync including transformToRestletPayload
            const netsuiteRestletService = require('./netsuiteRestletService');
            const dryRunResult = await netsuiteRestletService.createLotNumberedInventoryItem(itemData, { 
                isOpmsSync: true,
                dryRun: true,
                envOverride: envOverride
            });
            
            // Ensure mini-form fields are present in stored payload (for viewer visibility)
            const netsuitePayloadRaw = dryRunResult.payload || {};
            const netsuitePayload = {
                ...netsuitePayloadRaw,
                frontContentJson: netsuitePayloadRaw.frontContentJson || ' - ',
                backContentJson: netsuitePayloadRaw.backContentJson || ' - ',
                abrasionJson: netsuitePayloadRaw.abrasionJson || ' - ',
                firecodesJson: netsuitePayloadRaw.firecodesJson || ' - '
            };
            
            // Extract metadata for logging
            const opmsData = {
                item_id: opmsItemId,
                item_code: netsuitePayload.itemId,
                product_id: netsuitePayload.custitem_opms_prod_id
            };

            // Step 5: Validate payload (same validation as real sync)
            const validationResult = this.validatePayload(netsuitePayload);

            // Step 4: Simulate RESTlet validation and response
            logger.info('🤖 Running RESTlet validation simulation', { itemId: opmsData.item_code });
            const simulationResult = await this.restletSimulator.simulate(netsuitePayload);
            
            logger.info('🤖 Simulation completed', {
                wouldSucceed: simulationResult.wouldSucceed,
                checksPerformed: simulationResult.checksPerformed,
                checksPassed: simulationResult.checksPassedCount,
                errors: simulationResult.errors
            });

            // Step 5: Store actual JSON payload + simulation results in database (if requested)
            let storedRecord = null;
            if (storePayload) {
                try {
                    storedRecord = await this.dryRunLogModel.storeDryRunPayload({
                        opmsItemId: opmsData.item_id,
                        opmsItemCode: opmsData.item_code,
                        opmsProductId: opmsData.product_id,
                        syncType,
                        syncTrigger,
                        jsonPayload: netsuitePayload,
                        validationStatus: validationResult.status,
                        validationErrors: validationResult.errors,
                        simulatedRestletResponse: simulationResult.mockResponse,
                        simulatedValidationResults: simulationResult.validationChecks,
                        wouldSucceed: simulationResult.wouldSucceed,
                        simulatedErrors: simulationResult.errors ? simulationResult.errors.join('; ') : null
                    });
                    logger.info('✅ Payload and simulation stored successfully', { 
                        storedRecordId: storedRecord?.id,
                        wouldSucceed: simulationResult.wouldSucceed
                    });
                } catch (storeError) {
                    logger.error('❌ Failed to store payload in database', {
                        error: storeError.message,
                        opmsItemId: opmsData.item_id
                    });
                    // Continue without storing - don't fail the entire operation
                    storedRecord = null;
                }
            }

            // Step 6: Return comprehensive dry-run result
            const result = {
                success: true,
                dryRun: true,
                opmsItemId: opmsData.item_id,
                opmsItemCode: opmsData.item_code,
                opmsProductId: opmsData.product_id,
                actualJsonPayload: netsuitePayload,
                payloadMetrics: {
                    sizeBytes: Buffer.byteLength(JSON.stringify(netsuitePayload), 'utf8'),
                    fieldCount: Object.keys(netsuitePayload).length,
                    validationStatus: validationResult.status
                },
                validationResult,
                restletSimulation: simulationResult,
                storedRecordId: storedRecord?.id || null,
                syncType,
                syncTrigger,
                timestamp: new Date().toISOString()
            };

            logger.info('Dry-run sync completed', {
                opmsItemId,
                payloadSizeBytes: result.payloadMetrics.sizeBytes,
                fieldCount: result.payloadMetrics.fieldCount,
                validationStatus: validationResult.status,
                storedRecordId: storedRecord?.id
            });

            return result;

        } catch (error) {
            logger.error('Dry-run sync failed', {
                error: error.message,
                opmsItemId,
                syncType,
                syncTrigger
            });

            return {
                success: false,
                dryRun: true,
                error: error.message,
                opmsItemId,
                syncType,
                syncTrigger,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Perform dry-run sync for multiple OPMS items
     * @param {Array<number>} opmsItemIds - Array of OPMS item IDs
     * @param {Object} options - Options for dry-run
     * @returns {Promise<Object>} - Batch dry-run results
     */
    async performBatchDryRunSync(opmsItemIds, options = {}) {
        const {
            syncType = 'batch_sync',
            syncTrigger = 'manual_batch_test',
            storePayload = true,
            maxConcurrency = 5
        } = options;

        logger.info('Starting batch dry-run sync', {
            itemCount: opmsItemIds.length,
            syncType,
            syncTrigger,
            maxConcurrency
        });

        const results = [];
        const errors = [];

        // Process items in batches to avoid overwhelming the system
        for (let i = 0; i < opmsItemIds.length; i += maxConcurrency) {
            const batch = opmsItemIds.slice(i, i + maxConcurrency);
            
            const batchPromises = batch.map(async (opmsItemId) => {
                try {
                    const result = await this.performDryRunSync(opmsItemId, {
                        syncType,
                        syncTrigger,
                        storePayload
                    });
                    return result;
                } catch (error) {
                    return {
                        success: false,
                        opmsItemId,
                        error: error.message
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Log progress
            logger.info('Batch dry-run progress', {
                processed: Math.min(i + maxConcurrency, opmsItemIds.length),
                total: opmsItemIds.length,
                successCount: results.filter(r => r.success).length,
                errorCount: results.filter(r => !r.success).length
            });
        }

        // Calculate summary statistics
        const successResults = results.filter(r => r.success);
        const errorResults = results.filter(r => !r.success);

        const summary = {
            totalItems: opmsItemIds.length,
            successfulItems: successResults.length,
            failedItems: errorResults.length,
            successRate: (successResults.length / opmsItemIds.length) * 100,
            averagePayloadSize: successResults.length > 0 
                ? successResults.reduce((sum, r) => sum + r.payloadMetrics.sizeBytes, 0) / successResults.length 
                : 0,
            averageFieldCount: successResults.length > 0
                ? successResults.reduce((sum, r) => sum + r.payloadMetrics.fieldCount, 0) / successResults.length
                : 0,
            validationStatuses: successResults.reduce((acc, r) => {
                acc[r.validationResult.status] = (acc[r.validationResult.status] || 0) + 1;
                return acc;
            }, {})
        };

        logger.info('Batch dry-run sync completed', summary);

        return {
            success: true,
            dryRun: true,
            summary,
            results,
            errors: errorResults,
            syncType,
            syncTrigger,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Validate NetSuite payload (same validation as real sync)
     * @param {Object} payload - NetSuite payload to validate
     * @returns {Object} - Validation result
     */
    validatePayload(payload) {
        const errors = [];
        const warnings = [];

        // Required fields validation
        const requiredFields = [
            'itemId',
            'custitem_opms_item_id',
            'custitem_opms_prod_id',
            'displayname'
        ];

        requiredFields.forEach(field => {
            if (!payload[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        });

        // Data type validation
        if (payload.custitem_opms_item_id && typeof payload.custitem_opms_item_id !== 'number') {
            errors.push('custitem_opms_item_id must be a number');
        }

        if (payload.custitem_opms_prod_id && typeof payload.custitem_opms_prod_id !== 'number') {
            errors.push('custitem_opms_prod_id must be a number');
        }

        // Display name format validation
        if (payload.displayname && !payload.displayname.includes(':')) {
            warnings.push('Display name should follow "Product: Color" format');
        }

        // Vendor validation
        if (payload.vendor && typeof payload.vendor !== 'number') {
            errors.push('Vendor ID must be a number');
        }

        const status = errors.length > 0 ? 'failed' : (warnings.length > 0 ? 'partial' : 'passed');

        return {
            status,
            errors: errors.length > 0 ? errors.join('; ') : null,
            warnings: warnings.length > 0 ? warnings.join('; ') : null,
            errorCount: errors.length,
            warningCount: warnings.length
        };
    }

    /**
     * Get stored dry-run payloads for analysis
     * @param {Object} filters - Filters for retrieving payloads
     * @returns {Promise<Object>} - Retrieved payloads and statistics
     */
    async getStoredPayloads(filters = {}) {
        try {
            const {
                opmsItemId,
                opmsItemCode,
                syncType,
                limit = 50,
                includePayload = true
            } = filters;

            let payloads;
            if (opmsItemId) {
                payloads = await this.dryRunLogModel.getByOpmsItemId(opmsItemId, limit, includePayload);
            } else if (opmsItemCode) {
                payloads = await this.dryRunLogModel.getByOpmsItemCode(opmsItemCode, limit, includePayload);
            } else {
                payloads = await this.dryRunLogModel.getRecentPayloads(limit, syncType, includePayload);
            }

            // Get statistics
            const statistics = await this.dryRunLogModel.getPayloadStatistics();

            return {
                success: true,
                payloads,
                statistics,
                filters,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            logger.error('Failed to get stored dry-run payloads', {
                error: error.message,
                filters
            });
            throw error;
        }
    }
}

module.exports = DryRunSyncService;
