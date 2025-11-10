/**
 * Test Database Configuration
 * Uses in-memory SQLite for fast, isolated testing
 */

const Database = require('better-sqlite3');
const logger = require('../utils/logger');

let testDb = null;

/**
 * Get or create test database instance
 * @returns {Database} SQLite database instance
 */
function getTestDb() {
  if (!testDb) {
    // Create in-memory SQLite database for tests
    testDb = new Database(':memory:');
    
    // Enable foreign keys
    testDb.pragma('foreign_keys = ON');
    
    // Create basic tables needed for tests
    initializeTestTables(testDb);
    
    logger.info('Test database initialized (SQLite in-memory)');
  }
  
  return testDb;
}

/**
 * Initialize basic tables for testing
 * @param {Database} db - SQLite database instance
 */
function initializeTestTables(db) {
  // Users table for auth tests
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      active INTEGER DEFAULT 1,
      showroom_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Vendors table for vendor tests
  db.exec(`
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_email TEXT,
      contact_phone TEXT,
      address TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Vendor contacts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS vendor_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      position TEXT,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    )
  `);

  // Products table for basic tests
  db.exec(`
    CREATE TABLE IF NOT EXISTS T_PRODUCT (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      width DECIMAL(10,2),
      vrepeat DECIMAL(10,2),
      hrepeat DECIMAL(10,2),
      outdoor TEXT DEFAULT 'N',
      archived TEXT DEFAULT 'N',
      in_master INTEGER DEFAULT 0,
      product_type TEXT DEFAULT 'R',
      vendors TEXT
    )
  `);

  // Items table for basic tests
  db.exec(`
    CREATE TABLE IF NOT EXISTS T_ITEM (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      product_id INTEGER,
      name TEXT NOT NULL,
      colors TEXT,
      active INTEGER DEFAULT 1,
      FOREIGN KEY (product_id) REFERENCES T_PRODUCT(id)
    )
  `);

  // Colors table for basic tests
  db.exec(`
    CREATE TABLE IF NOT EXISTS T_COLOR (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      hex_code TEXT,
      archived TEXT DEFAULT 'N'
    )
  `);

  logger.info('Test database tables initialized');
}

/**
 * Create test data for specific test scenarios
 * @param {string} scenario - Test scenario name
 */
function seedTestData(scenario = 'default') {
  const db = getTestDb();

  if (scenario === 'auth' || scenario === 'default') {
    // Seed test users for authentication tests
    const insertUser = db.prepare(`
      INSERT OR REPLACE INTO users (id, username, email, password_hash, role, active)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertUser.run(1, 'admin', 'admin@test.com', '$2a$10$hashedpassword', 'admin', 1);
    insertUser.run(2, 'user', 'user@test.com', '$2a$10$hashedpassword', 'user', 1);
    insertUser.run(3, 'inactive', 'inactive@test.com', '$2a$10$hashedpassword', 'user', 0);
  }

  if (scenario === 'vendors' || scenario === 'default') {
    // Seed test vendors
    const insertVendor = db.prepare(`
      INSERT OR REPLACE INTO vendors (id, name, contact_email, contact_phone, active)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertVendor.run(1, 'Test Vendor 1', 'vendor1@test.com', '555-0001', 1);
    insertVendor.run(2, 'Test Vendor 2', 'vendor2@test.com', '555-0002', 1);
  }

  logger.info(`Test data seeded for scenario: ${scenario}`);
}

/**
 * Mock database interface compatible with MySQL pool
 */
const testDatabaseInterface = {
  async query(sql, params = []) {
    const db = getTestDb();
    
    try {
      // Convert MySQL-style queries to SQLite-compatible format
      const sqliteQuery = convertMySQLToSQLite(sql);
      
      if (sqliteQuery.toLowerCase().includes('select')) {
        const stmt = db.prepare(sqliteQuery);
        const result = stmt.all(...params);
        return [result, []]; // MySQL format: [rows, fields]
      } else {
        const stmt = db.prepare(sqliteQuery);
        const info = stmt.run(...params);
        return [{ insertId: info.lastInsertRowid, affectedRows: info.changes }, []];
      }
    } catch (error) {
      logger.error('Test database query error:', error.message);
      throw error;
    }
  },

  async getConnection() {
    // Return a mock connection object
    return {
      query: this.query.bind(this),
      beginTransaction: () => Promise.resolve(),
      commit: () => Promise.resolve(),
      rollback: () => Promise.resolve(),
      release: () => Promise.resolve()
    };
  },

  async transaction(callback) {
    const connection = await this.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }
};

/**
 * Convert basic MySQL queries to SQLite format
 * @param {string} sql - MySQL query
 * @returns {string} SQLite-compatible query
 */
function convertMySQLToSQLite(sql) {
  return sql
    .replace(/`/g, '"') // Replace backticks with double quotes
    .replace(/AUTO_INCREMENT/gi, 'AUTOINCREMENT')
    .replace(/TINYINT\(1\)/gi, 'INTEGER')
    .replace(/VARCHAR\(\d+\)/gi, 'TEXT')
    .replace(/DATETIME/gi, 'DATETIME')
    .replace(/DECIMAL\(\d+,\d+\)/gi, 'REAL');
}

/**
 * Clean up test database
 */
function cleanup() {
  if (testDb) {
    testDb.close();
    testDb = null;
    logger.info('Test database cleaned up');
  }
}

module.exports = {
  getTestDb,
  seedTestData,
  cleanup,
  testConnection: () => Promise.resolve(true),
  pool: testDatabaseInterface,
  query: testDatabaseInterface.query.bind(testDatabaseInterface),
  transaction: testDatabaseInterface.transaction.bind(testDatabaseInterface)
};