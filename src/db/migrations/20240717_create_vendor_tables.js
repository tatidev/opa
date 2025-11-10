const logger = require('../../utils/logger');

exports.up = async (db) => {
    logger.info('Creating vendor system tables...');
    
    // Create vendors table
    await db.query(`
        CREATE TABLE api_vendors (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            abbreviation VARCHAR(10) NOT NULL,
            business_name VARCHAR(255),
            description TEXT,
            website VARCHAR(255),
            is_active BOOLEAN DEFAULT TRUE,
            is_archived BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_by INT,
            updated_by INT,
            
            UNIQUE KEY unique_name (name),
            UNIQUE KEY unique_abbreviation (abbreviation),
            KEY idx_active (is_active),
            KEY idx_archived (is_archived),
            KEY idx_created_by (created_by),
            KEY idx_name (name),
            KEY idx_abbreviation (abbreviation)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Create vendor contacts table
    await db.query(`
        CREATE TABLE api_vendor_contacts (
            id INT PRIMARY KEY AUTO_INCREMENT,
            vendor_id INT NOT NULL,
            contact_type ENUM('primary', 'billing', 'technical', 'sales') DEFAULT 'primary',
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            title VARCHAR(100),
            email VARCHAR(255),
            phone VARCHAR(20),
            phone_ext VARCHAR(10),
            mobile VARCHAR(20),
            fax VARCHAR(20),
            address_line1 VARCHAR(255),
            address_line2 VARCHAR(255),
            city VARCHAR(100),
            state VARCHAR(50),
            zip_code VARCHAR(20),
            country VARCHAR(100) DEFAULT 'USA',
            is_primary BOOLEAN DEFAULT FALSE,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_by INT,
            updated_by INT,
            
            FOREIGN KEY (vendor_id) REFERENCES api_vendors(id) ON DELETE CASCADE,
            KEY idx_vendor_id (vendor_id),
            KEY idx_contact_type (contact_type),
            KEY idx_is_primary (is_primary),
            KEY idx_active (is_active),
            KEY idx_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Create vendor files table
    await db.query(`
        CREATE TABLE api_vendor_files (
            id INT PRIMARY KEY AUTO_INCREMENT,
            vendor_id INT NOT NULL,
            file_type ENUM('logo', 'certificate', 'contract', 'catalog', 'price_list', 'other') DEFAULT 'other',
            file_name VARCHAR(255) NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            file_size INT,
            mime_type VARCHAR(100),
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_by INT,
            updated_by INT,
            
            FOREIGN KEY (vendor_id) REFERENCES api_vendors(id) ON DELETE CASCADE,
            KEY idx_vendor_id (vendor_id),
            KEY idx_file_type (file_type),
            KEY idx_active (is_active),
            KEY idx_created_by (created_by)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Create vendor notes table
    await db.query(`
        CREATE TABLE api_vendor_notes (
            id INT PRIMARY KEY AUTO_INCREMENT,
            vendor_id INT NOT NULL,
            note_type ENUM('general', 'payment', 'shipping', 'quality', 'service') DEFAULT 'general',
            title VARCHAR(255),
            content TEXT NOT NULL,
            is_private BOOLEAN DEFAULT FALSE,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_by INT,
            updated_by INT,
            
            FOREIGN KEY (vendor_id) REFERENCES api_vendors(id) ON DELETE CASCADE,
            KEY idx_vendor_id (vendor_id),
            KEY idx_note_type (note_type),
            KEY idx_is_private (is_private),
            KEY idx_active (is_active),
            KEY idx_created_by (created_by)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Create vendor addresses table
    await db.query(`
        CREATE TABLE api_vendor_addresses (
            id INT PRIMARY KEY AUTO_INCREMENT,
            vendor_id INT NOT NULL,
            address_type ENUM('main', 'billing', 'shipping', 'warehouse') DEFAULT 'main',
            address_line1 VARCHAR(255) NOT NULL,
            address_line2 VARCHAR(255),
            city VARCHAR(100) NOT NULL,
            state VARCHAR(50) NOT NULL,
            zip_code VARCHAR(20) NOT NULL,
            country VARCHAR(100) DEFAULT 'USA',
            is_primary BOOLEAN DEFAULT FALSE,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_by INT,
            updated_by INT,
            
            FOREIGN KEY (vendor_id) REFERENCES api_vendors(id) ON DELETE CASCADE,
            KEY idx_vendor_id (vendor_id),
            KEY idx_address_type (address_type),
            KEY idx_is_primary (is_primary),
            KEY idx_active (is_active),
            KEY idx_city_state (city, state)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Insert default vendor data
    await db.query(`
        INSERT INTO api_vendors (name, abbreviation, business_name, description, is_active, created_by) VALUES
        ('Carrier', 'CAR', 'Carrier Corporation', 'Premium fabric manufacturer', TRUE, 1),
        ('Designtex', 'DTX', 'Designtex Inc.', 'Commercial textile supplier', TRUE, 1),
        ('Momentum', 'MOM', 'Momentum Textiles', 'Healthcare and hospitality fabrics', TRUE, 1),
        ('Anzea', 'ANZ', 'Anzea Textiles', 'Durable fabric solutions', TRUE, 1),
        ('Maharam', 'MAH', 'Maharam Fabric Corporation', 'Design-focused textiles', TRUE, 1)
    `);
    
    logger.info('Vendor system tables created successfully');
};

exports.down = async (db) => {
    logger.info('Dropping vendor system tables...');
    
    await db.query('DROP TABLE IF EXISTS api_vendor_addresses');
    await db.query('DROP TABLE IF EXISTS api_vendor_notes');
    await db.query('DROP TABLE IF EXISTS api_vendor_files');
    await db.query('DROP TABLE IF EXISTS api_vendor_contacts');
    await db.query('DROP TABLE IF EXISTS api_vendors');
    
    logger.info('Vendor system tables dropped successfully');
}; 