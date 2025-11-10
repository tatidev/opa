/**
 * Data Type Validation Service for OPMS Import
 * Ensures all imported data matches the cache table data types
 * Prevents cache rebuild failures and API search breaks
 */

const logger = require('../utils/logger');

class DataTypeValidationService {
    constructor() {
        // Cache table structure based on user's specification
        this.cacheTableSchema = {
            product_name: { type: 'VARCHAR(255)', nullable: true },
            vrepeat: { type: 'VARCHAR(50)', nullable: true },
            hrepeat: { type: 'VARCHAR(50)', nullable: true },
            width: { type: 'DECIMAL(10,2)', nullable: true },
            product_id: { type: 'INT', nullable: false },
            outdoor: { type: "ENUM('Y','N')", nullable: true },
            product_type: { type: 'CHAR(1)', nullable: false },
            archived: { type: "ENUM('Y','N')", nullable: true },
            in_master: { type: "ENUM('Y','N')", nullable: true },
            abrasions: { type: 'TEXT', nullable: true },
            count_abrasion_files: { type: 'INT', nullable: true },
            content_front: { type: 'TEXT', nullable: true },
            firecodes: { type: 'TEXT', nullable: true },
            count_firecode_files: { type: 'INT', nullable: true },
            uses: { type: 'TEXT', nullable: true },
            uses_id: { type: 'TEXT', nullable: true },
            vendor_product_name: { type: 'VARCHAR(255)', nullable: true },
            tariff_surcharge: { type: 'DECIMAL(10,2)', nullable: true },
            freight_surcharge: { type: 'DECIMAL(10,2)', nullable: true },
            p_hosp_cut: { type: 'DECIMAL(10,2)', nullable: true },
            p_hosp_roll: { type: 'DECIMAL(10,2)', nullable: true },
            p_res_cut: { type: 'DECIMAL(10,2)', nullable: true },
            p_dig_res: { type: 'DECIMAL(10,2)', nullable: true },
            p_dig_hosp: { type: 'DECIMAL(10,2)', nullable: true },
            price_date: { type: 'VARCHAR(10)', nullable: true },
            fob: { type: 'DECIMAL(10,2)', nullable: true }, // CRITICAL: Must be numeric
            cost_cut: { type: 'VARCHAR(50)', nullable: true },
            cost_half_roll: { type: 'VARCHAR(50)', nullable: true },
            cost_roll: { type: 'VARCHAR(50)', nullable: true },
            cost_roll_landed: { type: 'VARCHAR(50)', nullable: true },
            cost_roll_ex_mill: { type: 'VARCHAR(50)', nullable: true },
            cost_date: { type: 'VARCHAR(10)', nullable: true },
            vendors_name: { type: 'VARCHAR(255)', nullable: true },
            vendors_abrev: { type: 'VARCHAR(10)', nullable: true },
            vendor_business_name: { type: 'VARCHAR(255)', nullable: true },
            weaves: { type: 'TEXT', nullable: true },
            weaves_id: { type: 'TEXT', nullable: true },
            colors: { type: 'TEXT', nullable: true },
            color_ids: { type: 'TEXT', nullable: true },
            searchable_colors: { type: 'TEXT', nullable: true },
            searchable_uses: { type: 'TEXT', nullable: true },
            searchable_firecodes: { type: 'TEXT', nullable: true },
            searchable_content_front: { type: 'TEXT', nullable: true },
            searchable_vendors_abrev: { type: 'VARCHAR(10)', nullable: true }
        };

        // Data type validation rules
        this.validationRules = {
            DECIMAL: (value, precision) => {
                if (value === null || value === undefined || value === '') return null;
                if (typeof value === 'number') return value;
                if (typeof value === 'string') {
                    // Remove any non-numeric characters except decimal point
                    const cleanValue = value.replace(/[^0-9.-]/g, '');
                    const numValue = parseFloat(cleanValue);
                    return isNaN(numValue) ? null : numValue;
                }
                return null;
            },
            INT: (value) => {
                if (value === null || value === undefined || value === '') return null;
                if (typeof value === 'number') return Math.floor(value);
                if (typeof value === 'string') {
                    const numValue = parseInt(value);
                    return isNaN(numValue) ? null : numValue;
                }
                return null;
            },
            VARCHAR: (value, maxLength) => {
                if (value === null || value === undefined) return null;
                const stringValue = String(value).trim();
                if (maxLength && stringValue.length > maxLength) {
                    return stringValue.substring(0, maxLength);
                }
                return stringValue;
            },
            TEXT: (value) => {
                if (value === null || value === undefined) return null;
                return String(value).trim();
            },
            ENUM: (value, allowedValues) => {
                if (value === null || value === undefined || value === '') return null;
                const stringValue = String(value).toUpperCase().trim();
                return allowedValues.includes(stringValue) ? stringValue : null;
            },
            CHAR: (value, length) => {
                if (value === null || value === undefined) return null;
                const stringValue = String(value).trim();
                if (stringValue.length > length) {
                    return stringValue.substring(0, length);
                }
                return stringValue.padEnd(length, ' ');
            }
        };
    }

