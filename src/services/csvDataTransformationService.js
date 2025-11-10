/**
 * CSV Data Transformation Service for OPMS Database
 * Transforms validated CSV data into database operations
 */

const logger = require('../utils/logger');
const DataTypeValidationService = require('./dataTypeValidationService');

class CsvDataTransformationService {
    constructor() {
        // Initialize data type validation service
        this.dataTypeValidator = new DataTypeValidationService();
        
        // Define field mappings from CSV to database
        this.fieldMappings = {
            // Core item fields
            'Item Id (Opuzen Code)': { table: 'T_ITEM', field: 'code', type: 'string' },
            'OPMS Item Id': { table: 'T_ITEM', field: 'id', type: 'integer', auto: true },
            'OPMS Product Id': { table: 'T_PRODUCT', field: 'id', type: 'integer', auto: true },
            
            // Product fields
            'Product Name': { table: 'T_PRODUCT', field: 'name', type: 'string' },
            'Width': { table: 'T_PRODUCT', field: 'width', type: 'decimal' },
            'VR': { table: 'T_PRODUCT', field: 'vrepeat', type: 'decimal' },
            'HR': { table: 'T_PRODUCT', field: 'hrepeat', type: 'decimal' },
            'Repeat (No-Repeat)': { table: 'T_PRODUCT', field: 'outdoor', type: 'enum', transform: this.transformRepeatField },
            
            // Item fields
            'Vendor Item Code': { table: 'T_ITEM', field: 'vendor_code', type: 'string' },
            'Vendor Item Color': { table: 'T_ITEM', field: 'vendor_color', type: 'string' },
            
            // Extended product fields
            'Vendor Product Name': { table: 'T_PRODUCT_VARIOUS', field: 'vendor_product_name', type: 'string' },
            'Prop 65 Compliance': { table: 'T_PRODUCT_VARIOUS', field: 'prop_65', type: 'enum', transform: this.transformYesNo },
            'AB 2998 Compliance': { table: 'T_PRODUCT_VARIOUS', field: 'ab_2998_compliant', type: 'enum', transform: this.transformYesNo },
            'Tariff / Harmonized Code': { table: 'T_PRODUCT_VARIOUS', field: 'tariff_code', type: 'string' },
            
            // Mini-forms content
            'Front Content': { table: 'T_PRODUCT_CONTENT_FRONT', field: 'content', type: 'text' },
            'Back Content': { table: 'T_PRODUCT_CONTENT_BACK', field: 'content', type: 'text' },
            'Abrasion': { table: 'T_PRODUCT_ABRASION', field: 'content', type: 'text' },
            'Firecodes': { table: 'T_PRODUCT_FIRECODE', field: 'content', type: 'text' },
            
            // Multi-select relationship fields
            'Color': { table: 'P_COLOR', field: 'name', type: 'relationship', many: true },
            'Vendor': { table: 'Z_VENDOR', field: 'name', type: 'relationship', many: true },
            'Finish': { table: 'T_PRODUCT_FINISH', field: 'name', type: 'relationship', many: true },
            'Cleaning': { table: 'T_PRODUCT_CLEANING', field: 'name', type: 'relationship', many: true },
            'Origin': { table: 'T_PRODUCT_ORIGIN', field: 'name', type: 'relationship', many: true },
            'Use (Item Application)': { table: 'T_PRODUCT_USE', field: 'name', type: 'relationship', many: true }
        };
    }

