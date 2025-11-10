/**
 * Create roles table
 */
exports.up = async function(connection) {
    await connection.query(`
        CREATE TABLE api_roles (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(50) UNIQUE NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            
            INDEX idx_name (name),
            INDEX idx_is_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Create default roles
    await connection.query(`
        INSERT INTO api_roles (name, description) VALUES 
        ('admin', 'System Administrator - Full access to all features'),
        ('manager', 'Manager - Can manage users and most operations'),
        ('user', 'Regular User - Standard access to basic features'),
        ('showroom', 'Showroom User - Access to showroom-specific features'),
        ('readonly', 'Read Only - View access only');
    `);
};

exports.down = async function(connection) {
    await connection.query('DROP TABLE IF EXISTS api_roles');
}; 