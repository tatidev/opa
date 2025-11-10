const fs = require('fs').promises;
const path = require('path');
const db = require('./index');
const logger = require('../utils/logger');

async function createMigrationsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS migrations (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
}

async function getExecutedMigrations() {
  try {
    return await db.query('SELECT name FROM migrations ORDER BY id');
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return [];
    }
    throw error;
  }
}

async function resetMigrations() {
  try {
    await db.query('DROP TABLE IF EXISTS migrations');
    await createMigrationsTable();
    logger.info('Migrations table has been reset');
  } catch (error) {
    logger.error('Failed to reset migrations:', error);
    throw error;
  }
}

function getMigrationNumber(filename) {
  const match = filename.match(/^(\d+)_/);
  return match ? parseInt(match[1], 10) : Infinity;
}

async function runMigrations(options = {}) {
  try {
    // Wait for database initialization
    await db.initialize();
    
    // Create migrations table if it doesn't exist
    await createMigrationsTable();
    
    // Reset migrations if requested
    if (options.reset) {
      await resetMigrations();
    }
    
    // Get list of executed migrations
    const executedMigrations = await getExecutedMigrations();
    const executedNames = new Set(executedMigrations.map(m => m.name));
    
    // Read migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files
      .filter(f => f.endsWith('.js'))
      .sort((a, b) => getMigrationNumber(a) - getMigrationNumber(b));
    
    // Run pending migrations
    for (const file of migrationFiles) {
      if (!executedNames.has(file)) {
        logger.info(`Running migration: ${file}`);
        
        const migration = require(path.join(migrationsDir, file));
        
        await db.transaction(async (connection) => {
          await migration.up(connection);
          await connection.query(
            'INSERT INTO migrations (name) VALUES (?)',
            [file]
          );
        });
        
        logger.info(`Completed migration: ${file}`);
      }
    }
    
    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    reset: args.includes('--reset')
  };
  runMigrations(options);
}

module.exports = { runMigrations }; 