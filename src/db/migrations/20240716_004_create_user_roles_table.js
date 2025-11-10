/**
 * Create user roles junction table
 */
exports.up = async function(connection) {
    await connection.query(`
        CREATE TABLE api_user_roles (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            role_id INT NOT NULL,
            assigned_by INT,
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (user_id) REFERENCES api_users(id) ON DELETE CASCADE,
            FOREIGN KEY (role_id) REFERENCES api_roles(id) ON DELETE CASCADE,
            FOREIGN KEY (assigned_by) REFERENCES api_users(id) ON DELETE SET NULL,
            
            UNIQUE KEY unique_user_role (user_id, role_id),
            INDEX idx_user_id (user_id),
            INDEX idx_role_id (role_id),
            INDEX idx_assigned_by (assigned_by)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Assign admin role to default admin user
    await connection.query(`
        INSERT INTO api_user_roles (user_id, role_id) 
        SELECT u.id, r.id 
        FROM api_users u, api_roles r 
        WHERE u.username = 'admin' AND r.name = 'admin';
    `);
};

exports.down = async function(connection) {
    await connection.query('DROP TABLE IF EXISTS api_user_roles');
}; 