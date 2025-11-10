require('dotenv').config();
const mysql = require('mysql2/promise');
const logger = require('../src/utils/logger');
const { up, down } = require('../src/db/migrations/20250129_add_restlet_simulation_columns');

async function runMigration() {
    let connection;
    try {
        logger.info('🚀 Adding RESTlet simulation columns to dry-run table...');

        const dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '3306'),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'opuzen_dev'
        };

        connection = await mysql.createConnection(dbConfig);
        logger.info('✅ Database connection established');
        logger.info(`📊 Connected to database: ${dbConfig.database}`);

        // Run migration
        await up({ query: connection.query.bind(connection) });

        // Verify columns were added
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'netsuite_dry_run_sync_log'
            AND COLUMN_NAME IN ('simulated_restlet_response', 'simulated_validation_results', 'would_succeed', 'simulated_errors')
            ORDER BY COLUMN_NAME
        `);

        logger.info('✅ Migration completed successfully');
        console.log('\n📋 New columns added:');
        columns.forEach(col => {
            console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE}${col.IS_NULLABLE === 'YES' ? ', NULL' : ', NOT NULL'})`);
            if (col.COLUMN_COMMENT) {
                console.log(`    └─ ${col.COLUMN_COMMENT}`);
            }
        });

    } catch (error) {
        logger.error('❌ Migration failed:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            logger.info('🔌 Database connection closed');
        }
        process.exit(0);
    }
}

if (require.main === module) {
    runMigration();
}

module.exports = runMigration;

