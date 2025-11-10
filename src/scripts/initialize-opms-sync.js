#!/usr/bin/env node

/**
 * OPMS-to-NetSuite Sync Initialization Script
 * 
 * This script initializes the OPMS-to-NetSuite synchronization system:
 * 1. Sets up database tables and triggers
 * 2. Validates NetSuite connectivity
 * 3. Initializes the sync service
 * 4. Performs initial health checks
 * 
 * Usage:
 *   node src/scripts/initialize-opms-sync.js [--setup-db] [--test-only]
 */

const path = require('path');
const fs = require('fs');

// Setup environment
require('dotenv').config();

const logger = require('../utils/logger');
const syncService = require('../services/OpmsToNetSuiteSyncService');
const OpmsChangeDetectionService = require('../services/OpmsChangeDetectionService');

class SyncInitializer {
    constructor() {
        this.options = {
            setupDatabase: process.argv.includes('--setup-db'),
            testOnly: process.argv.includes('--test-only'),
            verbose: process.argv.includes('--verbose')
        };
    }

    /**
     * Main initialization process
     */
    async initialize() {
        try {
            console.log('🚀 OPMS-to-NetSuite Sync Initialization');
            console.log('=====================================');
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`Options: ${JSON.stringify(this.options, null, 2)}`);
            console.log('');

            // Step 1: Validate environment
            await this.validateEnvironment();

            // Step 2: Setup database (if requested)
            if (this.options.setupDatabase) {
                await this.setupDatabase();
            }

            // Step 3: Test NetSuite connectivity
            await this.testNetSuiteConnectivity();

            // Step 4: Initialize sync service (if not test-only)
            if (!this.options.testOnly) {
                await this.initializeSyncService();
                await this.performHealthCheck();
            }

            console.log('✅ OPMS-to-NetSuite Sync initialization completed successfully!');
            console.log('');
            console.log('Next steps:');
            console.log('- Monitor sync activity via API: GET /api/opms-sync/status');
            console.log('- Trigger manual sync: POST /api/opms-sync/trigger-item');
            console.log('- View health status: GET /api/opms-sync/health');

            if (!this.options.testOnly) {
                // Keep the process running to maintain sync service
                console.log('');
                console.log('🔄 Sync service is now running...');
                console.log('Press Ctrl+C to stop');
                
                // Setup graceful shutdown
                process.on('SIGINT', async () => {
                    console.log('\n🛑 Shutting down sync service...');
                    await syncService.shutdown();
                    process.exit(0);
                });
            } else {
                process.exit(0);
            }
        } catch (error) {
            console.error('❌ Initialization failed:', error.message);
            if (this.options.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    /**
     * Validate required environment variables
     */
    async validateEnvironment() {
        console.log('🔍 Validating environment configuration...');

        const requiredEnvVars = [
            'DB_HOST',
            'DB_USER', 
            'DB_PASSWORD',
            'DB_NAME',
            'NETSUITE_CONSUMER_KEY',
            'NETSUITE_CONSUMER_SECRET',
            'NETSUITE_TOKEN_ID',
            'NETSUITE_TOKEN_SECRET',
            'NETSUITE_REALM'
        ];

        const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);

        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }

        // Validate sync is enabled
        if (process.env.OPMS_SYNC_ENABLED !== 'true') {
            console.log('⚠️  OPMS_SYNC_ENABLED is not set to "true" - sync will be disabled');
        }

        console.log('✅ Environment validation passed');
    }

    /**
     * Setup database tables and triggers
     */
    async setupDatabase() {
        console.log('🗄️  Setting up database tables and triggers...');

        try {
            const changeDetectionService = new OpmsChangeDetectionService();
            await changeDetectionService.setupDatabaseTriggers();
            console.log('✅ Database setup completed');
        } catch (error) {
            throw new Error(`Database setup failed: ${error.message}`);
        }
    }

    /**
     * Test NetSuite connectivity
     */
    async testNetSuiteConnectivity() {
        console.log('🌐 Testing NetSuite connectivity...');

        try {
            await syncService.validateNetSuiteAuth();
            console.log('✅ NetSuite connectivity test passed');
        } catch (error) {
            throw new Error(`NetSuite connectivity test failed: ${error.message}`);
        }
    }

    /**
     * Initialize the sync service
     */
    async initializeSyncService() {
        console.log('⚙️  Initializing sync service...');

        try {
            await syncService.initialize();
            console.log('✅ Sync service initialized successfully');
        } catch (error) {
            throw new Error(`Sync service initialization failed: ${error.message}`);
        }
    }

    /**
     * Perform comprehensive health check
     */
    async performHealthCheck() {
        console.log('🏥 Performing health check...');

        try {
            const health = await syncService.performHealthCheck();
            
            console.log(`Health Status: ${health.overall_status.toUpperCase()}`);
            
            if (health.issues && health.issues.length > 0) {
                console.log('Issues found:');
                health.issues.forEach(issue => {
                    console.log(`  - ${issue}`);
                });
            }

            if (health.overall_status === 'unhealthy') {
                throw new Error('Health check failed - service is unhealthy');
            }

            console.log('✅ Health check passed');
        } catch (error) {
            throw new Error(`Health check failed: ${error.message}`);
        }
    }
}

// Run initialization if called directly
if (require.main === module) {
    const initializer = new SyncInitializer();
    initializer.initialize().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = SyncInitializer;

