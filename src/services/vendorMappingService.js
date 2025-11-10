/**
 * Vendor Mapping Service
 * 
 * Handles mapping between OPMS vendor IDs and NetSuite vendor IDs
 * for proper native field integration.
 */

const BaseModel = require('../models/BaseModel');
const logger = require('../utils/logger');

class VendorMappingService {
    constructor() {
        this.model = new BaseModel('opms_netsuite_vendor_mapping');
        this.cache = new Map(); // Simple in-memory cache
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.lastCacheUpdate = 0;
    }

    /**
     * Get NetSuite vendor ID from OPMS vendor ID
     * @param {number} opmsVendorId - OPMS vendor ID
     * @returns {Promise<number|null>} NetSuite vendor ID or null
     */
    async getNetSuiteVendorId(opmsVendorId) {
        try {
            // Check cache first
            if (this.isCacheValid() && this.cache.has(opmsVendorId)) {
                logger.debug(`Vendor mapping cache hit for OPMS ID ${opmsVendorId}`);
                return this.cache.get(opmsVendorId);
            }

            // Query database
            const query = `
                SELECT netsuite_vendor_id 
                FROM opms_netsuite_vendor_mapping 
                WHERE opms_vendor_id = ?
            `;

            const result = await this.model.executeQuery(query, [opmsVendorId]);
            
            if (result.length > 0) {
                const netsuiteVendorId = result[0].netsuite_vendor_id;
                
                // Cache the result
                this.cache.set(opmsVendorId, netsuiteVendorId);
                
                logger.debug(`Vendor mapping found: OPMS ${opmsVendorId} → NetSuite ${netsuiteVendorId}`);
                return netsuiteVendorId;
            }

            logger.debug(`No vendor mapping found for OPMS ID ${opmsVendorId}`);
            return null;

        } catch (error) {
            logger.error(`Error getting NetSuite vendor ID for OPMS ID ${opmsVendorId}:`, error.message);
            return null;
        }
    }

    /**
     * Get OPMS vendor ID from NetSuite vendor ID (reverse lookup)
     * @param {number} netsuiteVendorId - NetSuite vendor ID
     * @returns {Promise<number|null>} OPMS vendor ID or null
     */
    async getOpmsVendorId(netsuiteVendorId) {
        try {
            const query = `
                SELECT opms_vendor_id 
                FROM opms_netsuite_vendor_mapping 
                WHERE netsuite_vendor_id = ?
            `;

            const result = await this.model.executeQuery(query, [netsuiteVendorId]);
            
            if (result.length > 0) {
                const opmsVendorId = result[0].opms_vendor_id;
                logger.debug(`Reverse vendor mapping found: NetSuite ${netsuiteVendorId} → OPMS ${opmsVendorId}`);
                return opmsVendorId;
            }

            logger.debug(`No reverse vendor mapping found for NetSuite ID ${netsuiteVendorId}`);
            return null;

        } catch (error) {
            logger.error(`Error getting OPMS vendor ID for NetSuite ID ${netsuiteVendorId}:`, error.message);
            return null;
        }
    }

    /**
     * Get vendor mapping details
     * @param {number} opmsVendorId - OPMS vendor ID
     * @returns {Promise<Object|null>} Full mapping details or null
     */
    async getVendorMapping(opmsVendorId) {
        try {
            const query = `
                SELECT 
                    opms_vendor_id,
                    opms_vendor_name,
                    opms_vendor_abrev,
                    netsuite_vendor_id,
                    netsuite_vendor_name,
                    created_at,
                    updated_at
                FROM opms_netsuite_vendor_mapping 
                WHERE opms_vendor_id = ?
            `;

            const result = await this.model.executeQuery(query, [opmsVendorId]);
            
            if (result.length > 0) {
                return result[0];
            }

            return null;

        } catch (error) {
            logger.error(`Error getting vendor mapping for OPMS ID ${opmsVendorId}:`, error.message);
            return null;
        }
    }

    /**
     * Get all vendor mappings
     * @returns {Promise<Array>} All vendor mappings
     */
    async getAllMappings() {
        try {
            const query = `
                SELECT 
                    opms_vendor_id,
                    opms_vendor_name,
                    opms_vendor_abrev,
                    netsuite_vendor_id,
                    netsuite_vendor_name,
                    created_at,
                    updated_at
                FROM opms_netsuite_vendor_mapping 
                ORDER BY opms_vendor_name
            `;

            return await this.model.executeQuery(query);

        } catch (error) {
            logger.error('Error getting all vendor mappings:', error.message);
            return [];
        }
    }

    /**
     * Refresh the vendor mapping cache
     */
    async refreshCache() {
        try {
            logger.info('Refreshing vendor mapping cache...');
            
            const query = `
                SELECT opms_vendor_id, netsuite_vendor_id 
                FROM opms_netsuite_vendor_mapping
            `;

            const mappings = await this.model.executeQuery(query);
            
            // Clear and rebuild cache
            this.cache.clear();
            mappings.forEach(mapping => {
                this.cache.set(mapping.opms_vendor_id, mapping.netsuite_vendor_id);
            });

            this.lastCacheUpdate = Date.now();
            logger.info(`Vendor mapping cache refreshed with ${mappings.length} mappings`);

        } catch (error) {
            logger.error('Error refreshing vendor mapping cache:', error.message);
        }
    }

    /**
     * Check if cache is still valid
     * @returns {boolean} True if cache is valid
     */
    isCacheValid() {
        return (Date.now() - this.lastCacheUpdate) < this.cacheExpiry;
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            lastUpdate: new Date(this.lastCacheUpdate).toISOString(),
            isValid: this.isCacheValid(),
            expiryTime: new Date(this.lastCacheUpdate + this.cacheExpiry).toISOString()
        };
    }

    /**
     * Check if vendor mapping table exists
     * @returns {Promise<boolean>} True if table exists
     */
    async checkMappingTableExists() {
        try {
            const query = `
                SELECT COUNT(*) as count 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                AND table_name = 'opms_netsuite_vendor_mapping'
            `;

            const result = await this.model.executeQuery(query);
            return result[0].count > 0;

        } catch (error) {
            logger.error('Error checking vendor mapping table:', error.message);
            return false;
        }
    }

    /**
     * Get mapping statistics
     * @returns {Promise<Object>} Mapping statistics
     */
    async getMappingStats() {
        try {
            const tableExists = await this.checkMappingTableExists();
            
            if (!tableExists) {
                return {
                    tableExists: false,
                    totalMappings: 0,
                    message: 'Vendor mapping table does not exist. Run vendor import first.'
                };
            }

            const countQuery = `SELECT COUNT(*) as total FROM opms_netsuite_vendor_mapping`;
            const countResult = await this.model.executeQuery(countQuery);

            const recentQuery = `
                SELECT COUNT(*) as recent 
                FROM opms_netsuite_vendor_mapping 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            `;
            const recentResult = await this.model.executeQuery(recentQuery);

            return {
                tableExists: true,
                totalMappings: countResult[0].total,
                recentMappings: recentResult[0].recent,
                cacheStats: this.getCacheStats()
            };

        } catch (error) {
            logger.error('Error getting mapping statistics:', error.message);
            return {
                tableExists: false,
                totalMappings: 0,
                error: error.message
            };
        }
    }
}

// Export singleton instance
module.exports = new VendorMappingService();

