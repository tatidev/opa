/**
 * CSV Import Service for OPMS Database
 * Handles parsing, validation, and transformation of CSV data for bulk imports
 */

const csv = require('csv-parser');
const fs = require('fs');
const logger = require('../utils/logger');

class CsvImportService {
    constructor() {
        // Define the expected CSV structure
        this.expectedColumns = [
            'Item Id (Opuzen Code)',
            'OPMS Item Id',
            'OPMS Product Id',
            'Product Name',
            'Display Name',
            'Color',
            'Width',
            'VR',
            'HR',
            'Vendor',
            'Vendor Item Code',
            'Vendor Product Name',
            'Vendor Item Color',
            'Repeat (No-Repeat)',
            'Front Content',
            'Back Content',
            'Abrasion',
            'Firecodes',
            'Prop 65 Compliance',
            'AB 2998 Compliance',
            'Finish',
            'Cleaning',
            'Origin',
            'Tariff / Harmonized Code',
            'Use (Item Application)'
        ];

        // Define required fields
        this.requiredFields = [
            'Item Id (Opuzen Code)',
            'Product Name',
            'Color'
        ];

        // Define field validators
        this.fieldValidators = {
            'Item Id (Opuzen Code)': this.validateItemCode,
            'Width': this.validateDecimal,
            'VR': this.validateDecimal,
            'HR': this.validateDecimal,
            'Prop 65 Compliance': this.validateYesNo,
            'AB 2998 Compliance': this.validateYesNo,
            'Repeat (No-Repeat)': this.validateRepeatField
        };
    }

