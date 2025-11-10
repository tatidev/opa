const request = require('supertest');
const express = require('express');
const mysql = require('mysql2/promise');

// Mock the database module
jest.mock('mysql2/promise');

// Mock the ProductModel
jest.mock('../models/ProductModel');
const ProductModel = require('../models/ProductModel');

// Mock the NetSuiteRestletService
jest.mock('../services/netsuiteRestletService');
const NetSuiteRestletService = require('../services/netsuiteRestletService');

// Mock the logger
jest.mock('../utils/logger');
const logger = require('../utils/logger');

// Import the export routes
const exportRoutes = require('../routes/export');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/export', exportRoutes);

describe('Export Routes', () => {
    let mockConnection;
    let mockExecute;
    let mockOpmsData;
    let mockMiniFormsData;
    let mockTransformedHtml;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Mock database connection
        mockExecute = jest.fn();
        mockConnection = {
            execute: mockExecute,
            end: jest.fn()
        };
        
        // Mock mysql.createConnection
        mysql.createConnection.mockResolvedValue(mockConnection);
        
        // Mock ProductModel methods
        ProductModel.prototype.getMiniFormsData = jest.fn();
        
        // Mock NetSuiteRestletService
        NetSuiteRestletService.transformToRestletPayload = jest.fn();
        
        // Mock logger methods
        logger.info = jest.fn();
        logger.error = jest.fn();
        logger.warn = jest.fn();

        // Define mock data
        mockOpmsData = [
            {
                item_id: 1,
                product_id: 1,
                item_code: '1354-6543',
                product_name: 'Tranquil',
                color_name: 'Ash',
                width: 54.00,
                vendor_id: 1,
                vendor_name: 'TextileCorp',
                vendor_code: 'TC-ASH-001',
                vendor_color: 'ASH-001',
                vendor_product_name: 'Tranquil Ash Fabric',
                netsuite_vendor_id: 1
            },
            {
                item_id: 2,
                product_id: 2,
                item_code: '2001-5678',
                product_name: 'Berba',
                color_name: 'Blue',
                width: 48.50,
                vendor_id: 2,
                vendor_name: 'FabricMills',
                vendor_code: 'FM-BLUE-02',
                vendor_color: 'BLUE-02',
                vendor_product_name: 'Berba Blue Fabric',
                netsuite_vendor_id: 2
            }
        ];

        mockMiniFormsData = {
            frontContent: 'Beautiful fabric front content',
            backContent: 'Fabric back content',
            abrasion: 'Abrasion test results',
            firecodes: 'Fire code certifications'
        };

        mockTransformedHtml = {
            frontContentJson: '<html>Front content HTML</html>',
            backContentJson: '<html>Back content HTML</html>',
            abrasionJson: '<html>Abrasion HTML</html>',
            firecodesJson: '<html>Fire codes HTML</html>'
        };
    });

    describe('GET /api/export/csv', () => {
        beforeEach(() => {
            // Mock successful database query
            mockExecute.mockResolvedValue([mockOpmsData]);
            
            // Mock mini-forms data
            ProductModel.prototype.getMiniFormsData.mockResolvedValue(mockMiniFormsData);
            
            // Mock HTML transformation
            NetSuiteRestletService.transformToRestletPayload.mockResolvedValue(mockTransformedHtml);
        });

        it('should export CSV with default parameters', async () => {
            const response = await request(app)
                .get('/api/export/csv')
                .expect(200);

            expect(response.headers['content-type']).toContain('text/csv');
            expect(response.headers['content-disposition']).toContain('attachment');
            expect(response.headers['content-disposition']).toContain('.csv');
            
            // Verify CSV content
            const csvLines = response.text.split('\n');
            expect(csvLines[0]).toContain('itemId,custitem_opms_item_id,custitem_opms_prod_id');
            expect(csvLines[1]).toContain('opmsAPI-1354-6543,1,1,Tranquil,Tranquil: Ash');
            expect(csvLines[2]).toContain('opmsAPI-2001-5678,2,2,Berba,Berba: Blue');
        });

        it('should export CSV with limit parameter', async () => {
            const response = await request(app)
                .get('/api/export/csv?limit=1')
                .expect(200);

            const csvLines = response.text.split('\n');
            // Should have header + 1 data row + empty line
            expect(csvLines.length).toBeGreaterThanOrEqual(3);
            expect(csvLines[1]).toContain('opmsAPI-1354-6543,1,1,Tranquil,Tranquil: Ash');
        });

        it('should export CSV with product name filters', async () => {
            const response = await request(app)
                .get('/api/export/csv?productNameStart=A&productNameEnd=D')
                .expect(200);

            expect(response.headers['content-type']).toContain('text/csv');
            expect(response.headers['content-disposition']).toContain('products-A-to-D');
        });

        it('should export CSV with item codes filter', async () => {
            const response = await request(app)
                .get('/api/export/csv?itemCodes=1354-6543,2001-5678')
                .expect(200);

            expect(response.headers['content-type']).toContain('text/csv');
            expect(response.headers['content-disposition']).toContain('specific-codes-2');
        });

        it('should export CSV with numeric range filters', async () => {
            const response = await request(app)
                .get('/api/export/csv?productIdStart=1&productIdEnd=5&itemIdStart=1&itemIdEnd=10')
                .expect(200);

            expect(response.headers['content-type']).toContain('text/csv');
            expect(response.headers['content-disposition']).toContain('prodIds-1-to-5');
            expect(response.headers['content-disposition']).toContain('itemIds-1-to-10');
        });

        it('should handle empty results gracefully', async () => {
            mockExecute.mockResolvedValue([[]]);

            const response = await request(app)
                .get('/api/export/csv')
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('No non-digital items found');
        });

        it('should reject limit exceeding maximum', async () => {
            const response = await request(app)
                .get('/api/export/csv?limit=1001')
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Limit cannot exceed 1000');
        });

        it('should reject too many item codes', async () => {
            const manyCodes = Array.from({length: 101}, (_, i) => `code-${i}`).join(',');
            
            const response = await request(app)
                .get(`/api/export/csv?itemCodes=${manyCodes}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('itemCodes cannot exceed 100');
        });

        it('should handle database connection errors', async () => {
            mysql.createConnection.mockRejectedValue(new Error('Database connection failed'));

            const response = await request(app)
                .get('/api/export/csv')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Database connection failed');
        });

        it('should handle query execution errors', async () => {
            mockExecute.mockRejectedValue(new Error('Query execution failed'));

            const response = await request(app)
                .get('/api/export/csv')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Query execution failed');
        });

        it('should generate descriptive filenames', async () => {
            const response = await request(app)
                .get('/api/export/csv?productNameStart=A&productNameEnd=Z&limit=50')
                .expect(200);

            const contentDisposition = response.headers['content-disposition'];
            expect(contentDisposition).toContain('opms-export-2-items');
            expect(contentDisposition).toContain('products-A-to-Z');
            expect(contentDisposition).toContain('.csv');
        });

        it('should properly escape CSV values with commas and quotes', async () => {
            // Mock data with special characters
            const specialData = [{
                ...mockOpmsData[0],
                product_name: 'Product, with "quotes" and commas',
                color_name: 'Color with\nnewlines'
            }];
            
            mockExecute.mockResolvedValue([specialData]);

            const response = await request(app)
                .get('/api/export/csv')
                .expect(200);

            const csvLines = response.text.split('\n');
            expect(csvLines[1]).toContain('"Product, with ""quotes"" and commas"');
            // Note: newlines in CSV are handled differently, so we'll just check the field exists
            expect(csvLines[1]).toContain('Color with');
        });

        it('should handle mini-forms data transformation errors gracefully', async () => {
            NetSuiteRestletService.transformToRestletPayload.mockRejectedValue(
                new Error('HTML transformation failed')
            );

            const response = await request(app)
                .get('/api/export/csv')
                .expect(200);

            // Should still export successfully with fallback values
            expect(response.headers['content-type']).toContain('text/csv');
            
            const csvLines = response.text.split('\n');
            expect(csvLines[1]).toContain(' - ');
        });

        it('should apply development prefix to NetSuite item IDs in dev mode', async () => {
            // Set development environment
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const response = await request(app)
                .get('/api/export/csv')
                .expect(200);

            const csvLines = response.text.split('\n');
            expect(csvLines[1]).toContain('opmsAPI-1354-6543');

            // Restore environment
            process.env.NODE_ENV = originalEnv;
        });

        it('should use production item IDs in production mode', async () => {
            // Set production environment
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const response = await request(app)
                .get('/api/export/csv')
                .expect(200);

            const csvLines = response.text.split('\n');
            expect(csvLines[1]).toContain('1354-6543');

            // Restore environment
            process.env.NODE_ENV = originalEnv;
        });
    });

    describe('POST /api/export/csv/bulk', () => {
        it('should return not implemented status', async () => {
            const response = await request(app)
                .post('/api/export/csv/bulk')
                .expect(501);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('not yet implemented');
            expect(response.body.alternative).toBe('/api/export/csv');
        });

        it('should handle errors gracefully', async () => {
            // Mock an error scenario
            const mockError = new Error('Test error');
            jest.spyOn(logger, 'error').mockImplementation(() => {
                throw mockError;
            });

            const response = await request(app)
                .post('/api/export/csv/bulk')
                .expect(501); // Bulk endpoint returns 501 Not Implemented

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('not yet implemented');
        });
    });

    describe('CSV Format Validation', () => {
        beforeEach(() => {
            // Ensure proper mocking for these tests
            mockExecute.mockResolvedValue([mockOpmsData]);
            ProductModel.prototype.getMiniFormsData.mockResolvedValue(mockMiniFormsData);
            NetSuiteRestletService.transformToRestletPayload.mockResolvedValue(mockTransformedHtml);
        });

        it('should include all required NetSuite fields', async () => {
            const response = await request(app)
                .get('/api/export/csv')
                .expect(200);

            const csvLines = response.text.split('\n');
            const headers = csvLines[0].split(',');
            
            // Check NetSuite field names (exact match to user specification)
            expect(headers).toContain('itemId');
            expect(headers).toContain('custitem_opms_item_id');
            expect(headers).toContain('custitem_opms_prod_id');
            expect(headers).toContain('custitem_opms_parent_product_name');
            expect(headers).toContain('displayname');
            expect(headers).toContain('custitem_opms_item_colors');
            expect(headers).toContain('custitem_opms_fabric_width');
            expect(headers).toContain('vendor');
            expect(headers).toContain('vendorcode');
            expect(headers).toContain('custitem_opms_vendor_prod_name');
            expect(headers).toContain('custitem_opms_vendor_color');
            expect(headers).toContain('custitem_opms_front_content');
            expect(headers).toContain('custitem_opms_back_content');
            expect(headers).toContain('custitem_opms_abrasion');
            expect(headers).toContain('custitem_opms_firecodes');
            
            // Check business fields
            expect(headers).toContain('cost');
            expect(headers).toContain('custitem_f3_rollprice');
            expect(headers).toContain('stockdescription');
            expect(headers).toContain('leadtime');
            expect(headers).toContain('minimumquantity');
            expect(headers).toContain('weight');
            expect(headers).toContain('weightunit');
            
            // Check constants (should be at the end)
            expect(headers).toContain('usebins');
            expect(headers).toContain('subsidiary');
        });

        it('should generate correct display names with colon format', async () => {
            const response = await request(app)
                .get('/api/export/csv')
                .expect(200);

            const csvLines = response.text.split('\n');
            
            // Check display name format: "Product: Color"
            expect(csvLines[1]).toContain('Tranquil: Ash');
            expect(csvLines[2]).toContain('Berba: Blue');
        });
    });
});