    /**
     * Transform CSV row to database operations
     * @param {Object} csvRow - Single CSV row
     * @param {number} rowNumber - Row number for error tracking
     * @returns {Object} Transformed data structure
     */
    transformCsvRow(csvRow, rowNumber) {
        try {
            const transformedData = {
                rowNumber,
                operations: [],
                errors: [],
                warnings: []
            };

            // Extract core identifiers
            const itemCode = csvRow['Item Id (Opuzen Code)'];
            const productName = csvRow['Product Name'];
            const colors = this.parseCommaSeparated(csvRow['Color']);

            if (!itemCode || !productName || !colors.length) {
                transformedData.errors.push('Missing required fields: Item Code, Product Name, or Color');
                return transformedData;
            }

            // Transform product data
            const productData = this.transformProductData(csvRow);
            if (productData) {
                transformedData.operations.push({
                    type: 'upsert_product',
                    table: 'T_PRODUCT',
                    data: productData,
                    where: { name: productName }
                });
            }

            // Transform item data
            const itemData = this.transformItemData(csvRow);
            if (itemData) {
                transformedData.operations.push({
                    type: 'upsert_item',
                    table: 'T_ITEM',
                    data: itemData,
                    where: { code: itemCode }
                });
            }

            // Transform extended product data
            const extendedData = this.transformExtendedProductData(csvRow);
            if (extendedData && Object.keys(extendedData).length > 0) {
                transformedData.operations.push({
                    type: 'upsert_product_various',
                    table: 'T_PRODUCT_VARIOUS',
                    data: extendedData,
                    where: { product_id: null } // Will be set after product creation
                });
            }

            // Transform mini-forms content
            const miniFormsData = this.transformMiniFormsData(csvRow);
            miniFormsData.forEach(miniForm => {
                if (miniForm) {
                    transformedData.operations.push(miniForm);
                }
            });

            // Transform relationship data
            const relationshipData = this.transformRelationshipData(csvRow);
            relationshipData.forEach(relationship => {
                if (relationship) {
                    transformedData.operations.push(relationship);
                }
            });

            // Add warnings for missing optional data
            this.addDataWarnings(csvRow, transformedData);

            logger.info(`Row ${rowNumber} transformed successfully`, {
                operations: transformedData.operations.length,
                errors: transformedData.errors.length,
                warnings: transformedData.warnings.length
            });

            return transformedData;

        } catch (error) {
            logger.error(`Error transforming row ${rowNumber}`, error);
            return {
                rowNumber,
                operations: [],
                errors: [`Transformation error: ${error.message}`],
                warnings: []
            };
        }
    }

    /**
     * Transform product data from CSV
     * @param {Object} csvRow - CSV row data
     * @returns {Object} Product data object
     */
    transformProductData(csvRow) {
        const productData = {};

        // Map direct fields
        if (csvRow['Product Name']) {
            productData.name = csvRow['Product Name'].trim();
        }

        if (csvRow['Width']) {
            const width = parseFloat(csvRow['Width']);
            if (!isNaN(width)) {
                productData.width = width;
            }
        }

        if (csvRow['VR']) {
            const vrepeat = parseFloat(csvRow['VR']);
            if (!isNaN(vrepeat)) {
                productData.vrepeat = vrepeat;
            }
        }

        if (csvRow['HR']) {
            const hrepeat = parseFloat(csvRow['HR']);
            if (!isNaN(hrepeat)) {
                productData.hrepeat = hrepeat;
            }
        }

        if (csvRow['Repeat (No-Repeat)']) {
            productData.outdoor = this.transformRepeatField(csvRow['Repeat (No-Repeat)']);
        }

        // Set default values
        productData.archived = 'N';
        productData.type = 'R'; // Default to regular product
        productData.in_master = 1;

        return Object.keys(productData).length > 0 ? productData : null;
    }

    /**
     * Transform item data from CSV
     * @param {Object} csvRow - CSV row data
     * @returns {Object} Item data object
     */
    transformItemData(csvRow) {
        const itemData = {};

        if (csvRow['Item Id (Opuzen Code)']) {
            itemData.code = csvRow['Item Id (Opuzen Code)'].trim();
        }

        if (csvRow['Vendor Item Code']) {
            itemData.vendor_code = csvRow['Vendor Item Code'].trim();
        }

        if (csvRow['Vendor Item Color']) {
            itemData.vendor_color = csvRow['Vendor Item Color'].trim();
        }

        // Set default values
        itemData.archived = 'N';
        itemData.product_type = 'R';
        itemData.in_ringset = 0;
        itemData.status_id = 1;
        itemData.stock_status_id = 1;

        return Object.keys(itemData).length > 0 ? itemData : null;
    }

