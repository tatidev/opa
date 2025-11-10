#!/usr/bin/env node

/**
 * NetSuite Results Validation Script
 * 
 * This script validates that items were correctly created/updated in NetSuite
 * by checking the actual NetSuite data against expected OPMS data.
 * 
 * Validation checks:
 * - Item exists in NetSuite
 * - Display name format: "Product: Color"
 * - Vendor sublist populated
 * - Custom fields populated correctly
 * - Field values match OPMS data
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
    NETSUITE_SEARCH_ENDPOINT: '/api/netsuite/search-items',
    TEST_RESULTS_FILE: 'test-results.json',
    VALIDATION_RESULTS_FILE: 'validation-results.json'
};

// Validation results tracking
const validationResults = {
    startTime: new Date().toISOString(),
    validations: [],
    summary: {
        total: 0,
        passed: 0,
        failed: 0,
        errors: []
    }
};

class NetSuiteValidationRunner {
    constructor() {
        this.apiClient = axios.create({
            baseURL: CONFIG.API_BASE_URL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'NetSuite-Validation-Runner/1.0'
            }
        });
    }

    /**
     * Main validation execution
     */
    async run() {
        console.log('🔍 NetSuite Results Validation');
        console.log('==============================');
        console.log(`API Base URL: ${CONFIG.API_BASE_URL}`);
        console.log(`Test Results: ${CONFIG.TEST_RESULTS_FILE}`);
        console.log('');

        try {
            // Step 1: Load test results
            const testResults = await this.loadTestResults();
            
            // Step 2: Extract NetSuite item IDs from test results
            const netsuiteItems = await this.extractNetSuiteItems(testResults);
            
            // Step 3: Validate each NetSuite item
            await this.validateNetSuiteItems(netsuiteItems);
            
            // Step 4: Generate validation report
            await this.generateValidationReport();
            
            console.log('✅ Validation completed successfully!');
            
        } catch (error) {
            console.error('❌ Validation failed:', error.message);
            validationResults.summary.errors.push({
                type: 'validation_error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
            process.exit(1);
        }
    }

    /**
     * Load test results from previous test run
     */
    async loadTestResults() {
        console.log('📋 Step 1: Loading Test Results');
        
        const resultsPath = path.join(__dirname, CONFIG.TEST_RESULTS_FILE);
        
        if (!fs.existsSync(resultsPath)) {
            throw new Error(`Test results file not found: ${resultsPath}`);
        }
        
        const testResults = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
        console.log(`✅ Loaded test results: ${testResults.summary.total} tests`);
        console.log('');
        
        return testResults;
    }

    /**
     * Extract NetSuite item IDs from test results
     */
    async extractNetSuiteItems(testResults) {
        console.log('📋 Step 2: Extracting NetSuite Item IDs');
        
        const netsuiteItems = [];
        
        for (const test of testResults.tests) {
            if (test.status === 'passed' && test.details.response) {
                const response = test.details.response;
                
                if (response.netsuiteItemId) {
                    netsuiteItems.push({
                        testName: test.name,
                        netsuiteItemId: response.netsuiteItemId,
                        opmsItemId: test.details.request.opmsItemId,
                        expectedData: this.extractExpectedData(test.details.request, response)
                    });
                }
            }
        }
        
        console.log(`✅ Found ${netsuiteItems.length} NetSuite items to validate`);
        console.log('');
        
        return netsuiteItems;
    }

    /**
     * Extract expected data from test request and response
     */
    extractExpectedData(request, response) {
        return {
            opmsItemId: request.opmsItemId,
            opmsProductId: request.opmsProductId,
            productType: request.productType,
            displayName: response.displayName,
            vendorId: response.vendorId,
            itemCode: response.itemCode
        };
    }

    /**
     * Validate NetSuite items
     */
    async validateNetSuiteItems(netsuiteItems) {
        console.log('📋 Step 3: Validating NetSuite Items');
        console.log('');

        for (const item of netsuiteItems) {
            await this.validateSingleItem(item);
        }
    }

    /**
     * Validate a single NetSuite item
     */
    async validateSingleItem(item) {
        console.log(`🔍 Validating: ${item.testName}`);
        console.log(`   NetSuite Item ID: ${item.netsuiteItemId}`);
        console.log(`   OPMS Item ID: ${item.opmsItemId}`);
        
        const validation = {
            testName: item.testName,
            netsuiteItemId: item.netsuiteItemId,
            opmsItemId: item.opmsItemId,
            startTime: new Date().toISOString(),
            checks: [],
            status: 'running'
        };

        try {
            // Check 1: Item exists in NetSuite
            await this.checkItemExists(item, validation);
            
            // Check 2: Display name format
            await this.checkDisplayNameFormat(item, validation);
            
            // Check 3: Vendor sublist population
            await this.checkVendorSublist(item, validation);
            
            // Check 4: Custom fields population
            await this.checkCustomFields(item, validation);
            
            // Check 5: Field values match OPMS data
            await this.checkFieldValues(item, validation);
            
            validation.status = 'passed';
            validation.endTime = new Date().toISOString();
            console.log(`   ✅ Validation passed`);
            validationResults.summary.passed++;
            
        } catch (error) {
            validation.status = 'failed';
            validation.endTime = new Date().toISOString();
            validation.errors = [error.message];
            console.log(`   ❌ Validation failed: ${error.message}`);
            validationResults.summary.failed++;
        }

        validationResults.validations.push(validation);
        validationResults.summary.total++;
        console.log('');
    }

    /**
     * Check if item exists in NetSuite
     */
    async checkItemExists(item, validation) {
        const check = {
            name: 'Item Exists in NetSuite',
            status: 'running',
            details: {}
        };

        try {
            // Search for the item in NetSuite
            const searchResponse = await this.apiClient.get(`${CONFIG.NETSUITE_SEARCH_ENDPOINT}?itemId=${item.netsuiteItemId}`);
            
            check.details = {
                searchResponse: searchResponse.data,
                statusCode: searchResponse.status
            };

            if (searchResponse.data.success && searchResponse.data.items && searchResponse.data.items.length > 0) {
                check.status = 'passed';
                check.details.message = 'Item found in NetSuite';
                console.log(`   ✅ Item exists in NetSuite`);
            } else {
                check.status = 'failed';
                check.details.message = 'Item not found in NetSuite';
                throw new Error('Item not found in NetSuite');
            }
        } catch (error) {
            check.status = 'failed';
            check.details.error = error.message;
            throw new Error(`Item existence check failed: ${error.message}`);
        }

        validation.checks.push(check);
    }

    /**
     * Check display name format
     */
    async checkDisplayNameFormat(item, validation) {
        const check = {
            name: 'Display Name Format',
            status: 'running',
            details: {}
        };

        try {
            // Get item details from NetSuite
            const itemResponse = await this.apiClient.get(`${CONFIG.NETSUITE_SEARCH_ENDPOINT}?itemId=${item.netsuiteItemId}`);
            
            if (itemResponse.data.success && itemResponse.data.items && itemResponse.data.items.length > 0) {
                const netsuiteItem = itemResponse.data.items[0];
                const displayName = netsuiteItem.displayName || netsuiteItem.itemId;
                
                check.details = {
                    expectedFormat: 'Product: Color',
                    actualDisplayName: displayName,
                    hasColon: displayName.includes(':'),
                    hasSpaceAfterColon: displayName.includes(': ')
                };

                // Validate format: "Product: Color" (colon separator, space after colon)
                if (displayName.includes(':') && displayName.includes(': ')) {
                    check.status = 'passed';
                    check.details.message = 'Display name format correct';
                    console.log(`   ✅ Display name format correct: "${displayName}"`);
                } else {
                    check.status = 'failed';
                    check.details.message = 'Display name format incorrect';
                    throw new Error(`Invalid display name format: "${displayName}" (should be "Product: Color")`);
                }
            } else {
                check.status = 'failed';
                check.details.error = 'Could not retrieve item details';
                throw new Error('Could not retrieve item details from NetSuite');
            }
        } catch (error) {
            check.status = 'failed';
            check.details.error = error.message;
            throw new Error(`Display name format check failed: ${error.message}`);
        }

        validation.checks.push(check);
    }

    /**
     * Check vendor sublist population
     */
    async checkVendorSublist(item, validation) {
        const check = {
            name: 'Vendor Sublist Population',
            status: 'running',
            details: {}
        };

        try {
            // Get item details with vendor sublist
            const itemResponse = await this.apiClient.get(`${CONFIG.NETSUITE_SEARCH_ENDPOINT}?itemId=${item.netsuiteItemId}&includeVendorSublist=true`);
            
            if (itemResponse.data.success && itemResponse.data.items && itemResponse.data.items.length > 0) {
                const netsuiteItem = itemResponse.data.items[0];
                const vendorSublist = netsuiteItem.vendorSublist || [];
                
                check.details = {
                    vendorSublistCount: vendorSublist.length,
                    vendorSublist: vendorSublist,
                    hasVendorData: vendorSublist.length > 0
                };

                if (vendorSublist.length > 0) {
                    check.status = 'passed';
                    check.details.message = 'Vendor sublist populated';
                    console.log(`   ✅ Vendor sublist populated (${vendorSublist.length} entries)`);
                } else {
                    check.status = 'failed';
                    check.details.message = 'Vendor sublist empty';
                    throw new Error('Vendor sublist is empty');
                }
            } else {
                check.status = 'failed';
                check.details.error = 'Could not retrieve item details';
                throw new Error('Could not retrieve item details from NetSuite');
            }
        } catch (error) {
            check.status = 'failed';
            check.details.error = error.message;
            throw new Error(`Vendor sublist check failed: ${error.message}`);
        }

        validation.checks.push(check);
    }

    /**
     * Check custom fields population
     */
    async checkCustomFields(item, validation) {
        const check = {
            name: 'Custom Fields Population',
            status: 'running',
            details: {}
        };

        try {
            // Get item details with custom fields
            const itemResponse = await this.apiClient.get(`${CONFIG.NETSUITE_SEARCH_ENDPOINT}?itemId=${item.netsuiteItemId}&includeCustomFields=true`);
            
            if (itemResponse.data.success && itemResponse.data.items && itemResponse.data.items.length > 0) {
                const netsuiteItem = itemResponse.data.items[0];
                const customFields = netsuiteItem.customFields || {};
                
                // Check for required OPMS custom fields
                const requiredFields = [
                    'custitem_opms_item_id',
                    'custitem_opms_prod_id',
                    'custitem_opms_parent_product_name',
                    'custitem_opms_fabric_width',
                    'custitem_opms_vendor_color',
                    'custitem_opms_vendor_prod_name',
                    'custitem_opms_item_colors'
                ];
                
                const populatedFields = requiredFields.filter(field => 
                    customFields[field] !== undefined && 
                    customFields[field] !== null && 
                    customFields[field] !== ''
                );
                
                check.details = {
                    requiredFields: requiredFields,
                    populatedFields: populatedFields,
                    missingFields: requiredFields.filter(field => !populatedFields.includes(field)),
                    populationRate: (populatedFields.length / requiredFields.length) * 100
                };

                if (populatedFields.length >= requiredFields.length * 0.8) { // 80% threshold
                    check.status = 'passed';
                    check.details.message = `Custom fields populated (${populatedFields.length}/${requiredFields.length})`;
                    console.log(`   ✅ Custom fields populated (${populatedFields.length}/${requiredFields.length})`);
                } else {
                    check.status = 'failed';
                    check.details.message = `Insufficient custom fields populated (${populatedFields.length}/${requiredFields.length})`;
                    throw new Error(`Insufficient custom fields populated: ${populatedFields.length}/${requiredFields.length}`);
                }
            } else {
                check.status = 'failed';
                check.details.error = 'Could not retrieve item details';
                throw new Error('Could not retrieve item details from NetSuite');
            }
        } catch (error) {
            check.status = 'failed';
            check.details.error = error.message;
            throw new Error(`Custom fields check failed: ${error.message}`);
        }

        validation.checks.push(check);
    }

    /**
     * Check field values match OPMS data
     */
    async checkFieldValues(item, validation) {
        const check = {
            name: 'Field Values Match OPMS Data',
            status: 'running',
            details: {}
        };

        try {
            // Get item details
            const itemResponse = await this.apiClient.get(`${CONFIG.NETSUITE_SEARCH_ENDPOINT}?itemId=${item.netsuiteItemId}&includeCustomFields=true`);
            
            if (itemResponse.data.success && itemResponse.data.items && itemResponse.data.items.length > 0) {
                const netsuiteItem = itemResponse.data.items[0];
                const customFields = netsuiteItem.customFields || {};
                
                // Validate key field mappings
                const fieldMappings = [
                    {
                        netsuiteField: 'custitem_opms_item_id',
                        expectedValue: item.opmsItemId.toString(),
                        actualValue: customFields.custitem_opms_item_id
                    },
                    {
                        netsuiteField: 'custitem_opms_prod_id',
                        expectedValue: item.opmsProductId.toString(),
                        actualValue: customFields.custitem_opms_prod_id
                    }
                ];
                
                const validMappings = fieldMappings.filter(mapping => 
                    mapping.actualValue === mapping.expectedValue
                );
                
                check.details = {
                    fieldMappings: fieldMappings,
                    validMappings: validMappings.length,
                    totalMappings: fieldMappings.length,
                    validationRate: (validMappings.length / fieldMappings.length) * 100
                };

                if (validMappings.length === fieldMappings.length) {
                    check.status = 'passed';
                    check.details.message = 'All field values match OPMS data';
                    console.log(`   ✅ Field values match OPMS data`);
                } else {
                    check.status = 'failed';
                    check.details.message = 'Some field values do not match OPMS data';
                    throw new Error(`Field value mismatch: ${validMappings.length}/${fieldMappings.length} fields match`);
                }
            } else {
                check.status = 'failed';
                check.details.error = 'Could not retrieve item details';
                throw new Error('Could not retrieve item details from NetSuite');
            }
        } catch (error) {
            check.status = 'failed';
            check.details.error = error.message;
            throw new Error(`Field values check failed: ${error.message}`);
        }

        validation.checks.push(check);
    }

    /**
     * Generate validation report
     */
    async generateValidationReport() {
        console.log('📋 Step 4: Generating Validation Report');
        
        validationResults.endTime = new Date().toISOString();
        validationResults.duration = new Date(validationResults.endTime) - new Date(validationResults.startTime);
        
        // Write results to file
        const resultsPath = path.join(__dirname, CONFIG.VALIDATION_RESULTS_FILE);
        fs.writeFileSync(resultsPath, JSON.stringify(validationResults, null, 2));
        
        // Display summary
        console.log('');
        console.log('📊 VALIDATION SUMMARY');
        console.log('=====================');
        console.log(`Total Validations: ${validationResults.summary.total}`);
        console.log(`Passed: ${validationResults.summary.passed}`);
        console.log(`Failed: ${validationResults.summary.failed}`);
        console.log(`Duration: ${validationResults.duration}ms`);
        console.log('');
        
        if (validationResults.summary.failed === 0) {
            console.log('🎉 ALL VALIDATIONS PASSED!');
        } else {
            console.log(`❌ ${validationResults.summary.failed} validation(s) failed`);
        }
        
        console.log(`📄 Detailed results saved to: ${resultsPath}`);
        console.log('');
    }
}

// Main execution
if (require.main === module) {
    const validationRunner = new NetSuiteValidationRunner();
    validationRunner.run().catch(error => {
        console.error('❌ Validation runner failed:', error);
        process.exit(1);
    });
}

module.exports = NetSuiteValidationRunner;



