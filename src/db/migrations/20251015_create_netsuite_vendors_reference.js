/**
 * Create NetSuite Vendors Reference Table
 * Migration to store NetSuite vendor data extracted from production for reference and lookup
 */

const logger = require('../../utils/logger');

exports.up = async (db) => {
    logger.info('Creating NetSuite vendors reference table...');
    
    // Create NetSuite vendors reference table
    await db.query(`
        CREATE TABLE netsuite_vendors_reference (
            id INT PRIMARY KEY COMMENT 'NetSuite internal vendor ID',
            entityid VARCHAR(255) NOT NULL COMMENT 'NetSuite entity ID (vendor code)',
            companyname VARCHAR(255) DEFAULT NULL COMMENT 'Legal company name',
            displayname VARCHAR(255) NOT NULL COMMENT 'Display name for vendor',
            isinactive BOOLEAN DEFAULT FALSE COMMENT 'Vendor active status (inverted)',
            subsidiary VARCHAR(255) DEFAULT NULL COMMENT 'Associated subsidiary name',
            subsidiary_id INT DEFAULT NULL COMMENT 'Subsidiary internal ID',
            
            -- Metadata fields
            extracted_at TIMESTAMP DEFAULT NULL COMMENT 'When this vendor data was extracted from NetSuite',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            
            -- Indexes for performance
            UNIQUE KEY unique_entityid (entityid),
            KEY idx_companyname (companyname),
            KEY idx_displayname (displayname),
            KEY idx_active (isinactive),
            KEY idx_subsidiary_id (subsidiary_id),
            KEY idx_subsidiary (subsidiary(100))
            
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Reference table storing NetSuite vendor data extracted from production'
    `);
    
    logger.info('✅ NetSuite vendors reference table created successfully');
    
    // Create view for active vendors only
    await db.query(`
        CREATE VIEW v_netsuite_vendors_active AS
        SELECT 
            id,
            entityid,
            companyname,
            displayname,
            subsidiary,
            subsidiary_id,
            extracted_at,
            updated_at
        FROM netsuite_vendors_reference
        WHERE isinactive = FALSE
        ORDER BY displayname ASC
    `);
    
    logger.info('✅ NetSuite vendors active view created');
    
    // Create view for vendor lookup (combining with OPMS mapping if exists)
    await db.query(`
        CREATE VIEW v_netsuite_vendor_lookup AS
        SELECT 
            nsv.id as netsuite_vendor_id,
            nsv.entityid as netsuite_entity_id,
            nsv.companyname as netsuite_company_name,
            nsv.displayname as netsuite_display_name,
            nsv.subsidiary as netsuite_subsidiary,
            nsv.subsidiary_id as netsuite_subsidiary_id,
            nsv.isinactive as netsuite_inactive,
            vm.opms_vendor_id,
            vm.opms_vendor_name,
            vm.opms_vendor_abrev,
            vm.mapping_confidence,
            vm.is_active as mapping_active
        FROM netsuite_vendors_reference nsv
        LEFT JOIN opms_netsuite_vendor_mapping vm 
            ON nsv.id = vm.netsuite_vendor_id AND vm.is_active = TRUE
        WHERE nsv.isinactive = FALSE
        ORDER BY nsv.displayname ASC
    `);
    
    logger.info('✅ NetSuite vendor lookup view created');
};

exports.down = async (db) => {
    logger.info('Dropping NetSuite vendors reference tables...');
    
    await db.query('DROP VIEW IF EXISTS v_netsuite_vendor_lookup');
    await db.query('DROP VIEW IF EXISTS v_netsuite_vendors_active');
    await db.query('DROP TABLE IF EXISTS netsuite_vendors_reference');
    
    logger.info('✅ NetSuite vendors reference tables dropped');
};

exports.description = 'Create NetSuite vendors reference table with lookup views';