    /**
     * Transform extended product data from CSV
     * @param {Object} csvRow - CSV row data
     * @returns {Object} Extended product data object
     */
    transformExtendedProductData(csvRow) {
        const extendedData = {};

        if (csvRow['Vendor Product Name']) {
            extendedData.vendor_product_name = csvRow['Vendor Product Name'].trim();
        }

        if (csvRow['Prop 65 Compliance']) {
            extendedData.prop_65 = this.transformYesNo(csvRow['Prop 65 Compliance']);
        }

        if (csvRow['AB 2998 Compliance']) {
            extendedData.ab_2998_compliant = this.transformYesNo(csvRow['AB 2998 Compliance']);
        }

        if (csvRow['Tariff / Harmonized Code']) {
            extendedData.tariff_code = csvRow['Tariff / Harmonized Code'].trim();
        }

        return extendedData;
    }

    /**
     * Transform mini-forms data from CSV
     * @param {Object} csvRow - CSV row data
     * @returns {Array} Array of mini-form operations
     */
    transformMiniFormsData(csvRow) {
        const miniForms = [];

        // Front Content
        if (csvRow['Front Content']) {
            miniForms.push({
                type: 'upsert_product_content_front',
                table: 'T_PRODUCT_CONTENT_FRONT',
                data: { content: csvRow['Front Content'].trim() },
                where: { product_id: null }
            });
        }

        // Back Content
        if (csvRow['Back Content']) {
            miniForms.push({
                type: 'upsert_product_content_back',
                table: 'T_PRODUCT_CONTENT_BACK',
                data: { content: csvRow['Back Content'].trim() },
                where: { product_id: null }
            });
        }

        // Abrasion
        if (csvRow['Abrasion']) {
            miniForms.push({
                type: 'upsert_product_abrasion',
                table: 'T_PRODUCT_ABRASION',
                data: { content: csvRow['Abrasion'].trim() },
                where: { product_id: null }
            });
        }

        // Firecodes
        if (csvRow['Firecodes']) {
            miniForms.push({
                type: 'upsert_product_firecode',
                table: 'T_PRODUCT_FIRECODE',
                data: { content: csvRow['Firecodes'].trim() },
                where: { product_id: null }
            });
        }

        return miniForms;
    }

    /**
     * Transform relationship data from CSV
     * @param {Object} csvRow - CSV row data
     * @returns {Array} Array of relationship operations
     */
    transformRelationshipData(csvRow) {
        const relationships = [];

        // Colors
        if (csvRow['Color']) {
            const colors = this.parseCommaSeparated(csvRow['Color']);
            if (colors.length > 0) {
                relationships.push({
                    type: 'sync_item_colors',
                    table: 'T_ITEM_COLOR',
                    data: { colors },
                    where: { item_id: null }
                });
            }
        }

        // Vendors
        if (csvRow['Vendor']) {
            const vendors = this.parseCommaSeparated(csvRow['Vendor']);
            if (vendors.length > 0) {
                relationships.push({
                    type: 'sync_product_vendors',
                    table: 'T_PRODUCT_VENDOR',
                    data: { vendors },
                    where: { product_id: null }
                });
            }
        }

        // Multi-select fields
        const multiSelectFields = ['Finish', 'Cleaning', 'Origin', 'Use (Item Application)'];
        multiSelectFields.forEach(field => {
            if (csvRow[field]) {
                const values = this.parseCommaSeparated(csvRow[field]);
                if (values.length > 0) {
                    const tableName = this.getTableNameForField(field);
                    relationships.push({
                        type: `sync_product_${field.toLowerCase().replace(/\s+/g, '_')}`,
                        table: tableName,
                        data: { values },
                        where: { product_id: null }
                    });
                }
            }
        });

        return relationships;
    }

    /**
     * Get table name for a field
     * @param {string} fieldName - Field name
     * @returns {string} Table name
     */
    getTableNameForField(fieldName) {
        const fieldMappings = {
            'Finish': 'T_PRODUCT_FINISH',
            'Cleaning': 'T_PRODUCT_CLEANING',
            'Origin': 'T_PRODUCT_ORIGIN',
            'Use (Item Application)': 'T_PRODUCT_USE'
        };
        return fieldMappings[fieldName] || 'UNKNOWN_TABLE';
    }

