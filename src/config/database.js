require('dotenv').config();
const logger = require('../utils/logger');

// Import the secrets-based database configuration
const secretsDb = require('./database-secrets');

// Export the secrets-based database functions
module.exports = {
  // Initialize database connection using AWS Secrets Manager
  async initializeDatabase() {
    try {
      await secretsDb.initializeDatabase();
      logger.info('Database initialized with AWS Secrets Manager');
    } catch (error) {
      logger.error('Failed to initialize database with AWS Secrets Manager', {
        error: error.message
      });
      throw error;
    }
  },

  // Get database pool
  async getPool() {
    return await secretsDb.getPool();
  },

  // Test database connection
  async testConnection() {
    return await secretsDb.testConnection();
  },

  // Execute a query
  async query(sql, params) {
    return await secretsDb.query(sql, params);
  },

  // Execute a transaction
  async transaction(callback) {
    return await secretsDb.transaction(callback);
  },

  // Close database connection
  async closeConnection() {
    return await secretsDb.closeConnection();
  },

  // Get configuration
  get config() {
    return secretsDb.config;
  },

  // Legacy pool export for backward compatibility
  get pool() {
    logger.warn('Using legacy pool access. Consider using getPool() instead.');
    return secretsDb.getPool();
  }
};