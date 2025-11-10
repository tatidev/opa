const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Import existing models
const ProductModel = require('../models/ProductModel');
const NetSuiteRestletService = require('../services/netsuiteRestletService');

/**
 * BulkExportController
 * Handles bulk CSV export with file-based item code filtering
 */
class BulkExportController {
    constructor() {
        this.productModel = new ProductModel();
        
        // Configure multer for secure file uploads
        this.upload = multer({
            storage: multer.memoryStorage(),
            limits: {
                fileSize: 2 * 1024 * 1024, // 2MB max
                files: 1
            },
            fileFilter: this.fileFilter.bind(this)
        });
    }

    /**
     * File filter for security
     */
    fileFilter(req, file, cb) {
        // Only allow plain text files
        if (file.mimetype === 'text/plain' || file.mimetype === 'text/csv' || file.originalname.endsWith('.txt')) {
            cb(null, true);
        } else {
            cb(new Error('Only text files (.txt, .csv) are allowed'));
        }
    }

    /**
     * Bulk CSV export endpoint
     * POST /api/export/csv/bulk
     */
    async bulkCsvExport(req, res) {
        try {
            logger.info('Starting bulk CSV export with file upload');

            // Validate file upload
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No item codes file provided. Please upload a .txt or .csv file.'
                });
            }

            // Parse item codes from uploaded file
            const fileContent = req.file.buffer.toString('utf8');
            const itemCodes = this.parseItemCodes(fileContent);

            if (itemCodes.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No valid item codes found in uploaded file'
                });
            }

            if (itemCodes.length > 8000) {
                return res.status(400).json({
                    success: false,
                    error: `Too many item codes: ${itemCodes.length}. Maximum allowed is 8000.`
                });
            }

            logger.info(`Processing bulk export for ${itemCodes.length} item codes`);

            // Use enhanced export query with chunked processing
            const processedItems = await this.processBulkExport(itemCodes);

            if (processedItems.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'No items found with valid vendor mappings for the provided codes'
                });
            }

            // Generate CSV content
            const csvContent = this.generateCsvContent(processedItems);
            
            // Generate descriptive filename
            const timestamp = Date.now();
            const filename = `bulk-export-${processedItems.length}-items-${timestamp}.csv`;

            // Set response headers for file download
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            logger.info(`Bulk CSV export completed: ${processedItems.length} items from ${itemCodes.length} codes`);
            res.send(csvContent);

        } catch (error) {
            logger.error('Bulk CSV export failed:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Parse item codes from file content
     */
    parseItemCodes(fileContent) {
        try {
            // Handle various formats: comma-separated, line-separated, or mixed
            const codes = fileContent
                .split(/[,\n\r\t\s]+/)
                .map(code => code.trim())
                .filter(code => code && code.length > 0 && code.length <= 50)
                .filter(code => /^[a-zA-Z0-9\-_\.]+$/.test(code)) // Alphanumeric + common separators only
                .slice(0, 8000); // Hard limit

            // Remove duplicates
            return [...new Set(codes)];
        } catch (error) {
            logger.error('Failed to parse item codes:', error);
            throw new Error('Invalid file format. Please provide item codes separated by commas, spaces, or line breaks.');
        }
    }

    /**
     * Process bulk export with chunked queries for performance
     */
    async processBulkExport(itemCodes) {
        const CHUNK_SIZE = 500;
        const processedItems = [];

        // Process codes in chunks to prevent database overload
        for (let i = 0; i < itemCodes.length; i += CHUNK_SIZE) {
            const chunk = itemCodes.slice(i, i + CHUNK_SIZE);
            logger.debug(`Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(itemCodes.length / CHUNK_SIZE)}: ${chunk.length} codes`);

            const chunkItems = await this.processItemChunk(chunk);
            processedItems.push(...chunkItems);
        }

        return processedItems;
    }

    /**
     * Process a chunk of item codes (based on existing export logic)
     */
    async processItemChunk(itemCodes) {
        // This uses the proven export query pattern from export.js
        // Enhanced with chunked processing for large datasets
        
        // Escape codes for SQL safety
        const escapedCodes = itemCodes.map(code => `'${code.replace(/'/g, "''")}'`).join(',');
        
        const query = `
            SELECT DISTINCT
                i.id as item_id,
                i.code as item_code,
                i.vendor_code,
                i.vendor_color,
                p.id as product_id,
                p.name as product_name,
                p.width,
                v.id as vendor_id,
                v.name as vendor_name,
                m.netsuite_vendor_id,
                m.netsuite_vendor_name,
                pvar.vendor_product_name,
                GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') as color_name
            FROM T_ITEM i
            JOIN T_PRODUCT p ON i.product_id = p.id
            JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
            JOIN Z_VENDOR v ON pv.vendor_id = v.id
            JOIN opms_netsuite_vendor_mapping m ON v.id = m.opms_vendor_id
            LEFT JOIN T_PRODUCT_VARIOUS pvar ON p.id = pvar.product_id
            LEFT JOIN T_ITEM_COLOR ic ON i.id = ic.item_id
            LEFT JOIN P_COLOR c ON ic.color_id = c.id
            WHERE i.code IN (${escapedCodes})
              AND i.code IS NOT NULL
              AND p.name IS NOT NULL
              AND v.name IS NOT NULL
              AND i.archived = 'N'
              AND p.archived = 'N'
              AND v.active = 'Y'
              AND v.archived = 'N'
              AND m.opms_vendor_name = m.netsuite_vendor_name
            GROUP BY i.id, i.code, i.vendor_code, i.vendor_color, p.id, p.name, p.width, v.id, v.name, m.netsuite_vendor_id, m.netsuite_vendor_name, pvar.vendor_product_name
            HAVING color_name IS NOT NULL
            ORDER BY p.name ASC, i.code ASC
        `;

        const [rows] = await this.productModel.db.query(query);
        
        // Process each item with mini-forms data (using existing processOpmsItems logic)
        const processedItems = [];
        
        for (const item of rows) {
            // Get mini-forms data
            const miniFormsData = await this.productModel.getMiniFormsData(item.product_id);
            
            // Transform with NetSuite service (existing pattern)
            let htmlData = {
                frontContentJson: 'src empty data',
                backContentJson: 'src empty data',
                abrasionJson: 'src empty data',
                firecodesJson: 'src empty data'
            };

            try {
                const transformedPayload = await NetSuiteRestletService.transformToRestletPayload({
                    frontContent: miniFormsData.frontContent,
                    backContent: miniFormsData.backContent,
                    abrasion: miniFormsData.abrasion,
                    firecodes: miniFormsData.firecodes
                });

                htmlData = {
                    frontContentJson: transformedPayload.frontContentJson || 'src empty data',
                    backContentJson: transformedPayload.backContentJson || 'src empty data',
                    abrasionJson: transformedPayload.abrasionJson || 'src empty data',
                    firecodesJson: transformedPayload.firecodesJson || 'src empty data'
                };
            } catch (error) {
                logger.error(`Error generating mini-forms HTML for item ${item.item_code}:`, error.message);
            }

            // Create NetSuite itemId with development prefix
            const netsuiteItemId = this.generateNetSuiteItemId(item.item_code);

            // Create processed item with NetSuite-ready format
            processedItems.push({
                // OPMS Source Data
                opms_item_id: item.item_id,
                opms_product_id: item.product_id,
                opms_item_code: item.item_code,
                opms_product_name: item.product_name,
                opms_color_name: item.color_name,
                opms_width: item.width,
                opms_vendor_id: item.vendor_id,
                opms_vendor_name: item.vendor_name,
                opms_vendor_code: item.vendor_code,
                opms_vendor_color: item.vendor_color,
                opms_vendor_product_name: item.vendor_product_name,

                // NetSuite Payload Fields
                ns_itemId: netsuiteItemId,
                ns_displayname: `${item.product_name}: ${item.color_name}`,
                ns_custitem_opms_fabric_width: item.width || 'src empty data',
                ns_vendor: item.netsuite_vendor_id,
                ns_vendorname: item.vendor_name || 'src empty data',
                ns_vendorcode: item.vendor_code || 'src empty data',
                ns_custitem_opms_vendor_color: item.vendor_color || 'src empty data',
                ns_custitem_opms_vendor_prod_name: item.vendor_product_name || 'src empty data',
                ns_custitem_opms_item_colors: item.color_name || 'src empty data',
                ns_custitem_opms_parent_product_name: item.product_name || 'src empty data',
                ns_custitem_opms_product_id: item.product_id,
                ns_custitem_opms_item_id: item.item_id,
                ns_frontContentJson: htmlData.frontContentJson,
                ns_backContentJson: htmlData.backContentJson,
                ns_abrasionJson: htmlData.abrasionJson,
                ns_firecodesJson: htmlData.firecodesJson
            });
        }

        return processedItems;
    }

    /**
     * Generate CSV content from processed items
     */
    generateCsvContent(processedItems) {
        // CSV headers (matching existing export format)
        const csvHeaders = [
            // OPMS Source Data
            'opms_item_id', 'opms_product_id', 'opms_item_code', 'opms_product_name', 'opms_color_name',
            'opms_width', 'opms_vendor_id', 'opms_vendor_name', 'opms_vendor_code', 'opms_vendor_color', 'opms_vendor_product_name',
            
            // NetSuite Payload Fields
            'ns_itemId', 'ns_displayname', 'ns_custitem_opms_fabric_width', 
            'ns_vendor', 'ns_vendorname', 'ns_vendorcode',
            'ns_custitem_opms_vendor_color', 'ns_custitem_opms_vendor_prod_name', 'ns_custitem_opms_item_colors',
            'ns_custitem_opms_parent_product_name', 'ns_custitem_opms_product_id', 'ns_custitem_opms_item_id',
            'ns_frontContentJson', 'ns_backContentJson', 'ns_abrasionJson', 'ns_firecodesJson'
        ];

        let csvContent = csvHeaders.join(',') + '\n';
        
        for (const item of processedItems) {
            const csvRow = csvHeaders.map(header => {
                const value = item[header];
                if (value === null || value === undefined) {
                    return '';
                }
                const stringValue = String(value);
                // Escape commas and quotes in CSV values
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            }).join(',');
            csvContent += csvRow + '\n';
        }

        return csvContent;
    }

    /**
     * Generate NetSuite itemId with development prefix when testing
     */
    generateNetSuiteItemId(opmsItemCode) {
        // Check if we're in development/testing mode
        const isDevelopment = process.env.NODE_ENV !== 'production';
        const isTestPrefix = process.env.NETSUITE_TEST_PREFIX === 'true';
        
        // Add opmsAPI prefix for development or when test prefix is enabled
        if (isDevelopment || isTestPrefix) {
            return `opmsAPI-${opmsItemCode}`;
        }
        
        // Production: use OPMS code directly
        return opmsItemCode;
    }
}

module.exports = BulkExportController;
