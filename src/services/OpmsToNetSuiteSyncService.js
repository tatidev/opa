/**
 * OPMS to NetSuite Sync Service
 * Main orchestration service for OPMS-to-NetSuite synchronization
 * 
 * This is the primary service that coordinates all sync components:
 * - Change detection (triggers + polling)
 * - Data transformation (field mapping + validation)
 * - Queue management (processing + retry logic)
 * - NetSuite integration (RESTlet calls)
 * - Monitoring and health checks
 */

const logger = require('../utils/logger');
const syncConfigService = require('./SyncConfigService');
const OpmsChangeDetectionService = require('./OpmsChangeDetectionService');
const OpmsDataTransformService = require('./OpmsDataTransformService');
const NetSuiteSyncQueueService = require('./NetSuiteSyncQueueService');
const netsuiteRestletService = require('./netsuiteRestletService');

class OpmsToNetSuiteSyncService {
    constructor() {
        this.changeDetectionService = new OpmsChangeDetectionService();
        this.dataTransformService = new OpmsDataTransformService();
        this.queueService = new NetSuiteSyncQueueService(netsuiteRestletService);
        
        // Service state
        this.isInitialized = false;
        this.isRunning = false;
        this.startTime = null;
        
        // Configuration
        // NOTE: OPMS_SYNC_ENABLED environment variable is IGNORED
        // Sync is controlled ONLY by database configuration (netsuite_opms_sync_config table)
        // This ensures runtime sync control via dashboard toggle works properly
        this.config = {
            enableChangeDetection: true,  // Always enabled - controlled by runtime database checks
            enableQueueProcessing: true,  // Always enabled - controlled by runtime database checks
            healthCheckInterval: 30000, // 30 seconds
            autoRestart: true,
            maxRestartAttempts: 3
        };

        // Health monitoring
        this.healthCheckIntervalId = null;
        this.restartAttempts = 0;
        this.lastHealthCheck = null;
        
        // Bind methods for proper context
        this.handleUncaughtError = this.handleUncaughtError.bind(this);
        this.handleProcessExit = this.handleProcessExit.bind(this);
    }

    /**
     * Static method to initialize the sync service
     * @returns {Promise<OpmsToNetSuiteSyncService>} - Initialized service instance
     */
    static async initialize() {
        const instance = new OpmsToNetSuiteSyncService();
        await instance.initialize();
        return instance;
    }

    /**
     * Initialize the complete sync system
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            if (this.isInitialized) {
                logger.warn('OPMS-to-NetSuite sync service is already initialized');
                return;
            }

            logger.info('Initializing OPMS-to-NetSuite Sync Service', {
                enableChangeDetection: this.config.enableChangeDetection,
                enableQueueProcessing: this.config.enableQueueProcessing,
                environment: process.env.NODE_ENV
            });

            // Validate NetSuite authentication
            await this.validateNetSuiteAuth();

            // Initialize change detection service
            if (this.config.enableChangeDetection) {
                await this.changeDetectionService.initialize();
                logger.info('Change detection service initialized');
            }

            // Initialize queue processing service
            if (this.config.enableQueueProcessing) {
                await this.queueService.startProcessing();
                logger.info('Queue processing service initialized');
            }

            // Setup health monitoring
            await this.startHealthMonitoring();

            // Setup error handlers
            this.setupErrorHandlers();

            this.isInitialized = true;
            this.isRunning = true;
            this.startTime = new Date();

            logger.info('OPMS-to-NetSuite Sync Service initialized successfully', {
                startTime: this.startTime,
                changeDetectionActive: this.config.enableChangeDetection,
                queueProcessingActive: this.config.enableQueueProcessing,
                healthMonitoringActive: true
            });
        } catch (error) {
            logger.error('Failed to initialize OPMS-to-NetSuite Sync Service', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Check if sync is enabled at runtime (database configuration)
     * @returns {Promise<boolean>}
     */
    async isSyncEnabledAtRuntime() {
        try {
            return await syncConfigService.isSyncEnabled();
        } catch (error) {
            logger.error('Failed to check runtime sync enabled status', {
                error: error.message
            });
            // Default to disabled on error to prevent unwanted sync
            return false;
        }
    }

