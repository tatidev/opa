/**
 * Migration: Create NetSuite Sync Log Table
 * 
 * This migration creates a table to track NetSuite data synchronization
 */

/**
 * Apply the migration
 * 
 * @param {Object} db - Database connection
 */
exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS netsuite_sync_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sync_type VARCHAR(50) NOT NULL COMMENT 'Type of sync (inventory_items, assembly_items, etc.)',
      items_count INT NOT NULL DEFAULT 0 COMMENT 'Number of items processed',
      sync_date DATETIME NOT NULL COMMENT 'Date and time of synchronization',
      status VARCHAR(20) NOT NULL COMMENT 'Status of sync (success, error)',
      details TEXT COMMENT 'Additional details or error information',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  await db.query(sql);
  console.log('Created netsuite_sync_log table');
};

/**
 * Rollback the migration
 * 
 * @param {Object} db - Database connection
 */
exports.down = async (db) => {
  const sql = `DROP TABLE IF EXISTS netsuite_sync_log;`;
  await db.query(sql);
  console.log('Dropped netsuite_sync_log table');
};

/**
 * Migration name
 */
exports.description = 'Create NetSuite sync log table'; 