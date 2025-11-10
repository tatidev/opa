#!/usr/bin/env node

/**
 * Identify Test Items Script
 * 
 * This script uses the same database connection as the API server
 * to identify suitable test items in OPMS for synchronization testing.
 */

const mysql = require('mysql2/promise');
const path = require('path');

// Load environment variables (same as API server)
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Database configuration (same as API server)
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'opuzen',
    connectionLimit: 10
};

class TestItemIdentifier {
    constructor() {
        this.db = null;
    }

    async connect() {
        try {
            this.db = await mysql.createConnection(dbConfig);
            console.log('✅ Connected to OPMS database');
            console.log(`   Database: ${dbConfig.database}`);
            console.log(`   Host: ${dbConfig.host}`);
            console.log('');
        } catch (error) {
            throw new Error(`Database connection failed: ${error.message}`);
        }
    }

    async identifyTestItems() {
        console.log('🔍 Identifying Test Items in OPMS...');
        console.log('');

        const testItems = {
            completeData: [],
            missingData: [],
            multipleColors: [],
            miniForms: [],
            multiSelect: []
        };

        try {
            // 1. Find items with complete data
            console.log('📋 1. Items with Complete Data:');
            const completeDataQuery = `
                SELECT 
                    'COMPLETE_DATA' as test_type,
                    i.id as item_id,
                    i.code as item_code,
                    p.name as product_name,
                    v.name as vendor_name,
                    m.netsuite_vendor_id,
                    GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') as colors,
                    CASE 
                        WHEN p.width IS NOT NULL THEN 'HAS_WIDTH'
                        ELSE 'NO_WIDTH'
                    END as width_status,
                    CASE 
                        WHEN pvar.vendor_product_name IS NOT NULL THEN 'HAS_VENDOR_PROD_NAME'
                        ELSE 'NO_VENDOR_PROD_NAME'
                    END as vendor_prod_name_status,
                    CASE 
                        WHEN i.vendor_code IS NOT NULL THEN 'HAS_VENDOR_CODE'
                        ELSE 'NO_VENDOR_CODE'
                    END as vendor_code_status,
                    CASE 
                        WHEN i.vendor_color IS NOT NULL THEN 'HAS_VENDOR_COLOR'
                        ELSE 'NO_VENDOR_COLOR'
                    END as vendor_color_status
                FROM T_ITEM i
                JOIN T_PRODUCT p ON i.product_id = p.id
                JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
                JOIN Z_VENDOR v ON pv.vendor_id = v.id
                JOIN opms_netsuite_vendor_mapping m ON v.id = m.opms_vendor_id
                LEFT JOIN T_PRODUCT_VARIOUS pvar ON p.id = pvar.product_id
                LEFT JOIN T_ITEM_COLOR ic ON i.id = ic.item_id
                LEFT JOIN P_COLOR c ON ic.color_id = c.id
                WHERE i.code IS NOT NULL
                  AND p.name IS NOT NULL
                  AND v.name IS NOT NULL
                  AND i.archived = 'N'
                  AND p.archived = 'N'
                  AND v.active = 'Y'
                  AND v.archived = 'N'
                  AND m.opms_vendor_name = m.netsuite_vendor_name
                  AND p.width IS NOT NULL
                  AND pvar.vendor_product_name IS NOT NULL
                  AND i.vendor_code IS NOT NULL
                  AND i.vendor_color IS NOT NULL
                GROUP BY i.id, i.code, p.name, v.name, m.netsuite_vendor_id, p.width, pvar.vendor_product_name, i.vendor_code, i.vendor_color
                HAVING colors IS NOT NULL
                ORDER BY i.id
                LIMIT 3
            `;

            const [completeDataRows] = await this.db.execute(completeDataQuery);
            testItems.completeData = completeDataRows;
            console.log(`   Found ${completeDataRows.length} items with complete data`);
            completeDataRows.forEach((item, index) => {
                console.log(`   ${index + 1}. Item ID: ${item.item_id}, Code: ${item.item_code}, Product: ${item.product_name}`);
            });
            console.log('');

            // 2. Find items with missing data
            console.log('📋 2. Items with Missing Data (for "src empty data" testing):');
            const missingDataQuery = `
                SELECT 
                    'MISSING_DATA' as test_type,
                    i.id as item_id,
                    i.code as item_code,
                    p.name as product_name,
                    v.name as vendor_name,
                    m.netsuite_vendor_id,
                    GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') as colors,
                    CASE 
                        WHEN p.width IS NULL THEN 'NO_WIDTH'
                        ELSE 'HAS_WIDTH'
                    END as width_status,
                    CASE 
                        WHEN pvar.vendor_product_name IS NULL THEN 'NO_VENDOR_PROD_NAME'
                        ELSE 'HAS_VENDOR_PROD_NAME'
                    END as vendor_prod_name_status,
                    CASE 
                        WHEN i.vendor_code IS NULL THEN 'NO_VENDOR_CODE'
                        ELSE 'HAS_VENDOR_CODE'
                    END as vendor_code_status,
                    CASE 
                        WHEN i.vendor_color IS NULL THEN 'NO_VENDOR_COLOR'
                        ELSE 'HAS_VENDOR_COLOR'
                    END as vendor_color_status
                FROM T_ITEM i
                JOIN T_PRODUCT p ON i.product_id = p.id
                JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
                JOIN Z_VENDOR v ON pv.vendor_id = v.id
                JOIN opms_netsuite_vendor_mapping m ON v.id = m.opms_vendor_id
                LEFT JOIN T_PRODUCT_VARIOUS pvar ON p.id = pvar.product_id
                LEFT JOIN T_ITEM_COLOR ic ON i.id = ic.item_id
                LEFT JOIN P_COLOR c ON ic.color_id = c.id
                WHERE i.code IS NOT NULL
                  AND p.name IS NOT NULL
                  AND v.name IS NOT NULL
                  AND i.archived = 'N'
                  AND p.archived = 'N'
                  AND v.active = 'Y'
                  AND v.archived = 'N'
                  AND m.opms_vendor_name = m.netsuite_vendor_name
                  AND (
                    p.width IS NULL OR 
                    pvar.vendor_product_name IS NULL OR 
                    i.vendor_code IS NULL OR 
                    i.vendor_color IS NULL
                  )
                GROUP BY i.id, i.code, p.name, v.name, m.netsuite_vendor_id, p.width, pvar.vendor_product_name, i.vendor_code, i.vendor_color
                HAVING colors IS NOT NULL
                ORDER BY i.id
                LIMIT 2
            `;

            const [missingDataRows] = await this.db.execute(missingDataQuery);
            testItems.missingData = missingDataRows;
            console.log(`   Found ${missingDataRows.length} items with missing data`);
            missingDataRows.forEach((item, index) => {
                console.log(`   ${index + 1}. Item ID: ${item.item_id}, Code: ${item.item_code}, Product: ${item.product_name}`);
            });
            console.log('');

            // 3. Find items with multiple colors
            console.log('📋 3. Items with Multiple Colors:');
            const multipleColorsQuery = `
                SELECT 
                    'MULTIPLE_COLORS' as test_type,
                    i.id as item_id,
                    i.code as item_code,
                    p.name as product_name,
                    v.name as vendor_name,
                    m.netsuite_vendor_id,
                    GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') as colors,
                    COUNT(DISTINCT c.id) as color_count
                FROM T_ITEM i
                JOIN T_PRODUCT p ON i.product_id = p.id
                JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
                JOIN Z_VENDOR v ON pv.vendor_id = v.id
                JOIN opms_netsuite_vendor_mapping m ON v.id = m.opms_vendor_id
                LEFT JOIN T_ITEM_COLOR ic ON i.id = ic.item_id
                LEFT JOIN P_COLOR c ON ic.color_id = c.id
                WHERE i.code IS NOT NULL
                  AND p.name IS NOT NULL
                  AND v.name IS NOT NULL
                  AND i.archived = 'N'
                  AND p.archived = 'N'
                  AND v.active = 'Y'
                  AND v.archived = 'N'
                  AND m.opms_vendor_name = m.netsuite_vendor_name
                GROUP BY i.id, i.code, p.name, v.name, m.netsuite_vendor_id
                HAVING color_count > 1
                ORDER BY color_count DESC, i.id
                LIMIT 2
            `;

            const [multipleColorsRows] = await this.db.execute(multipleColorsQuery);
            testItems.multipleColors = multipleColorsRows;
            console.log(`   Found ${multipleColorsRows.length} items with multiple colors`);
            multipleColorsRows.forEach((item, index) => {
                console.log(`   ${index + 1}. Item ID: ${item.item_id}, Code: ${item.item_code}, Colors: ${item.colors} (${item.color_count} colors)`);
            });
            console.log('');

            // 4. Find items with mini-forms data
            console.log('📋 4. Items with Mini-Forms Data:');
            const miniFormsQuery = `
                SELECT 
                    'MINI_FORMS' as test_type,
                    i.id as item_id,
                    i.code as item_code,
                    p.name as product_name,
                    v.name as vendor_name,
                    m.netsuite_vendor_id,
                    GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') as colors,
                    CASE 
                        WHEN EXISTS (SELECT 1 FROM T_PRODUCT_CONTENT_FRONT WHERE product_id = p.id) THEN 'HAS_FRONT_CONTENT'
                        ELSE 'NO_FRONT_CONTENT'
                    END as front_content_status,
                    CASE 
                        WHEN EXISTS (SELECT 1 FROM T_PRODUCT_CONTENT_BACK WHERE product_id = p.id) THEN 'HAS_BACK_CONTENT'
                        ELSE 'NO_BACK_CONTENT'
                    END as back_content_status,
                    CASE 
                        WHEN EXISTS (SELECT 1 FROM T_PRODUCT_ABRASION WHERE product_id = p.id) THEN 'HAS_ABRASION'
                        ELSE 'NO_ABRASION'
                    END as abrasion_status,
                    CASE 
                        WHEN EXISTS (SELECT 1 FROM T_PRODUCT_FIRECODE WHERE product_id = p.id) THEN 'HAS_FIRECODES'
                        ELSE 'NO_FIRECODES'
                    END as firecodes_status
                FROM T_ITEM i
                JOIN T_PRODUCT p ON i.product_id = p.id
                JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
                JOIN Z_VENDOR v ON pv.vendor_id = v.id
                JOIN opms_netsuite_vendor_mapping m ON v.id = m.opms_vendor_id
                LEFT JOIN T_ITEM_COLOR ic ON i.id = ic.item_id
                LEFT JOIN P_COLOR c ON ic.color_id = c.id
                WHERE i.code IS NOT NULL
                  AND p.name IS NOT NULL
                  AND v.name IS NOT NULL
                  AND i.archived = 'N'
                  AND p.archived = 'N'
                  AND v.active = 'Y'
                  AND v.archived = 'N'
                  AND m.opms_vendor_name = m.netsuite_vendor_name
                  AND (
                    EXISTS (SELECT 1 FROM T_PRODUCT_CONTENT_FRONT WHERE product_id = p.id) OR
                    EXISTS (SELECT 1 FROM T_PRODUCT_CONTENT_BACK WHERE product_id = p.id) OR
                    EXISTS (SELECT 1 FROM T_PRODUCT_ABRASION WHERE product_id = p.id) OR
                    EXISTS (SELECT 1 FROM T_PRODUCT_FIRECODE WHERE product_id = p.id)
                  )
                GROUP BY i.id, i.code, p.name, v.name, m.netsuite_vendor_id
                HAVING colors IS NOT NULL
                ORDER BY i.id
                LIMIT 2
            `;

            const [miniFormsRows] = await this.db.execute(miniFormsQuery);
            testItems.miniForms = miniFormsRows;
            console.log(`   Found ${miniFormsRows.length} items with mini-forms data`);
            miniFormsRows.forEach((item, index) => {
                console.log(`   ${index + 1}. Item ID: ${item.item_id}, Code: ${item.item_code}, Product: ${item.product_name}`);
            });
            console.log('');

            // 5. Find items with multi-select data
            console.log('📋 5. Items with Multi-Select Data:');
            const multiSelectQuery = `
                SELECT 
                    'MULTI_SELECT' as test_type,
                    i.id as item_id,
                    i.code as item_code,
                    p.name as product_name,
                    v.name as vendor_name,
                    m.netsuite_vendor_id,
                    GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') as colors,
                    GROUP_CONCAT(DISTINCT f.name ORDER BY f.name SEPARATOR ', ') as finish_names,
                    GROUP_CONCAT(DISTINCT cl.name ORDER BY cl.name SEPARATOR ', ') as cleaning_names,
                    GROUP_CONCAT(DISTINCT o.name ORDER BY o.name SEPARATOR ', ') as origin_names,
                    GROUP_CONCAT(DISTINCT u.name ORDER BY u.name SEPARATOR ', ') as use_names
                FROM T_ITEM i
                JOIN T_PRODUCT p ON i.product_id = p.id
                JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
                JOIN Z_VENDOR v ON pv.vendor_id = v.id
                JOIN opms_netsuite_vendor_mapping m ON v.id = m.opms_vendor_id
                LEFT JOIN T_ITEM_COLOR ic ON i.id = ic.item_id
                LEFT JOIN P_COLOR c ON ic.color_id = c.id
                LEFT JOIN T_PRODUCT_FINISH pf ON p.id = pf.product_id
                LEFT JOIN P_FINISH f ON pf.finish_id = f.id
                LEFT JOIN T_PRODUCT_CLEANING pcl ON p.id = pcl.product_id
                LEFT JOIN P_CLEANING cl ON pcl.cleaning_id = cl.id
                LEFT JOIN T_PRODUCT_ORIGIN po ON p.id = po.product_id
                LEFT JOIN P_ORIGIN o ON po.origin_id = o.id
                LEFT JOIN T_PRODUCT_USE pu ON p.id = pu.product_id
                LEFT JOIN P_USE u ON pu.use_id = u.id
                WHERE i.code IS NOT NULL
                  AND p.name IS NOT NULL
                  AND v.name IS NOT NULL
                  AND i.archived = 'N'
                  AND p.archived = 'N'
                  AND v.active = 'Y'
                  AND v.archived = 'N'
                  AND m.opms_vendor_name = m.netsuite_vendor_name
                  AND (
                    f.name IS NOT NULL OR
                    cl.name IS NOT NULL OR
                    o.name IS NOT NULL OR
                    u.name IS NOT NULL
                  )
                GROUP BY i.id, i.code, p.name, v.name, m.netsuite_vendor_id
                HAVING colors IS NOT NULL
                ORDER BY i.id
                LIMIT 2
            `;

            const [multiSelectRows] = await this.db.execute(multiSelectQuery);
            testItems.multiSelect = multiSelectRows;
            console.log(`   Found ${multiSelectRows.length} items with multi-select data`);
            multiSelectRows.forEach((item, index) => {
                console.log(`   ${index + 1}. Item ID: ${item.item_id}, Code: ${item.item_code}, Product: ${item.product_name}`);
            });
            console.log('');

            return testItems;

        } catch (error) {
            throw new Error(`Query execution failed: ${error.message}`);
        }
    }

