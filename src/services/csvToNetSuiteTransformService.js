/**
 * CSV to NetSuite Transform Service
 * Transforms OPMS CSV export format to NetSuite RESTlet payload format
 */

const csv = require('csv-parser');
const fs = require('fs');
const logger = require('../utils/logger');

class CsvToNetSuiteTransformService {
    constructor() {
        // Define expected CSV headers from OPMS export
        this.expectedHeaders = [
            // OPMS Source Data
            'opms_item_id', 'opms_product_id', 'opms_item_code', 'opms_product_name', 'opms_color_name',
            'opms_width', 'opms_vendor_id', 'opms_vendor_name', 'opms_vendor_code', 'opms_vendor_color', 'opms_vendor_product_name',
            
            // NetSuite Payload Fields
            'ns_itemId', 'ns_displayname', 'ns_custitem_opms_fabric_width', 
            'ns_vendor', 'ns_vendorname', 'ns_vendorcode',
            'ns_custitem_opms_vendor_color', 'ns_custitem_opms_vendor_prod_name', 'ns_custitem_opms_item_colors',
            'ns_custitem_opms_parent_product_name', 'ns_custitem_opms_product_id', 'ns_custitem_opms_item_id',
            'ns_frontContentJson', 'ns_backContentJson', 'ns_abrasionJson', 'ns_firecodesJson',
            
            // NetSuite Constants
            'ns_usebins', 'ns_matchbilltoreceipt', 'ns_custitem_aln_1_auto_numbered',
            'ns_custitem_aln_3_initial_sequence', 'ns_subsidiary', 'ns_taxschedule',
            'ns_unitstype', 'ns_custitem_aln_2_number_format'
        ];

        // Define required fields for NetSuite RESTlet
        this.requiredFields = [
            'ns_itemId',           // itemId (required)
            'ns_displayname',      // displayName (required)
            'ns_custitem_opms_product_id',  // custitem_opms_product_id (required)
            'ns_custitem_opms_item_id'      // custitem_opms_item_id (required)
        ];
    }

