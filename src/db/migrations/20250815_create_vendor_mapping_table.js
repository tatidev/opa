/**
 * Create OPMS-NetSuite Vendor Mapping Table
 * Migration to create the vendor mapping table for production use
 */

const logger = require('../../utils/logger');

exports.up = async (db) => {
    logger.info('Creating OPMS-NetSuite vendor mapping table...');
    
    // Create vendor mapping table
    await db.query(`
        CREATE TABLE opms_netsuite_vendor_mapping (
            id INT PRIMARY KEY AUTO_INCREMENT,
            opms_vendor_id INT NOT NULL,
            opms_vendor_name VARCHAR(40) NOT NULL,
            opms_vendor_abrev VARCHAR(15),
            netsuite_vendor_id INT NOT NULL,
            netsuite_vendor_name VARCHAR(255),
            netsuite_vendor_entity_id VARCHAR(50),
            is_active BOOLEAN DEFAULT TRUE,
            mapping_confidence ENUM('high', 'medium', 'low') DEFAULT 'medium',
            mapping_method ENUM('manual', 'automatic', 'import') DEFAULT 'manual',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_by INT,
            updated_by INT,
            
            -- Indexes for performance
            UNIQUE KEY unique_opms_vendor (opms_vendor_id),
            UNIQUE KEY unique_netsuite_vendor (netsuite_vendor_id),
            KEY idx_opms_name (opms_vendor_name),
            KEY idx_netsuite_name (netsuite_vendor_name),
            KEY idx_active (is_active),
            KEY idx_confidence (mapping_confidence),
            KEY idx_method (mapping_method),
            
            -- Foreign key constraints (if Z_VENDOR table is accessible)
            -- FOREIGN KEY (opms_vendor_id) REFERENCES Z_VENDOR(id) ON DELETE CASCADE,
            
            -- Ensure data integrity
            CHECK (opms_vendor_id > 0),
            CHECK (netsuite_vendor_id > 0)
            
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Mapping table between OPMS vendors and NetSuite vendors'
    `);
    
    logger.info('✅ Vendor mapping table created successfully');
    
    // Insert known mappings from our testing
    logger.info('Inserting known vendor mappings...');
    
    await db.query(`
        INSERT INTO opms_netsuite_vendor_mapping 
        (opms_vendor_id, opms_vendor_name, opms_vendor_abrev, netsuite_vendor_id, netsuite_vendor_name, 
         mapping_confidence, mapping_method, notes, created_by)
        VALUES 
        (?, 'Dekortex', 'DEKO', 326, 'Dekortex', 'high', 'manual', 'Verified through testing - Item 8477', 1)
        ON DUPLICATE KEY UPDATE
        netsuite_vendor_id = VALUES(netsuite_vendor_id),
        mapping_confidence = VALUES(mapping_confidence),
        updated_at = CURRENT_TIMESTAMP
    `, [
        // We'll need to find the actual OPMS vendor ID for Dekortex
        // For now, using a placeholder that can be updated
        999 // This should be replaced with actual Dekortex OPMS ID
    ]);
    
    logger.info('✅ Known vendor mappings inserted');
    
    // Create vendor mapping log table for audit trail
    await db.query(`
        CREATE TABLE opms_netsuite_vendor_mapping_log (
            id INT PRIMARY KEY AUTO_INCREMENT,
            mapping_id INT NOT NULL,
            action ENUM('create', 'update', 'delete', 'verify') NOT NULL,
            old_values JSON,
            new_values JSON,
            user_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            
            KEY idx_mapping_id (mapping_id),
            KEY idx_action (action),
            KEY idx_created_at (created_at),
            
            FOREIGN KEY (mapping_id) REFERENCES opms_netsuite_vendor_mapping(id) ON DELETE CASCADE
            
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Audit log for vendor mapping changes'
    `);
    
    logger.info('✅ Vendor mapping log table created');
    
    // Create view for easy vendor lookup
    await db.query(`
        CREATE VIEW v_vendor_mapping AS
        SELECT 
            vm.id,
            vm.opms_vendor_id,
            vm.opms_vendor_name,
            vm.opms_vendor_abrev,
            vm.netsuite_vendor_id,
            vm.netsuite_vendor_name,
            vm.is_active,
            vm.mapping_confidence,
            vm.mapping_method,
            vm.created_at,
            vm.updated_at,
            -- OPMS vendor details (if accessible)
            zv.active as opms_vendor_active,
            zv.archived as opms_vendor_archived
        FROM opms_netsuite_vendor_mapping vm
        LEFT JOIN Z_VENDOR zv ON vm.opms_vendor_id = zv.id
        WHERE vm.is_active = TRUE
    `);
    
    logger.info('✅ Vendor mapping view created');
};

exports.down = async (db) => {
    logger.info('Dropping vendor mapping tables...');
    
    await db.query('DROP VIEW IF EXISTS v_vendor_mapping');
    await db.query('DROP TABLE IF EXISTS opms_netsuite_vendor_mapping_log');
    await db.query('DROP TABLE IF EXISTS opms_netsuite_vendor_mapping');
    
    logger.info('✅ Vendor mapping tables dropped');
};

exports.description = 'Create OPMS-NetSuite vendor mapping table with audit trail';
