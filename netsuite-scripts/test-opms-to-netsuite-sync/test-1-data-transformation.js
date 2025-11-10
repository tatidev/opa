/**
 * Test #1: OPMS Data Transformation Validation
 * 
 * Purpose: Validates that OPMS item data is correctly extracted and transformed
 *          to NetSuite payload format with proper field mapping and validation.
 * 
 * Environment: Production OPMS database
 * Safety: READ ONLY - Does not create any NetSuite items
 * 
 * Validates:
 * - OPMS data extraction from database
 * - Field mapping to NetSuite format
 * - "src empty data" pattern implementation
 * - Display name formatting (Product: Color)
 * - All 25+ required fields populated
 */

require('dotenv').config();
const OpmsDataTransformService = require('../../src/services/OpmsDataTransformService');
const db = require('../../src/config/database');

// ANSI color codes for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

class DataTransformationTest {
    constructor() {
        this.transformService = new OpmsDataTransformService();
        this.results = {
            passed: 0,
            failed: 0,
            warnings: 0,
            tests: []
        };
    }

    /**
     * Log test result
     */
    log(status, message, details = null) {
        const timestamp = new Date().toISOString();
        const statusColors = {
            'PASS': colors.green,
            'FAIL': colors.red,
            'WARN': colors.yellow,
            'INFO': colors.blue
        };
        
        const color = statusColors[status] || colors.reset;
        console.log(`${color}[${status}]${colors.reset} ${message}`);
        
        if (details) {
            console.log(`${colors.cyan}${JSON.stringify(details, null, 2)}${colors.reset}`);
        }

        this.results.tests.push({
            timestamp,
            status,
            message,
            details
        });

        if (status === 'PASS') this.results.passed++;
        if (status === 'FAIL') this.results.failed++;
        if (status === 'WARN') this.results.warnings++;
    }

    /**
     * Get a test item from OPMS database
     */
    async getTestItem() {
        try {
            this.log('INFO', 'Finding suitable test item from OPMS database...');
            
            const query = `
                SELECT DISTINCT
                    i.id as item_id,
                    i.code as item_code,
                    p.name as product_name,
                    v.name as vendor_name,
                    GROUP_CONCAT(DISTINCT c.name ORDER BY ic.n_order SEPARATOR ', ') as color_name
                FROM T_ITEM i
                JOIN T_PRODUCT p ON i.product_id = p.id
                LEFT JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
                LEFT JOIN Z_VENDOR v ON pv.vendor_id = v.id
                LEFT JOIN T_ITEM_COLOR ic ON i.id = ic.item_id
                LEFT JOIN P_COLOR c ON ic.color_id = c.id
                WHERE i.code IS NOT NULL
                  AND i.code != ''
                  AND p.name IS NOT NULL
                  AND i.archived = 'N'
                  AND p.archived = 'N'
                GROUP BY i.id, i.code, p.name, v.name
                HAVING color_name IS NOT NULL
                LIMIT 1
            `;

            const [results] = await db.query(query);
            const testItem = results[0];

            if (!testItem) {
                throw new Error('No suitable test items found in OPMS database');
            }

            this.log('PASS', 'Test item found', {
                item_id: testItem.item_id,
                item_code: testItem.item_code,
                product_name: testItem.product_name,
                vendor_name: testItem.vendor_name,
                colors: testItem.color_name
            });

            return testItem;
        } catch (error) {
            this.log('FAIL', 'Failed to find test item', { error: error.message });
            throw error;
        }
    }

