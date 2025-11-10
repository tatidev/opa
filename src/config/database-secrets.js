require('dotenv').config();
const { z } = require('zod');
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

// AWS SDK for Secrets Manager
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

// Database configuration schema
const dbConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().default(3306),
  user: z.string().default('root'),
  password: z.string().default(''),
  database: z.string().default('opuzen'),
  connectionLimit: z.number().default(10),
  waitForConnections: z.boolean().default(true),
  queueLimit: z.number().default(0),
  enableKeepAlive: z.boolean().default(true),
  keepAliveInitialDelay: z.number().default(0)
});

// AWS Secrets Manager client
const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-west-1'
});

// Cache for secrets to avoid repeated API calls
let secretsCache = null;
let secretsCacheExpiry = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get database credentials from AWS Secrets Manager
 */
async function getSecretsFromAWS() {
  try {
    // Check if we have cached secrets and they're still valid
    if (secretsCache && secretsCacheExpiry && Date.now() < secretsCacheExpiry) {
      logger.debug('Using cached database secrets');
      return secretsCache;
    }

    const secretArn = process.env.RDS_SECRET_ARN || 'arn:aws:secretsmanager:us-west-1:992382576482:secret:rds!cluster-2cc47963-bf79-4426-8b61-6aac4f194a15-BS8pVs';
    if (!secretArn) {
      throw new Error('RDS_SECRET_ARN environment variable is required for AWS Secrets Manager');
    }

    logger.info('Fetching database credentials from AWS Secrets Manager', { secretArn });

    const command = new GetSecretValueCommand({
      SecretId: secretArn
    });

    const response = await secretsClient.send(command);
    
    if (!response.SecretString) {
      throw new Error('No secret string found in AWS Secrets Manager response');
    }

    const secrets = JSON.parse(response.SecretString);
    
    // Cache the secrets
    secretsCache = secrets;
    secretsCacheExpiry = Date.now() + CACHE_DURATION;
    
    logger.info('Successfully retrieved database credentials from AWS Secrets Manager');
    return secrets;
    
  } catch (error) {
    logger.error('Failed to retrieve database credentials from AWS Secrets Manager', {
      error: error.message,
      secretArn: process.env.RDS_SECRET_ARN
    });
    throw error;
  }
}

/**
 * Get database configuration from AWS Secrets Manager or environment variables
 */
async function getDbConfig() {
  try {
    let config = {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectionLimit: process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT, 10) : undefined,
      waitForConnections: true,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    };

    // If AWS Secrets Manager is configured, use it
    if (process.env.RDS_SECRET_ARN) {
      logger.info('Using AWS Secrets Manager for database credentials');
      const secrets = await getSecretsFromAWS();
      
      // Override with secrets from AWS
      config = {
        ...config,
        host: secrets.host || config.host,
        port: secrets.port ? parseInt(secrets.port, 10) : config.port,
        user: secrets.username || secrets.user || config.user,
        password: secrets.password || config.password,
        database: secrets.dbname || secrets.database || config.database
      };
    } else {
      logger.info('Using environment variables for database credentials');
    }

    const validatedConfig = dbConfigSchema.parse(config);
    logger.info('Database configuration loaded successfully', {
      host: validatedConfig.host,
      port: validatedConfig.port,
      user: validatedConfig.user,
      database: validatedConfig.database,
      source: process.env.RDS_SECRET_ARN ? 'AWS Secrets Manager' : 'Environment Variables'
    });
    
    return validatedConfig;
    
  } catch (error) {
    logger.error('Invalid database configuration', {
      error: error.message,
      hasSecretArn: !!process.env.RDS_SECRET_ARN
    });
    throw error;
  }
}

// Create database connection pool with async initialization
let pool = null;
let config = null;

/**
 * Initialize database connection
 */
async function initializeDatabase() {
  try {
    config = await getDbConfig();
    pool = mysql.createPool(config);
    logger.info('Database connection pool created successfully');
    return pool;
  } catch (error) {
    logger.error('Failed to initialize database connection', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Get database pool (initialize if needed)
 */
async function getPool() {
  if (!pool) {
    await initializeDatabase();
  }
  return pool;
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const dbPool = await getPool();
    const connection = await dbPool.getConnection();
    logger.info('Database connection test successful');
    connection.release();
    return true;
  } catch (error) {
    logger.error('Database connection test failed', {
      error: error.message,
      host: config?.host,
      user: config?.user,
      database: config?.database
    });
    return false;
  }
}

/**
 * Execute a query
 */
async function query(sql, params) {
  const dbPool = await getPool();
  return dbPool.query(sql, params);
}

/**
 * Execute a transaction
 */
async function transaction(callback) {
  const dbPool = await getPool();
  const connection = await dbPool.getConnection();
  await connection.beginTransaction();
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Close database connection
 */
async function closeConnection() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  }
}

// Export functions
module.exports = {
  initializeDatabase,
  getPool,
  testConnection,
  query,
  transaction,
  closeConnection,
  get config() { return config; }
};
