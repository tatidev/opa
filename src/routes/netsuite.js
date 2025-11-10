/**
 * NetSuite RESTlet API routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const logger = require('../utils/logger');
const restletService = require('../services/netsuiteRestletService');
const netsuiteClient = require('../services/netsuiteClient');
const ProductModel = require('../models/ProductModel');
const ItemModel = require('../models/ItemModel');
const NetSuiteCsvImportController = require('../controllers/NetSuiteCsvImportController');
const SimpleNetSuiteImportController = require('../controllers/SimpleNetSuiteImportController');
const axios = require('axios');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Initialize NetSuite CSV import controllers
const netSuiteCsvImportController = new NetSuiteCsvImportController();
const simpleNetSuiteImportController = new SimpleNetSuiteImportController();

function buildAuthHeader(method, url) {
  const { 
    NETSUITE_CONSUMER_KEY, 
    NETSUITE_CONSUMER_SECRET, 
    NETSUITE_TOKEN, 
    NETSUITE_TOKEN_SECRET 
  } = process.env;

  const header = `OAuth realm="${process.env.NETSUITE_ACCOUNT_ID}",oauth_consumer_key="${NETSUITE_CONSUMER_KEY}",oauth_token="${NETSUITE_TOKEN}",oauth_signature_method="HMAC-SHA1",oauth_timestamp="${Math.floor(Date.now()/1000)}",oauth_nonce="${Math.random().toString(36).substring(2)}",oauth_version="1.0",oauth_signature="${NETSUITE_CONSUMER_SECRET}&${NETSUITE_TOKEN_SECRET}"`;

  return header;
}

/**
 * @swagger
 * /api/netsuite/metadata:
 *   get:
 *     summary: Get NetSuite metadata catalog
 *     description: Retrieve the complete NetSuite metadata catalog showing all available record types
 *     tags: [NetSuite]
 *     responses:
 *       200:
 *         description: NetSuite metadata catalog
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resources:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       type:
 *                         type: string
 *       500:
 *         description: Server error
 */
router.get('/metadata', async (req, res) => {
  try {
    logger.info('GET /api/netsuite/metadata');
    const data = await netsuiteClient.getMetadataCatalog();
    res.json(data);
  } catch (error) {
    logger.error('Error fetching NetSuite metadata catalog', { error: error.message });
    res.status(500).json({ 
      error: error.message,
      details: 'See server logs for more information'
    });
  }
});

/**
 * @swagger
 * /api/netsuite/metadata/{recordType}:
 *   get:
 *     summary: Get metadata for a specific record type
 *     description: Retrieve detailed metadata for a specific NetSuite record type
 *     tags: [NetSuite]
 *     parameters:
 *       - in: path
 *         name: recordType
 *         required: true
 *         description: The NetSuite record type (e.g., 'inventoryitem', 'customer')
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Record type metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 fields:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Server error
 */
router.get('/metadata/:recordType', async (req, res) => {
  try {
    const { recordType } = req.params;
    logger.info(`GET /api/netsuite/metadata/${recordType}`);
    const data = await netsuiteClient.getRecordMetadata(recordType);
    res.json(data);
  } catch (error) {
    logger.error('Error fetching NetSuite record metadata', { 
      recordType: req.params.recordType, 
      error: error.message 
    });
    res.status(500).json({ 
      error: error.message,
      details: 'See server logs for more information'
    });
  }
});

/**
 * @swagger
 * /api/netsuite/restlet/test:
 *   get:
 *     summary: Test RESTlet connectivity
 *     description: Test basic connectivity to the NetSuite RESTlet endpoint
 *     tags: [NetSuite]
 *     responses:
 *       200:
 *         description: RESTlet connection successful
 *       500:
 *         description: RESTlet connection failed
 */
router.get('/restlet/test', async (req, res) => {
  try {
    logger.info('GET /api/netsuite/restlet/test');
    
    // Test with a simple GET request to the RESTlet
    const result = await restletService.testConnection();
    
    res.json({ 
      success: true, 
      message: 'RESTlet connection successful',
      result
    });
  } catch (error) {
    logger.error('RESTlet test connection failed', { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: 'RESTlet connection test failed'
    });
  }
});

