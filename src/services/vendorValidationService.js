/**
 * Vendor Validation Service
 * Validates vendors before NetSuite integration and provides OPMS-NetSuite mapping
 */

const BaseModel = require('../models/BaseModel');
const logger = require('../utils/logger');

class VendorValidationService extends BaseModel {
    constructor() {
        super();
    }

    /**
     * Validate vendor exists in OPMS Z_VENDOR table
     * @param {number|string} vendorId - OPMS vendor ID
     * @returns {Promise<Object|null>} Vendor data if valid, null if not found
     */
    async validateOpmsVendor(vendorId) {
        if (!vendorId) {
            return null;
        }

        const query = `
            SELECT 
                id,
                name,
                abrev as abbreviation,
                active,
                archived,
                date_add as created_at,
                date_modif as updated_at
            FROM Z_VENDOR 
            WHERE id = ? AND active = 'Y' AND archived = 'N'
        `;

        try {
            const vendors = await this.executeQuery(query, [vendorId]);
            if (vendors.length === 0) {
                logger.warn(`OPMS vendor not found or inactive: ${vendorId}`);
                return null;
            }

            const vendor = vendors[0];
            logger.debug(`OPMS vendor validated: ${vendor.name} (ID: ${vendor.id})`);
            return vendor;
        } catch (error) {
            logger.error(`Error validating OPMS vendor ${vendorId}:`, error.message);
            return null;
        }
    }

    /**
     * Get NetSuite vendor ID from OPMS vendor data
     * Uses vendor mapping table or fallback strategies
     * @param {Object} opmsVendor - OPMS vendor data
     * @returns {Promise<number|null>} NetSuite vendor ID
     */
    async getNetSuiteVendorId(opmsVendor) {
        if (!opmsVendor) {
            return null;
        }

        // Strategy 1: Check vendor mapping table (if exists)
        const mappedId = await this.checkVendorMapping(opmsVendor.id);
        if (mappedId) {
            logger.debug(`Found mapped NetSuite vendor ID: ${mappedId} for OPMS vendor ${opmsVendor.id}`);
            return mappedId;
        }

        // Strategy 2: Use hardcoded mapping for known vendors (temporary)
        const hardcodedId = this.getHardcodedVendorMapping(opmsVendor.name, opmsVendor.abbreviation);
        if (hardcodedId) {
            logger.debug(`Using hardcoded NetSuite vendor ID: ${hardcodedId} for ${opmsVendor.name}`);
            return hardcodedId;
        }

        // Strategy 3: Default fallback (could be enhanced with NetSuite search)
        logger.warn(`No NetSuite mapping found for OPMS vendor: ${opmsVendor.name} (ID: ${opmsVendor.id})`);
        return null;
    }

    /**
     * Check vendor mapping table for NetSuite ID
     * @param {number} opmsVendorId - OPMS vendor ID
     * @returns {Promise<number|null>} NetSuite vendor ID
     */
    async checkVendorMapping(opmsVendorId) {
        try {
            // Check if mapping table exists
            const tableExists = await this.checkTableExists('opms_netsuite_vendor_mapping');
            if (!tableExists) {
                return null;
            }

            const query = `
                SELECT netsuite_vendor_id 
                FROM opms_netsuite_vendor_mapping 
                WHERE opms_vendor_id = ?
            `;

            const mappings = await this.executeQuery(query, [opmsVendorId]);
            return mappings.length > 0 ? mappings[0].netsuite_vendor_id : null;
        } catch (error) {
            logger.debug(`Vendor mapping table not available: ${error.message}`);
            return null;
        }
    }

    /**
     * Hardcoded vendor mapping for known vendors (temporary solution)
     * @param {string} vendorName - Vendor name
     * @param {string} vendorAbbreviation - Vendor abbreviation
     * @returns {number|null} NetSuite vendor ID
     */
    getHardcodedVendorMapping(vendorName, vendorAbbreviation) {
        // Known vendor mappings (from our testing and documentation)
        const knownMappings = {
            // Vendor name/abbreviation -> NetSuite ID
            'Dekortex': 326,
            'DEKO': 326,
            
            // Add more mappings as discovered
            // 'Regal': null,        // Top vendor - needs mapping
            // 'Morgan/MJD': null,   // Top vendor - needs mapping
            // 'Pointe International': null, // Top vendor - needs mapping
        };

        // Try by name first
        if (knownMappings[vendorName]) {
            return knownMappings[vendorName];
        }

        // Try by abbreviation
        if (knownMappings[vendorAbbreviation]) {
            return knownMappings[vendorAbbreviation];
        }

        return null;
    }