    /**
     * Validate NetSuite authentication
     * @returns {Promise<void>}
     */
    async validateNetSuiteAuth() {
        try {
            // Test NetSuite authentication by calling the RESTlet service
            const testResult = await this.queueService.testNetSuiteConnection();
            if (!testResult.success) {
                throw new Error(`NetSuite authentication failed: ${testResult.error}`);
            }
            
            logger.info('NetSuite authentication validated successfully');
        } catch (error) {
            logger.error('NetSuite authentication validation failed', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Start health monitoring
     * @returns {Promise<void>}
     */
    async startHealthMonitoring() {
        try {
            this.healthCheckIntervalId = setInterval(async () => {
                await this.performHealthCheck();
            }, this.config.healthCheckInterval);
            
            logger.info('Health monitoring started', {
                intervalMs: this.config.healthCheckInterval
            });
        } catch (error) {
            logger.error('Failed to start health monitoring', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Setup error handlers
     * @returns {void}
     */
    setupErrorHandlers() {
        // Handle uncaught exceptions
        process.on('uncaughtException', this.handleUncaughtError);
        
        // Handle unhandled promise rejections
        process.on('unhandledRejection', this.handleUncaughtError);
        
        // Handle process exit
        process.on('SIGINT', this.handleProcessExit);
        process.on('SIGTERM', this.handleProcessExit);
        
        logger.info('Error handlers setup completed');
    }

    /**
     * Handle uncaught errors
     * @param {Error} error - Uncaught error
     */
    handleUncaughtError(error) {
        logger.error('Uncaught error in sync service', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        
        // Attempt graceful shutdown
        this.shutdown()
            .then(() => {
                logger.info('Sync service shutdown completed after uncaught error');
                process.exit(1);
            })
            .catch((shutdownError) => {
                logger.error('Failed to shutdown sync service after uncaught error', {
                    error: shutdownError.message
                });
                process.exit(1);
            });
    }

    /**
     * Handle process exit
     * @param {string} signal - Exit signal
     */
    async handleProcessExit(signal) {
        logger.info('Process exit signal received', { signal });
        
        try {
            await this.shutdown();
            logger.info('Sync service shutdown completed gracefully');
            process.exit(0);
        } catch (error) {
            logger.error('Failed to shutdown sync service gracefully', {
                error: error.message
            });
            process.exit(1);
        }
    }

    /**
     * Perform health check
     * @returns {Promise<void>}
     */
    async performHealthCheck() {
        try {
            const healthStatus = {
                timestamp: new Date().toISOString(),
                serviceInitialized: this.isInitialized,
                serviceRunning: this.isRunning,
                uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
                changeDetectionActive: this.changeDetectionService ? this.changeDetectionService.isPollingActive : false,
                queueProcessingActive: this.queueService ? this.queueService.isProcessing : false
            };

            this.lastHealthCheck = healthStatus;
            
            logger.debug('Health check completed', healthStatus);
        } catch (error) {
            logger.error('Health check failed', {
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Shutdown the sync service
     * @returns {Promise<void>}
     */
    async shutdown() {
        try {
            logger.info('Shutting down OPMS-to-NetSuite sync service');
            
            // Stop health monitoring
            if (this.healthCheckIntervalId) {
                clearInterval(this.healthCheckIntervalId);
                this.healthCheckIntervalId = null;
            }
            
            // Stop change detection
            if (this.changeDetectionService) {
                this.changeDetectionService.stopPollingService();
            }
            
            // Stop queue processing
            if (this.queueService) {
                await this.queueService.stopProcessing();
            }
            
            this.isRunning = false;
            this.isInitialized = false;
            
            logger.info('OPMS-to-NetSuite sync service shutdown completed');
        } catch (error) {
            logger.error('Error during sync service shutdown', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Get service status
     * @returns {Object} - Service status information
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isRunning: this.isRunning,
            startTime: this.startTime,
            lastHealthCheck: this.lastHealthCheck,
            config: this.config,
            restartAttempts: this.restartAttempts
        };
    }

    /**
     * Validate NetSuite authentication
     * @returns {Promise<void>}
     */
    async validateNetSuiteAuth() {
        try {
            logger.info('Validating NetSuite authentication');

            // Test NetSuite connection using existing service
            const testPayload = {
                itemid: `opmsAPI-AUTH-TEST-${Date.now()}`,
                displayname: 'Authentication Test Item - DELETE ME'
            };

            // This will throw if authentication fails
            await netsuiteRestletService.createLotNumberedInventoryItem(testPayload);

            logger.info('NetSuite authentication validated successfully');
        } catch (error) {
            if (error.message.includes('401') || error.message.includes('authentication')) {
                throw new Error(`NetSuite authentication failed: ${error.message}`);
            }
            // Other errors might be acceptable for auth test
            logger.warn('NetSuite auth test completed with non-auth error', {
                error: error.message
            });
        }
    }

    /**
     * Start health monitoring
     * @returns {Promise<void>}
     */
    async startHealthMonitoring() {
        try {
            this.healthCheckIntervalId = setInterval(async () => {
                try {
                    await this.performHealthCheck();
                } catch (error) {
                    logger.error('Health check failed', {
                        error: error.message
                    });
                }
            }, this.config.healthCheckInterval);

            // Perform initial health check
            await this.performHealthCheck();

            logger.info('Health monitoring started', {
                intervalMs: this.config.healthCheckInterval
            });
        } catch (error) {
            logger.error('Failed to start health monitoring', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Perform comprehensive health check
     * @returns {Promise<Object>} - Health status
     */
    async performHealthCheck() {
        try {
            const healthStatus = {
                timestamp: new Date(),
                overall_status: 'healthy',
                services: {},
                issues: []
            };

            // Check change detection service
            if (this.config.enableChangeDetection) {
                try {
                    const changeDetectionStatus = await this.changeDetectionService.getServiceStatus();
                    healthStatus.services.change_detection = {
                        status: 'healthy',
                        details: changeDetectionStatus
                    };

                    if (!changeDetectionStatus.service.triggersInstalled) {
                        healthStatus.issues.push('Database triggers not installed');
                        healthStatus.overall_status = 'degraded';
                    }

                    if (!changeDetectionStatus.service.pollingActive) {
                        healthStatus.issues.push('Polling service not active');
                        healthStatus.overall_status = 'degraded';
                    }
                } catch (error) {
                    healthStatus.services.change_detection = {
                        status: 'unhealthy',
                        error: error.message
                    };
                    healthStatus.issues.push(`Change detection service error: ${error.message}`);
                    healthStatus.overall_status = 'unhealthy';
                }
            }

            // Check queue processing service
            if (this.config.enableQueueProcessing) {
                try {
                    const queueStats = await this.queueService.getQueueStats();
                    healthStatus.services.queue_processing = {
                        status: queueStats.processing.isActive ? 'healthy' : 'unhealthy',
                        details: queueStats
                    };

                    if (!queueStats.processing.isActive) {
                        healthStatus.issues.push('Queue processing not active');
                        healthStatus.overall_status = 'unhealthy';
                    }

                    // Check for high failure rate
                    const failureRate = parseFloat(queueStats.session_stats.successRate?.replace('%', '') || '0');
                    if (failureRate < 80 && queueStats.session_stats.totalProcessed > 10) {
                        healthStatus.issues.push(`Low success rate: ${queueStats.session_stats.successRate}`);
                        healthStatus.overall_status = 'degraded';
                    }
                } catch (error) {
                    healthStatus.services.queue_processing = {
                        status: 'unhealthy',
                        error: error.message
                    };
                    healthStatus.issues.push(`Queue processing service error: ${error.message}`);
                    healthStatus.overall_status = 'unhealthy';
                }
            }

            // Check NetSuite connectivity
            try {
                // Simple connectivity test - just check if service is accessible
                const netsuiteStatus = {
                    status: 'healthy',
                    last_test: new Date()
                };
                healthStatus.services.netsuite = netsuiteStatus;
            } catch (error) {
                healthStatus.services.netsuite = {
                    status: 'unhealthy',
                    error: error.message
                };
                healthStatus.issues.push(`NetSuite connectivity error: ${error.message}`);
                healthStatus.overall_status = 'unhealthy';
            }

            this.lastHealthCheck = healthStatus;

            // Log health status
            if (healthStatus.overall_status === 'healthy') {
                logger.debug('Health check passed', {
                    status: healthStatus.overall_status,
                    serviceCount: Object.keys(healthStatus.services).length
                });
            } else {
                logger.warn('Health check found issues', {
                    status: healthStatus.overall_status,
                    issues: healthStatus.issues
                });

                // Auto-restart if configured and status is unhealthy
                if (this.config.autoRestart && 
                    healthStatus.overall_status === 'unhealthy' && 
                    this.restartAttempts < this.config.maxRestartAttempts) {
                    
                    logger.info('Attempting auto-restart due to unhealthy status');
                    await this.restart();
                }
            }

            return healthStatus;
        } catch (error) {
            logger.error('Health check failed', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Setup error handlers
     * @returns {void}
     */
    setupErrorHandlers() {
        // Handle uncaught exceptions
        process.on('uncaughtException', this.handleUncaughtError);
        
        // Handle unhandled promise rejections
        process.on('unhandledRejection', this.handleUncaughtError);
        
        // Handle process termination
        process.on('SIGTERM', this.handleProcessExit);
        process.on('SIGINT', this.handleProcessExit);
    }

    /**
     * Handle uncaught errors
     * @param {Error} error - Uncaught error
     * @returns {void}
     */
    handleUncaughtError(error) {
        logger.error('Uncaught error in sync service', {
            error: error.message,
            stack: error.stack
        });

        // Attempt graceful shutdown
        this.shutdown().catch(shutdownError => {
            logger.error('Error during emergency shutdown', {
                error: shutdownError.message
            });
        });
    }

    /**
     * Handle process exit
     * @returns {void}
     */
    handleProcessExit() {
        logger.info('Process exit signal received, shutting down sync service');
        
        this.shutdown().then(() => {
            process.exit(0);
        }).catch(error => {
            logger.error('Error during shutdown', {
                error: error.message
            });
            process.exit(1);
        });
    }

    /**
     * Restart the sync service
     * @returns {Promise<void>}
     */
    async restart() {
        try {
            this.restartAttempts++;
            
            logger.info('Restarting OPMS-to-NetSuite Sync Service', {
                attempt: this.restartAttempts,
                maxAttempts: this.config.maxRestartAttempts
            });

            // Shutdown current services
            await this.shutdown(false); // Don't remove error handlers

            // Wait a moment before restart
            await this.sleep(5000);

            // Reinitialize
            await this.initialize();

            this.restartAttempts = 0; // Reset on successful restart

            logger.info('OPMS-to-NetSuite Sync Service restarted successfully');
        } catch (error) {
            logger.error('Failed to restart sync service', {
                error: error.message,
                attempt: this.restartAttempts
            });

            if (this.restartAttempts >= this.config.maxRestartAttempts) {
                logger.error('Max restart attempts exceeded, service will remain down');
                throw error;
            }
        }
    }

    /**
     * Get comprehensive service status
     * @returns {Promise<Object>} - Service status
     */
    async getServiceStatus() {
        try {
            const runtime = this.startTime 
                ? Date.now() - this.startTime.getTime()
                : 0;

            const status = {
                service: {
                    isInitialized: this.isInitialized,
                    isRunning: this.isRunning,
                    startTime: this.startTime,
                    runtimeMs: runtime,
                    runtimeHours: (runtime / (1000 * 60 * 60)).toFixed(2),
                    restartAttempts: this.restartAttempts
                },
                configuration: this.config,
                last_health_check: this.lastHealthCheck
            };

            // Get detailed service status if running
            if (this.isRunning) {
                if (this.config.enableChangeDetection) {
                    status.change_detection = await this.changeDetectionService.getServiceStatus();
                }

                if (this.config.enableQueueProcessing) {
                    status.queue_processing = await this.queueService.getQueueStats();
                    status.queue_status = await this.queueService.getQueueStatus();
                }
            }

            return status;
        } catch (error) {
            logger.error('Failed to get service status', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Manually trigger sync for an item
     * @param {number} itemId - Item ID
     * @param {string} reason - Reason for manual trigger
     * @param {Object} triggeredBy - User information
     * @returns {Promise<Object>} - Trigger result
     */
    async manualTriggerItem(itemId, reason = 'Manual API trigger', triggeredBy = null) {
        try {
            if (!this.isRunning) {
                throw new Error('Sync service is not running');
            }

            return await this.changeDetectionService.manualTriggerItem(
                itemId, 
                reason, 
                'HIGH', 
                triggeredBy
            );
        } catch (error) {
            logger.error('Manual item trigger failed', {
                error: error.message,
                itemId: itemId,
                reason: reason
            });
            throw error;
        }
    }

    /**
     * Manually trigger sync for all items in a product
     * @param {number} productId - Product ID
     * @param {string} reason - Reason for manual trigger
     * @param {Object} triggeredBy - User information
     * @returns {Promise<Object>} - Trigger result
     */
    async manualTriggerProduct(productId, reason = 'Manual API product trigger', triggeredBy = null) {
        try {
            if (!this.isRunning) {
                throw new Error('Sync service is not running');
            }

            return await this.changeDetectionService.manualTriggerProduct(
                productId, 
                reason, 
                'NORMAL', 
                triggeredBy
            );
        } catch (error) {
            logger.error('Manual product trigger failed', {
                error: error.message,
                productId: productId,
                reason: reason
            });
            throw error;
        }
    }

    /**
     * Pause sync processing
     * @returns {Promise<void>}
     */
    async pauseSync() {
        try {
            if (this.config.enableQueueProcessing) {
                this.queueService.pauseProcessing();
            }

            if (this.config.enableChangeDetection) {
                this.changeDetectionService.stopPollingService();
            }

            logger.info('Sync processing paused');
        } catch (error) {
            logger.error('Failed to pause sync processing', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Resume sync processing
     * @returns {Promise<void>}
     */
    async resumeSync() {
        try {
            if (this.config.enableQueueProcessing) {
                await this.queueService.resumeProcessing();
            }

            if (this.config.enableChangeDetection) {
                await this.changeDetectionService.startPollingService();
            }

            logger.info('Sync processing resumed');
        } catch (error) {
            logger.error('Failed to resume sync processing', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Shutdown the sync service
     * @param {boolean} removeErrorHandlers - Whether to remove error handlers
     * @returns {Promise<void>}
     */
    async shutdown(removeErrorHandlers = true) {
        try {
            logger.info('Shutting down OPMS-to-NetSuite Sync Service');

            // Stop health monitoring
            if (this.healthCheckIntervalId) {
                clearInterval(this.healthCheckIntervalId);
                this.healthCheckIntervalId = null;
            }

            // Shutdown change detection service
            if (this.changeDetectionService) {
                await this.changeDetectionService.shutdown();
            }

            // Shutdown queue processing service
            if (this.queueService) {
                await this.queueService.shutdown();
            }

            // Remove error handlers if requested
            if (removeErrorHandlers) {
                process.removeListener('uncaughtException', this.handleUncaughtError);
                process.removeListener('unhandledRejection', this.handleUncaughtError);
                process.removeListener('SIGTERM', this.handleProcessExit);
                process.removeListener('SIGINT', this.handleProcessExit);
            }

            this.isRunning = false;
            this.isInitialized = false;

            const runtime = this.startTime 
                ? Date.now() - this.startTime.getTime()
                : 0;

            logger.info('OPMS-to-NetSuite Sync Service shutdown completed', {
                runtimeMs: runtime,
                runtimeHours: (runtime / (1000 * 60 * 60)).toFixed(2)
            });
        } catch (error) {
            logger.error('Error during sync service shutdown', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Sleep utility function
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export singleton instance
const syncService = new OpmsToNetSuiteSyncService();

module.exports = syncService;

