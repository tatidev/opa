/**
 * OPMS Change Detection Service
 * Multi-layered change detection system for OPMS Product and Item updates
 * 
 * Implements three detection layers:
 * 1. Database Triggers (Primary) - Real-time detection
 * 2. Polling Service (Backup) - Catches missed changes
 * 3. Manual Triggers (On-demand) - API-driven sync
 */

const logger = require('../utils/logger');
const NetSuiteSyncJob = require('../models/NetSuiteSyncJob');
const OpmsChangeLog = require('../models/OpmsChangeLog');
const BaseModel = require('../models/BaseModel');

class OpmsChangeDetectionService extends BaseModel {
    constructor() {
        super();
        this.netSuiteSyncJob = new NetSuiteSyncJob();
        this.opmsChangeLog = new OpmsChangeLog();
        this.pollingInterval = 60000; // 1 minute
        this.lastPollTimestamp = null;
        this.isPollingActive = false;
        this.pollingIntervalId = null;
    }

    /**
     * Initialize the change detection service
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            logger.info('Initializing OPMS Change Detection Service');

            // Verify database triggers are installed
            await this.verifyTriggersInstalled();

            // Start polling service - TEMPORARILY DISABLED FOR TESTING
            // await this.startPollingService();

            logger.info('OPMS Change Detection Service initialized successfully', {
                triggersActive: true,
                pollingActive: this.isPollingActive,
                pollingIntervalMs: this.pollingInterval
            });
        } catch (error) {
            logger.error('Failed to initialize OPMS Change Detection Service', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Verify that database triggers are installed and active
     * @returns {Promise<boolean>}
     */
    async verifyTriggersInstalled() {
        try {
            const query = `
                SELECT 
                    TRIGGER_NAME,
                    EVENT_MANIPULATION,
                    EVENT_OBJECT_TABLE,
                    CREATED
                FROM information_schema.TRIGGERS 
                WHERE TRIGGER_SCHEMA = DATABASE() 
                  AND TRIGGER_NAME IN ('opms_item_sync_trigger', 'opms_product_sync_trigger')
            `;

            const [triggers] = await this.db.query(query);

            const expectedTriggers = ['opms_item_sync_trigger', 'opms_product_sync_trigger'];
            const installedTriggers = triggers.map(t => t.TRIGGER_NAME);
            const missingTriggers = expectedTriggers.filter(t => !installedTriggers.includes(t));

            if (missingTriggers.length > 0) {
                logger.warn('Some database triggers are missing', {
                    missingTriggers: missingTriggers,
                    installedTriggers: installedTriggers
                });
                return false;
            }

            logger.info('Database triggers verified successfully', {
                installedTriggers: installedTriggers
            });

            return true;
        } catch (error) {
            logger.error('Failed to verify database triggers', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Setup database triggers (run this once during deployment)
     * @returns {Promise<void>}
     */
    async setupDatabaseTriggers() {
        try {
            logger.info('Setting up database triggers for change detection');

            // Read and execute the SQL setup script
            const fs = require('fs');
            const path = require('path');
            const setupSqlPath = path.join(__dirname, '../db/setup-opms-sync-tables.sql');
            
            if (!fs.existsSync(setupSqlPath)) {
                throw new Error('Setup SQL file not found: ' + setupSqlPath);
            }

            const setupSql = fs.readFileSync(setupSqlPath, 'utf8');
            
            // Split SQL into individual statements and execute
            const statements = setupSql.split(';').filter(stmt => stmt.trim().length > 0);
            
            for (const statement of statements) {
                if (statement.trim().length > 0) {
                    await this.db.query(statement);
                }
            }

            logger.info('Database triggers setup completed successfully');
        } catch (error) {
            logger.error('Failed to setup database triggers', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Start the polling service for backup change detection
     * @returns {Promise<void>}
     */
    async startPollingService() {
        try {
            if (this.isPollingActive) {
                logger.warn('Polling service is already active');
                return;
            }

            this.lastPollTimestamp = new Date();
            this.isPollingActive = true;

            this.pollingIntervalId = setInterval(async () => {
                try {
                    await this.detectMissedChanges();
                } catch (error) {
                    logger.error('Polling service error', { 
                        error: error.message 
                    });
                }
            }, this.pollingInterval);

            logger.info('Polling service started', {
                intervalMs: this.pollingInterval,
                firstPollAt: this.lastPollTimestamp
            });
        } catch (error) {
            logger.error('Failed to start polling service', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Stop the polling service
     * @returns {void}
     */
    stopPollingService() {
        if (this.pollingIntervalId) {
            clearInterval(this.pollingIntervalId);
            this.pollingIntervalId = null;
            this.isPollingActive = false;
            
            logger.info('Polling service stopped');
        }
    }

    /**
     * Detect changes missed by triggers (backup detection)
     * @returns {Promise<void>}
     */
    async detectMissedChanges() {
        try {
            const startTime = Date.now();
            const lastPoll = this.lastPollTimestamp || new Date(Date.now() - this.pollingInterval * 2);

            // Check for items modified since last poll that aren't already queued
            const query = `
                SELECT DISTINCT 
                    i.id as item_id, 
                    i.product_id, 
                    i.code, 
                    i.date_modif,
                    p.date_modif as product_date_modif,
                    'POLLING_DETECTED' as source
                FROM T_ITEM i
                JOIN T_PRODUCT p ON i.product_id = p.id
                LEFT JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
                LEFT JOIN Z_VENDOR v ON pv.vendor_id = v.id
                LEFT JOIN opms_netsuite_vendor_mapping m ON v.id = m.opms_vendor_id
                WHERE (i.date_modif > ? OR p.date_modif > ?)
                  AND i.archived = 'N'
                  AND p.archived = 'N'
                  AND i.code IS NOT NULL
                  AND i.code != ''
                  AND p.name IS NOT NULL
                  -- Filter active vendors only when they exist, allow NULL vendors
                  AND (v.id IS NULL OR (v.active = 'Y' AND v.archived = 'N'))
                  AND (m.id IS NULL OR m.opms_vendor_name = m.netsuite_vendor_name)
                  AND NOT EXISTS (
                      SELECT 1 FROM opms_sync_queue q 
                      WHERE q.item_id = i.id 
                        AND q.status IN ('PENDING', 'PROCESSING')
                        AND q.created_at > ?
                  )
                LIMIT 100
            `;

            const missedChanges = await this.db.query(query, [lastPoll, lastPoll, lastPoll]);

            if (missedChanges.length > 0) {
                logger.info('Polling detected missed changes', {
                    changeCount: missedChanges.length,
                    lastPollTime: lastPoll
                });

                // Queue each missed change for sync
                for (const change of missedChanges) {
                    await this.queueSyncItem(change.item_id, change.product_id, 'UPDATE', {
                        item_id: change.item_id,
                        product_id: change.product_id,
                        item_code: change.code,
                        change_fields: ['polling_detected'],
                        trigger_source: 'POLLING_BACKUP',
                        detection_reason: 'Missed by triggers or system downtime',
                        item_date_modif: change.date_modif,
                        product_date_modif: change.product_date_modif
                    }, 'NORMAL');

                    // Log the detected change
                    await this.opmsChangeLog.logChange({
                        item_id: change.item_id,
                        product_id: change.product_id,
                        change_type: 'ITEM_UPDATE',
                        change_source: 'POLLING_SERVICE',
                        change_data: {
                            detection_method: 'polling_backup',
                            item_code: change.code,
                            last_poll_time: lastPoll,
                            item_date_modif: change.date_modif,
                            product_date_modif: change.product_date_modif
                        },
                        detected_at: new Date()
                    });
                }
            }

            this.lastPollTimestamp = new Date();
            const processingTime = Date.now() - startTime;

            logger.debug('Polling service completed', {
                missedChanges: missedChanges.length,
                processingTimeMs: processingTime,
                lastPollTime: this.lastPollTimestamp
            });
        } catch (error) {
            logger.error('Failed to detect missed changes', {
                error: error.message
            });
            // Don't throw - polling should continue despite errors
        }
    }

    /**
     * Queue an item for synchronization
     * @param {number} itemId - Item ID
     * @param {number} productId - Product ID
     * @param {string} eventType - Event type (CREATE, UPDATE, DELETE)
     * @param {Object} eventData - Event data
     * @param {string} priority - Priority (HIGH, NORMAL, LOW)
     * @returns {Promise<Object>} - Created sync job
     */
    async queueSyncItem(itemId, productId, eventType, eventData, priority = 'NORMAL') {
        try {
            // CRITICAL: Check if sync is enabled at runtime
            const syncConfigService = require('./SyncConfigService');
            const isSyncEnabled = await syncConfigService.isSyncEnabled();
            
            if (!isSyncEnabled) {
                // Allow manual single-item triggers when global sync is disabled
                const isManualTrigger = eventData?.trigger_source === 'MANUAL_API' || eventData?.trigger_source === 'MANUAL_PRODUCT_API';
                if (isManualTrigger) {
                    logger.info('Global sync disabled, proceeding due to manual trigger', {
                        itemId: itemId,
                        source: eventData?.triggered_by?.source || 'unknown'
                    });
                } else {
                    logger.info('Sync disabled - skipping item queue', {
                        itemId: itemId,
                        productId: productId,
                        eventType: eventType,
                        reason: 'OPMS-to-NetSuite sync is disabled via database configuration'
                    });
                    return null;
                }
            }

            // Check if item is digital - digital items are NOT synced to NetSuite
            const [itemInfo] = await this.db.query(`
                SELECT i.code, i.product_type
                FROM T_ITEM i
                WHERE i.id = ?
            `, [itemId]);
            
            if (itemInfo && itemInfo.length > 0) {
                const item = itemInfo[0];
                const itemCode = item.code || '';
                const productType = item.product_type || '';
                
                // Valid NetSuite item code format: nnnn-nnnn (4 digits, hyphen, 4 digits)
                const validCodePattern = /^\d{4}-\d{4}$/;
                
                // Skip digital items based on multiple criteria:
                // 1. Product type is 'D' (Digital)
                // 2. Item code contains "digital" (case-insensitive)
                // 3. Item code does NOT match valid format nnnn-nnnn
                const isDigitalType = productType === 'D';
                const codeContainsDigital = itemCode.toLowerCase().includes('digital');
                const invalidCodeFormat = !validCodePattern.test(itemCode);
                const isManualTrigger = eventData && (eventData.trigger_source === 'MANUAL_API' || eventData.trigger_source === 'MANUAL_PRODUCT_API');
                
                // Allow MANUAL triggers to bypass invalid-code format restrictions, but still block explicit digital items
                if (isDigitalType || codeContainsDigital || (!isManualTrigger && invalidCodeFormat)) {
                    logger.info('Skipping digital item from NetSuite sync', {
                        itemId: itemId,
                        itemCode: itemCode,
                        productType: productType,
                        skipReasons: {
                            digitalType: isDigitalType,
                            codeContainsDigital: codeContainsDigital,
                            invalidFormat: invalidCodeFormat && !isManualTrigger
                        },
                        message: 'Digital items are not synced to NetSuite'
                    });
                    return null; // Don't queue digital items
                }
            }
            
            const syncJob = await this.netSuiteSyncJob.createSyncJob({
                item_id: itemId,
                product_id: productId,
                event_type: eventType,
                event_data: eventData,
                priority: priority
            });

            logger.debug('Item queued for sync', {
                jobId: syncJob.id,
                itemId: itemId,
                productId: productId,
                priority: priority,
                triggerSource: eventData.trigger_source
            });

            return syncJob;
        } catch (error) {
            logger.error('Failed to queue item for sync', {
                error: error.message,
                itemId: itemId,
                productId: productId,
                eventType: eventType
            });
            throw error;
        }
    }

    /**
     * Manually trigger sync for a specific item
     * @param {number} itemId - Item ID
     * @param {string} reason - Reason for manual trigger
     * @param {string} priority - Priority level
     * @param {Object} triggeredBy - User information
     * @returns {Promise<Object>} - Created sync job
     */
    async manualTriggerItem(itemId, reason = 'Manual trigger', priority = 'HIGH', triggeredBy = null) {
        try {
            // Validate item exists and is syncable
            const itemQuery = `
                SELECT 
                    i.id, 
                    i.product_id, 
                    i.code,
                    p.name as product_name,
                    v.name as vendor_name
                FROM T_ITEM i
                JOIN T_PRODUCT p ON i.product_id = p.id
                LEFT JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
                LEFT JOIN Z_VENDOR v ON pv.vendor_id = v.id AND v.active = 'Y' AND v.archived = 'N'
                LEFT JOIN opms_netsuite_vendor_mapping m ON v.id = m.opms_vendor_id AND m.opms_vendor_name = m.netsuite_vendor_name
                WHERE i.id = ?
                  AND i.archived = 'N'
                  AND p.archived = 'N'
                  AND i.code IS NOT NULL
                  AND i.code != ''
                  AND p.name IS NOT NULL
            `;

            const [rows] = await this.db.query(itemQuery, [itemId]);

            if (!rows || rows.length === 0) {
                throw new Error(`Item ${itemId} not found or not syncable`);
            }
            
            const item = rows[0];

            // Queue for sync
            const syncJob = await this.queueSyncItem(
                item.id,
                item.product_id,
                'UPDATE',
                {
                    item_id: item.id,
                    product_id: item.product_id,
                    item_code: item.code,
                    change_fields: ['manual_trigger'],
                    trigger_source: 'MANUAL_API',
                    trigger_reason: reason,
                    triggered_by: triggeredBy,
                    environment_override: triggeredBy?.env || null,
                    live_sync: triggeredBy?.live === true,
                    triggered_at: new Date().toISOString()
                },
                priority
            );

            // If not queued (e.g., blocked by config), return gracefully
            if (!syncJob) {
                logger.info('Manual sync trigger not queued', {
                    itemId: item.id,
                    reason: 'Configuration prevented queueing'
                });
                return {
                    success: false,
                    queued: false,
                    item: {
                        id: item.id,
                        code: item.code,
                        product_name: item.product_name,
                        vendor_name: item.vendor_name
                    }
                };
            }

            // Log the manual trigger
            await this.opmsChangeLog.logChange({
                item_id: item.id,
                product_id: item.product_id,
                change_type: 'MANUAL_TRIGGER',
                change_source: 'MANUAL_API',
                change_data: {
                    trigger_reason: reason,
                    triggered_by: triggeredBy,
                    item_code: item.code,
                    product_name: item.product_name,
                    vendor_name: item.vendor_name,
                    priority: priority
                },
                detected_at: new Date()
            });

            logger.info('Manual sync trigger completed', {
                jobId: syncJob.id,
                itemId: item.id,
                itemCode: item.code,
                reason: reason,
                priority: priority,
                triggeredBy: triggeredBy
            });

            return {
                success: true,
                syncJob: syncJob,
                item: {
                    id: item.id,
                    code: item.code,
                    product_name: item.product_name,
                    vendor_name: item.vendor_name
                }
            };
        } catch (error) {
            logger.error('Manual trigger failed', {
                error: error.message,
                itemId: itemId,
                reason: reason,
                triggeredBy: triggeredBy
            });
            throw error;
        }
    }

    /**
     * Manually trigger sync for all items in a product
     * @param {number} productId - Product ID
     * @param {string} reason - Reason for manual trigger
     * @param {string} priority - Priority level
     * @param {Object} triggeredBy - User information
     * @returns {Promise<Object>} - Trigger results
     */
    async manualTriggerProduct(productId, reason = 'Manual product trigger', priority = 'NORMAL', triggeredBy = null) {
        try {
            // Get all syncable items for this product
            const itemsQuery = `
                SELECT 
                    i.id, 
                    i.code,
                    p.name as product_name
                FROM T_ITEM i
                JOIN T_PRODUCT p ON i.product_id = p.id
                LEFT JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
                LEFT JOIN Z_VENDOR v ON pv.vendor_id = v.id
                LEFT JOIN opms_netsuite_vendor_mapping m ON v.id = m.opms_vendor_id
                WHERE i.product_id = ?
                  AND i.archived = 'N'
                  AND p.archived = 'N'
                  AND i.code IS NOT NULL
                  AND i.code != ''
                  AND p.name IS NOT NULL
                  -- Filter active vendors only when they exist, allow NULL vendors
                  AND (v.id IS NULL OR (v.active = 'Y' AND v.archived = 'N'))
                  AND (m.id IS NULL OR m.opms_vendor_name = m.netsuite_vendor_name)
            `;

            const [items] = await this.db.query(itemsQuery, [productId]);

            if (items.length === 0) {
                throw new Error(`No syncable items found for product ${productId}`);
            }

            const syncJobs = [];
            const errors = [];

            // Queue all items for sync
            for (const item of items) {
                try {
                    const syncJob = await this.queueSyncItem(
                        item.id,
                        productId,
                        'UPDATE',
                        {
                            item_id: item.id,
                            product_id: productId,
                            item_code: item.code,
                            change_fields: ['manual_product_trigger'],
                            trigger_source: 'MANUAL_PRODUCT_API',
                            trigger_reason: reason,
                            triggered_by: triggeredBy,
                            triggered_at: new Date().toISOString()
                        },
                        priority
                    );

                    syncJobs.push(syncJob);
                } catch (error) {
                    errors.push({
                        itemId: item.id,
                        itemCode: item.code,
                        error: error.message
                    });
                }
            }

            // Log the manual product trigger
            await this.opmsChangeLog.logChange({
                item_id: null,
                product_id: productId,
                change_type: 'MANUAL_TRIGGER',
                change_source: 'MANUAL_API',
                change_data: {
                    trigger_type: 'product_trigger',
                    trigger_reason: reason,
                    triggered_by: triggeredBy,
                    product_name: items[0].product_name,
                    total_items: items.length,
                    successful_queues: syncJobs.length,
                    failed_queues: errors.length,
                    priority: priority
                },
                detected_at: new Date()
            });

            logger.info('Manual product sync trigger completed', {
                productId: productId,
                productName: items[0].product_name,
                totalItems: items.length,
                successfulQueues: syncJobs.length,
                failedQueues: errors.length,
                reason: reason,
                priority: priority,
                triggeredBy: triggeredBy
            });

            return {
                success: true,
                productId: productId,
                productName: items[0].product_name,
                totalItems: items.length,
                syncJobs: syncJobs,
                errors: errors
            };
        } catch (error) {
            logger.error('Manual product trigger failed', {
                error: error.message,
                productId: productId,
                reason: reason,
                triggeredBy: triggeredBy
            });
            throw error;
        }
    }

    /**
     * Get change detection service status
     * @returns {Promise<Object>} - Service status
     */
    async getServiceStatus() {
        try {
            // Check trigger status
            const triggersInstalled = await this.verifyTriggersInstalled();

            // Get recent activity stats
            const changeStats = await this.opmsChangeLog.getChangeStats({ hours: 24 });
            const jobStats = await this.netSuiteSyncJob.getJobStats({ hours: 24 });

            // Get queue status
            const queueQuery = `
                SELECT 
                    status,
                    COUNT(*) as count
                FROM opms_sync_queue
                GROUP BY status
            `;
            const queueStatus = await this.db.query(queueQuery);

            return {
                service: {
                    triggersInstalled: triggersInstalled,
                    pollingActive: this.isPollingActive,
                    pollingIntervalMs: this.pollingInterval,
                    lastPollTime: this.lastPollTimestamp
                },
                queue: {
                    status: queueStatus.reduce((acc, row) => {
                        const status = row.status ? row.status.toLowerCase() : 'unknown';
                        acc[status] = row.count;
                        return acc;
                    }, {})
                },
                activity: {
                    changes: changeStats,
                    jobs: jobStats
                }
            };
        } catch (error) {
            logger.error('Failed to get service status', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Shutdown the change detection service
     * @returns {Promise<void>}
     */
    async shutdown() {
        try {
            logger.info('Shutting down OPMS Change Detection Service');

            // Stop polling service
            this.stopPollingService();

            logger.info('OPMS Change Detection Service shutdown completed');
        } catch (error) {
            logger.error('Error during service shutdown', {
                error: error.message
            });
            throw error;
        }
    }
}

module.exports = OpmsChangeDetectionService;

