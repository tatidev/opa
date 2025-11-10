#!/usr/bin/env node

/**
 * Environment-Aware Database Migration Script
 * 
 * Automatically detects environment from EFS path structure and
 * retrieves appropriate database credentials from AWS Secrets Manager
 */

const path = require('path');
const { execSync } = require('child_process');
const logger = require('../utils/logger');

/**
 * Detect environment from current working directory path
 */
function detectEnvironmentFromPath() {
    const cwd = process.cwd();
    logger.info(`Detecting environment from path: ${cwd}`);
    
    if (cwd.includes('/opuzen-efs/dev/')) {
        return 'dev';
    } else if (cwd.includes('/opuzen-efs/qa/')) {
        return 'qa';  
    } else if (cwd.includes('/opuzen-efs/prod/')) {
        return 'prod';
    } else {
        logger.warn(`Path ${cwd} not recognized as EFS environment, defaulting to development`);
        return 'development'; // Local development fallback
    }
}

/**
 * Get environment configuration based on detected environment
 */
function getEnvironmentConfig(env) {
    const configs = {
        dev: {
            NODE_ENV: 'development',
            DB_NAME: 'opuzen_dev_master_app',
            SECRET_ID: 'rds!cluster-2cc47963-bf79-4426-8b61-6aac4f194a15',
            description: 'Development Environment',
            region: 'us-west-1'
        },
        qa: {
            NODE_ENV: 'qa', 
            DB_NAME: 'opuzen_qa_master_app',
            SECRET_ID: 'rds!cluster-2cc47963-bf79-4426-8b61-6aac4f194a15',
            description: 'QA Environment',
            region: 'us-west-1'
        },
        prod: {
            NODE_ENV: 'production',
            DB_NAME: 'opuzen_prod_master_app',
            SECRET_ID: 'rds!cluster-2cc47963-bf79-4426-8b61-6aac4f194a15',
            description: 'Production Environment',
            region: 'us-west-1'
        },
        development: {
            NODE_ENV: 'development',
            DB_NAME: process.env.DB_NAME || 'opuzen',
            SECRET_ID: null, // Use local environment variables
            description: 'Local Development',
            region: null
        }
    };
    
    return configs[env] || configs.development;
}

/**
 * Retrieve database credentials from AWS Secrets Manager
 */
async function getDatabaseCredentials(secretId, region) {
    if (!secretId) {
        logger.info('No secret ID provided, using local environment variables');
        return {
            username: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || '3306'
        };
    }
    
    try {
        logger.info(`Retrieving database credentials from AWS Secrets Manager: ${secretId}`);
        
        const command = `aws secretsmanager get-secret-value --secret-id "${secretId}" --region ${region} --query 'SecretString' --output text`;
        const secretJson = execSync(command, { encoding: 'utf8' }).trim();
        const credentials = JSON.parse(secretJson);
        
        logger.info('✅ Database credentials retrieved successfully');
        return {
            username: credentials.username,
            password: credentials.password,
            host: 'opuzen-aurora-mysql8-cluster.cluster-c7886s6kkcmk.us-west-1.rds.amazonaws.com', // Known Aurora endpoint
            port: credentials.port || '3306'
        };
        
    } catch (error) {
        logger.error(`Failed to retrieve database credentials: ${error.message}`);
        throw new Error(`AWS Secrets Manager access failed for ${secretId}. Ensure deployment server has proper IAM permissions.`);
    }
}

/**
 * Set environment variables for migration
 */
