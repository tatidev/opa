const mysql = require('mysql2/promise');
const { config } = require('../config/database');
const logger = require('../utils/logger');

class Database {
  constructor() {
    this.pool = null;
  }

  async initialize() {
    try {
      if (!this.pool) {
        logger.info('Initializing database connection pool with config:', {
          host: config.host,
          port: config.port,
          user: config.user,
          database: config.database
        });

        this.pool = mysql.createPool({
          ...config,
          waitForConnections: true,
          queueLimit: 0,
          enableKeepAlive: true,
          keepAliveInitialDelay: 0
        });

        await this.testConnection();
        logger.info('Database connection pool initialized successfully');
      }
    } catch (error) {
      logger.error('Failed to initialize database connection pool:', {
        error: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      });
      throw error;
    }
  }

  async testConnection() {
    try {
      const connection = await this.pool.getConnection();
      logger.info('Database connection test successful');
      connection.release();
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', {
        error: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      });
      throw error;
    }
  }

  async query(sql, params) {
    if (!this.pool) {
      throw new Error('Database connection pool not initialized');
    }
    try {
      const [rows] = await this.pool.query(sql, params);
      return rows;
    } catch (error) {
      logger.error('Database query failed:', {
        error: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
        sql,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async transaction(callback) {
    if (!this.pool) {
      throw new Error('Database connection pool not initialized');
    }
    const connection = await this.pool.getConnection();
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

  async end() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database connection pool closed');
    }
  }
}

const db = new Database();

// Initialize the database connection
db.initialize().catch(error => {
  logger.error('Failed to initialize database:', error);
  process.exit(1);
});

module.exports = db; 