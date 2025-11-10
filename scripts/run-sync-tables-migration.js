#!/usr/bin/env node
/**
 * Run Sync Tables Migration
 * 
 * This script creates the NetSuite-to-OPMS sync tracking tables
 * in the OPMS database using raw SQL.
 * 
 * Usage:
 *   node scripts/run-sync-tables-migration.js
 * 
 * Requirements:
 *   - Database credentials in .env or AWS Secrets Manager
 *   - Database connection must be available
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');
const logger = require('../src/utils/logger');

async function runMigration() {
  let connection;
  
  try {
    logger.info('Starting sync tables migration...');
    
    // Read the SQL migration file
    const sqlPath = path.join(__dirname, '../src/db/migrations/create_sync_tables.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    logger.info('SQL migration file loaded', { path: sqlPath });
    
    // Initialize database connection
    await db.initializeDatabase();
    const pool = await db.getPool();
    connection = await pool.getConnection();
    
    logger.info('Database connection established');
    
    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => {
        // Filter out comments and empty statements
        return stmt.length > 0 && 
               !stmt.startsWith('--') && 
               !stmt.startsWith('/*') &&
               !stmt.toUpperCase().startsWith('SHOW') &&
               !stmt.toUpperCase().startsWith('SELECT') &&
               !stmt.toUpperCase().startsWith('DESCRIBE');
      });
    
    logger.info(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        // Log first 100 chars of statement for tracking
        const preview = statement.substring(0, 100).replace(/\s+/g, ' ');
        logger.info(`Executing statement ${i + 1}/${statements.length}: ${preview}...`);
        
        await connection.query(statement);
        
      } catch (error) {
        // Log error but continue with other statements
        logger.error(`Failed to execute statement ${i + 1}`, {
          error: error.message,
          statement: statement.substring(0, 200)
        });
        
        // Only throw if it's a critical error (not "table already exists", etc.)
        if (!error.message.includes('already exists') && 
            !error.message.includes('Duplicate')) {
          throw error;
        }
      }
    }
    
    logger.info('✅ Migration completed successfully');
    
    // Verify tables were created
    const [tables] = await connection.query("SHOW TABLES LIKE 'netsuite_opms_sync%'");
    logger.info(`Created ${tables.length} sync tables:`, {
      tables: tables.map(t => Object.values(t)[0])
    });
    
    // Check config values
    const [configs] = await connection.query('SELECT config_key, config_value FROM netsuite_opms_sync_config');
    logger.info(`Inserted ${configs.length} configuration values`);
    
    return {
      success: true,
      tablesCreated: tables.length,
      configsInserted: configs.length
    };
    
  } catch (error) {
    logger.error('❌ Migration failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
    
  } finally {
    if (connection) {
      connection.release();
      logger.info('Database connection released');
    }
    
    // Close the pool
    await db.closeConnection();
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration()
    .then(result => {
      console.log('\n✅ MIGRATION SUCCESSFUL');
      console.log(`   Tables created: ${result.tablesCreated}`);
      console.log(`   Configs inserted: ${result.configsInserted}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ MIGRATION FAILED');
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = { runMigration };

