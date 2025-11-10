/**
 * Enhanced NetSuite RESTlet Service with Vendor Validation
 * Extends the base service with vendor validation and OPMS integration
 */

const netsuiteService = require('./netsuiteRestletService');
const VendorValidationService = require('./vendorValidationService');
const logger = require('../utils/logger');

class NetSuiteRestletServiceEnhanced {
    constructor() {
        this.vendorValidator = new VendorValidationService();
    }

    /**
     * Create lot numbered inventory item with vendor validation
     * @param {Object} itemData - Item data with vendor information
     * @param {Object} options - Creation options
     * @returns {Promise<Object>} Creation result with validation details
     */
    async createLotNumberedInventoryItemWithValidation(itemData, options = {}) {
        const result = {
            success: false,
            validation: {
                vendor: null,
                warnings: [],
                errors: []
            }
        };

        try {
            logger.info(`Creating NetSuite item with vendor validation: ${itemData.itemId || itemData.code}`);

            // Step 1: Validate vendor data
            const vendorValidation = await this.vendorValidator.validateAndPrepareVendorData(itemData);
            result.validation.vendor = vendorValidation;

            if (vendorValidation.errors.length > 0) {
                result.validation.warnings.push(...vendorValidation.errors);
                logger.warn(`Vendor validation warnings for item ${itemData.itemId}:`, vendorValidation.errors);
            }

            // Step 2: Enhance item data with validated vendor information
            const enhancedItemData = await this.enhanceItemDataWithVendor(itemData, vendorValidation);

            // Step 3: Create item using enhanced data
            const createResult = await netsuiteService.createLotNumberedInventoryItem(enhancedItemData, options);

            // Step 4: Merge results
            result.success = createResult.success;
            result.id = createResult.id;
            result.itemId = createResult.itemId;
            result.message = createResult.message;
            result.customFields = createResult.customFields;
            result.error = createResult.error;

            // Step 5: Add vendor validation summary
            if (result.success && vendorValidation.isValid) {
                result.validation.summary = this.createValidationSummary(vendorValidation);
                logger.info(`Item created successfully with vendor: ${result.validation.summary}`);
            }

            return result;

        } catch (error) {
            logger.error('Error in enhanced item creation:', error.message);
            result.error = error.message;
            result.validation.errors.push(error.message);
            return result;
        }
    }

    /**
     * Enhance item data with validated vendor information
     * @param {Object} itemData - Original item data
     * @param {Object} vendorValidation - Vendor validation result
     * @returns {Promise<Object>} Enhanced item data
     */
    async enhanceItemDataWithVendor(itemData, vendorValidation) {
        const enhanced = { ...itemData };

        if (vendorValidation.isValid && vendorValidation.vendorData) {
            const vendorData = vendorValidation.vendorData;

            // Add NetSuite vendor ID if available
            if (vendorData.netsuiteVendorId) {
                enhanced.vendor = vendorData.netsuiteVendorId;
                logger.debug(`Added NetSuite vendor ID: ${vendorData.netsuiteVendorId}`);
            }

            // Add vendor name for NetSuite vendorname field
            if (vendorData.vendorName) {
                enhanced.vendorname = vendorData.vendorName;
                enhanced.vendorProductName = vendorData.vendorName; // Alternative field name
            }

            // Add vendor code
            if (vendorData.vendorCode) {
                enhanced.vendorcode = vendorData.vendorCode;
                enhanced.vendorCode = vendorData.vendorCode; // Alternative field name
            }

            // Add custom OPMS vendor fields
            enhanced.custitem_opms_vendor_name = vendorData.opmsVendor.name;
            
            if (vendorData.vendorColor) {
                enhanced.custitem_opms_vendor_color = vendorData.vendorColor;
            }

            logger.debug(`Enhanced item data with vendor: ${vendorData.opmsVendor.name} (NetSuite ID: ${vendorData.netsuiteVendorId || 'unmapped'})`);
        }

        return enhanced;
    }

    /**
     * Create validation summary for logging
     * @param {Object} vendorValidation - Vendor validation result
     * @returns {string} Summary string
     */
    createValidationSummary(vendorValidation) {
        const vendor = vendorValidation.vendorData;
        if (!vendor) return 'No vendor data';

        const parts = [
            `OPMS: ${vendor.opmsVendor.name} (ID: ${vendor.opmsVendor.id})`,
            `NetSuite: ${vendor.netsuiteVendorId || 'unmapped'}`
        ];

        if (vendor.vendorCode) {
            parts.push(`Code: ${vendor.vendorCode}`);
        }

        return parts.join(', ');
    }

    /**
     * Validate vendor configuration in NetSuite
     * @param {number} netsuiteVendorId - NetSuite vendor ID
     * @returns {Promise<Object>} Validation result
     */
    async validateNetSuiteVendor(netsuiteVendorId) {
        // This could be enhanced to actually check NetSuite vendor configuration
        // For now, return basic validation
        return {
            isValid: netsuiteVendorId && netsuiteVendorId > 0,
            vendorId: netsuiteVendorId,
            message: netsuiteVendorId ? 'Vendor ID provided' : 'No vendor ID'
        };
    }

    /**
     * Get vendor mapping statistics
     * @returns {Promise<Object>} Vendor statistics
     */
    async getVendorStats() {
        return await this.vendorValidator.getVendorStats();
    }

    /**
     * Validate OPMS vendor by ID
     * @param {number} opmsVendorId - OPMS vendor ID
     * @returns {Promise<Object>} Vendor data or null
     */
    async validateOpmsVendor(opmsVendorId) {
        return await this.vendorValidator.validateOpmsVendor(opmsVendorId);
    }

    /**
     * Get NetSuite vendor ID for OPMS vendor
     * @param {number} opmsVendorId - OPMS vendor ID
     * @returns {Promise<number|null>} NetSuite vendor ID
     */
    async getNetSuiteVendorId(opmsVendorId) {
        const opmsVendor = await this.validateOpmsVendor(opmsVendorId);
        if (!opmsVendor) return null;
        
        return await this.vendorValidator.getNetSuiteVendorId(opmsVendor);
    }

    // Proxy all other methods to the base service
    async createLotNumberedInventoryItem(itemData, options = {}) {
        return await netsuiteService.createLotNumberedInventoryItem(itemData, options);
    }

    async updateLotNumberedInventoryItem(itemId, itemData, options = {}) {
        return await netsuiteService.updateLotNumberedInventoryItem(itemId, options);
    }

    async deleteLotNumberedInventoryItem(itemId, options = {}) {
        return await netsuiteService.deleteLotNumberedInventoryItem(itemId, options);
    }

    async testConnection() {
        return await netsuiteService.testConnection();
    }

    transformToRestletPayload(itemData) {
        return netsuiteService.transformToRestletPayload(itemData);
    }
}

module.exports = new NetSuiteRestletServiceEnhanced();
