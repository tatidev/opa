/**
 * Comprehensive CSV Import Test - Mixed Existing/New Parent Products
 * Tests CSV import scenarios with products that already exist and new products
 */

const CsvImportService = require('../services/csvImportService');
const CsvDataTransformationService = require('../services/csvDataTransformationService');
const DatabaseOperationExecutor = require('../services/databaseOperationExecutor');
const fs = require('fs');
const path = require('path');

describe('CSV Import - Mixed Parent Products', () => {
    let csvService;
    let transformationService;
    let executor;
    let mockDb;
    let testCsvPath;

    // Track database state for verification
    let mockProducts = new Map();
    let mockItems = new Map();
    let nextProductId = 1;
    let nextItemId = 1;

    beforeAll(() => {
        // Initialize services
        csvService = new CsvImportService();
        transformationService = new CsvDataTransformationService();
        executor = new DatabaseOperationExecutor();

        // Create mock database
        mockDb = {
            query: jest.fn(),
            execute: jest.fn(),
            end: jest.fn()
        };

        executor.setDatabase(mockDb);
    });

    beforeEach(() => {
        // Reset mock state
        mockProducts.clear();
        mockItems.clear();
        nextProductId = 1;
        nextItemId = 1;

        // Pre-populate with existing products
        mockProducts.set('Existing Product Alpha', {
            id: nextProductId++,
            name: 'Existing Product Alpha',
            width: 54.00,
            vrepeat: 12.5,
            hrepeat: 8.25,
            outdoor: 'N',
            archived: 'N',
            type: 'R',
            in_master: 1
        });

        mockProducts.set('Another Existing Product', {
            id: nextProductId++,
            name: 'Another Existing Product',
            width: 48.00,
            vrepeat: 10.0,
            hrepeat: 6.0,
            outdoor: 'Y',
            archived: 'N',
            type: 'R',
            in_master: 1
        });

        // Reset mock implementation
        mockDb.query.mockClear();
        setupMockDbResponses();

        // Create test CSV with mixed scenarios using complete column structure
        testCsvPath = path.join(__dirname, 'test-mixed-parents.csv');
        const mixedParentCsvContent = `Item Id (Opuzen Code),Product Name,Display Name,Color,Width,VR,HR,Vendor,Vendor Item Code,Vendor Product Name,Vendor Item Color,Repeat (No-Repeat),Front Content,Back Content,Abrasion,Firecodes,Prop 65 Compliance,AB 2998 Compliance,Finish,Cleaning,Origin,Tariff / Harmonized Code,Use (Item Application)
1001-0001,Existing Product Alpha,Existing Product Alpha: Red,Red,54.00,12.5,8.25,Vendor A,VA-001,Alpha Fabric Line,Red-001,Repeat,60% Cotton 40% Polyester,Soft backing material,Class II ASTM D3884,Class A ASTM E84,Y,Y,Matte,Professional cleaning only,USA,6302.93.0000,Residential upholstery
1001-0002,Existing Product Alpha,Existing Product Alpha: Blue,Blue,54.00,12.5,8.25,Vendor A,VA-002,Alpha Fabric Line,Blue-001,Repeat,60% Cotton 40% Polyester,Soft backing material,Class II ASTM D3884,Class A ASTM E84,Y,Y,Matte,Professional cleaning only,USA,6302.93.0000,Residential upholstery
2001-0001,New Product Beta,New Product Beta: Green,Green,60.00,15.0,10.0,Vendor B,VB-001,Beta Collection,Green-100,No-Repeat,100% Polyester,Durable synthetic backing,Heavy Duty 50000 rubs,NFPA 701,N,N,Satin,Machine washable,Italy,5407.20.0000,Commercial upholstery
2001-0002,New Product Beta,New Product Beta: Yellow,Yellow,60.00,15.0,10.0,Vendor B,VB-002,Beta Collection,Yellow-100,No-Repeat,100% Polyester,Durable synthetic backing,Heavy Duty 50000 rubs,NFPA 701,N,N,Satin,Machine washable,Italy,5407.20.0000,Commercial upholstery
3001-0001,Another Existing Product,Another Existing Product: Purple,Purple,48.00,10.0,6.0,Vendor C,VC-001,Classic Series,Purple-50,Repeat,70% Wool 30% Silk,Natural fiber backing,Moderate 25000 rubs,Class B,Y,N,Textured,Dry clean only,Belgium,5111.30.0000,High-end residential
4001-0001,New Product Gamma,New Product Gamma: Orange,Orange,52.00,11.0,7.5,Vendor D,VD-001,Gamma Modern,Orange-200,Repeat,85% Cotton 15% Linen,Cotton blend backing,Standard 15000 rubs,Cal TB 117,N,Y,Semi-gloss,Spot clean,Mexico,5208.12.0000,Hospitality`;

        fs.writeFileSync(testCsvPath, mixedParentCsvContent);
    });

    afterEach(() => {
        // Clean up test file
        if (fs.existsSync(testCsvPath)) {
            fs.unlinkSync(testCsvPath);
        }
    });

    function setupMockDbResponses() {
        mockDb.query.mockImplementation((sql, params) => {
            
            // Handle product existence check
            if (sql.includes('SELECT id FROM T_PRODUCT WHERE name = ?')) {
                const productName = params[0];
                const product = mockProducts.get(productName);
                return Promise.resolve([[product ? { id: product.id } : null].filter(Boolean)]);
            }

            // Handle product UPDATE (existing product)
            if (sql.includes('UPDATE T_PRODUCT SET')) {
                // This is an update to existing product - just return success
                return Promise.resolve([{ affectedRows: 1 }]);
            }

            // Handle product INSERT (new product)
            if (sql.includes('INSERT INTO T_PRODUCT')) {
                const productName = params[0]; // First param is the product name
                
                if (!mockProducts.has(productName)) {
                    const newProduct = {
                        id: nextProductId++,
                        name: productName,
                        width: params[1] || 0,
                        vrepeat: params[2] || 0,
                        hrepeat: params[3] || 0,
                        outdoor: params[4] || 'N',
                        archived: 'N',
                        type: 'R',
                        in_master: 1
                    };
                    mockProducts.set(productName, newProduct);
                    return Promise.resolve([{ insertId: newProduct.id, affectedRows: 1 }]);
                }
                return Promise.resolve([{ insertId: mockProducts.get(productName).id, affectedRows: 0 }]);
            }

            // Handle item existence check
            if (sql.includes('SELECT id FROM T_ITEM WHERE code = ?')) {
                const itemCode = params[0];
                const item = mockItems.get(itemCode);
                return Promise.resolve([[item ? { id: item.id } : null].filter(Boolean)]);
            }

            // Handle item UPDATE (existing item)
            if (sql.includes('UPDATE T_ITEM SET')) {
                // This is an update to existing item - just return success
                return Promise.resolve([{ affectedRows: 1 }]);
            }

            // Handle item INSERT (new item)
            if (sql.includes('INSERT INTO T_ITEM')) {
                const itemCode = params[0];
                const productId = params[params.length - 1]; // product_id is last param
                
                const newItem = {
                    id: nextItemId++,
                    code: itemCode,
                    product_id: productId,
                    vendor_code: params[1] || null,
                    vendor_color: params[2] || null,
                    archived: 'N',
                    product_type: 'R',
                    in_ringset: 0,
                    status_id: 1,
                    stock_status_id: 1
                };
                mockItems.set(itemCode, newItem);
                return Promise.resolve([{ insertId: newItem.id, affectedRows: 1 }]);
            }

            // Handle T_PRODUCT_VARIOUS table operations (don't add to mockProducts)
            if (sql.includes('T_PRODUCT_VARIOUS')) {
                return Promise.resolve([{ insertId: nextItemId++, affectedRows: 1 }]);
            }

            // Handle any other table operations
            if (sql.includes('INSERT INTO') || sql.includes('UPDATE') || sql.includes('SELECT')) {
                return Promise.resolve([[], []]);
            }

            // Default response
            return Promise.resolve([[], []]);
        });
    }

    describe('Mixed Parent Product Import', () => {
        test('should handle mixed existing and new parent products correctly', async () => {
            // Parse CSV
            const csvData = await csvService.parseCsvFile(testCsvPath);
            expect(csvData).toHaveLength(6);

            // Validate CSV data
            const validation = csvService.validateCsvData(csvData);
            expect(validation.isValid).toBe(true);
            expect(validation.summary.validRows).toBe(6);

            // Transform each CSV row
            const transformedRows = [];
            for (let i = 0; i < csvData.length; i++) {
                const transformed = transformationService.transformCsvRow(csvData[i], i + 1);
                expect(transformed.errors).toHaveLength(0);
                transformedRows.push(transformed);
            }

            // Execute database operations for each row
            const executionResults = [];
            for (const transformed of transformedRows) {
                const result = await executor.executeOperations(transformed.operations);
                executionResults.push(result);
            }

            // Verify all operations succeeded
            executionResults.forEach((result, index) => {
                expect(result.successful).toBeGreaterThan(0);
                expect(result.failed).toBe(0);
            });

            // Verify database state
            verifyDatabaseState();
        });

        test('should reuse existing products and create new ones appropriately', async () => {
            // Parse and process CSV
            const csvData = await csvService.parseCsvFile(testCsvPath);
            
            for (let i = 0; i < csvData.length; i++) {
                const transformed = transformationService.transformCsvRow(csvData[i], i + 1);
                await executor.executeOperations(transformed.operations);
            }

            // Verify only the correct product names exist (filter out numeric keys from other operations)
            const productNames = Array.from(mockProducts.keys())
                .filter(key => typeof key === 'string')
                .sort();
            
            expect(productNames).toEqual([
                'Another Existing Product',
                'Existing Product Alpha', 
                'New Product Beta',
                'New Product Gamma'
            ]);
            
            // Verify we have exactly 4 string-named products
            expect(productNames).toHaveLength(4);
        });

        test('should create correct item-product relationships', async () => {
            // Process CSV
            const csvData = await csvService.parseCsvFile(testCsvPath);
            
            for (let i = 0; i < csvData.length; i++) {
                const transformed = transformationService.transformCsvRow(csvData[i], i + 1);
                await executor.executeOperations(transformed.operations);
            }

            // Verify item-product relationships
            const relationships = [];
            for (const [itemCode, item] of mockItems.entries()) {
                const product = Array.from(mockProducts.values()).find(p => p.id === item.product_id);
                relationships.push({
                    item_code: itemCode,
                    product_name: product.name
                });
            }
            relationships.sort((a, b) => a.item_code.localeCompare(b.item_code));

            expect(relationships).toHaveLength(6);
            
            // Verify specific relationships
            const expectedRelationships = [
                { item_code: '1001-0001', product_name: 'Existing Product Alpha' },
                { item_code: '1001-0002', product_name: 'Existing Product Alpha' },
                { item_code: '2001-0001', product_name: 'New Product Beta' },
                { item_code: '2001-0002', product_name: 'New Product Beta' },
                { item_code: '3001-0001', product_name: 'Another Existing Product' },
                { item_code: '4001-0001', product_name: 'New Product Gamma' }
            ];

            relationships.forEach((rel, index) => {
                expect(rel.item_code).toBe(expectedRelationships[index].item_code);
                expect(rel.product_name).toBe(expectedRelationships[index].product_name);
            });
        });

        test('should handle product updates for existing products', async () => {
            // Get initial product data
            const initialProduct = mockProducts.get('Existing Product Alpha');
            expect(initialProduct.width).toBe(54);
            expect(initialProduct.vrepeat).toBe(12.5);
            expect(initialProduct.hrepeat).toBe(8.25);

            // Process CSV (which has same values, should update but not change)
            const csvData = await csvService.parseCsvFile(testCsvPath);
            const transformed = transformationService.transformCsvRow(csvData[0], 1); // First row is Existing Product Alpha
            await executor.executeOperations(transformed.operations);

            // Verify product data remains consistent
            const updatedProduct = mockProducts.get('Existing Product Alpha');
            expect(updatedProduct.width).toBe(54);
            expect(updatedProduct.vrepeat).toBe(12.5);
            expect(updatedProduct.hrepeat).toBe(8.25);
        });
    });

    /**
     * Verify the final database state after mixed parent import
     */
    function verifyDatabaseState() {
        // Check products (filter out numeric keys from other operations)
        const productNames = Array.from(mockProducts.keys()).filter(key => typeof key === 'string');
        expect(productNames).toHaveLength(4);

        // Check items
        const testItems = Array.from(mockItems.entries())
            .map(([code, item]) => ({
                code,
                product_name: Array.from(mockProducts.values()).find(p => p.id === item.product_id)?.name
            }))
            .sort((a, b) => a.code.localeCompare(b.code));

        expect(testItems).toHaveLength(6);

        // Verify parent-child groupings
        const productGroups = testItems.reduce((groups, item) => {
            if (!groups[item.product_name]) {
                groups[item.product_name] = [];
            }
            groups[item.product_name].push(item.code);
            return groups;
        }, {});

        expect(productGroups['Existing Product Alpha']).toEqual(['1001-0001', '1001-0002']);
        expect(productGroups['New Product Beta']).toEqual(['2001-0001', '2001-0002']);
        expect(productGroups['Another Existing Product']).toEqual(['3001-0001']);
        expect(productGroups['New Product Gamma']).toEqual(['4001-0001']);
    }
});
