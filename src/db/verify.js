const db = require('./index');
const logger = require('../utils/logger');

async function verifyDatabaseStructure() {
  try {
    await db.initialize();

    // Verify T_ITEM table
    const itemTable = await db.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'T_ITEM'
      ORDER BY ORDINAL_POSITION;
    `);
    logger.info('T_ITEM table structure:', itemTable);

    // Verify foreign keys
    const foreignKeys = await db.query(`
      SELECT 
        TABLE_NAME,
        COLUMN_NAME,
        CONSTRAINT_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY TABLE_NAME, COLUMN_NAME;
    `);
    logger.info('Foreign key relationships:', foreignKeys);

    // Verify indexes
    const indexes = await db.query(`
      SELECT 
        TABLE_NAME,
        INDEX_NAME,
        COLUMN_NAME,
        NON_UNIQUE
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
    `);
    logger.info('Database indexes:', indexes);

    // Verify table sizes
    const tableSizes = await db.query(`
      SELECT 
        TABLE_NAME,
        TABLE_ROWS,
        DATA_LENGTH,
        INDEX_LENGTH
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME;
    `);
    logger.info('Table sizes:', tableSizes);

    logger.info('Database structure verification completed successfully');
  } catch (error) {
    logger.error('Database structure verification failed:', error);
    throw error;
  } finally {
    await db.end();
  }
}

// Run verification if this file is executed directly
if (require.main === module) {
  verifyDatabaseStructure().catch(error => {
    logger.error('Verification failed:', error);
    process.exit(1);
  });
}

module.exports = { verifyDatabaseStructure }; 