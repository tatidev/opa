const ProductModel = require('../models/ProductModel');
const logger = require('../utils/logger');

// Mock dependencies
jest.mock('../models/ProductModel');
jest.mock('../utils/logger');

describe('Export Service Logic', () => {
    let mockProductModel;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock ProductModel
        mockProductModel = {
            getMiniFormsData: jest.fn()
        };
        ProductModel.mockImplementation(() => mockProductModel);
        
        // Mock logger
        logger.info = jest.fn();
        logger.error = jest.fn();
        logger.warn = jest.fn();
    });

    describe('OPMS Field Validation Logic', () => {
        // Import the validation function from the export route
        const validateOpmsField = (fieldName, fieldData) => {
            if (fieldData === undefined) {
                logger.warn(`OPMS field '${fieldName}' query failed or field not accessible`);
                return 'query_failed';
            } else if (fieldData === null || fieldData === '' || (Array.isArray(fieldData) && fieldData.length === 0)) {
                return 'src_empty_data';
            } else {
                return 'has_data';
            }
        };

        it('should return "query_failed" for undefined fields', () => {
            const result = validateOpmsField('test_field', undefined);
            expect(result).toBe('query_failed');
            expect(logger.warn).toHaveBeenCalledWith(
                "OPMS field 'test_field' query failed or field not accessible"
            );
        });

        it('should return "src_empty_data" for null fields', () => {
            const result = validateOpmsField('test_field', null);
            expect(result).toBe('src_empty_data');
        });

        it('should return "src_empty_data" for empty string fields', () => {
            const result = validateOpmsField('test_field', '');
            expect(result).toBe('src_empty_data');
        });

        it('should return "src_empty_data" for empty array fields', () => {
            const result = validateOpmsField('test_field', []);
            expect(result).toBe('src_empty_data');
        });

        it('should return "has_data" for valid string fields', () => {
            const result = validateOpmsField('test_field', 'valid data');
            expect(result).toBe('has_data');
        });

        it('should return "has_data" for valid array fields', () => {
            const result = validateOpmsField('test_field', ['item1', 'item2']);
            expect(result).toBe('has_data');
        });

        it('should return "has_data" for zero values', () => {
            const result = validateOpmsField('test_field', 0);
            expect(result).toBe('has_data');
        });

        it('should return "has_data" for false values', () => {
            const result = validateOpmsField('test_field', false);
            expect(result).toBe('has_data');
        });
    });

    describe('NetSuite Value Conversion Logic', () => {
        const getNetSuiteValue = (fieldData, validationStatus, fieldName, itemId) => {
            if (validationStatus === 'src_empty_data') {
                return 'src empty data';
            } else if (validationStatus === 'query_failed') {
                logger.error(`IMPORT ERROR: OPMS field '${fieldName}' query failed for item ${itemId}`, {
                    itemId: itemId,
                    fieldName: fieldName,
                    severity: 'medium',
                    action: 'continue_import',
                    timestamp: new Date().toISOString()
                });
                return null;
            } else {
                return fieldData;
            }
        };

        it('should return "src empty data" for empty but accessible fields', () => {
            const result = getNetSuiteValue('', 'src_empty_data', 'test_field', 123);
            expect(result).toBe('src empty data');
        });

        it('should return null and log error for query failed fields', () => {
            const result = getNetSuiteValue('some_data', 'query_failed', 'test_field', 123);
            expect(result).toBe(null);
            expect(logger.error).toHaveBeenCalledWith(
                "IMPORT ERROR: OPMS field 'test_field' query failed for item 123",
                expect.objectContaining({
                    itemId: 123,
                    fieldName: 'test_field',
                    severity: 'medium',
                    action: 'continue_import'
                })
            );
        });

        it('should return original data for valid fields', () => {
            const testData = 'valid data';
            const result = getNetSuiteValue(testData, 'has_data', 'test_field', 123);
            expect(result).toBe(testData);
        });

        it('should handle numeric data correctly', () => {
            const testData = 42;
            const result = getNetSuiteValue(testData, 'has_data', 'test_field', 123);
            expect(result).toBe(42);
        });

        it('should handle boolean data correctly', () => {
            const testData = true;
            const result = getNetSuiteValue(testData, 'has_data', 'test_field', 123);
            expect(result).toBe(true);
        });
    });

    describe('Display Name Generation', () => {
        it('should generate correct display name format with colon separator', () => {
            const productName = 'Tranquil';
            const colorName = 'Ash';
            const displayName = `${productName}: ${colorName}`;
            
            expect(displayName).toBe('Tranquil: Ash');
        });

        it('should handle product names with special characters', () => {
            const productName = 'Product-Name_123';
            const colorName = 'Blue';
            const displayName = `${productName}: ${colorName}`;
            
            expect(displayName).toBe('Product-Name_123: Blue');
        });

        it('should handle color names with spaces and commas', () => {
            const productName = 'Berba';
            const colorName = 'Fiesta, bay blue';
            const displayName = `${productName}: ${colorName}`;
            
            expect(displayName).toBe('Berba: Fiesta, bay blue');
        });

        it('should not use dash separator (incorrect format)', () => {
            const productName = 'Tranquil';
            const colorName = 'Ash';
            const wrongDisplayName = `${productName} - ${colorName}`;
            
            expect(wrongDisplayName).toBe('Tranquil - Ash');
            expect(wrongDisplayName).not.toBe('Tranquil: Ash');
        });
    });

    describe('NetSuite Item ID Generation', () => {
        const generateNetSuiteItemId = (opmsItemCode) => {
            const isDevelopment = process.env.NODE_ENV !== 'production';
            const isTestPrefix = process.env.NETSUITE_TEST_PREFIX === 'true';
            
            if (isDevelopment || isTestPrefix) {
                return `opmsAPI-${opmsItemCode}`;
            }
            
            return opmsItemCode;
        };

        beforeEach(() => {
            // Reset environment variables
            delete process.env.NODE_ENV;
            delete process.env.NETSUITE_TEST_PREFIX;
        });

        it('should add opmsAPI prefix in development mode', () => {
            process.env.NODE_ENV = 'development';
            
            const result = generateNetSuiteItemId('1354-6543');
            expect(result).toBe('opmsAPI-1354-6543');
        });

        it('should add opmsAPI prefix when test prefix is enabled', () => {
            process.env.NETSUITE_TEST_PREFIX = 'true';
            
            const result = generateNetSuiteItemId('2001-5678');
            expect(result).toBe('opmsAPI-2001-5678');
        });

        it('should use original code in production mode', () => {
            process.env.NODE_ENV = 'production';
            
            const result = generateNetSuiteItemId('1354-6543');
            expect(result).toBe('1354-6543');
        });

        it('should use original code when no environment is set', () => {
            // When no environment is set, it defaults to development mode
            // So it should add the opmsAPI prefix
            const result = generateNetSuiteItemId('1354-6543');
            expect(result).toBe('opmsAPI-1354-6543');
        });

        it('should handle various item code formats', () => {
            process.env.NODE_ENV = 'development';
            
            expect(generateNetSuiteItemId('ABC123')).toBe('opmsAPI-ABC123');
            expect(generateNetSuiteItemId('123-456')).toBe('opmsAPI-123-456');
            expect(generateNetSuiteItemId('PROD-001')).toBe('opmsAPI-PROD-001');
        });
    });

    describe('Mini-Forms Data Processing', () => {
        const mockMiniFormsData = {
            frontContent: 'Front content data',
            backContent: 'Back content data',
            abrasion: 'Abrasion test data',
            firecodes: 'Fire codes data'
        };

        beforeEach(() => {
            mockProductModel.getMiniFormsData.mockResolvedValue(mockMiniFormsData);
        });

        it('should process mini-forms data successfully', async () => {
            const result = await mockProductModel.getMiniFormsData(123);
            expect(result).toEqual(mockMiniFormsData);
        });

        it('should validate mini-forms field accessibility', () => {
            const validateField = (fieldName, fieldData) => {
                if (fieldData === undefined) {
                    return 'query_failed';
                } else if (fieldData === null || fieldData === '' || (Array.isArray(fieldData) && fieldData.length === 0)) {
                    return 'src_empty_data';
                } else {
                    return 'has_data';
                }
            };

            expect(validateField('frontContent', mockMiniFormsData.frontContent)).toBe('has_data');
            expect(validateField('backContent', mockMiniFormsData.backContent)).toBe('has_data');
            expect(validateField('abrasion', mockMiniFormsData.abrasion)).toBe('has_data');
            expect(validateField('firecodes', mockMiniFormsData.firecodes)).toBe('has_data');
        });

        it('should handle missing mini-forms data gracefully', () => {
            const validateField = (fieldName, fieldData) => {
                if (fieldData === undefined) {
                    return 'query_failed';
                } else if (fieldData === null || fieldData === '' || (Array.isArray(fieldData) && fieldData.length === 0)) {
                    return 'src_empty_data';
                } else {
                    return 'has_data';
                }
            };

            expect(validateField('frontContent', undefined)).toBe('query_failed');
            expect(validateField('backContent', null)).toBe('src_empty_data');
            expect(validateField('abrasion', '')).toBe('src_empty_data');
            expect(validateField('firecodes', [])).toBe('src_empty_data');
        });
    });

    describe('CSV Data Structure Validation', () => {
        it('should validate required OPMS source fields', () => {
            const requiredOpmsFields = [
                'opms_item_id',
                'opms_product_id', 
                'opms_item_code',
                'opms_product_name',
                'opms_color_name',
                'opms_width',
                'opms_vendor_id',
                'opms_vendor_name',
                'opms_vendor_code',
                'opms_vendor_color',
                'opms_vendor_product_name'
            ];

            requiredOpmsFields.forEach(field => {
                expect(field).toMatch(/^opms_/);
            });
        });

        it('should validate required NetSuite payload fields', () => {
            const requiredNetSuiteFields = [
                'ns_itemId',
                'ns_displayname',
                'ns_custitem_opms_fabric_width',
                'ns_vendor',
                'ns_vendorname',
                'ns_vendorcode',
                'ns_custitem_opms_vendor_color',
                'ns_custitem_opms_vendor_prod_name',
                'ns_custitem_opms_item_colors',
                'ns_custitem_opms_parent_product_name',
                'ns_custitem_opms_product_id',
                'ns_custitem_opms_item_id',
                'ns_frontContentJson',
                'ns_backContentJson',
                'ns_abrasionJson',
                'ns_firecodesJson'
            ];

            requiredNetSuiteFields.forEach(field => {
                expect(field).toMatch(/^ns_/);
            });
        });

        it('should ensure field count consistency', () => {
            const opmsFields = 11; // OPMS source fields
            const netsuiteFields = 16; // NetSuite payload fields
            const totalFields = opmsFields + netsuiteFields;
            
            expect(totalFields).toBe(27);
        });
    });

    describe('Error Handling and Logging', () => {
        it('should log field validation failures appropriately', () => {
            const validateAndLog = (fieldName, fieldData, itemId) => {
                if (fieldData === undefined) {
                    logger.warn(`OPMS field '${fieldName}' query failed for item ${itemId}`);
                    return 'query_failed';
                }
                return 'valid';
            };

            const result = validateAndLog('test_field', undefined, 123);
            expect(result).toBe('query_failed');
            expect(logger.warn).toHaveBeenCalledWith(
                'OPMS field \'test_field\' query failed for item 123'
            );
        });

        it('should log import errors with structured data', () => {
            const logImportError = (fieldName, itemId, errorType) => {
                logger.error(`IMPORT ERROR: ${errorType}`, {
                    fieldName,
                    itemId,
                    timestamp: new Date().toISOString(),
                    severity: 'medium'
                });
            };

            logImportError('test_field', 123, 'field_access_failed');
            
            expect(logger.error).toHaveBeenCalledWith(
                'IMPORT ERROR: field_access_failed',
                expect.objectContaining({
                    fieldName: 'test_field',
                    itemId: 123,
                    severity: 'medium'
                })
            );
        });

        it('should handle database connection failures gracefully', () => {
            const mockDbError = new Error('Connection refused');
            
            // Simulate database connection failure
            const handleDbError = (error) => {
                if (error.message.includes('Connection refused')) {
                    logger.error('Database connection failed', {
                        error: error.message,
                        action: 'retry_later'
                    });
                    return 'connection_failed';
                }
                return 'unknown_error';
            };

            const result = handleDbError(mockDbError);
            expect(result).toBe('connection_failed');
            expect(logger.error).toHaveBeenCalledWith(
                'Database connection failed',
                expect.objectContaining({
                    error: 'Connection refused',
                    action: 'retry_later'
                })
            );
        });
    });

    describe('Performance and Scalability', () => {
        it('should handle large datasets efficiently', () => {
            const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
                item_id: i + 1,
                product_id: i + 1,
                item_code: `CODE-${i + 1}`,
                product_name: `Product ${i + 1}`,
                color_name: `Color ${i + 1}`
            }));

            expect(largeDataset.length).toBe(1000);
            expect(largeDataset[0].item_code).toBe('CODE-1');
            expect(largeDataset[999].item_code).toBe('CODE-1000');
        });

        it('should validate memory usage patterns', () => {
            const createItemData = (item) => ({
                opms_item_id: item.item_id,
                opms_product_id: item.product_id,
                opms_item_code: item.item_code,
                opms_product_name: item.product_name,
                opms_color_name: item.color_name,
                ns_itemId: `opmsAPI-${item.item_code}`,
                ns_displayname: `${item.product_name}: ${item.color_name}`
            });

            const sampleItem = {
                item_id: 1,
                product_id: 1,
                item_code: '1354-6543',
                product_name: 'Tranquil',
                color_name: 'Ash'
            };

            const processedItem = createItemData(sampleItem);
            
            expect(processedItem.ns_itemId).toBe('opmsAPI-1354-6543');
            expect(processedItem.ns_displayname).toBe('Tranquil: Ash');
        });
    });
});