    /**
     * Parse comma-separated values
     * @param {string} value - Comma-separated string
     * @returns {Array} Array of trimmed values
     */
    parseCommaSeparated(value) {
        if (!value || typeof value !== 'string') return [];
        return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
    }

    /**
     * Transform repeat field to database format
     * @param {string} value - Repeat field value
     * @returns {string} Database value
     */
    transformRepeatField(value) {
        if (!value) return 'N';
        const normalized = value.trim().toLowerCase();
        return normalized === 'repeat' ? 'Y' : 'N';
    }

    /**
     * Transform Yes/No field to database format
     * @param {string} value - Yes/No field value
     * @returns {string} Database value
     */
    transformYesNo(value) {
        if (!value) return 'N';
        const normalized = value.trim().toUpperCase();
        return ['Y', 'YES'].includes(normalized) ? 'Y' : 'N';
    }

    /**
     * Add warnings for missing optional data
     * @param {Object} csvRow - CSV row data
     * @param {Object} transformedData - Transformed data object
     */
    addDataWarnings(csvRow, transformedData) {
        const optionalFields = [
            'Width', 'VR', 'HR', 'Vendor Item Code', 'Vendor Item Color',
            'Vendor Product Name', 'Front Content', 'Back Content', 'Abrasion', 'Firecodes',
            'Prop 65 Compliance', 'AB 2998 Compliance', 'Finish', 'Cleaning', 'Origin',
            'Tariff / Harmonized Code', 'Use (Item Application)'
        ];

        optionalFields.forEach(field => {
            if (!csvRow[field] || csvRow[field].trim() === '') {
                transformedData.warnings.push(`Optional field '${field}' is empty`);
            }
        });
    }

    /**
     * Generate display name from product and colors
     * @param {string} productName - Product name
     * @param {Array} colors - Array of colors
     * @returns {string} Formatted display name
     */
    generateDisplayName(productName, colors) {
        if (!productName || !colors || colors.length === 0) {
            return productName || 'Unknown Product';
        }
        return `${productName}: ${colors.join(', ')}`;
    }

    /**
     * Validate transformed data structure
     * @param {Object} transformedData - Transformed data
     * @returns {Object} Validation result
     */
    validateTransformedData(transformedData) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };

        if (!transformedData.operations || transformedData.operations.length === 0) {
            validation.isValid = false;
            validation.errors.push('No operations generated from CSV data');
        }

        // Check for required operations
        const hasProductOp = transformedData.operations.some(op => op.type === 'upsert_product');
        const hasItemOp = transformedData.operations.some(op => op.type === 'upsert_item');

        if (!hasProductOp) {
            validation.isValid = false;
            validation.errors.push('Missing product operation');
        }

        if (!hasItemOp) {
            validation.isValid = false;
            validation.errors.push('Missing item operation');
        }

        // Add warnings from transformation
        if (transformedData.warnings) {
            validation.warnings.push(...transformedData.warnings);
        }

        return validation;
    }

    /**
     * Validate transformed operations to ensure cache table compatibility
     * @param {Array} operations - Array of database operations
     * @returns {Array} Validated operations
     */
    validateTransformedOperations(operations) {
        const validatedOperations = [];

        operations.forEach(operation => {
            try {
                // Validate data types for each operation
                const validationResult = this.dataTypeValidator.validateAndCorrectData(
                    operation.data, 
                    operation.table
                );

                if (validationResult.isValid) {
                    // Update operation data with validated values
                    operation.data = validationResult.data;
                    if (validationResult.warnings.length > 0) {
                        operation.warnings = validationResult.warnings;
                    }
                    validatedOperations.push(operation);
                } else {
                    // Log validation errors but don't fail the import
                    logger.warn(`Data validation failed for ${operation.table}:`, {
                        errors: validationResult.errors,
                        operation: operation.type
                    });
                    
                    // Use corrected data even if there were validation errors
                    operation.data = validationResult.data;
                    operation.warnings = validationResult.warnings;
                    validatedOperations.push(operation);
                }

            } catch (error) {
                logger.error(`Operation validation failed for ${operation.table}:`, error);
                // Include operation with original data if validation fails
                validatedOperations.push(operation);
            }
        });

        return validatedOperations;
    }
}

module.exports = CsvDataTransformationService;