/**
 * @swagger
 * /api/netsuite/bulk-delete:
 *   delete:
 *     summary: Bulk delete NetSuite inventory items
 *     description: Delete multiple NetSuite inventory items that match specific criteria. Includes safety checks to prevent accidental deletion of production items.
 *     tags: [NetSuite]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dryRun:
 *                 type: boolean
 *                 description: If true, only returns items that would be deleted without actually deleting them
 *                 default: true
 *               itemPattern:
 *                 type: string
 *                 description: Pattern to match item names (e.g., "TEST-", "TEMP-")
 *                 default: "TEST-"
 *               maxItems:
 *                 type: integer
 *                 description: Maximum number of items to delete in one operation
 *                 default: 50
 *                 minimum: 1
 *                 maximum: 100
 *     responses:
 *       200:
 *         description: Bulk delete completed or dry run results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 itemsProcessed:
 *                   type: integer
 *                 itemsDeleted:
 *                   type: integer
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                 dryRun:
 *                   type: boolean
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Server error during bulk delete operation
 */
router.delete('/bulk-delete', async (req, res) => {
  try {
    const { dryRun = true, itemPattern = "TEST-", maxItems = 50 } = req.body || {};
    
    // Validate parameters
    if (typeof itemPattern !== 'string' || itemPattern.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'itemPattern must be a string with at least 3 characters for safety'
      });
    }
    
    if (typeof maxItems !== 'number' || maxItems < 1 || maxItems > 100) {
      return res.status(400).json({
        success: false,
        error: 'maxItems must be a number between 1 and 100'
      });
    }
    
    logger.info('Starting bulk delete operation', { dryRun, itemPattern, maxItems });
    
    const result = await restletService.bulkDeleteItems({
      dryRun,
      itemPattern,
      maxItems
    });
    
    res.json(result);
  } catch (error) {
    logger.error('Bulk delete operation failed', { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/netsuite/items-count:
 *   get:
 *     summary: Get count of NetSuite items matching pattern
 *     description: Returns count and basic info about NetSuite items matching a pattern
 *     tags: [NetSuite] 
 *     parameters:
 *       - in: query
 *         name: pattern
 *         schema:
 *           type: string
 *         description: Pattern to search for in item names
 *     responses:
 *       200:
 *         description: Item count and details
 *       500:
 *         description: Server error
 */
router.get('/items-count', async (req, res) => {
  try {
    const { pattern = '' } = req.query;
    
    logger.info('Getting NetSuite items count', { pattern });
    
    const result = await restletService.getItemsCount(pattern);
    
    res.json(result);
  } catch (error) {
    logger.error('Error getting items count', { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/netsuite/vendors:
 *   get:
 *     summary: Get all NetSuite vendors
 *     description: Retrieve list of all vendors from NetSuite
 *     tags: [NetSuite]
 *     responses:
 *       200:
 *         description: List of vendors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 vendors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       companyname:
 *                         type: string
 *       500:
 *         description: Server error
 */
router.get('/vendors', async (req, res) => {
  try {
    logger.info('GET /api/netsuite/vendors');
    
    const result = await restletService.getVendors();
    
    res.json(result);
  } catch (error) {
    logger.error('Error fetching vendors', { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/netsuite/restlet/test-all-fields:
 *   post:
 *     summary: Test RESTlet with comprehensive field data
 *     description: Test the RESTlet with a comprehensive set of fields including mini-forms data
 *     tags: [NetSuite]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               itemId:
 *                 type: string
 *                 description: Custom item ID for testing
 *     responses:
 *       200:
 *         description: RESTlet test successful
 *       500:
 *         description: RESTlet test failed
 */
router.post('/restlet/test-all-fields', async (req, res) => {
  try {
    const { itemId } = req.body || {};
    const testItemId = itemId || `opmsAPI-COMPREHENSIVE-TEST-${Date.now()}`;
    
    logger.info('Testing RESTlet with comprehensive field data', { testItemId });
    
    // Create comprehensive test payload per netsuite-test-naming.mdc rule
    const testPayload = {
      itemId: testItemId,
      displayName: 'Comprehensive Test Item',
      vendor: '1',
      vendorcode: 'TEST-VENDOR-CODE',
      custitem_opms_vendor_color: 'Test Color',
      custitem_opms_vendor_prod_name: 'Test Vendor Product Name',
      custitem_opms_item_colors: 'Red, Blue, Green',
      custitem_opms_parent_product_name: 'Test Parent Product',
      custitem_opms_fabric_width: '54',
      custitem_opms_product_id: 999,
      custitem_opms_item_id: 999,
      // Test mini-forms data
      frontContent: [
        { fiber: 'Cotton', percentage: 60 },
        { fiber: 'Polyester', percentage: 40 }
      ],
      backContent: [
        { fiber: 'Cotton', percentage: 100 }
      ],
      abrasion: [
        { test: 'Wyzenbeek', cycles: 50000, result: 'Pass' }
      ],
      firecodes: [
        { standard: 'NFPA 260', result: 'Pass' }
      ]
    };
    
    const result = await restletService.createLotNumberedInventoryItem(testPayload);
    
    res.json({ 
      success: true, 
      message: 'RESTlet comprehensive test successful',
      testItemId,
      result
    });
  } catch (error) {
    logger.error('RESTlet comprehensive test failed', { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @swagger  
 * /api/netsuite/sync-from-opms:
 *   post:
 *     summary: Sync item from OPMS to NetSuite (called by legacy app)
 *     description: Endpoint for legacy OPMS application to sync item data to NetSuite after item creation/update
 *     tags: [NetSuite]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - opmsItemId
 *             properties:
 *               opmsItemId:
 *                 type: integer
 *                 description: OPMS item ID
 *                 example: 12345
 *               opmsProductId:
 *                 type: integer
 *                 description: OPMS product ID  
 *                 example: 678
 *               productType:
 *                 type: string
 *                 enum: [R, D]
 *                 description: Product type (R=Regular, D=Digital)
 *                 example: "R"
 *               isNew:
 *                 type: boolean
 *                 description: Whether this is a new item creation or update
 *                 example: true
 *     responses:
 *       200:
 *         description: Item synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Item synced to NetSuite successfully"
 *                 netsuiteItemId:
 *                   type: string
 *                   example: "12345"
 *       400:
 *         description: Invalid input data
 *       500:
 *         description: Server error
 */
router.post('/sync-from-opms', async (req, res) => {
  try {
    const { opmsItemId, opmsProductId, productType = 'R', isNew = true } = req.body;
    
    if (!opmsItemId) {
      return res.status(400).json({
        success: false,
        error: 'opmsItemId is required'
      });
    }
    
    logger.info('Syncing item from OPMS to NetSuite', { 
      opmsItemId, 
      opmsProductId, 
      productType, 
      isNew 
    });
    
    // Get complete item data from OPMS database
    const itemModel = new ItemModel();
    const itemData = await itemModel.getItemForNetSuiteSync(opmsItemId, productType);
    
    if (!itemData) {
      return res.status(404).json({
        success: false,
        error: 'Item not found in OPMS database'
      });
    }
    
    // Build NetSuite payload from OPMS data
    const netsuitePayload = {
      itemId: itemData.code,
      displayName: `${itemData.product_name}: ${itemData.color_names}`,
      vendor: itemData.netsuite_vendor_id,
      vendorcode: itemData.vendor_code || '',
      custitem_opms_vendor_color: itemData.vendor_color || '',
      custitem_opms_vendor_prod_name: itemData.vendor_product_name || '',
      custitem_opms_item_colors: itemData.color_names || '',
      custitem_opms_parent_product_name: itemData.product_name || '',
      custitem_opms_fabric_width: itemData.width || '',
      custitem_opms_product_id: parseInt(itemData.product_id),
      custitem_opms_item_id: parseInt(opmsItemId)
    };
    
    // Get mini-forms data if product ID is available
    if (opmsProductId) {
      try {
        const productModel = new ProductModel();
        const miniFormsData = await productModel.getMiniFormsData(parseInt(opmsProductId));
        
        if (miniFormsData.frontContent && miniFormsData.frontContent.length > 0) {
          netsuitePayload.frontContent = miniFormsData.frontContent;
        }
        if (miniFormsData.backContent && miniFormsData.backContent.length > 0) {
          netsuitePayload.backContent = miniFormsData.backContent;
        }
        if (miniFormsData.abrasion && miniFormsData.abrasion.length > 0) {
          netsuitePayload.abrasion = miniFormsData.abrasion;
        }
        if (miniFormsData.firecodes && miniFormsData.firecodes.length > 0) {
          netsuitePayload.firecodes = miniFormsData.firecodes;
        }
        
        logger.info('Added mini-forms data to NetSuite payload', { 
          opmsItemId,
          opmsProductId,
          frontContent: miniFormsData.frontContent?.length || 0,
          backContent: miniFormsData.backContent?.length || 0,
          abrasion: miniFormsData.abrasion?.length || 0,
          firecodes: miniFormsData.firecodes?.length || 0
        });
      } catch (miniFormsError) {
        logger.warn('Failed to get mini-forms data, continuing without it', { 
          opmsItemId,
          opmsProductId,
          error: miniFormsError.message 
        });
      }
    }
    
    // Create/update item in NetSuite
    const result = await restletService.createLotNumberedInventoryItem(netsuitePayload);
    
    logger.info('Successfully synced item to NetSuite', { 
      opmsItemId,
      netsuiteItemId: result.netsuiteItemId,
      isNew,
      success: result.success
    });
    
    res.json({
      success: true,
      message: 'Item synced to NetSuite successfully',
      netsuiteItemId: result.id || result.netsuiteItemId,
      opmsItemId,
      isNew,
      displayName: netsuitePayload.displayName,
      vendor: netsuitePayload.vendor
    });
    
  } catch (error) {
    logger.error('Error syncing item from OPMS to NetSuite', { 
      opmsItemId: req.body?.opmsItemId,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to sync item to NetSuite',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/netsuite/items:
 *   post:
 *     summary: Create (or upsert) a NetSuite inventory item via RESTlet
 *     description: Creates an inventory item using the custom RESTlet. Initially supports itemId and displayName.
 *     tags: [NetSuite]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               itemId:
 *                 type: string
 *               displayName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Item created/updated
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post('/items', async (req, res) => {
  try {
    const { itemId } = req.body || {};
    if (!itemId) {
      return res.status(400).json({ success: false, error: 'itemId is required' });
    }
    
    // Pass the entire request body to the RESTlet service
    // The transformToRestletPayload function will handle all field mapping
    const payload = req.body;

    // If opmsProductId is provided but no mini-forms data, inherit from parent product
    const { opmsProductId, frontContent, backContent, abrasion, firecodes } = payload;
    if (opmsProductId && (!frontContent && !backContent && !abrasion && !firecodes)) {
      try {
        logger.info(`Inheriting mini-forms data from parent product ${opmsProductId}`, { itemId, opmsProductId });
        const productModel = new ProductModel();
        const miniFormsData = await productModel.getMiniFormsData(parseInt(opmsProductId));
        
        // Add inherited mini-forms data to payload
        if (miniFormsData.frontContent && miniFormsData.frontContent.length > 0) {
          payload.frontContent = miniFormsData.frontContent;
        }
        if (miniFormsData.backContent && miniFormsData.backContent.length > 0) {
          payload.backContent = miniFormsData.backContent;
        }
        if (miniFormsData.abrasion && miniFormsData.abrasion.length > 0) {
          payload.abrasion = miniFormsData.abrasion;
        }
        if (miniFormsData.firecodes && miniFormsData.firecodes.length > 0) {
          payload.firecodes = miniFormsData.firecodes;
        }
        
        logger.info(`Successfully inherited mini-forms data from product ${opmsProductId}`, { 
          itemId, 
          opmsProductId,
          inheritedFields: {
            frontContent: miniFormsData.frontContent?.length || 0,
            backContent: miniFormsData.backContent?.length || 0,
            abrasion: miniFormsData.abrasion?.length || 0,
            firecodes: miniFormsData.firecodes?.length || 0
          }
        });
      } catch (inheritError) {
        logger.warn(`Failed to inherit mini-forms data from product ${opmsProductId}`, { 
          itemId, 
          opmsProductId, 
          error: inheritError.message 
        });
        // Continue with item creation without mini-forms data
      }
    }

    const result = await restletService.createLotNumberedInventoryItem(payload);
    return res.json(result);
  } catch (error) {
    logger.error('RESTlet item create error', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/netsuite/items/{id}:
 *   put:
 *     summary: Update an existing NetSuite inventory item
 *     description: Update specific fields of an existing inventory item via RESTlet
 *     tags: [NetSuite]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: NetSuite internal ID of the item to update
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *               frontContent:
 *                 type: array
 *               backContent:
 *                 type: array
 *               abrasion:
 *                 type: array
 *     responses:
 *       200:
 *         description: Item updated successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.put('/items/:id', async (req, res) => {
  try {
    const itemId = req.params.id;
    const { displayName, frontContent, backContent, abrasion, firecodes } = req.body || {};
    
    if (!itemId) {
      return res.status(400).json({ success: false, error: 'Item ID is required' });
    }
    
    // Build update payload
    const payload = { id: itemId };
    if (displayName) payload.displayName = displayName;
    if (frontContent && Array.isArray(frontContent)) payload.frontContent = frontContent;
    if (backContent && Array.isArray(backContent)) payload.backContent = backContent;
    if (abrasion && Array.isArray(abrasion)) payload.abrasion = abrasion;
    if (firecodes && Array.isArray(firecodes)) payload.firecodes = firecodes;

    const result = await restletService.updateLotNumberedInventoryItem(payload);
    return res.json(result);
  } catch (error) {
    logger.error('RESTlet item update error', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/netsuite/items/{id}:
 *   delete:
 *     summary: Delete a NetSuite inventory item via RESTlet
 *     description: Deletes an inventory item using the custom RESTlet. Only deletes API-created items with safety checks.
 *     tags: [NetSuite]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: NetSuite internal ID of the item to delete
 *     responses:
 *       200:
 *         description: Item deleted successfully
 *       400:
 *         description: Validation error or safety check failed
 *       404:
 *         description: Item not found
 *       500:
 *         description: Server error
 */
router.delete('/items/:id', async (req, res) => {
  try {
    const itemId = req.params.id;
    
    if (!itemId) {
      return res.status(400).json({ success: false, error: 'Item ID is required' });
    }
    
    // Use RESTlet service for deletion
    const result = await restletService.deleteLotNumberedInventoryItem(itemId);
    return res.json(result);
  } catch (error) {
    logger.error('RESTlet item delete error', { error: error.message });
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    
    if (error.message.includes('safety check') || error.message.includes('not allowed')) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Fields metadata endpoints
 */

/**
 * @swagger
 * /api/netsuite/metadata/{recordType}/fields:
 *   get:
 *     summary: Get flattened field list for a NetSuite record type
 *     description: Fetches the JSON schema for the record type and returns field id, type, title, required
 *     tags: [NetSuite]
 *     parameters:
 *       - in: path
 *         name: recordType
 *         required: true
 *         schema:
 *           type: string
 *         example: inventoryitem
 *     responses:
 *       200:
 *         description: Field list
 *       500:
 *         description: Server error
 */
router.get('/metadata/:recordType/fields', async (req, res) => {
  try {
    const { recordType } = req.params;
    logger.info(`GET /api/netsuite/metadata/${recordType}/fields`);

    // Step 1: get catalog entry to find schema link
    const catalog = await netsuiteClient.getRecordMetadata(recordType);
    const links = (catalog && Array.isArray(catalog.links)) ? catalog.links : [];
    const schemaLink = links.find(l => l.mediaType === 'application/schema+json' && (l.rel === 'describes' || l.rel === 'alternate'))
      || links.find(l => l.rel === 'describes')
      || links.find(l => l.mediaType === 'application/schema+json');

    if (!schemaLink || !schemaLink.href) {
      return res.status(200).json({
        recordType,
        fields: [],
        info: 'Schema link not found in catalog',
        catalog
      });
    }

    // Step 2: fetch schema with Accept header
    const url = String(schemaLink.href).replace(/\n/g, '');
    const schemaResp = await axios.get(url, {
      headers: {
        Authorization: buildAuthHeader('GET', url),
        Accept: 'application/schema+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Opuzen-API/1.0'
      }
    });

    const schema = schemaResp.data || {};
    const props = schema.properties || (schema.data && schema.data.properties) || {};
    const required = new Set(schema.required || (schema.data && schema.data.required) || []);

    const fields = Object.entries(props).map(([id, def]) => ({
      id,
      type: def.type || def.dataType || '',
      title: def.title || def.label || '',
      required: required.has(id)
    })).sort((a,b)=> String(a.id).localeCompare(String(b.id)));

    return res.json({ recordType, count: fields.length, fields });
  } catch (error) {
    logger.error('Error fetching recordType fields', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Convenience alias for inventory items
router.get('/metadata/fields', async (req, res) => {
  req.params.recordType = 'inventoryitem';
  return router.handle(req, res);
});

/**
 * @swagger
 * /api/netsuite/cleanup:
 *   post:
 *     summary: Clean up NetSuite items by filename prefix
 *     description: Search for and delete NetSuite items matching a specific filename prefix
 *     tags: [NetSuite]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filenamePrefix:
 *                 type: string
 *                 description: "Prefix to search for (default: opmsAPI)"
 *                 example: opmsAPI
 *               max:
 *                 type: number
 *                 description: "Maximum number of items to process (default: all)"
 *                 example: 10
 *               dryRun:
 *                 type: boolean
 *                 description: "Show what would be deleted without actually deleting (default: false)"
 *                 example: false
 *     responses:
 *       200:
 *         description: Cleanup operation completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 results:
 *                   type: object
 *                   properties:
 *                     totalItems:
 *                       type: number
 *                     directDeleted:
 *                       type: number
 *                     markedInactive:
 *                       type: number
 *                     failed:
 *                       type: number
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post('/cleanup', async (req, res) => {
  try {
    const { filenamePrefix = 'opmsAPI', max = null, dryRun = false } = req.body;
    
    logger.info('POST /api/netsuite/cleanup', { 
      filenamePrefix, 
      max, 
      dryRun 
    });

    // Import the cleanup function from the script
    const { cleanupNetSuiteItems } = require('../../scripts/cleanup-netsuite-items');
    
    // Call the cleanup function
    const results = await cleanupNetSuiteItems({
      filenamePrefix,
      max,
      dryRun
    });

    return res.json({
      success: true,
      message: 'Cleanup operation completed successfully',
      results
    });

  } catch (error) {
    logger.error('Cleanup operation failed', { error: error.message });
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/netsuite/import/csv:
 *   post:
 *     summary: Import OPMS CSV export to NetSuite
 *     description: Upload an OPMS CSV export file and automatically import all items to NetSuite using the RESTlet integration
 *     tags: [NetSuite]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: OPMS CSV export file with NetSuite fields and constants
 *               options:
 *                 type: string
 *                 description: JSON string with processing options
 *                 example: '{"batchSize":10,"delayMs":2000,"dryRun":false}'
 *     responses:
 *       201:
 *         description: NetSuite import job created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: NetSuite import job created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: integer
 *                       example: 123
 *                     jobUuid:
 *                       type: string
 *                       example: uuid-string
 *                     totalItems:
 *                       type: integer
 *                       example: 50
 *                     estimatedTime:
 *                       type: string
 *                       example: 10-15 minutes
 *                     status:
 *                       type: string
 *                       example: processing
 *       400:
 *         description: Invalid CSV file or format
 *       500:
 *         description: Server error
 */
router.post('/import/csv', upload.single('file'), async (req, res) => {
  await netSuiteCsvImportController.uploadCsvForNetSuiteImport(req, res);
});

// Simple synchronous NetSuite import (no background jobs)
router.post('/import/simple', upload.single('file'), async (req, res) => {
  await simpleNetSuiteImportController.simpleImport(req, res);
});

/**
 * @swagger
 * /api/netsuite/import/jobs/{jobId}:
 *   get:
 *     summary: Get NetSuite import job status
 *     description: Retrieve the status and progress of a NetSuite import job
 *     tags: [NetSuite]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Import job ID
 *     responses:
 *       200:
 *         description: Job status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: integer
 *                       example: 123
 *                     status:
 *                       type: string
 *                       enum: [pending, processing, completed, failed]
 *                       example: processing
 *                     totalItems:
 *                       type: integer
 *                       example: 50
 *                     processedItems:
 *                       type: integer
 *                       example: 25
 *                     succeededItems:
 *                       type: integer
 *                       example: 23
 *                     failedItems:
 *                       type: integer
 *                       example: 2
 *       404:
 *         description: Job not found
 *       500:
 *         description: Server error
 */
router.get('/import/jobs/:jobId', async (req, res) => {
  await netSuiteCsvImportController.getNetSuiteImportJobStatus(req, res);
});

// GET /api/netsuite/itemvendor-vendors - Get vendors available for itemvendor sublist
router.get('/itemvendor-vendors', async (req, res) => {
  try {
    const vendors = await netsuiteRestletService.getItemVendors();
    res.json({
      success: true,
      count: vendors.length,
      vendors: vendors
    });
  } catch (error) {
    logger.error('Failed to get itemvendor vendors from NetSuite:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/netsuite/populate-vendor-mapping - Populate vendor mapping table with NetSuite itemvendor vendors
router.post('/populate-vendor-mapping', async (req, res) => {
  try {
    logger.info('Starting vendor mapping population from NetSuite itemvendor list');
    
    // Get vendors from NetSuite itemvendor sublist
    const netsuiteVendors = await netsuiteRestletService.getItemVendors();
    
    if (!netsuiteVendors || netsuiteVendors.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No itemvendor vendors found in NetSuite'
      });
    }
    
    // Get OPMS vendors that need mapping
    const db = require('../db/connection');
    const [opmsVendors] = await db.query(`
      SELECT DISTINCT 
        v.id as opms_vendor_id,
        v.name as opms_vendor_name,
        v.abrev as opms_vendor_abrev
      FROM Z_VENDOR v
      JOIN T_PRODUCT_VENDOR pv ON v.id = pv.vendor_id
      WHERE v.active = 'Y' 
        AND v.archived = 'N'
      ORDER BY v.name
    `);
    
    logger.info(`Found ${netsuiteVendors.length} NetSuite itemvendor vendors and ${opmsVendors.length} OPMS vendors`);
    
    // Clear existing mappings
    await db.query('TRUNCATE TABLE opms_netsuite_vendor_mapping');
    
    // Create mappings based on name matching
    const mappings = [];
    const unmappedOpms = [];
    const unmappedNetSuite = [...netsuiteVendors];
    
    for (const opmsVendor of opmsVendors) {
      // Try exact name match first
      let netsuiteMatch = netsuiteVendors.find(ns => 
        ns.name.toLowerCase() === opmsVendor.opms_vendor_name.toLowerCase()
      );
      
      // Try partial name match if exact fails
      if (!netsuiteMatch) {
        netsuiteMatch = netsuiteVendors.find(ns => 
          ns.name.toLowerCase().includes(opmsVendor.opms_vendor_name.toLowerCase()) ||
          opmsVendor.opms_vendor_name.toLowerCase().includes(ns.name.toLowerCase())
        );
      }
      
      if (netsuiteMatch) {
        mappings.push({
          opms_vendor_id: opmsVendor.opms_vendor_id,
          opms_vendor_name: opmsVendor.opms_vendor_name,
          opms_vendor_abrev: opmsVendor.opms_vendor_abrev,
          netsuite_vendor_id: netsuiteMatch.id,
          netsuite_vendor_name: netsuiteMatch.name,
          mapping_method: 'auto'
        });
        
        // Remove from unmapped NetSuite list
        const index = unmappedNetSuite.findIndex(ns => ns.id === netsuiteMatch.id);
        if (index > -1) {
          unmappedNetSuite.splice(index, 1);
        }
      } else {
        unmappedOpms.push(opmsVendor);
      }
    }
    
    // Insert mappings
    if (mappings.length > 0) {
      const insertQuery = `
        INSERT INTO opms_netsuite_vendor_mapping 
        (opms_vendor_id, opms_vendor_name, opms_vendor_abrev, netsuite_vendor_id, netsuite_vendor_name, mapping_method)
        VALUES ?
      `;
      
      const values = mappings.map(m => [
        m.opms_vendor_id,
        m.opms_vendor_name,
        m.opms_vendor_abrev,
        m.netsuite_vendor_id,
        m.netsuite_vendor_name,
        m.mapping_method
      ]);
      
      await db.query(insertQuery, [values]);
    }
    
    logger.info(`Vendor mapping population completed: ${mappings.length} mapped, ${unmappedOpms.length} OPMS unmapped, ${unmappedNetSuite.length} NetSuite unmapped`);
    
    res.json({
      success: true,
      summary: {
        totalNetSuiteVendors: netsuiteVendors.length,
        totalOpmsVendors: opmsVendors.length,
        mappingsCreated: mappings.length,
        unmappedOpms: unmappedOpms.length,
        unmappedNetSuite: unmappedNetSuite.length
      },
      mappings: mappings,
      unmappedOpms: unmappedOpms,
      unmappedNetSuite: unmappedNetSuite
    });
    
  } catch (error) {
    logger.error('Failed to populate vendor mapping:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 