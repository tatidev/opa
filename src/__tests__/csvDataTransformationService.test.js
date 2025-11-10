/**
 * Tests for CSV Data Transformation Service
 * Tests CSV data transformation into database operations
 */

const CsvDataTransformationService = require('../services/csvDataTransformationService');

describe('CsvDataTransformationService', () => {
    let transformationService;

    beforeEach(() => {
        transformationService = new CsvDataTransformationService();
    });

    describe('Constructor', () => {
        test('should initialize with field mappings', () => {
            expect(transformationService.fieldMappings).toBeDefined();
            expect(transformationService.fieldMappings['Item Id (Opuzen Code)']).toBeDefined();
            expect(transformationService.fieldMappings['Product Name']).toBeDefined();
            expect(transformationService.fieldMappings['Color']).toBeDefined();
        });

        test('should have correct table mappings', () => {
            expect(transformationService.fieldMappings['Product Name'].table).toBe('T_PRODUCT');
            expect(transformationService.fieldMappings['Item Id (Opuzen Code)'].table).toBe('T_ITEM');
            expect(transformationService.fieldMappings['Color'].table).toBe('P_COLOR');
        });
    });

    describe('transformCsvRow', () => {
        test('should transform valid CSV row successfully', () => {
            const csvRow = {
                'Item Id (Opuzen Code)': 'ABC123',
                'Product Name': 'Tranquil',
                'Color': 'Ash, Blue',
                'Width': '54.00',
                'VR': '12.5',
                'HR': '8.25',
                'Vendor': 'Vendor A',
                'Prop 65 Compliance': 'Y',
                'AB 2998 Compliance': 'N'
            };

            const result = transformationService.transformCsvRow(csvRow, 1);

            expect(result.rowNumber).toBe(1);
            expect(result.errors).toHaveLength(0);
            expect(result.operations).toBeDefined();
            expect(result.operations.length).toBeGreaterThan(0);
        });

        test('should handle missing required fields', () => {
            const csvRow = {
                'Product Name': 'Tranquil',
                'Color': 'Ash'
                // Missing Item Id
            };

            const result = transformationService.transformCsvRow(csvRow, 1);

            expect(result.errors).toContain('Missing required fields: Item Code, Product Name, or Color');
            expect(result.operations).toHaveLength(0);
        });

        test('should handle empty color field', () => {
            const csvRow = {
                'Item Id (Opuzen Code)': 'ABC123',
                'Product Name': 'Tranquil',
                'Color': ''
            };

            const result = transformationService.transformCsvRow(csvRow, 1);

            expect(result.errors).toContain('Missing required fields: Item Code, Product Name, or Color');
        });

        test('should generate product operation', () => {
            const csvRow = {
                'Item Id (Opuzen Code)': 'ABC123',
                'Product Name': 'Tranquil',
                'Color': 'Ash',
                'Width': '54.00',
                'VR': '12.5',
                'HR': '8.25'
            };

            const result = transformationService.transformCsvRow(csvRow, 1);

            const productOp = result.operations.find(op => op.type === 'upsert_product');
            expect(productOp).toBeDefined();
            expect(productOp.table).toBe('T_PRODUCT');
            expect(productOp.data.name).toBe('Tranquil');
            expect(productOp.data.width).toBe(54.00);
            expect(productOp.data.vrepeat).toBe(12.5);
            expect(productOp.data.hrepeat).toBe(8.25);
        });

        test('should generate item operation', () => {
            const csvRow = {
                'Item Id (Opuzen Code)': 'ABC123',
                'Product Name': 'Tranquil',
                'Color': 'Ash',
                'Vendor Item Code': 'V001',
                'Vendor Item Color': 'ASH'
            };

            const result = transformationService.transformCsvRow(csvRow, 1);

            const itemOp = result.operations.find(op => op.type === 'upsert_item');
            expect(itemOp).toBeDefined();
            expect(itemOp.table).toBe('T_ITEM');
            expect(itemOp.data.code).toBe('ABC123');
            expect(itemOp.data.vendor_code).toBe('V001');
            expect(itemOp.data.vendor_color).toBe('ASH');
        });

        test('should handle transformation errors gracefully', () => {
            // Create a row that will cause an error
            const csvRow = {
                'Item Id (Opuzen Code)': 'ABC123',
                'Product Name': 'Tranquil',
                'Color': 'Ash'
            };

            // Mock a method to throw an error
            const originalMethod = transformationService.transformProductData;
            transformationService.transformProductData = jest.fn().mockImplementation(() => {
                throw new Error('Test error');
            });

            const result = transformationService.transformCsvRow(csvRow, 1);

            expect(result.errors).toContain('Transformation error: Test error');
            expect(result.operations).toHaveLength(0);

            // Restore original method
            transformationService.transformProductData = originalMethod;
        });
    });

    describe('transformProductData', () => {
        test('should transform basic product data', () => {
            const csvRow = {
                'Product Name': 'Tranquil',
                'Width': '54.00',
                'VR': '12.5',
                'HR': '8.25'
            };

            const result = transformationService.transformProductData(csvRow);

            expect(result.name).toBe('Tranquil');
            expect(result.width).toBe(54.00);
            expect(result.vrepeat).toBe(12.5);
            expect(result.hrepeat).toBe(8.25);
            expect(result.archived).toBe('N');
            expect(result.type).toBe('R');
            expect(result.in_master).toBe(1);
        });

        test('should handle missing numeric fields', () => {
            const csvRow = {
                'Product Name': 'Tranquil'
                // Missing Width, VR, HR
            };

            const result = transformationService.transformProductData(csvRow);

            expect(result.name).toBe('Tranquil');
            expect(result.width).toBeUndefined();
            expect(result.vrepeat).toBeUndefined();
            expect(result.hrepeat).toBeUndefined();
        });

        test('should handle invalid numeric fields', () => {
            const csvRow = {
                'Product Name': 'Tranquil',
                'Width': 'invalid',
                'VR': 'not-a-number',
                'HR': 'abc'
            };

            const result = transformationService.transformProductData(csvRow);

            expect(result.name).toBe('Tranquil');
            expect(result.width).toBeUndefined();
            expect(result.vrepeat).toBeUndefined();
            expect(result.hrepeat).toBeUndefined();
        });

        test('should transform repeat field correctly', () => {
            const csvRow = {
                'Product Name': 'Tranquil',
                'Repeat (No-Repeat)': 'Repeat'
            };

            const result = transformationService.transformProductData(csvRow);

            expect(result.outdoor).toBe('Y');
        });

        test('should handle no-repeat field', () => {
            const csvRow = {
                'Product Name': 'Tranquil',
                'Repeat (No-Repeat)': 'No-Repeat'
            };

            const result = transformationService.transformProductData(csvRow);

            expect(result.outdoor).toBe('N');
        });

        test('should return default values for empty data', () => {
            const csvRow = {};

            const result = transformationService.transformProductData(csvRow);

            expect(result).toBeDefined();
            expect(result.archived).toBe('N');
            expect(result.type).toBe('R');
            expect(result.in_master).toBe(1);
            expect(result.name).toBeUndefined();
        });
    });

    describe('transformItemData', () => {
        test('should transform basic item data', () => {
            const csvRow = {
                'Item Id (Opuzen Code)': 'ABC123',
                'Vendor Item Code': 'V001',
                'Vendor Item Color': 'ASH'
            };

            const result = transformationService.transformItemData(csvRow);

            expect(result.code).toBe('ABC123');
            expect(result.vendor_code).toBe('V001');
            expect(result.vendor_color).toBe('ASH');
            expect(result.archived).toBe('N');
            expect(result.product_type).toBe('R');
            expect(result.in_ringset).toBe(0);
            expect(result.status_id).toBe(1);
            expect(result.stock_status_id).toBe(1);
        });

        test('should handle missing optional fields', () => {
            const csvRow = {
                'Item Id (Opuzen Code)': 'ABC123'
                // Missing vendor fields
            };

            const result = transformationService.transformItemData(csvRow);

            expect(result.code).toBe('ABC123');
            expect(result.vendor_code).toBeUndefined();
            expect(result.vendor_color).toBeUndefined();
        });

        test('should return default values for empty data', () => {
            const csvRow = {};

            const result = transformationService.transformItemData(csvRow);

            expect(result).toBeDefined();
            expect(result.archived).toBe('N');
            expect(result.product_type).toBe('R');
            expect(result.in_ringset).toBe(0);
            expect(result.status_id).toBe(1);
            expect(result.stock_status_id).toBe(1);
            expect(result.code).toBeUndefined();
        });
    });

    describe('transformExtendedProductData', () => {
        test('should transform compliance fields', () => {
            const csvRow = {
                'Vendor Product Name': 'Tranquil Ash',
                'Prop 65 Compliance': 'Y',
                'AB 2998 Compliance': 'N',
                'Tariff / Harmonized Code': '5702.42.0000'
            };

            const result = transformationService.transformExtendedProductData(csvRow);

            expect(result.vendor_product_name).toBe('Tranquil Ash');
            expect(result.prop_65).toBe('Y');
            expect(result.ab_2998_compliant).toBe('N');
            expect(result.tariff_code).toBe('5702.42.0000');
        });

        test('should handle missing fields', () => {
            const csvRow = {
                'Vendor Product Name': 'Tranquil Ash'
                // Missing compliance fields
            };

            const result = transformationService.transformExtendedProductData(csvRow);

            expect(result.vendor_product_name).toBe('Tranquil Ash');
            expect(result.prop_65).toBeUndefined();
            expect(result.ab_2998_compliant).toBeUndefined();
            expect(result.tariff_code).toBeUndefined();
        });

        test('should return empty object for no data', () => {
            const csvRow = {};

            const result = transformationService.transformExtendedProductData(csvRow);

            expect(Object.keys(result)).toHaveLength(0);
        });
    });

    describe('transformMiniFormsData', () => {
        test('should transform all mini-forms fields', () => {
            const csvRow = {
                'Front Content': 'Front content here',
                'Back Content': 'Back content here',
                'Abrasion': 'ASTM D3884',
                'Firecodes': 'ASTM E84'
            };

            const result = transformationService.transformMiniFormsData(csvRow);

            expect(result).toHaveLength(4);
            
            const frontOp = result.find(op => op.type === 'upsert_product_content_front');
            expect(frontOp).toBeDefined();
            expect(frontOp.data.content).toBe('Front content here');

            const backOp = result.find(op => op.type === 'upsert_product_content_back');
            expect(backOp).toBeDefined();
            expect(backOp.data.content).toBe('Back content here');

            const abrasionOp = result.find(op => op.type === 'upsert_product_abrasion');
            expect(abrasionOp).toBeDefined();
            expect(abrasionOp.data.content).toBe('ASTM D3884');

            const firecodeOp = result.find(op => op.type === 'upsert_product_firecode');
            expect(firecodeOp).toBeDefined();
            expect(firecodeOp.data.content).toBe('ASTM E84');
        });

        test('should handle missing mini-forms fields', () => {
            const csvRow = {
                'Front Content': 'Front content here'
                // Missing other fields
            };

            const result = transformationService.transformMiniFormsData(csvRow);

            expect(result).toHaveLength(1);
            expect(result[0].type).toBe('upsert_product_content_front');
        });

        test('should return empty array for no mini-forms data', () => {
            const csvRow = {};

            const result = transformationService.transformMiniFormsData(csvRow);

            expect(result).toHaveLength(0);
        });
    });

    describe('transformRelationshipData', () => {
        test('should transform color relationships', () => {
            const csvRow = {
                'Color': 'Ash, Blue, Red'
            };

            const result = transformationService.transformRelationshipData(csvRow);

            const colorOp = result.find(op => op.type === 'sync_item_colors');
            expect(colorOp).toBeDefined();
            expect(colorOp.data.colors).toEqual(['Ash', 'Blue', 'Red']);
        });

        test('should transform vendor relationships', () => {
            const csvRow = {
                'Vendor': 'Vendor A, Vendor B'
            };

            const result = transformationService.transformRelationshipData(csvRow);

            const vendorOp = result.find(op => op.type === 'sync_product_vendors');
            expect(vendorOp).toBeDefined();
            expect(vendorOp.data.vendors).toEqual(['Vendor A', 'Vendor B']);
        });

        test('should transform multi-select fields', () => {
            const csvRow = {
                'Finish': 'Textured, Smooth',
                'Cleaning': 'Spot Clean, Professional',
                'Origin': 'USA, Canada',
                'Use (Item Application)': 'Residential, Commercial'
            };

            const result = transformationService.transformRelationshipData(csvRow);

            expect(result).toHaveLength(4);
            
            const finishOp = result.find(op => op.type === 'sync_product_finish');
            expect(finishOp).toBeDefined();
            expect(finishOp.data.values).toEqual(['Textured', 'Smooth']);

            const cleaningOp = result.find(op => op.type === 'sync_product_cleaning');
            expect(cleaningOp).toBeDefined();
            expect(cleaningOp.data.values).toEqual(['Spot Clean', 'Professional']);
        });

        test('should handle empty relationship fields', () => {
            const csvRow = {
                'Color': '',
                'Vendor': '',
                'Finish': ''
            };

            const result = transformationService.transformRelationshipData(csvRow);

            expect(result).toHaveLength(0);
        });
    });

    describe('Utility Methods', () => {
        describe('parseCommaSeparated', () => {
            test('should parse comma-separated values', () => {
                const result = transformationService.parseCommaSeparated('Ash, Blue, Red');
                expect(result).toEqual(['Ash', 'Blue', 'Red']);
            });

            test('should handle single value', () => {
                const result = transformationService.parseCommaSeparated('Ash');
                expect(result).toEqual(['Ash']);
            });

            test('should handle empty string', () => {
                const result = transformationService.parseCommaSeparated('');
                expect(result).toEqual([]);
            });

            test('should handle undefined value', () => {
                const result = transformationService.parseCommaSeparated(undefined);
                expect(result).toEqual([]);
            });

            test('should trim whitespace', () => {
                const result = transformationService.parseCommaSeparated(' Ash , Blue , Red ');
                expect(result).toEqual(['Ash', 'Blue', 'Red']);
            });
        });

        describe('transformRepeatField', () => {
            test('should transform repeat to Y', () => {
                expect(transformationService.transformRepeatField('Repeat')).toBe('Y');
                expect(transformationService.transformRepeatField('repeat')).toBe('Y');
                expect(transformationService.transformRepeatField('REPEAT')).toBe('Y');
            });

            test('should transform no-repeat to N', () => {
                expect(transformationService.transformRepeatField('No-Repeat')).toBe('N');
                expect(transformationService.transformRepeatField('no-repeat')).toBe('N');
                expect(transformationService.transformRepeatField('NO-REPEAT')).toBe('N');
            });

            test('should default to N for empty values', () => {
                expect(transformationService.transformRepeatField('')).toBe('N');
                expect(transformationService.transformRepeatField(null)).toBe('N');
                expect(transformationService.transformRepeatField(undefined)).toBe('N');
            });
        });

        describe('transformYesNo', () => {
            test('should transform yes values to Y', () => {
                expect(transformationService.transformYesNo('Y')).toBe('Y');
                expect(transformationService.transformYesNo('YES')).toBe('Y');
                expect(transformationService.transformYesNo('Yes')).toBe('Y');
            });

            test('should transform no values to N', () => {
                expect(transformationService.transformYesNo('N')).toBe('N');
                expect(transformationService.transformYesNo('NO')).toBe('N');
                expect(transformationService.transformYesNo('No')).toBe('N');
                expect(transformationService.transformYesNo('Maybe')).toBe('N');
            });

            test('should default to N for empty values', () => {
                expect(transformationService.transformYesNo('')).toBe('N');
                expect(transformationService.transformYesNo(null)).toBe('N');
                expect(transformationService.transformYesNo(undefined)).toBe('N');
            });
        });

        describe('generateDisplayName', () => {
            test('should generate display name with colors', () => {
                const result = transformationService.generateDisplayName('Tranquil', ['Ash', 'Blue']);
                expect(result).toBe('Tranquil: Ash, Blue');
            });

            test('should handle single color', () => {
                const result = transformationService.generateDisplayName('Tranquil', ['Ash']);
                expect(result).toBe('Tranquil: Ash');
            });

            test('should handle missing product name', () => {
                const result = transformationService.generateDisplayName('', ['Ash']);
                expect(result).toBe('Unknown Product');
            });

            test('should handle missing colors', () => {
                const result = transformationService.generateDisplayName('Tranquil', []);
                expect(result).toBe('Tranquil');
            });
        });
    });

    describe('validateTransformedData', () => {
        test('should validate valid transformed data', () => {
            const transformedData = {
                operations: [
                    { type: 'upsert_product', table: 'T_PRODUCT' },
                    { type: 'upsert_item', table: 'T_ITEM' }
                ],
                warnings: ['Optional field is empty']
            };

            const result = transformationService.validateTransformedData(transformedData);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toContain('Optional field is empty');
        });

        test('should detect missing operations', () => {
            const transformedData = {
                operations: [],
                warnings: []
            };

            const result = transformationService.validateTransformedData(transformedData);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('No operations generated from CSV data');
        });

        test('should detect missing product operation', () => {
            const transformedData = {
                operations: [
                    { type: 'upsert_item', table: 'T_ITEM' }
                ],
                warnings: []
            };

            const result = transformationService.validateTransformedData(transformedData);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Missing product operation');
        });

        test('should detect missing item operation', () => {
            const transformedData = {
                operations: [
                    { type: 'upsert_product', table: 'T_PRODUCT' }
                ],
                warnings: []
            };

            const result = transformationService.validateTransformedData(transformedData);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Missing item operation');
        });
    });
});