async function setupEnvironmentForMigration() {
    try {
        // Detect environment from path
        const detectedEnv = detectEnvironmentFromPath();
        const envConfig = getEnvironmentConfig(detectedEnv);
        
        logger.info(`🔍 Environment detected: ${envConfig.description}`);
        logger.info(`📊 Database target: ${envConfig.DB_NAME}`);
        
        // Get database credentials
        const dbCredentials = await getDatabaseCredentials(envConfig.SECRET_ID, envConfig.region);
        
        // Set environment variables for migration
        process.env.NODE_ENV = envConfig.NODE_ENV;
        process.env.DB_NAME = envConfig.DB_NAME;
        process.env.DB_HOST = dbCredentials.host;
        process.env.DB_USER = dbCredentials.username;
        process.env.DB_PASSWORD = dbCredentials.password;
        process.env.DB_PORT = dbCredentials.port;
        
        logger.info('✅ Environment variables configured for migration');
        logger.info(`   NODE_ENV: ${process.env.NODE_ENV}`);
        logger.info(`   DB_NAME: ${process.env.DB_NAME}`);
        logger.info(`   DB_HOST: ${process.env.DB_HOST}`);
        logger.info(`   DB_USER: ${process.env.DB_USER}`);
        logger.info(`   DB_PORT: ${process.env.DB_PORT}`);
        
        return {
            environment: detectedEnv,
            config: envConfig,
            credentials: dbCredentials
        };
        
    } catch (error) {
        logger.error('Failed to setup environment for migration:', error);
        throw error;
    }
}

/**
 * Main migration execution
 */
async function runEnvironmentAwareMigration() {
    try {
        logger.info('🚀 Starting environment-aware database migration...');
        
        // Setup environment
        const { environment, config } = await setupEnvironmentForMigration();
        
        // Confirm migration target
        logger.info('📋 Migration Summary:');
        logger.info(`   Environment: ${config.description}`);
        logger.info(`   Database: ${process.env.DB_NAME}`);
        logger.info(`   Working Directory: ${process.cwd()}`);
        
        // Import and run migrations
        const { runMigrations } = require('./migrate');
        
        logger.info('🔄 Executing database migrations...');
        await runMigrations();
        
        logger.info('✅ Environment-aware migration completed successfully!');
        
    } catch (error) {
        logger.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Handle command line arguments
const args = process.argv.slice(2);
const options = {
    reset: args.includes('--reset'),
    dryRun: args.includes('--dry-run'),
    help: args.includes('--help')
};

if (options.help) {
    console.log(`
Environment-Aware Database Migration Script

Usage: node src/db/migrate-env-aware.js [options]

Options:
  --reset     Reset migrations table (use with caution)
  --dry-run   Show what would be migrated without executing
  --help      Show this help message

Environment Detection:
  Automatically detects environment from working directory:
  - /opuzen-efs/dev/   → Development environment
  - /opuzen-efs/qa/    → QA environment  
  - /opuzen-efs/prod/  → Production environment
  - Other paths        → Local development

Database Credentials:
  Retrieved automatically from AWS Secrets Manager based on environment.
  Fallback to local environment variables for development.

Examples:
  # Run migrations for DEV environment
  cd /opuzen-efs/dev/opms-api && node src/db/migrate-env-aware.js
  
  # Run migrations for QA environment
  cd /opuzen-efs/qa/opms-api && node src/db/migrate-env-aware.js
  
  # Run migrations for PROD environment (requires approval)
  cd /opuzen-efs/prod/opms-api && node src/db/migrate-env-aware.js
`);
    process.exit(0);
}

if (options.dryRun) {
    // Dry run - just show what would happen
    (async () => {
        try {
            const detectedEnv = detectEnvironmentFromPath();
            const envConfig = getEnvironmentConfig(detectedEnv);
            
            console.log('🔍 DRY RUN - Migration Preview');
            console.log(`   Environment: ${envConfig.description}`);
            console.log(`   Database: ${envConfig.DB_NAME}`);
            console.log(`   Working Directory: ${process.cwd()}`);
            console.log(`   Secret ID: ${envConfig.SECRET_ID || 'Local env vars'}`);
            console.log('   Migrations that would run: [checking...]');
            
            // TODO: Show pending migrations without executing
            console.log('✅ Dry run completed');
        } catch (error) {
            console.error('❌ Dry run failed:', error.message);
            process.exit(1);
        }
    })();
} else {
    // Run actual migration
    runEnvironmentAwareMigration();
}

module.exports = {
    detectEnvironmentFromPath,
    getEnvironmentConfig,
    getDatabaseCredentials,
    setupEnvironmentForMigration
};