    async generateTestConfig(testItems) {
        console.log('📝 Generating Test Configuration...');
        console.log('');

        // Create test configuration for the test runner
        const testConfig = {
            completeData: testItems.completeData.slice(0, 1).map(item => ({
                itemId: item.item_id,
                productId: item.item_id, // We'll need to get the actual product_id
                productType: 'R',
                expectedFields: ['item_code', 'product_name', 'colors', 'vendor_data', 'dimensions']
            })),
            missingData: testItems.missingData.slice(0, 1).map(item => ({
                itemId: item.item_id,
                productId: item.item_id, // We'll need to get the actual product_id
                productType: 'R',
                expectedFields: ['item_code', 'product_name', 'colors']
            })),
            multipleColors: testItems.multipleColors.slice(0, 1).map(item => ({
                itemId: item.item_id,
                productId: item.item_id, // We'll need to get the actual product_id
                productType: 'R',
                expectedFields: ['item_code', 'product_name', 'multiple_colors']
            })),
            miniForms: testItems.miniForms.slice(0, 1).map(item => ({
                itemId: item.item_id,
                productId: item.item_id, // We'll need to get the actual product_id
                productType: 'R',
                expectedFields: ['item_code', 'product_name', 'mini_forms_content']
            })),
            multiSelect: testItems.multiSelect.slice(0, 1).map(item => ({
                itemId: item.item_id,
                productId: item.item_id, // We'll need to get the actual product_id
                productType: 'R',
                expectedFields: ['item_code', 'product_name', 'multi_select_fields']
            }))
        };

        // Write test configuration to file
        const fs = require('fs');
        const configPath = path.join(__dirname, 'test-items-config.json');
        fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));

        console.log('✅ Test configuration generated:');
        console.log(`   File: ${configPath}`);
        console.log('');
        console.log('📋 Test Items Summary:');
        console.log(`   Complete Data: ${testConfig.completeData.length} items`);
        console.log(`   Missing Data: ${testConfig.missingData.length} items`);
        console.log(`   Multiple Colors: ${testConfig.multipleColors.length} items`);
        console.log(`   Mini-Forms: ${testConfig.miniForms.length} items`);
        console.log(`   Multi-Select: ${testConfig.multiSelect.length} items`);
        console.log('');

        return testConfig;
    }

    async close() {
        if (this.db) {
            await this.db.end();
            console.log('✅ Database connection closed');
        }
    }
}

// Main execution
async function main() {
    const identifier = new TestItemIdentifier();
    
    try {
        await identifier.connect();
        const testItems = await identifier.identifyTestItems();
        const testConfig = await identifier.generateTestConfig(testItems);
        
        console.log('🎉 Test item identification completed successfully!');
        console.log('');
        console.log('Next steps:');
        console.log('1. Review the test-items-config.json file');
        console.log('2. Update 2-test-runner.js with the real item IDs');
        console.log('3. Run the test suite: ./run-tests.sh');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await identifier.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = TestItemIdentifier;