    /**
     * Parse CSV file and return array of rows
     * @param {string} filePath - Path to CSV file
     * @returns {Promise<Array>} Array of CSV rows as objects
     */
    async parseCsvFile(filePath) {
        return new Promise((resolve, reject) => {
            const rows = [];
            
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    rows.push(row);
                })
                .on('end', () => {
                    logger.info(`CSV parsed successfully: ${rows.length} rows`);
                    resolve(rows);
                })
                .on('error', (error) => {
                    logger.error('CSV parsing error:', error);
                    reject(error);
                });
        });
    }

    /**
     * Validate CSV format and headers
     * @param {Array} rows - CSV rows
     * @returns {Object} Validation result
     */
    validateCsvFormat(rows) {
        if (!rows || rows.length === 0) {
            return {
                isValid: false,
                error: 'CSV file is empty or has no data rows'
            };
        }

        const firstRow = rows[0];
        const csvHeaders = Object.keys(firstRow);
        
        // Check for required headers
        const missingHeaders = this.requiredFields.filter(field => !csvHeaders.includes(field));
        
        if (missingHeaders.length > 0) {
            return {
                isValid: false,
                error: `Missing required CSV headers: ${missingHeaders.join(', ')}`
            };
        }

        // Check for duplicate item IDs
        const itemIds = rows.map(row => row.ns_itemId).filter(id => id);
        const duplicateIds = itemIds.filter((id, index) => itemIds.indexOf(id) !== index);
        
        if (duplicateIds.length > 0) {
            return {
                isValid: false,
                error: `Duplicate item IDs found: ${[...new Set(duplicateIds)].join(', ')}`
            };
        }

        return {
            isValid: true,
            rowCount: rows.length,
            headers: csvHeaders
        };
    }

    /**
     * Transform CSV row to NetSuite RESTlet payload format
     * @param {Object} csvRow - Single CSV row object
     * @param {number} rowIndex - Row index for error reporting
     * @returns {Object} NetSuite RESTlet payload
     */
    transformCsvRowToRestletPayload(csvRow, rowIndex) {
        try {
            // Build base payload with required fields
            const payload = {
                itemId: csvRow.ns_itemId,
                displayName: csvRow.ns_displayname,
                custitem_opms_product_id: parseInt(csvRow.ns_custitem_opms_product_id),
                custitem_opms_item_id: parseInt(csvRow.ns_custitem_opms_item_id)
            };

            // Add optional fields if present
            if (csvRow.ns_custitem_opms_fabric_width) {
                payload.custitem_opms_fabric_width = parseFloat(csvRow.ns_custitem_opms_fabric_width);
            }

            // Add vendor fields
            if (csvRow.ns_vendor) {
                payload.vendor = csvRow.ns_vendor;
            }
            if (csvRow.ns_vendorname) {
                payload.vendorname = csvRow.ns_vendorname;
            }
            if (csvRow.ns_vendorcode) {
                payload.vendorcode = csvRow.ns_vendorcode;
            }

            // Add custom vendor fields
            if (csvRow.ns_custitem_opms_vendor_color) {
                payload.custitem_opms_vendor_color = csvRow.ns_custitem_opms_vendor_color;
            }
            if (csvRow.ns_custitem_opms_vendor_prod_name) {
                payload.custitem_opms_vendor_prod_name = csvRow.ns_custitem_opms_vendor_prod_name;
            }
            if (csvRow.ns_custitem_opms_item_colors) {
                payload.custitem_opms_item_colors = csvRow.ns_custitem_opms_item_colors;
            }
            if (csvRow.ns_custitem_opms_parent_product_name) {
                payload.custitem_opms_parent_product_name = csvRow.ns_custitem_opms_parent_product_name;
            }

            // Add mini-forms content (parse HTML if needed)
            if (csvRow.ns_frontContentJson && csvRow.ns_frontContentJson !== 'src empty data') {
                payload.frontContent = this.parseHtmlToMiniFormData(csvRow.ns_frontContentJson);
            }
            if (csvRow.ns_backContentJson && csvRow.ns_backContentJson !== 'src empty data') {
                payload.backContent = this.parseHtmlToMiniFormData(csvRow.ns_backContentJson);
            }
            if (csvRow.ns_abrasionJson && csvRow.ns_abrasionJson !== 'src empty data') {
                payload.abrasion = this.parseHtmlToMiniFormData(csvRow.ns_abrasionJson);
            }
            if (csvRow.ns_firecodesJson && csvRow.ns_firecodesJson !== 'src empty data') {
                payload.firecodes = this.parseHtmlToMiniFormData(csvRow.ns_firecodesJson);
            }

            // Add NetSuite constants (convert from CSV strings to proper types)
            payload.usebins = this.parseBooleanValue(csvRow.ns_usebins);
            payload.matchbilltoreceipt = this.parseBooleanValue(csvRow.ns_matchbilltoreceipt);
            payload.custitem_aln_1_auto_numbered = this.parseBooleanValue(csvRow.ns_custitem_aln_1_auto_numbered);
            payload.custitem_aln_3_initial_sequence = parseInt(csvRow.ns_custitem_aln_3_initial_sequence) || 1;
            payload.subsidiary = parseInt(csvRow.ns_subsidiary) || 2;
            payload.taxschedule = parseInt(csvRow.ns_taxschedule) || 1;
            payload.unitstype = parseInt(csvRow.ns_unitstype) || 1;
            payload.custitem_aln_2_number_format = this.parseBooleanValue(csvRow.ns_custitem_aln_2_number_format);

            return payload;

        } catch (error) {
            logger.error(`Error transforming CSV row ${rowIndex}:`, error);
            throw new Error(`Row ${rowIndex}: ${error.message}`);
        }
    }

    /**
     * Parse HTML mini-forms content to extract data
     * For now, pass through as-is since RESTlet handles HTML
     * @param {string} htmlContent - HTML content from CSV
     * @returns {string} Processed content
     */
    parseHtmlToMiniFormData(htmlContent) {
        // For now, pass HTML through as-is since the RESTlet can handle HTML content
        // Future enhancement: Parse HTML tables back to structured data if needed
        return htmlContent;
    }

    /**
     * Parse boolean values from CSV strings
     * @param {string} value - String value from CSV
     * @returns {boolean} Parsed boolean
     */
    parseBooleanValue(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true' || value === '1';
        }
        return false;
    }

    /**
     * Transform entire CSV to array of NetSuite RESTlet payloads
     * @param {string} filePath - Path to CSV file
     * @returns {Promise<Object>} Transformation result
     */
    async transformCsvToRestletPayloads(filePath) {
        try {
            logger.info('Starting CSV to RESTlet transformation', { filePath });

            // Parse CSV file
            const rows = await this.parseCsvFile(filePath);
            
            // Validate CSV format
            const validation = this.validateCsvFormat(rows);
            if (!validation.isValid) {
                throw new Error(validation.error);
            }

            logger.info(`CSV validation passed: ${validation.rowCount} rows`);

            // Transform each row
            const transformedItems = [];
            const errors = [];

            for (let i = 0; i < rows.length; i++) {
                try {
                    const payload = this.transformCsvRowToRestletPayload(rows[i], i + 1);
                    transformedItems.push({
                        rowIndex: i + 1,
                        itemId: payload.itemId,
                        payload: payload
                    });
                } catch (error) {
                    errors.push({
                        rowIndex: i + 1,
                        itemId: rows[i].ns_itemId || 'unknown',
                        error: error.message
                    });
                }
            }

            logger.info('CSV transformation completed', {
                totalRows: rows.length,
                successfulTransforms: transformedItems.length,
                errors: errors.length
            });

            return {
                success: true,
                totalRows: rows.length,
                transformedItems: transformedItems,
                errors: errors,
                summary: {
                    successful: transformedItems.length,
                    failed: errors.length,
                    successRate: Math.round((transformedItems.length / rows.length) * 100)
                }
            };

        } catch (error) {
            logger.error('CSV transformation failed:', error);
            return {
                success: false,
                error: error.message,
                totalRows: 0,
                transformedItems: [],
                errors: []
            };
        }
    }

    /**
     * Validate individual RESTlet payload
     * @param {Object} payload - RESTlet payload
     * @returns {Object} Validation result
     */
    validateRestletPayload(payload) {
        const errors = [];

        // Check required fields
        if (!payload.itemId) {
            errors.push('itemId is required');
        }
        if (!payload.displayName) {
            errors.push('displayName is required');
        }
        if (!payload.custitem_opms_product_id || isNaN(payload.custitem_opms_product_id)) {
            errors.push('custitem_opms_product_id must be a valid integer');
        }
        if (!payload.custitem_opms_item_id || isNaN(payload.custitem_opms_item_id)) {
            errors.push('custitem_opms_item_id must be a valid integer');
        }

        // Check item ID length (NetSuite limit)
        if (payload.itemId && payload.itemId.length > 40) {
            errors.push('itemId cannot exceed 40 characters');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Get transformation statistics
     * @param {Object} transformResult - Result from transformCsvToRestletPayloads
     * @returns {Object} Statistics
     */
    getTransformationStats(transformResult) {
        return {
            totalRows: transformResult.totalRows,
            successfulTransforms: transformResult.transformedItems.length,
            failedTransforms: transformResult.errors.length,
            successRate: transformResult.summary.successRate,
            readyForNetSuite: transformResult.transformedItems.filter(item => {
                const validation = this.validateRestletPayload(item.payload);
                return validation.isValid;
            }).length
        };
    }
}

module.exports = CsvToNetSuiteTransformService;