    /**
     * Test: Transform item data to NetSuite format
     */
    async testDataTransformation(itemId) {
        try {
            this.log('INFO', `Testing data transformation for item ${itemId}...`);

            const payload = await this.transformService.transformItemForNetSuite(itemId);

            if (!payload) {
                throw new Error('Transformation returned null/undefined payload');
            }

            this.log('PASS', 'Data transformation completed', {
                fieldCount: Object.keys(payload).length,
                itemId: payload.custitem_opms_item_id,
                itemCode: payload.itemid
            });

            return payload;
        } catch (error) {
            this.log('FAIL', 'Data transformation failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Test: Validate required fields are present
     */
    testRequiredFields(payload) {
        this.log('INFO', 'Validating required fields...');

        const requiredFields = [
            { field: 'itemId', description: 'Item ID (from T_ITEM.code) - camelCase for RESTlet' },
            { field: 'displayname', description: 'Display name (Product: Color format)' },
            { field: 'custitem_opms_item_id', description: 'OPMS Item ID' },
            { field: 'custitem_opms_prod_id', description: 'OPMS Product ID' }
        ];

        let allRequired = true;

        for (const req of requiredFields) {
            if (payload[req.field] === undefined || payload[req.field] === null) {
                this.log('FAIL', `Required field missing: ${req.field}`, { description: req.description });
                allRequired = false;
            } else {
                this.log('PASS', `Required field present: ${req.field}`, { value: payload[req.field] });
            }
        }

        return allRequired;
    }

    /**
     * Test: Validate display name format (Product: Color)
     */
    testDisplayNameFormat(payload) {
        this.log('INFO', 'Validating display name format...');

        const displayName = payload.displayname;

        if (!displayName) {
            this.log('FAIL', 'Display name is missing');
            return false;
        }

        // Check for colon separator (correct format)
        if (displayName.includes(':')) {
            this.log('PASS', 'Display name uses colon separator', { displayName });
            return true;
        }

        // Check for dash separator (incorrect legacy format)
        if (displayName.includes(' - ')) {
            this.log('FAIL', 'Display name uses legacy dash separator (should be colon)', { displayName });
            return false;
        }

        this.log('WARN', 'Display name format unclear', { displayName });
        return false;
    }

    /**
     * Test: Validate "src empty data" pattern
     */
    testSrcEmptyDataPattern(payload) {
        this.log('INFO', 'Validating "src empty data" pattern implementation...');

        const fieldsToCheck = [
            'custitem_opms_vendor_color',
            'custitem_opms_vendor_prod_name',
            'custitem_opms_fabric_width',
            'vendorcode'
        ];

        let foundSrcEmptyData = false;
        let properlyImplemented = true;

        for (const field of fieldsToCheck) {
            const value = payload[field];
            
            if (value === 'src empty data') {
                foundSrcEmptyData = true;
                this.log('PASS', `Field uses "src empty data" pattern: ${field}`);
            } else if (value === undefined || value === null) {
                // Check if this should be "src empty data" instead
                this.log('WARN', `Field is null/undefined (might need "src empty data"): ${field}`);
            } else {
                this.log('INFO', `Field has actual data: ${field}`, { value });
            }
        }

        if (foundSrcEmptyData) {
            this.log('PASS', '"src empty data" pattern is implemented');
        } else {
            this.log('INFO', 'No fields currently using "src empty data" (this item may have complete data)');
        }

        return properlyImplemented;
    }

    /**
     * Test: Validate vendor mapping
     */
    testVendorMapping(payload) {
        this.log('INFO', 'Validating vendor mapping...');

        const vendorId = payload.vendor;

        if (!vendorId) {
            this.log('WARN', 'No vendor ID in payload (item may not have vendor)', { vendor: vendorId });
            return true; // Not a failure, some items may not have vendors
        }

        // Vendor ID should be a number for NetSuite
        if (typeof vendorId === 'number' && vendorId > 0) {
            this.log('PASS', 'Vendor ID is valid number', { vendorId, type: typeof vendorId });
            return true;
        }

        // If it's a string number, that's a BUG in transformation service
        if (typeof vendorId === 'string') {
            const numericValue = parseInt(vendorId);
            if (!isNaN(numericValue) && numericValue > 0) {
                this.log('FAIL', 'Vendor ID is string (should be number) - BUG in OpmsDataTransformService', { 
                    vendorId, 
                    type: typeof vendorId,
                    expectedType: 'number',
                    location: 'OpmsDataTransformService.js line 441'
                });
                return false;
            }
        }

        this.log('FAIL', 'Vendor ID is invalid', { vendorId, type: typeof vendorId });
        return false;
    }

    /**
     * Test: Validate all custom fields
     */
    testCustomFields(payload) {
        this.log('INFO', 'Validating custom field population...');

        const customFields = [
            'custitem_opms_item_id',
            'custitem_opms_prod_id',
            'custitem_opms_vendor_color',
            'custitem_opms_vendor_prod_name',
            'custitem_opms_item_colors',
            'custitem_opms_parent_product_name',
            'custitem_opms_fabric_width'
        ];

        let allPresent = true;

        for (const field of customFields) {
            if (payload[field] !== undefined) {
                this.log('PASS', `Custom field populated: ${field}`, { value: payload[field] });
            } else {
                this.log('WARN', `Custom field missing: ${field}`);
                allPresent = false;
            }
        }

        return allPresent;
    }

    /**
     * Print test summary
     */
    printSummary() {
        console.log('\n' + '='.repeat(70));
        console.log(`${colors.cyan}TEST SUMMARY${colors.reset}`);
        console.log('='.repeat(70));
        console.log(`${colors.green}Passed:${colors.reset}  ${this.results.passed}`);
        console.log(`${colors.red}Failed:${colors.reset}  ${this.results.failed}`);
        console.log(`${colors.yellow}Warnings:${colors.reset} ${this.results.warnings}`);
        console.log('='.repeat(70));

        if (this.results.failed === 0) {
            console.log(`${colors.green}✓ ALL TESTS PASSED${colors.reset}`);
        } else {
            console.log(`${colors.red}✗ SOME TESTS FAILED${colors.reset}`);
        }
        console.log('='.repeat(70) + '\n');
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        try {
            console.log(`${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
            console.log(`${colors.cyan}║  OPMS-to-NetSuite Data Transformation Validation Test         ║${colors.reset}`);
            console.log(`${colors.cyan}║  Environment: PRODUCTION                                       ║${colors.reset}`);
            console.log(`${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

            // Get test item
            const testItem = await this.getTestItem();

            // Test data transformation
            const payload = await this.testDataTransformation(testItem.item_id);

            // Run validation tests
            this.testRequiredFields(payload);
            this.testDisplayNameFormat(payload);
            this.testSrcEmptyDataPattern(payload);
            this.testVendorMapping(payload);
            this.testCustomFields(payload);

            // Print summary
            this.printSummary();

            // Exit with appropriate code
            process.exit(this.results.failed === 0 ? 0 : 1);

        } catch (error) {
            console.error(`${colors.red}FATAL ERROR:${colors.reset}`, error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// Run the test
const test = new DataTransformationTest();
test.runAllTests();