    /**
     * Validate and prepare vendor data for NetSuite integration
     * @param {Object} itemData - Item data containing vendor information
     * @returns {Promise<Object>} Validated vendor data for NetSuite
     */
    async validateAndPrepareVendorData(itemData) {
        const result = {
            isValid: false,
            vendorData: null,
            netsuiteVendorId: null,
            errors: []
        };

        try {
            // Extract vendor ID from various possible sources
            const vendorId = this.extractVendorId(itemData);
            
            if (!vendorId) {
                result.errors.push('No vendor ID found in item data');
                return result;
            }

            // Validate OPMS vendor
            const opmsVendor = await this.validateOpmsVendor(vendorId);
            if (!opmsVendor) {
                result.errors.push(`OPMS vendor not found or inactive: ${vendorId}`);
                return result;
            }

            // Get NetSuite vendor ID
            const netsuiteVendorId = await this.getNetSuiteVendorId(opmsVendor);
            if (!netsuiteVendorId) {
                result.errors.push(`No NetSuite mapping found for OPMS vendor: ${opmsVendor.name} (ID: ${opmsVendor.id})`);
                // Don't return here - we can still proceed with custom fields
            }

            // Prepare vendor data for NetSuite
            result.isValid = true;
            result.vendorData = {
                opmsVendor: opmsVendor,
                netsuiteVendorId: netsuiteVendorId,
                vendorName: itemData.vendor_product_name || itemData.vendorProductName || opmsVendor.name,
                vendorCode: itemData.vendor_code || itemData.vendorCode || null,
                vendorColor: itemData.vendor_color || itemData.vendorColor || null
            };
            result.netsuiteVendorId = netsuiteVendorId;

            logger.info(`Vendor validation successful: ${opmsVendor.name} -> NetSuite ID: ${netsuiteVendorId || 'unmapped'}`);

        } catch (error) {
            logger.error('Error in vendor validation:', error.message);
            result.errors.push(`Vendor validation error: ${error.message}`);
        }

        return result;
    }

    /**
     * Extract vendor ID from item data (handles multiple field name formats)
     * @param {Object} itemData - Item data
     * @returns {number|null} Vendor ID
     */
    extractVendorId(itemData) {
        // Try various field names that might contain vendor ID
        const possibleFields = [
            'vendor_id',        // OPMS database field
            'vendorId',         // API camelCase
            'vendor',           // Direct vendor field
            'opms_vendor_id'    // Explicit OPMS field
        ];

        for (const field of possibleFields) {
            if (itemData[field]) {
                const vendorId = parseInt(itemData[field]);
                if (!isNaN(vendorId) && vendorId > 0) {
                    return vendorId;
                }
            }
        }

        return null;
    }

    /**
     * Check if a table exists in the database
     * @param {string} tableName - Table name to check
     * @returns {Promise<boolean>} True if table exists
     */
    async checkTableExists(tableName) {
        try {
            const query = `
                SELECT COUNT(*) as count 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                AND table_name = ?
            `;
            const result = await this.executeQuery(query, [tableName]);
            return result[0].count > 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get vendor statistics for monitoring
     * @returns {Promise<Object>} Vendor statistics
     */
    async getVendorStats() {
        try {
            const stats = {};

            // OPMS vendor count
            const opmsQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN active = 'Y' THEN 1 END) as active,
                    COUNT(CASE WHEN archived = 'N' THEN 1 END) as not_archived
                FROM Z_VENDOR
            `;
            const opmsStats = await this.executeQuery(opmsQuery);
            stats.opms = opmsStats[0];

            // Mapping table stats (if exists)
            const mappingExists = await this.checkTableExists('opms_netsuite_vendor_mapping');
            if (mappingExists) {
                const mappingQuery = `SELECT COUNT(*) as mapped FROM opms_netsuite_vendor_mapping`;
                const mappingStats = await this.executeQuery(mappingQuery);
                stats.mapped = mappingStats[0].mapped;
            } else {
                stats.mapped = 0;
            }

            stats.mappingCoverage = stats.opms.active > 0 ? 
                Math.round((stats.mapped / stats.opms.active) * 100) : 0;

            return stats;
        } catch (error) {
            logger.error('Error getting vendor stats:', error.message);
            return { error: error.message };
        }
    }
}

module.exports = VendorValidationService;
