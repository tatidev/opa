const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const ProductModel = require('../models/ProductModel');
const NetSuiteRestletService = require('../services/netsuiteRestletService');
const logger = require('../utils/logger');
const { strictLimiter } = require('../middleware/rateLimiter');

// SECURITY: Apply strict rate limiting to all export routes (100 req/15min)
router.use(strictLimiter);

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'opuzen_api_master_app',
    port: process.env.DB_PORT || 3306
};

/**
 * OPMS Field Validation Function (from v1.4.2 spec)
 */
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

/**
 * Get NetSuite Value (from v1.4.2 spec)
 */
const getNetSuiteValue = (fieldData, validationStatus, fieldName, itemId) => {
    if (validationStatus === 'src_empty_data') {
        return ' - ';
    } else if (validationStatus === 'query_failed') {
        logger.debug(`OPMS field '${fieldName}' query failed for item ${itemId} - returning ' - '`);
        return ' - ';
    } else {
        return fieldData;
    }
};

/**
 * Core export query (v1.4.2 spec - excluding digital items)
 * Enhanced with comprehensive filtering capabilities
 */
const getExportQuery = (filters = {}) => {
    const {
        limit = 100,
        productNameStart,
        productNameEnd,
        dateStart,
        dateEnd,
        productIdStart,
        productIdEnd,
        itemIdStart,
        itemIdEnd,
        itemCodeStart,
        itemCodeEnd,
        itemCodes,
        onlyValidCodes = true  // NEW: Filter for valid ####-####<alpha> format by default
    } = filters;

    let whereConditions = [
        'i.code IS NOT NULL',
        'p.name IS NOT NULL',
        'v.name IS NOT NULL',
        "i.archived = 'N'",
        "p.archived = 'N'",
        "v.active = 'Y'",
        "v.archived = 'N'",
        'm.opms_vendor_name = m.netsuite_vendor_name',  // Only accurate vendor mappings
        "(i.code NOT LIKE 'Digital%' AND i.code != 'D' AND i.code != '')"  // Exclude digital items
    ];

    // NEW: Filter for valid item code format (####-####<alpha>)
    if (onlyValidCodes) {
        // MySQL REGEXP for ####-####<optional letter> format
        whereConditions.push("i.code REGEXP '^[0-9]{4}-[0-9]{4}[A-Za-z]?$'");
    }

    // Product name alphanumeric range filter
    if (productNameStart && productNameEnd) {
        whereConditions.push(`p.name >= '${productNameStart}' AND p.name <= '${productNameEnd}'`);
    } else if (productNameStart) {
        whereConditions.push(`p.name >= '${productNameStart}'`);
    } else if (productNameEnd) {
        whereConditions.push(`p.name <= '${productNameEnd}'`);
    }

    // Date range filter - TODO: Add when timestamp column is available
    // Currently disabled until proper date column is identified
    // if (dateStart && dateEnd) {
    //     whereConditions.push(`DATE(i.timestamp) >= '${dateStart}' AND DATE(i.timestamp) <= '${dateEnd}'`);
    // } else if (dateStart) {
    //     whereConditions.push(`DATE(i.timestamp) >= '${dateStart}'`);
    // } else if (dateEnd) {
    //     whereConditions.push(`DATE(i.timestamp) <= '${dateEnd}'`);
    // }

    // Product ID numeric range filter
    if (productIdStart && productIdEnd) {
        whereConditions.push(`p.id >= ${productIdStart} AND p.id <= ${productIdEnd}`);
    } else if (productIdStart) {
        whereConditions.push(`p.id >= ${productIdStart}`);
    } else if (productIdEnd) {
        whereConditions.push(`p.id <= ${productIdEnd}`);
    }

    // Item ID numeric range filter
    if (itemIdStart && itemIdEnd) {
        whereConditions.push(`i.id >= ${itemIdStart} AND i.id <= ${itemIdEnd}`);
    } else if (itemIdStart) {
        whereConditions.push(`i.id >= ${itemIdStart}`);
    } else if (itemIdEnd) {
        whereConditions.push(`i.id <= ${itemIdEnd}`);
    }

    // Item code (T_ITEM.code) alphanumeric range filter
    if (itemCodeStart && itemCodeEnd) {
        whereConditions.push(`i.code >= '${itemCodeStart}' AND i.code <= '${itemCodeEnd}'`);
    } else if (itemCodeStart) {
        whereConditions.push(`i.code >= '${itemCodeStart}'`);
    } else if (itemCodeEnd) {
        whereConditions.push(`i.code <= '${itemCodeEnd}'`);
    }

    // Item codes IN filter - T_ITEM.code in specific set
    if (itemCodes && Array.isArray(itemCodes) && itemCodes.length > 0) {
        // Sanitize item codes to prevent SQL injection
        const sanitizedCodes = itemCodes
            .filter(code => code && typeof code === 'string')
            .map(code => code.trim())
            .filter(code => code.length > 0 && code.length <= 50) // Reasonable length limit
            .slice(0, 100); // Limit to 100 codes max
        
        if (sanitizedCodes.length > 0) {
            // For now, use safe string interpolation until full parameterization is implemented
            const escapedCodes = sanitizedCodes.map(code => `'${code.replace(/'/g, "''")}'`).join(',');
            whereConditions.push(`i.code IN (${escapedCodes})`);
        }
    }

    return `
        SELECT DISTINCT
            i.id as item_id,
            i.code as item_code,
            i.vendor_code,                    -- T_ITEM.vendor_code
            i.vendor_color,                   -- T_ITEM.vendor_color
            p.id as product_id,
            p.name as product_name,
            p.width,
            p.vrepeat,
            p.hrepeat,
            p.outdoor,
            v.id as vendor_id,
            v.name as vendor_name,
            m.netsuite_vendor_id,
            m.netsuite_vendor_name,
            pvar.vendor_product_name,         -- T_PRODUCT_VARIOUS.vendor_product_name
            pvar.lead_time,                   -- PRODUCTION LEAD-TIME
            pvar.weight_n,                    -- Weight
            pvar.weight_unit_id,              -- Weight Unit ID
            pvar.prop_65,                     -- Prop 65 Compliance
            pvar.ab_2998_compliant,           -- AB 2998 Compliance
            pvar.tariff_code,                 -- Tariff/Harmonized Code
            i.min_order_qty,                  -- M.O.Q. (item-specific)
            ppc.cost_cut,                     -- PURCHASE CUT PRICE
            ppc.cost_roll,                    -- PURCHASE ROLL PRICE
            ss.name as stock_status_name,     -- STOCK STATUS name
            ss.descr as stock_status_descr,   -- STOCK STATUS description
            GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') as color_name
        FROM T_ITEM i
        JOIN T_PRODUCT p ON i.product_id = p.id
        JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
        JOIN Z_VENDOR v ON pv.vendor_id = v.id
        JOIN opms_netsuite_vendor_mapping m ON v.id = m.opms_vendor_id
        LEFT JOIN T_PRODUCT_VARIOUS pvar ON p.id = pvar.product_id
        LEFT JOIN T_PRODUCT_PRICE_COST ppc ON ppc.product_id = p.id
        LEFT JOIN P_STOCK_STATUS ss ON ss.id = i.stock_status_id
        LEFT JOIN T_ITEM_COLOR ic ON i.id = ic.item_id
        LEFT JOIN P_COLOR c ON ic.color_id = c.id
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY i.id, i.code, i.vendor_code, i.vendor_color, i.min_order_qty, p.id, p.name, p.width, p.vrepeat, p.hrepeat, p.outdoor, v.id, v.name, m.netsuite_vendor_id, m.netsuite_vendor_name, pvar.vendor_product_name, pvar.lead_time, pvar.weight_n, pvar.weight_unit_id, pvar.prop_65, pvar.ab_2998_compliant, pvar.tariff_code, ppc.cost_cut, ppc.cost_roll, ss.name, ss.descr
        HAVING color_name IS NOT NULL
        ORDER BY p.name ASC, i.code ASC
        LIMIT ${limit}
    `;
};

