#!/usr/bin/env node

/**
 * Test Data Cleanup Script
 * 
 * This script cleans up test data created during OPMS to NetSuite sync testing.
 * It removes test items from NetSuite that were created with the "opmsAPI-" prefix.
 * 
 * Safety features:
 * - Only removes items with "opmsAPI-" prefix
 * - Confirms before deletion
 * - Logs all cleanup operations
 * - Can be run multiple times safely
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const CONFIG = {
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
    NETSUITE_SEARCH_ENDPOINT: '/api/netsuite/search-items',
    NETSUITE_DELETE_ENDPOINT: '/api/netsuite/delete-item',
    TEST_RESULTS_FILE: 'test-results.json',
    VALIDATION_RESULTS_FILE: 'validation-results.json',
    CLEANUP_RESULTS_FILE: 'cleanup-results.json',
    TEST_ITEM_PREFIX: 'opmsAPI-'
};

// Cleanup results tracking
const cleanupResults = {
    startTime: new Date().toISOString(),
    operations: [],
    summary: {
        total: 0,
        deleted: 0,
        failed: 0,
        skipped: 0,
        errors: []
    }
};

class TestDataCleanupRunner {
    constructor() {
        this.apiClient = axios.create({
            baseURL: CONFIG.API_BASE_URL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Test-Data-Cleanup-Runner/1.0'
            }
        });
        
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    /**
     * Main cleanup execution
     */
    async run() {
        console.log('🧹 Test Data Cleanup Runner');
        console.log('===========================');
        console.log(`API Base URL: ${CONFIG.API_BASE_URL}`);
        console.log(`Test Item Prefix: ${CONFIG.TEST_ITEM_PREFIX}`);
        console.log('');

        try {
            // Step 1: Find test items in NetSuite
            const testItems = await this.findTestItems();
            
            if (testItems.length === 0) {
                console.log('✅ No test items found to clean up');
                return;
            }
            
            // Step 2: Confirm cleanup operation
            const confirmed = await this.confirmCleanup(testItems);
            
            if (!confirmed) {
                console.log('❌ Cleanup cancelled by user');
                return;
            }
            
            // Step 3: Delete test items
            await this.deleteTestItems(testItems);
            
            // Step 4: Generate cleanup report
            await this.generateCleanupReport();
            
            console.log('✅ Cleanup completed successfully!');
            
        } catch (error) {
            console.error('❌ Cleanup failed:', error.message);
            cleanupResults.summary.errors.push({
                type: 'cleanup_error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
            process.exit(1);
        } finally {
            this.rl.close();
        }
    }

    /**
     * Find test items in NetSuite
     */
    async findTestItems() {
        console.log('📋 Step 1: Finding Test Items in NetSuite');
        
        try {
            // Search for items with test prefix
            const searchResponse = await this.apiClient.get(
                `${CONFIG.NETSUITE_SEARCH_ENDPOINT}?searchTerm=${CONFIG.TEST_ITEM_PREFIX}&limit=100`
            );
            
            if (!searchResponse.data.success) {
                throw new Error(`Search failed: ${searchResponse.data.error}`);
            }
            
            const allItems = searchResponse.data.items || [];
            const testItems = allItems.filter(item => 
                item.itemId && item.itemId.startsWith(CONFIG.TEST_ITEM_PREFIX)
            );
            
            console.log(`✅ Found ${testItems.length} test items to clean up`);
            
            if (testItems.length > 0) {
                console.log('   Test items found:');
                testItems.forEach((item, index) => {
                    console.log(`   ${index + 1}. ${item.itemId} - ${item.displayName || 'No display name'}`);
                });
            }
            
            console.log('');
            return testItems;
            
        } catch (error) {
            throw new Error(`Failed to find test items: ${error.message}`);
        }
    }

    /**
     * Confirm cleanup operation with user
     */
    async confirmCleanup(testItems) {
        console.log('📋 Step 2: Confirming Cleanup Operation');
        console.log('');
        console.log(`⚠️  WARNING: This will permanently delete ${testItems.length} test items from NetSuite`);
        console.log('   Items to be deleted:');
        testItems.forEach((item, index) => {
            console.log(`   - ${item.itemId} (${item.displayName || 'No display name'})`);
        });
        console.log('');
        console.log('   This action cannot be undone!');
        console.log('');
        
        const answer = await this.askQuestion('Do you want to proceed with cleanup? (yes/no): ');
        
        const confirmed = answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';
        
        if (confirmed) {
            console.log('✅ Cleanup confirmed by user');
        } else {
            console.log('❌ Cleanup cancelled by user');
        }
        
        console.log('');
        return confirmed;
    }

    /**
     * Delete test items from NetSuite
     */
    async deleteTestItems(testItems) {
        console.log('📋 Step 3: Deleting Test Items from NetSuite');
        console.log('');
        
        for (const item of testItems) {
            await this.deleteSingleItem(item);
        }
    }

    /**
     * Delete a single test item
     */
    async deleteSingleItem(item) {
        const operation = {
            itemId: item.itemId,
            displayName: item.displayName,
            startTime: new Date().toISOString(),
            status: 'running'
        };

        console.log(`🗑️  Deleting: ${item.itemId}`);
        
        try {
            // Attempt to delete the item
            const deleteResponse = await this.apiClient.delete(
                `${CONFIG.NETSUITE_DELETE_ENDPOINT}/${item.itemId}`
            );
            
            operation.response = deleteResponse.data;
            operation.statusCode = deleteResponse.status;
            
            if (deleteResponse.data.success) {
                operation.status = 'deleted';
                operation.endTime = new Date().toISOString();
                console.log(`   ✅ Deleted successfully`);
                cleanupResults.summary.deleted++;
            } else {
                operation.status = 'failed';
                operation.endTime = new Date().toISOString();
                operation.error = deleteResponse.data.error || 'Unknown error';
                console.log(`   ❌ Delete failed: ${operation.error}`);
                cleanupResults.summary.failed++;
            }
            
        } catch (error) {
            operation.status = 'failed';
            operation.endTime = new Date().toISOString();
            operation.error = error.message;
            console.log(`   ❌ Delete failed: ${error.message}`);
            cleanupResults.summary.failed++;
        }

        cleanupResults.operations.push(operation);
        cleanupResults.summary.total++;
        console.log('');
    }

    /**
     * Generate cleanup report
     */
    async generateCleanupReport() {
        console.log('📋 Step 4: Generating Cleanup Report');
        
        cleanupResults.endTime = new Date().toISOString();
        cleanupResults.duration = new Date(cleanupResults.endTime) - new Date(cleanupResults.startTime);
        
        // Write results to file
        const resultsPath = path.join(__dirname, CONFIG.CLEANUP_RESULTS_FILE);
        fs.writeFileSync(resultsPath, JSON.stringify(cleanupResults, null, 2));
        
        // Display summary
        console.log('');
        console.log('📊 CLEANUP SUMMARY');
        console.log('==================');
        console.log(`Total Items: ${cleanupResults.summary.total}`);
        console.log(`Deleted: ${cleanupResults.summary.deleted}`);
        console.log(`Failed: ${cleanupResults.summary.failed}`);
        console.log(`Skipped: ${cleanupResults.summary.skipped}`);
        console.log(`Duration: ${cleanupResults.duration}ms`);
        console.log('');
        
        if (cleanupResults.summary.failed === 0) {
            console.log('🎉 ALL TEST ITEMS CLEANED UP SUCCESSFULLY!');
        } else {
            console.log(`⚠️  ${cleanupResults.summary.failed} item(s) could not be deleted`);
        }
        
        console.log(`📄 Detailed results saved to: ${resultsPath}`);
        console.log('');
    }

    /**
     * Ask a question and return the answer
     */
    askQuestion(question) {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer);
            });
        });
    }

    /**
     * Clean up test data from previous test runs
     */
    async cleanupPreviousTestData() {
        console.log('📋 Cleaning up previous test data files');
        
        const filesToClean = [
            CONFIG.TEST_RESULTS_FILE,
            CONFIG.VALIDATION_RESULTS_FILE,
            CONFIG.CLEANUP_RESULTS_FILE
        ];
        
        for (const file of filesToClean) {
            const filePath = path.join(__dirname, file);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`   ✅ Removed: ${file}`);
                } catch (error) {
                    console.log(`   ⚠️  Could not remove: ${file} - ${error.message}`);
                }
            }
        }
        
        console.log('');
    }
}

// Command line argument handling
const args = process.argv.slice(2);

// Main execution
if (require.main === module) {
    const cleanupRunner = new TestDataCleanupRunner();
    
    // Handle command line arguments
    if (args.includes('--cleanup-files')) {
        cleanupRunner.cleanupPreviousTestData().then(() => {
            console.log('✅ File cleanup completed');
            process.exit(0);
        });
    } else if (args.includes('--help')) {
        console.log('Test Data Cleanup Script');
        console.log('');
        console.log('Usage:');
        console.log('  node 4-cleanup-test-data.js              # Clean up test items from NetSuite');
        console.log('  node 4-cleanup-test-data.js --cleanup-files  # Clean up test result files');
        console.log('  node 4-cleanup-test-data.js --help       # Show this help');
        console.log('');
        console.log('Options:');
        console.log('  --cleanup-files    Remove test result files (test-results.json, etc.)');
        console.log('  --help            Show this help message');
        console.log('');
        process.exit(0);
    } else {
        cleanupRunner.run().catch(error => {
            console.error('❌ Cleanup runner failed:', error);
            process.exit(1);
        });
    }
}

module.exports = TestDataCleanupRunner;