    /**
     * Validate and correct data types for a single record
     * @param {Object} data - Data to validate
     * @param {string} tableName - Target table name
     * @returns {Object} Validated and corrected data
     */
    validateAndCorrectData(data, tableName) {
        const validatedData = {};
        const errors = [];
        const warnings = [];

        try {
            // Get schema for the target table
            const tableSchema = this.getTableSchema(tableName);
            if (!tableSchema) {
                throw new Error(`Unknown table: ${tableName}`);
            }

            // Validate each field
            for (const [fieldName, fieldSchema] of Object.entries(tableSchema)) {
                const value = data[fieldName];
                
                try {
                    const validatedValue = this.validateField(value, fieldSchema);
                    if (validatedValue !== undefined) {
                        validatedData[fieldName] = validatedValue;
                    }
                } catch (fieldError) {
                    errors.push(`Field ${fieldName}: ${fieldError.message}`);
                    // Set to null for failed fields to prevent cache rebuild failures
                    validatedData[fieldName] = null;
                }
            }

            // Log validation results
            if (errors.length > 0) {
                logger.warn(`Data validation errors for ${tableName}:`, { errors, data });
            }
            if (warnings.length > 0) {
                logger.info(`Data validation warnings for ${tableName}:`, { warnings, data });
            }

            return {
                data: validatedData,
                errors,
                warnings,
                isValid: errors.length === 0
            };

        } catch (error) {
            logger.error(`Data validation failed for ${tableName}:`, error);
            throw error;
        }
    }

    /**
     * Validate a single field against its schema definition
     * @param {*} value - Field value to validate
     * @param {Object} fieldSchema - Field schema definition
     * @returns {*} Validated value
     */
    validateField(value, fieldSchema) {
        const { type, nullable, precision } = fieldSchema;

        // Handle null values
        if (value === null || value === undefined || value === '') {
            if (!nullable) {
                throw new Error(`Field cannot be null`);
            }
            return null;
        }

        // Extract base type and parameters
        const baseType = type.split('(')[0].toUpperCase();
        const params = type.match(/\(([^)]+)\)/);
        const paramValue = params ? params[1] : null;

        // Apply validation rule
        if (this.validationRules[baseType]) {
            return this.validationRules[baseType](value, paramValue);
        }

        // Default string conversion for unknown types
        return String(value).trim();
    }

    /**
     * Get schema for a specific table
     * @param {string} tableName - Table name
     * @returns {Object} Table schema
     */
    getTableSchema(tableName) {
        // Map table names to their schemas
        const tableSchemas = {
            'T_PRODUCT': {
                id: { type: 'INT', nullable: false },
                name: { type: 'VARCHAR(50)', nullable: false },
                width: { type: 'DECIMAL(11,2)', nullable: true },
                vrepeat: { type: 'DECIMAL(5,2)', nullable: true },
                hrepeat: { type: 'DECIMAL(5,2)', nullable: true },
                outdoor: { type: "ENUM('Y','N')", nullable: true },
                archived: { type: "ENUM('Y','N')", nullable: true }
            },
            'T_ITEM': {
                id: { type: 'INT', nullable: false },
                code: { type: 'VARCHAR(9)', nullable: true },
                product_id: { type: 'INT', nullable: false },
                vendor_code: { type: 'VARCHAR(50)', nullable: true },
                vendor_color: { type: 'VARCHAR(50)', nullable: true },
                archived: { type: "ENUM('Y','N')", nullable: true }
            },
            'T_PRODUCT_VARIOUS': {
                product_id: { type: 'INT', nullable: false },
                vendor_product_name: { type: 'VARCHAR(50)', nullable: true },
                prop_65: { type: "ENUM('Y','N')", nullable: true },
                ab_2998_compliant: { type: "ENUM('Y','N')", nullable: true },
                tariff_code: { type: 'VARCHAR(50)', nullable: true }
            }
        };

        return tableSchemas[tableName] || {};
    }

    /**
     * Pre-validate CSV data before transformation
     * @param {Array} csvData - Array of CSV rows
     * @returns {Object} Validation results
     */
    preValidateCsvData(csvData) {
        const results = {
            totalRows: csvData.length,
            validRows: 0,
            invalidRows: 0,
            errors: [],
            warnings: []
        };

        csvData.forEach((row, index) => {
            try {
                // Check for critical data type issues
                const criticalIssues = this.checkCriticalDataTypes(row);
                if (criticalIssues.length > 0) {
                    results.invalidRows++;
                    results.errors.push(`Row ${index + 1}: ${criticalIssues.join(', ')}`);
                } else {
                    results.validRows++;
                }
            } catch (error) {
                results.invalidRows++;
                results.errors.push(`Row ${index + 1}: ${error.message}`);
            }
        });

        return results;
    }

    /**
     * Check for critical data type issues that would break cache rebuild
     * @param {Object} row - CSV row data
     * @returns {Array} Array of critical issues
     */
    checkCriticalDataTypes(row) {
        const issues = [];

        // Check numeric fields that must be numeric for cache table
        const numericFields = ['Width', 'VR', 'HR'];
        numericFields.forEach(field => {
            if (row[field] && isNaN(parseFloat(row[field]))) {
                issues.push(`${field} must be numeric, got: "${row[field]}"`);
            }
        });

        // Check enum fields
        const enumFields = {
            'Repeat (No-Repeat)': ['Y', 'N', 'Repeat', 'No-Repeat'],
            'Prop 65 Compliance': ['Y', 'N'],
            'AB 2998 Compliance': ['Y', 'N']
        };

        Object.entries(enumFields).forEach(([field, allowedValues]) => {
            if (row[field] && !allowedValues.includes(row[field])) {
                issues.push(`${field} must be one of: ${allowedValues.join(', ')}, got: "${row[field]}"`);
            }
        });

        return issues;
    }
}

module.exports = DataTypeValidationService;