/**
 * Process OPMS items with complete field validation and mini-forms
 */
const processOpmsItems = async (rows) => {
    const productModel = new ProductModel();
    const processedItems = [];

    for (let i = 0; i < rows.length; i++) {
        const item = rows[i];
        logger.info(`Processing item ${i + 1}/${rows.length}: ${item.item_code} (${item.product_name})`);

        // Basic field validation
        const productNameStatus = validateOpmsField('product_name', item.product_name);
        const colorNameStatus = validateOpmsField('color_name', item.color_name);
        const widthStatus = validateOpmsField('width', item.width);
        const vendorNameStatus = validateOpmsField('vendor_name', item.vendor_name);
        const vendorCodeStatus = validateOpmsField('vendor_code', item.vendor_code);
        const vendorColorStatus = validateOpmsField('vendor_color', item.vendor_color);
        const vendorProductNameStatus = validateOpmsField('vendor_product_name', item.vendor_product_name);
        
        // NEW: Validate pricing and status fields
        const leadTimeStatus = validateOpmsField('lead_time', item.lead_time);
        const costCutStatus = validateOpmsField('cost_cut', item.cost_cut);
        const costRollStatus = validateOpmsField('cost_roll', item.cost_roll);
        const stockStatusNameStatus = validateOpmsField('stock_status_name', item.stock_status_name);
        const stockStatusDescrStatus = validateOpmsField('stock_status_descr', item.stock_status_descr);
        
        // NEW: Validate M.O.Q. and weight fields
        const minOrderQtyStatus = validateOpmsField('min_order_qty', item.min_order_qty);
        const weightStatus = validateOpmsField('weight_n', item.weight_n);
        const weightUnitIdStatus = validateOpmsField('weight_unit_id', item.weight_unit_id);

        // Get mini-forms data
        const miniFormsData = await productModel.getMiniFormsData(item.product_id);

        // Validate mini-forms fields
        const frontStatus = validateOpmsField('frontContent', miniFormsData.frontContent);
        const backStatus = validateOpmsField('backContent', miniFormsData.backContent);
        const abrasionStatus = validateOpmsField('abrasion', miniFormsData.abrasion);
        const firecodesStatus = validateOpmsField('firecodes', miniFormsData.firecodes);

        // Process mini-forms data (blank/null/empty become " - ")
        const preparedMiniFormsData = {
            frontContent: frontStatus === 'src_empty_data' ? ' - ' : miniFormsData.frontContent,
            backContent: backStatus === 'src_empty_data' ? ' - ' : miniFormsData.backContent,
            abrasion: abrasionStatus === 'src_empty_data' ? ' - ' : miniFormsData.abrasion,
            firecodes: firecodesStatus === 'src_empty_data' ? ' - ' : miniFormsData.firecodes
        };

        // Transform to HTML via NetSuite service
        let htmlData = {
            frontContentJson: ' - ',
            backContentJson: ' - ',
            abrasionJson: ' - ',
            firecodesJson: ' - '
        };

        try {
            const transformedPayload = await NetSuiteRestletService.transformToRestletPayload({
                frontContent: preparedMiniFormsData.frontContent,
                backContent: preparedMiniFormsData.backContent,
                abrasion: preparedMiniFormsData.abrasion,
                firecodes: preparedMiniFormsData.firecodes
            });

            htmlData = {
                frontContentJson: transformedPayload.frontContentJson || ' - ',
                backContentJson: transformedPayload.backContentJson || ' - ',
                abrasionJson: transformedPayload.abrasionJson || ' - ',
                firecodesJson: transformedPayload.firecodesJson || ' - '
            };
        } catch (error) {
            logger.error(`Error generating mini-forms HTML: ${error.message}`);
        }

        // NetSuite values with " - " handling for empty fields
        const nsProductName = getNetSuiteValue(item.product_name, productNameStatus, 'product_name', item.item_id);
        const nsColorName = getNetSuiteValue(item.color_name, colorNameStatus, 'color_name', item.item_id);
        const nsWidth = getNetSuiteValue(item.width, widthStatus, 'width', item.item_id);
        const nsVendorName = getNetSuiteValue(item.vendor_name, vendorNameStatus, 'vendor_name', item.item_id);
        const nsVendorCode = getNetSuiteValue(item.vendor_code, vendorCodeStatus, 'vendor_code', item.item_id);
        const nsVendorColor = getNetSuiteValue(item.vendor_color, vendorColorStatus, 'vendor_color', item.item_id);
        const nsVendorProductName = getNetSuiteValue(item.vendor_product_name, vendorProductNameStatus, 'vendor_product_name', item.item_id);
        
        // NEW: NetSuite values for pricing and status fields
        const nsLeadTime = getNetSuiteValue(item.lead_time, leadTimeStatus, 'lead_time', item.item_id);
        const nsCostCut = getNetSuiteValue(item.cost_cut, costCutStatus, 'cost_cut', item.item_id);
        const nsCostRoll = getNetSuiteValue(item.cost_roll, costRollStatus, 'cost_roll', item.item_id);
        const nsStockStatusName = getNetSuiteValue(item.stock_status_name, stockStatusNameStatus, 'stock_status_name', item.item_id);
        const nsStockStatusDescr = getNetSuiteValue(item.stock_status_descr, stockStatusDescrStatus, 'stock_status_descr', item.item_id);
        
        // NEW: NetSuite values for M.O.Q. and weight fields
        const nsMinOrderQty = getNetSuiteValue(item.min_order_qty, minOrderQtyStatus, 'min_order_qty', item.item_id);
        const nsWeight = getNetSuiteValue(item.weight_n, weightStatus, 'weight_n', item.item_id);
        const nsWeightUnitId = getNetSuiteValue(item.weight_unit_id, weightUnitIdStatus, 'weight_unit_id', item.item_id);

        // Display name with correct colon format
        const displayName = `${nsProductName}: ${nsColorName}`;

        // Create NetSuite itemId with development prefix
        const netsuiteItemId = generateNetSuiteItemId(item.item_code);

        // Add processed item data using EXACT field names from user specification
        processedItems.push({
            itemId: netsuiteItemId,
            custitem_opms_item_id: item.item_id,
            custitem_opms_prod_id: item.product_id,
            custitem_opms_parent_product_name: nsProductName,
            displayname: displayName,
            custitem_opms_item_colors: nsColorName,
            custitem_opms_fabric_width: nsWidth,
            custitem_vertical_repeat: getNetSuiteValue(item.vrepeat, validateOpmsField('vrepeat', item.vrepeat), 'vrepeat', item.item_id),
            custitem_horizontal_repeat: getNetSuiteValue(item.hrepeat, validateOpmsField('hrepeat', item.hrepeat), 'hrepeat', item.item_id),
            vendor: item.netsuite_vendor_id,
            vendorcode: nsVendorCode,
            custitem_opms_vendor_prod_name: nsVendorProductName,
            custitem_opms_vendor_color: nsVendorColor,
            custitem_opms_is_repeat: getNetSuiteValue(item.outdoor, validateOpmsField('outdoor', item.outdoor), 'outdoor', item.item_id),
            custitem_opms_front_content: htmlData.frontContentJson,
            custitem_opms_back_content: htmlData.backContentJson,
            custitem_opms_abrasion: htmlData.abrasionJson,
            custitem_opms_firecodes: htmlData.firecodesJson,
            custitem_prop65_compliance: getNetSuiteValue(item.prop_65, validateOpmsField('prop_65', item.prop_65), 'prop_65', item.item_id),
            custitem_ab2998_compliance: getNetSuiteValue(item.ab_2998_compliant, validateOpmsField('ab_2998_compliant', item.ab_2998_compliant), 'ab_2998_compliant', item.item_id),
            custitem_opms_finish: ' - ', // Need to implement
            custitem_opms_fabric_cleaning: ' - ', // Need to implement
            custitem_opms_product_origin: ' - ', // Need to implement
            custitem_tariff_harmonized_code: getNetSuiteValue(item.tariff_code, validateOpmsField('tariff_code', item.tariff_code), 'tariff_code', item.item_id),
            custitem_item_application: ' - ', // Need to implement
            custitemf3_lisa_item: ' - ', // Need clarification
            price_1_: ' - ', // Need to map from pricing
            cost: nsCostCut,
            custitem_f3_rollprice: nsCostRoll,
            usebins: true,
            matchbilltoreceipt: true,
            custitem_aln_1_auto_numbered: true,
            taxschedule: 1,
            custitem_aln_2_number_format: true,
            unitstype: 1,
            custitem_aln_3_initial_sequence: 1,
            subsidiary: 2,
            stockdescription: nsStockStatusDescr,
            leadtime: nsLeadTime,
            minimumquantity: nsMinOrderQty,
            weight: nsWeight,
            weightunit: nsWeightUnitId
        });
    }

    return processedItems;
};

