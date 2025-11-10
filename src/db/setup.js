const mysql = require('mysql2/promise');
const { config } = require('../config/database');

async function setupDatabase() {
  // Create a connection without database selected
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password
  });

  try {
    // Create database if it doesn't exist
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${config.database}`);
    console.log(`Database '${config.database}' created or already exists`);

    // Use the database
    await connection.query(`USE ${config.database}`);
    console.log(`Using database '${config.database}'`);

    // Create migrations table if it doesn't exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT NOT NULL AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Migrations table created or already exists');

  } catch (error) {
    console.error('Database setup failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupDatabase()
    .then(() => {
      console.log('Database setup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupDatabase }; 