    /**
     * Parse CSV file and return structured data
     * @param {string} filePath - Path to CSV file
     * @returns {Promise<Array>} Array of parsed CSV rows
     */
    async parseCsvFile(filePath) {
        return new Promise((resolve, reject) => {
            const results = [];
            
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', () => {
                    logger.info(`CSV parsed successfully: ${results.length} rows`);
                    resolve(results);
                })
                .on('error', (error) => {
                    logger.error('CSV parsing failed', error);
                    reject(error);
                });
        });
    }

    /**
     * Parse CSV buffer (for API uploads)
     * @param {Buffer} csvBuffer - CSV file buffer
     * @returns {Promise<Array>} Array of parsed CSV rows
     */
    async parseCsvBuffer(csvBuffer) {
        return new Promise((resolve, reject) => {
            const results = [];
            const lines = csvBuffer.toString().split('\n');
            
            if (lines.length < 2) {
                reject(new Error('CSV must have at least header and one data row'));
                return;
            }

            // Parse header
            const headers = this.parseCsvLine(lines[0]);
            
            // Parse data rows
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim()) {
                    const values = this.parseCsvLine(lines[i]);
                    const row = {};
                    
                    headers.forEach((header, index) => {
                        row[header] = values[index] || '';
                    });
                    
                    results.push(row);
                }
            }
            
            logger.info(`CSV buffer parsed successfully: ${results.length} rows`);
            resolve(results);
        });
    }

    /**
     * Parse CSV line with proper comma handling
     * @param {string} line - CSV line
     * @returns {Array} Array of values
     */
    parseCsvLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }

    /**
     * Validate CSV structure and data
     * @param {Array} csvData - Parsed CSV data
     * @returns {Object} Validation results
     */
    validateCsvData(csvData) {
        const validationResults = {
            isValid: true,
            errors: [],
            warnings: [],
            summary: {
                totalRows: csvData.length,
                validRows: 0,
                invalidRows: 0,
                missingRequiredFields: 0,
                dataTypeErrors: 0
            }
        };

        if (!csvData || csvData.length === 0) {
            validationResults.errors.push('CSV file is empty');
            validationResults.isValid = false;
            return validationResults;
        }

        // Validate each row
        csvData.forEach((row, rowIndex) => {
            const rowNumber = rowIndex + 1;
            let rowValid = true;
            let rowErrors = [];

            // Check required fields
            this.requiredFields.forEach(field => {
                if (!row[field] || row[field].trim() === '') {
                    const missingFieldMessage = this.getMissingFieldMessage(field);
                    rowErrors.push(missingFieldMessage);
                    rowValid = false;
                    validationResults.summary.missingRequiredFields++;
                }
            });

            // Validate field data types
            Object.entries(this.fieldValidators).forEach(([field, validator]) => {
                if (row[field] && row[field].trim() !== '') {
                    try {
                        const isValid = validator(row[field]);
                        if (!isValid) {
                            const errorMessage = this.getFieldErrorMessage(field, row[field]);
                            rowErrors.push(errorMessage);
                            rowValid = false;
                            validationResults.summary.dataTypeErrors++;
                        }
                    } catch (error) {
                        rowErrors.push(`Validation error for ${field}: ${error.message}`);
                        rowValid = false;
                        validationResults.summary.dataTypeErrors++;
                    }
                }
            });

            // Check for duplicate item codes
            const itemCode = row['Item Id (Opuzen Code)'];
            if (itemCode) {
                const duplicateRows = csvData.filter((r, i) => 
                    i !== rowIndex && r['Item Id (Opuzen Code)'] === itemCode
                );
                if (duplicateRows.length > 0) {
                    const duplicateMessage = this.getDuplicateItemCodeMessage(itemCode, rowIndex, duplicateRows);
                    rowErrors.push(duplicateMessage);
                    rowValid = false;
                }
            }

            if (rowValid) {
                validationResults.summary.validRows++;
            } else {
                validationResults.summary.invalidRows++;
                validationResults.errors.push(`Row ${rowNumber}: ${rowErrors.join('; ')}`);
            }
        });

        // Overall validation
        if (validationResults.summary.invalidRows > 0) {
            validationResults.isValid = false;
        }

        // Add comprehensive validation summary and guidance
        if (validationResults.summary.validRows === 0) {
            validationResults.warnings.push('⚠️ NO VALID ROWS FOUND - All rows have errors that must be fixed before import');
        }

        if (validationResults.summary.missingRequiredFields > 0) {
            validationResults.warnings.push(`🚨 ${validationResults.summary.missingRequiredFields} rows missing REQUIRED fields - Item Code, Product Name, and Color are mandatory`);
        }

        if (validationResults.summary.dataTypeErrors > 0) {
            validationResults.warnings.push(`🔧 ${validationResults.summary.dataTypeErrors} data type errors found - Check numeric fields (Width, VR, HR) and compliance fields (Y/N values)`);
        }

        // Add fix guidance
        if (!validationResults.isValid) {
            validationResults.fixGuidance = this.getFixGuidance(validationResults);
        }

        logger.info('CSV validation completed', validationResults.summary);
        return validationResults;
    }

    /**
     * Get comprehensive fix guidance based on validation results
     * @param {Object} validationResults - Validation results object
     * @returns {Object} Fix guidance with step-by-step instructions
     */
    getFixGuidance(validationResults) {
        const guidance = {
            priority: 'high',
            steps: [],
            examples: {},
            commonIssues: []
        };

        // Step-by-step fix instructions
        if (validationResults.summary.missingRequiredFields > 0) {
            guidance.steps.push({
                step: 1,
                title: 'Fix Missing Required Fields',
                description: 'All rows must have Item Code, Product Name, and Color',
                action: 'Add the missing values to empty cells',
                fields: ['Item Id (Opuzen Code)', 'Product Name', 'Color']
            });
        }

        if (validationResults.summary.dataTypeErrors > 0) {
            guidance.steps.push({
                step: guidance.steps.length + 1,
                title: 'Fix Data Type Errors',
                description: 'Ensure numeric fields contain valid numbers and compliance fields use Y/N',
                action: 'Correct invalid values according to the error messages',
                fields: ['Width', 'VR', 'HR', 'Prop 65 Compliance', 'AB 2998 Compliance', 'Repeat (No-Repeat)']
            });
        }

        // Add examples for common fixes
        guidance.examples = {
            'Item Code': '1354-6543, 7654-8989K, 2001-5678A',
            'Width': '54.00, 48.5, 60',
            'VR (Vertical Repeat)': '12.5, 8.0, 15.25',
            'HR (Horizontal Repeat)': '8.25, 10.0, 6.5',
            'Prop 65 Compliance': 'Y or N',
            'AB 2998 Compliance': 'Y or N',
            'Repeat': 'Repeat, No-Repeat, Y, or N',
            'Color': 'Ash, Blue, Red (comma-separated for multiple colors)'
        };

        // Common issues and solutions
        guidance.commonIssues = [
            {
                issue: 'Text in numeric fields',
                solution: 'Replace text like "USA" with actual numbers like "54.00"',
                example: 'Width: "USA" → "54.00"'
            },
            {
                issue: 'Invalid compliance values',
                solution: 'Use only Y (Yes) or N (No) for compliance fields',
                example: 'Prop 65: "Maybe" → "Y" or "N"'
            },
            {
                issue: 'Incorrect item code format',
                solution: 'Use new format: 4 digits, dash, 4 digits, optional letter (####-####<alpha>)',
                example: 'ABC123 → 1354-6543, PROD-01K → 2001-5678K, FAB001A → 3001-0001A'
            },
            {
                issue: 'Duplicate item codes',
                solution: 'Each row must have a unique Item Code',
                example: '1354-6543 appears twice → Change one to 1354-6544'
            },
            {
                issue: 'Empty required fields',
                solution: 'Fill in all required fields: Item Code, Product Name, Color',
                example: 'Product Name: "" → "Tranquil"'
            }
        ];

        return guidance;
    }

    /**
     * Get specific error message for missing required fields
     * @param {string} fieldName - Name of the missing field
     * @returns {string} Detailed error message with fix suggestion
     */
    getMissingFieldMessage(fieldName) {
        const fieldMessages = {
            'Item Id (Opuzen Code)': 'Missing Item Code - REQUIRED: Provide a unique code in format ####-####<alpha> (e.g., "1354-6543", "7654-8989K", "2001-5678A")',
            'Product Name': 'Missing Product Name - REQUIRED: Provide the product name (e.g., "Tranquil")',
            'Color': 'Missing Color - REQUIRED: Provide color name(s), comma-separated if multiple (e.g., "Ash, Blue")'
        };
        return fieldMessages[fieldName] || `Missing required field: ${fieldName}`;
    }

    /**
     * Get specific error message for invalid field data
     * @param {string} fieldName - Name of the field with invalid data
     * @param {string} value - The invalid value
     * @returns {string} Detailed error message with fix suggestion
     */
    getFieldErrorMessage(fieldName, value) {
        const errorMessages = {
            'Item Id (Opuzen Code)': `Invalid Item Code "${value}" - FIX: Must use format ####-####<alpha> (4 digits, dash, 4 digits, optional letter). Examples: "1354-6543", "7654-8989K", "2001-5678A"`,
            'Width': `Invalid Width "${value}" - FIX: Must be a positive decimal number in inches. Examples: "54.00", "48.5", "60"`,
            'VR': `Invalid VR (Vertical Repeat) "${value}" - FIX: Must be a positive decimal number in inches. Examples: "12.5", "8.0", "15.25"`,
            'HR': `Invalid HR (Horizontal Repeat) "${value}" - FIX: Must be a positive decimal number in inches. Examples: "8.25", "10.0", "6.5"`,
            'Prop 65 Compliance': `Invalid Prop 65 Compliance "${value}" - FIX: Must be "Y" for Yes or "N" for No. Current value: "${value}"`,
            'AB 2998 Compliance': `Invalid AB 2998 Compliance "${value}" - FIX: Must be "Y" for Yes or "N" for No. Current value: "${value}"`,
            'Repeat (No-Repeat)': `Invalid Repeat field "${value}" - FIX: Must be "Repeat", "No-Repeat", "Y", or "N". Current value: "${value}"`
        };
        return errorMessages[fieldName] || `Invalid ${fieldName}: "${value}" - Check data format and try again`;
    }

    /**
     * Get specific error message for duplicate item codes
     * @param {string} itemCode - The duplicate item code
     * @param {number} currentRow - Current row index
     * @param {Array} duplicateRows - Array of rows with same item code
     * @returns {string} Detailed error message with fix suggestion
     */
    getDuplicateItemCodeMessage(itemCode, currentRow, duplicateRows) {
        const duplicateRowNumbers = duplicateRows.map((_, index) => index + 2); // +2 for header and 1-based indexing
        return `Duplicate Item Code "${itemCode}" - FIX: Each item must have a unique code. This code also appears in row(s): ${duplicateRowNumbers.join(', ')}. Change one of them to a unique value.`;
    }

    /**
     * Field validators
     */
    validateItemCode(code) {
        if (!code || code.trim() === '') return false;
        
        // NEW FORMAT REQUIREMENT: For CSV imports, enforce ####-####<alpha> format (going forward)
        // Pattern: 4 digits, dash, 4 digits, optional single alpha character
        // Examples: 1354-6543, 7654-8989K, 2001-5678A
        // Legacy items in database are not affected by this validation
        const newFormatPattern = /^\d{4}-\d{4}[A-Za-z]?$/;
        
        if (!newFormatPattern.test(code)) {
            return false;
        }
        
        return true;
    }

    validateDecimal(value) {
        if (!value || value.trim() === '') return true; // Optional field
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0;
    }

    validateYesNo(value) {
        if (!value || value.trim() === '') return true; // Optional field
        return ['Y', 'N', 'y', 'n'].includes(value.trim());
    }

    validateRepeatField(value) {
        if (!value || value.trim() === '') return true; // Optional field
        const validValues = ['Repeat', 'No-Repeat', 'repeat', 'no-repeat', 'Y', 'N', 'y', 'n'];
        return validValues.includes(value.trim());
    }

    /**
     * Get CSV template with headers
     * @returns {string} CSV template string
     */
    getCsvTemplate() {
        const headers = this.expectedColumns.join(',');
        const exampleRow = [
            '1354-6543K',       // Item Id (Opuzen Code)
            '',                 // OPMS Item Id (auto-generated)
            '',                 // OPMS Product Id (auto-generated)
            'Tranquil',         // Product Name
            'Tranquil: Ash',    // Display Name (auto-generated)
            'Ash',              // Color
            '54.00',            // Width
            '12.5',             // VR
            '8.25',             // HR
            'Vendor Name',      // Vendor
            'V001',             // Vendor Item Code
            'Tranquil Ash',     // Vendor Product Name
            'ASH',              // Vendor Item Color
            'Repeat',           // Repeat (No-Repeat)
            'Front content...', // Front Content
            'Back content...',  // Back Content
            'ASTM D3884',       // Abrasion
            'ASTM E84',         // Firecodes
            'Y',                // Prop 65 Compliance
            'Y',                // AB 2998 Compliance
            'Textured',         // Finish
            'Spot Clean',       // Cleaning
            'USA',              // Origin
            '5702.42.0000',     // Tariff / Harmonized Code
            'Residential'       // Use (Item Application)
        ].join(',');
        
        return `${headers}\n${exampleRow}`;
    }
}

module.exports = CsvImportService;