/**
 * Generate NetSuite itemId with development prefix when testing
 */
const generateNetSuiteItemId = (opmsItemCode) => {
    // Check if we're in development/testing mode
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const isTestPrefix = process.env.NETSUITE_TEST_PREFIX === 'true';
    
    // Add opmsAPI prefix for development or when test prefix is enabled
    if (isDevelopment || isTestPrefix) {
        return `opmsAPI-${opmsItemCode}`;
    }
    
    // Production: use OPMS code directly
    return opmsItemCode;
};

/**
 * @swagger
 * /api/export/csv:
 *   get:
 *     summary: Export OPMS items to CSV for NetSuite import
 *     description: Export OPMS inventory items to CSV format with comprehensive filtering options. The CSV includes all required NetSuite fields and mini-forms HTML data. By default, only exports items with valid ####-####<alpha> format codes.
 *     tags: [Export]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           maximum: 1000
 *         description: Maximum number of items to export
 *       - in: query
 *         name: productNameStart
 *         schema:
 *           type: string
 *         description: Start of product name range filter (alphanumeric)
 *       - in: query
 *         name: productNameEnd
 *         schema:
 *           type: string
 *         description: End of product name range filter (alphanumeric)
 *       - in: query
 *         name: productIdStart
 *         schema:
 *           type: integer
 *         description: Start of product ID range filter
 *       - in: query
 *         name: productIdEnd
 *         schema:
 *           type: integer
 *         description: End of product ID range filter
 *       - in: query
 *         name: itemIdStart
 *         schema:
 *           type: integer
 *         description: Start of item ID range filter
 *       - in: query
 *         name: itemIdEnd
 *         schema:
 *           type: integer
 *         description: End of item ID range filter
 *       - in: query
 *         name: itemCodeStart
 *         schema:
 *           type: string
 *         description: Start of item code range filter (alphanumeric)
 *       - in: query
 *         name: itemCodeEnd
 *         schema:
 *           type: string
 *         description: End of item code range filter (alphanumeric)
 *       - in: query
 *         name: itemCodes
 *         schema:
 *           type: string
 *         description: Specific item codes (comma-separated, max 100)
 *       - in: query
 *         name: dateStart
 *         schema:
 *           type: string
 *           format: date
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: Start date filter (YYYY-MM-DD format, currently disabled)
 *       - in: query
 *         name: dateEnd
 *         schema:
 *           type: string
 *           format: date
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: End date filter (YYYY-MM-DD format, currently disabled)
 *       - in: query
 *         name: onlyValidCodes
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Only export items with valid ####-####<alpha> format codes (default: true)
 *     responses:
 *       200:
 *         description: CSV export successful
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *             example: |
 *               opms_item_id,opms_product_id,opms_item_code,opms_product_name,opms_color_name,opms_width,opms_vendor_id,opms_vendor_name,opms_vendor_code,opms_vendor_color,opms_vendor_product_name,ns_itemId,ns_displayname,ns_custitem_opms_fabric_width,ns_vendor,ns_vendorname,ns_vendorcode,ns_custitem_opms_vendor_color,ns_custitem_opms_vendor_prod_name,ns_custitem_opms_item_colors,ns_custitem_opms_parent_product_name,ns_custitem_opms_product_id,ns_custitem_opms_item_id,ns_frontContentJson,ns_backContentJson,ns_abrasionJson,ns_firecodesJson
 *               1,1,1354-6543,Tranquil,Ash,54.00,1,TextileCorp,TC-ASH-001,ASH-001,Tranquil Ash Fabric,opmsAPI-1354-6543,Tranquil: Ash,54.00,1,TextileCorp,TC-ASH-001,ASH-001,Tranquil Ash Fabric,Ash,Tranquil,1,1,<html>...</html>,<html>...</html>,<html>...</html>,<html>...</html>
 *         headers:
 *           Content-Disposition:
 *             description: CSV file download
 *             schema:
 *               type: string
 *               example: 'attachment; filename="opms-export-100-items-1755476700546.csv"'
 *       400:
 *         description: Bad request - invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: No items found matching criteria
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/csv', async (req, res) => {
    let connection;
    
    try {
        // Parse and validate parameters
        const limit = parseInt(req.query.limit) || 100;
        if (limit > 1000) {
            return res.status(400).json({
                success: false,
                error: 'Limit cannot exceed 1000 items'
            });
        }

        // Parse filter parameters
        const filters = {
            limit,
            productNameStart: req.query.productNameStart,
            productNameEnd: req.query.productNameEnd,
            dateStart: req.query.dateStart,  // Format: YYYY-MM-DD
            dateEnd: req.query.dateEnd,      // Format: YYYY-MM-DD
            productIdStart: req.query.productIdStart ? parseInt(req.query.productIdStart) : null,
            productIdEnd: req.query.productIdEnd ? parseInt(req.query.productIdEnd) : null,
            itemIdStart: req.query.itemIdStart ? parseInt(req.query.itemIdStart) : null,
            itemIdEnd: req.query.itemIdEnd ? parseInt(req.query.itemIdEnd) : null,
            itemCodeStart: req.query.itemCodeStart,
            itemCodeEnd: req.query.itemCodeEnd,
            itemCodes: req.query.itemCodes,
            onlyValidCodes: req.query.onlyValidCodes !== 'false'  // Default to true, set to false only if explicitly requested
        };

        // Validate date format if provided
        if (filters.dateStart && !/^\d{4}-\d{2}-\d{2}$/.test(filters.dateStart)) {
            return res.status(400).json({
                success: false,
                error: 'dateStart must be in YYYY-MM-DD format'
            });
        }
        if (filters.dateEnd && !/^\d{4}-\d{2}-\d{2}$/.test(filters.dateEnd)) {
            return res.status(400).json({
                success: false,
                error: 'dateEnd must be in YYYY-MM-DD format'
            });
        }

        // Parse itemCodes parameter (can be array or comma-separated string)
        if (filters.itemCodes) {
            if (typeof filters.itemCodes === 'string') {
                // Handle comma-separated string: "code1,code2,code3"
                filters.itemCodes = filters.itemCodes.split(',').map(code => code.trim()).filter(code => code);
            } else if (!Array.isArray(filters.itemCodes)) {
                return res.status(400).json({
                    success: false,
                    error: 'itemCodes must be an array or comma-separated string'
                });
            }
            
            // Validate itemCodes array
            if (filters.itemCodes.length > 100) {
                return res.status(400).json({
                    success: false,
                    error: 'itemCodes cannot exceed 100 items'
                });
            }
        }

        logger.info(`Starting CSV export with filters:`, filters);

        // Connect to database
        connection = await mysql.createConnection(dbConfig);
        
        // Execute query with filters
        const sql = getExportQuery(filters);
        const [rows] = await connection.execute(sql);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No non-digital items found with valid vendor mappings'
            });
        }

        // Process items
        const processedItems = await processOpmsItems(rows);

        // Generate CSV headers using EXACT NetSuite field names from user specification
        // Constants moved to the end (farthest right) as requested
        const csvHeaders = [
            'itemId',
            'custitem_opms_item_id',
            'custitem_opms_prod_id',
            'custitem_opms_parent_product_name',
            'displayname',
            'custitem_opms_item_colors',
            'custitem_opms_fabric_width',
            'custitem_vertical_repeat',
            'custitem_horizontal_repeat',
            'vendor',
            'vendorcode',
            'custitem_opms_vendor_prod_name',
            'custitem_opms_vendor_color',
            'custitem_opms_is_repeat',
            'custitem_opms_front_content',
            'custitem_opms_back_content',
            'custitem_opms_abrasion',
            'custitem_opms_firecodes',
            'custitem_prop65_compliance',
            'custitem_ab2998_compliance',
            'custitem_opms_finish',
            'custitem_opms_fabric_cleaning',
            'custitem_opms_product_origin',
            'custitem_tariff_harmonized_code',
            'custitem_item_application',
            'custitemf3_lisa_item',
            'price_1_',
            'cost',
            'custitem_f3_rollprice',
            'stockdescription',
            'leadtime',
            'minimumquantity',
            'weight',
            'weightunit',
            // NetSuite Constants (moved to end as requested)
            'usebins',
            'matchbilltoreceipt',
            'custitem_aln_1_auto_numbered',
            'taxschedule',
            'custitem_aln_2_number_format',
            'unitstype',
            'custitem_aln_3_initial_sequence',
            'subsidiary'
        ];

        // Generate CSV content
        let csvContent = csvHeaders.join(',') + '\n';
        
        for (const item of processedItems) {
            const csvRow = csvHeaders.map(header => {
                const value = item[header];
                if (value === null || value === undefined) {
                    return '';
                }
                const stringValue = String(value);
                // Enhanced CSV escaping for HTML content with quotes, commas, and newlines
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r') || stringValue.includes("'")) {
                    // Escape double quotes and wrap in quotes
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            }).join(',');
            csvContent += csvRow + '\n';
        }

        // Generate descriptive filename based on filters
        const timestamp = Date.now();
        let filenameParts = [`opms-export-${processedItems.length}-items`];
        
        if (filters.productNameStart || filters.productNameEnd) {
            filenameParts.push(`products-${filters.productNameStart || 'start'}-to-${filters.productNameEnd || 'end'}`);
        }
        if (filters.dateStart || filters.dateEnd) {
            filenameParts.push(`dates-${filters.dateStart || 'start'}-to-${filters.dateEnd || 'end'}`);
        }
        if (filters.productIdStart || filters.productIdEnd) {
            filenameParts.push(`prodIds-${filters.productIdStart || 'start'}-to-${filters.productIdEnd || 'end'}`);
        }
        if (filters.itemIdStart || filters.itemIdEnd) {
            filenameParts.push(`itemIds-${filters.itemIdStart || 'start'}-to-${filters.itemIdEnd || 'end'}`);
        }
        if (filters.itemCodeStart || filters.itemCodeEnd) {
            filenameParts.push(`codes-${filters.itemCodeStart || 'start'}-to-${filters.itemCodeEnd || 'end'}`);
        }
        if (filters.itemCodes && filters.itemCodes.length > 0) {
            filenameParts.push(`specific-codes-${filters.itemCodes.length}`);
        }
        
        filenameParts.push(timestamp.toString());
        const filename = filenameParts.join('-') + '.csv';
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        logger.info(`CSV export completed: ${processedItems.length} items exported with filters:`, filters);
        res.send(csvContent);

    } catch (error) {
        logger.error('CSV export failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

/**
 * @swagger
 * /api/export/csv/bulk:
 *   post:
 *     summary: Bulk export OPMS items to CSV for NetSuite import
 *     description: Upload a file with item codes to export up to 8,000 items to CSV format. The CSV includes all required NetSuite fields, mini-forms HTML data, and NetSuite constants.
 *     tags: [Export]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               item_codes_file:
 *                 type: string
 *                 format: binary
 *                 description: Text or CSV file containing item codes (one per line or comma-separated, max 8,000 codes)
 *     responses:
 *       200:
 *         description: Bulk CSV export successful
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *             example: |
 *               opms_item_id,opms_product_id,opms_item_code,opms_product_name,opms_color_name,opms_width,opms_vendor_id,opms_vendor_name,opms_vendor_code,opms_vendor_color,opms_vendor_product_name,ns_itemId,ns_displayname,ns_custitem_opms_fabric_width,ns_vendor,ns_vendorname,ns_vendorcode,ns_custitem_opms_vendor_color,ns_custitem_opms_vendor_prod_name,ns_custitem_opms_item_colors,ns_custitem_opms_parent_product_name,ns_custitem_opms_product_id,ns_custitem_opms_item_id,ns_frontContentJson,ns_backContentJson,ns_abrasionJson,ns_firecodesJson
 *               1,1,1354-6543,Tranquil,Ash,54.00,1,TextileCorp,TC-ASH-001,ASH-001,Tranquil Ash Fabric,opmsAPI-1354-6543,Tranquil: Ash,54.00,1,TextileCorp,TC-ASH-001,ASH-001,Tranquil Ash Fabric,Ash,Tranquil,1,1,<html>...</html>,<html>...</html>,<html>...</html>,<html>...</html>
 *         headers:
 *           Content-Disposition:
 *             description: CSV file download
 *             schema:
 *               type: string
 *               example: 'attachment; filename="bulk-export-8000-items-1755476700546.csv"'
 *       400:
 *         description: Bad request - invalid file or too many item codes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: No items found matching the provided codes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/csv/bulk', async (req, res) => {
    try {
        // For now, this is a placeholder that redirects to the BulkExportController
        // In a full implementation, this would handle file upload and call the controller
        res.status(501).json({
            success: false,
            error: 'Bulk export endpoint not yet implemented. Use the single CSV export endpoint for now.',
            alternative: '/api/export/csv'
        });
    } catch (error) {
        logger.error('Bulk CSV export failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/export/csv/batch:
 *   post:
 *     summary: Batch export large datasets using 1000-item iterations
 *     description: Export large datasets by automatically iterating through the standard export endpoint in 1000-item batches. Combines results into a single CSV file with onlyValidCodes filtering.
 *     tags: [Export]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxItems:
 *                 type: integer
 *                 default: 10000
 *                 maximum: 50000
 *                 description: Maximum total items to export across all batches
 *               filters:
 *                 type: object
 *                 properties:
 *                   productNameStart:
 *                     type: string
 *                     description: Start of product name range
 *                   productNameEnd:
 *                     type: string
 *                     description: End of product name range
 *                   itemIdStart:
 *                     type: integer
 *                     description: Start of item ID range
 *                   itemIdEnd:
 *                     type: integer
 *                     description: End of item ID range
 *                   onlyValidCodes:
 *                     type: boolean
 *                     default: true
 *                     description: Only export items with valid ####-####<alpha> codes
 *               progressCallback:
 *                 type: boolean
 *                 default: false
 *                 description: Enable progress tracking via WebSocket
 *     responses:
 *       200:
 *         description: Batch export completed successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *         headers:
 *           Content-Disposition:
 *             description: CSV file download
 *             schema:
 *               type: string
 *               example: 'attachment; filename="batch-export-8500-items-itemId-1757095554896.csv"'
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Server error
 */
router.post('/csv/batch', async (req, res) => {
    try {
        const BatchExportService = require('../services/batchExportService');
        const batchExportService = new BatchExportService();

        const {
            maxItems = 10000,
            filters = {},
            progressCallback = false
        } = req.body;

        // Validate maxItems limit
        if (maxItems > 50000) {
            return res.status(400).json({
                success: false,
                error: 'maxItems cannot exceed 50,000 items'
            });
        }

        // Set up progress tracking if requested
        let progressHandler = null;
        if (progressCallback) {
            progressHandler = (progress) => {
                logger.info('Batch export progress:', progress);
                // TODO: Implement WebSocket progress updates
            };
        }

        // Execute batch export
        const result = await batchExportService.batchExport({
            baseUrl: `${req.protocol}://${req.get('host')}`,
            filters,
            maxItems,
            progressCallback: progressHandler
        });

        if (!result.success) {
            return res.status(500).json(result);
        }

        // Return CSV file
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        
        logger.info(`Batch export completed: ${result.totalItems} items in ${result.totalBatches} batches`);
        res.send(result.csvContent);

    } catch (error) {
        logger.error('Batch CSV export failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
