/**
 * Create user showrooms junction table
 */
exports.up = async function(connection) {
    await connection.query(`
        CREATE TABLE api_user_showrooms (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            showroom_id INT NOT NULL,
            assigned_by INT,
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (user_id) REFERENCES api_users(id) ON DELETE CASCADE,
            FOREIGN KEY (showroom_id) REFERENCES api_showrooms(id) ON DELETE CASCADE,
            FOREIGN KEY (assigned_by) REFERENCES api_users(id) ON DELETE SET NULL,
            
            UNIQUE KEY unique_user_showroom (user_id, showroom_id),
            INDEX idx_user_id (user_id),
            INDEX idx_showroom_id (showroom_id),
            INDEX idx_assigned_by (assigned_by)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Assign admin user to main office
    await connection.query(`
        INSERT INTO api_user_showrooms (user_id, showroom_id) 
        SELECT u.id, s.id 
        FROM api_users u, api_showrooms s 
        WHERE u.username = 'admin' AND s.abbreviation = 'MAIN';
    `);
};

exports.down = async function(connection) {
    await connection.query('DROP TABLE IF EXISTS api_user_showrooms');
}; 