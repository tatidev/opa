/**
 * Create showrooms table
 */
exports.up = async function(connection) {
    await connection.query(`
        CREATE TABLE api_showrooms (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            abbreviation VARCHAR(10) NOT NULL,
            address TEXT,
            city VARCHAR(100),
            state VARCHAR(50),
            zip VARCHAR(20),
            country VARCHAR(100) DEFAULT 'USA',
            phone VARCHAR(20),
            email VARCHAR(255),
            contact_person VARCHAR(255),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            
            INDEX idx_name (name),
            INDEX idx_abbreviation (abbreviation),
            INDEX idx_is_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Create default showrooms
    await connection.query(`
        INSERT INTO api_showrooms (name, abbreviation, city, state, is_active) VALUES 
        ('Main Office', 'MAIN', 'New York', 'NY', TRUE),
        ('Atlanta Showroom', 'ATL', 'Atlanta', 'GA', TRUE),
        ('Chicago Showroom', 'CHI', 'Chicago', 'IL', TRUE),
        ('Dallas Showroom', 'DAL', 'Dallas', 'TX', TRUE),
        ('Los Angeles Showroom', 'LA', 'Los Angeles', 'CA', TRUE);
    `);
};

exports.down = async function(connection) {
    await connection.query('DROP TABLE IF EXISTS api_showrooms');
}; 