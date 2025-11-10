/**
 * Create users table
 */
exports.up = async function(connection) {
    await connection.query(`
        CREATE TABLE api_users (
            id INT PRIMARY KEY AUTO_INCREMENT,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            phone VARCHAR(20),
            company VARCHAR(255),
            is_active BOOLEAN DEFAULT TRUE,
            email_verified BOOLEAN DEFAULT FALSE,
            email_verification_token VARCHAR(255),
            password_reset_token VARCHAR(255),
            password_reset_expires TIMESTAMP NULL,
            last_login TIMESTAMP NULL,
            failed_login_attempts INT DEFAULT 0,
            locked_until TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            
            INDEX idx_username (username),
            INDEX idx_email (email),
            INDEX idx_email_verification_token (email_verification_token),
            INDEX idx_password_reset_token (password_reset_token),
            INDEX idx_is_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Create default admin user
    await connection.query(`
        INSERT INTO api_users (
            username, email, password_hash, first_name, last_name, 
            is_active, email_verified
        ) VALUES (
            'admin', 'admin@opuzen.com', 
            '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
            'System', 'Administrator', 
            TRUE, TRUE
        );
    `);
};

exports.down = async function(connection) {
    await connection.query('DROP TABLE IF EXISTS api_users');
}; 