/**
 * NetSuite Vendor Service
 * 
 * Handles vendor creation and validation in NetSuite
 * Ensures vendors exist before creating inventory items
 */

const fetch = require('node-fetch');
const logger = require('../utils/logger');
const netsuiteService = require('./netsuiteRestletService');

class NetSuiteVendorService {
    constructor() {
        this.vendorRestletUrl = process.env.NETSUITE_VENDOR_RESTLET_URL;
        this.cache = new Map(); // Cache vendor existence checks
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Ensure vendor exists in NetSuite, create if it doesn't
     * @param {Object} opmsVendor - OPMS vendor data
     * @returns {Promise<Object>} NetSuite vendor info
     */
    async ensureVendorExists(opmsVendor) {
        if (!opmsVendor || !opmsVendor.name) {
            throw new Error('Invalid vendor data provided');
        }

        const cacheKey = `vendor_${opmsVendor.id}_${opmsVendor.name}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                logger.debug(`Vendor cache hit: ${opmsVendor.name} -> NetSuite ID ${cached.data.id}`);
                return cached.data;
            }
        }

        try {
            logger.info(`🏢 Ensuring vendor exists in NetSuite: ${opmsVendor.name} (OPMS ID: ${opmsVendor.id})`);

            // Prepare vendor data for NetSuite
            const vendorData = {
                companyName: opmsVendor.name,
                opmsVendorId: opmsVendor.id,
                opmsAbbreviation: opmsVendor.abbreviation || opmsVendor.abrev,
                subsidiary: 1 // Default subsidiary
            };

            // Call NetSuite vendor RESTlet
            const result = await this.callVendorRestlet(vendorData);

            if (result.success) {
                const vendorInfo = {
                    id: result.id,
                    name: result.companyName || opmsVendor.name,
                    isExisting: result.isExisting || false,
                    opmsId: opmsVendor.id
                };

                // Cache the result
                this.cache.set(cacheKey, {
                    data: vendorInfo,
                    timestamp: Date.now()
                });

                if (result.isExisting) {
                    logger.info(`   ✅ Vendor already exists: NetSuite ID ${result.id}`);
                } else {
                    logger.info(`   ✅ Vendor created: NetSuite ID ${result.id}`);
                }

                return vendorInfo;
            } else {
                throw new Error(`Vendor creation failed: ${result.message || 'Unknown error'}`);
            }

        } catch (error) {
            logger.error(`❌ Failed to ensure vendor exists: ${opmsVendor.name}`, error.message);
            throw error;
        }
    }

    /**
     * Call NetSuite Vendor RESTlet
     * @param {Object} vendorData - Vendor data for NetSuite
     * @returns {Promise<Object>} RESTlet response
     */
    async callVendorRestlet(vendorData) {
        if (!this.vendorRestletUrl) {
            throw new Error('NETSUITE_VENDOR_RESTLET_URL not configured');
        }

        // Use the same authentication as the inventory RESTlet
        const authHeaders = netsuiteService.buildAuthHeaders('POST', this.vendorRestletUrl);

        logger.debug('🚀 Calling NetSuite Vendor RESTlet:', {
            url: this.vendorRestletUrl,
            data: vendorData
        });

        const response = await fetch(this.vendorRestletUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            },
            body: JSON.stringify(vendorData)
        });

        const responseText = await response.text();

        if (!response.ok) {
            throw new Error(`Vendor RESTlet error: ${response.status} ${response.statusText}: ${responseText}`);
        }

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            throw new Error(`Invalid JSON response from Vendor RESTlet: ${responseText}`);
        }

        logger.debug('📥 Vendor RESTlet response:', result);
        return result;
    }

    /**
     * Batch ensure multiple vendors exist
     * @param {Array} opmsVendors - Array of OPMS vendor objects
     * @returns {Promise<Array>} Array of NetSuite vendor info
     */
    async ensureVendorsExist(opmsVendors) {
        if (!Array.isArray(opmsVendors) || opmsVendors.length === 0) {
            return [];
        }

        logger.info(`🏢 Ensuring ${opmsVendors.length} vendors exist in NetSuite`);

        const results = [];
        for (const vendor of opmsVendors) {
            try {
                const vendorInfo = await this.ensureVendorExists(vendor);
                results.push(vendorInfo);
            } catch (error) {
                logger.error(`Failed to process vendor ${vendor.name}:`, error.message);
                // Continue with other vendors
                results.push({
                    id: null,
                    name: vendor.name,
                    error: error.message,
                    opmsId: vendor.id
                });
            }
        }

        const successful = results.filter(r => r.id !== null).length;
        logger.info(`✅ Vendor processing complete: ${successful}/${opmsVendors.length} successful`);

        return results;
    }

    /**
     * Clear vendor cache
     */
    clearCache() {
        this.cache.clear();
        logger.debug('Vendor cache cleared');
    }

    /**
     * Get cache stats
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys())
        };
    }
}

module.exports = NetSuiteVendorService;
