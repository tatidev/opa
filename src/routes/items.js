const express = require('express');
const router = express.Router();
const ItemModel = require('../models/ItemModel');
const ColorModel = require('../models/ColorModel');
const logger = require('../utils/logger');

// Instantiate models
const itemModel = new ItemModel();
const colorModel = new ColorModel();

/**
 * @swagger
 * /api/items:
 *   get:
 *     summary: List all items
 *     description: Retrieve a list of all items with optional filtering
 *     tags: [Items]
 *     parameters:
 *       - in: query
 *         name: archived
 *         schema:
 *           type: string
 *           enum: [Y, N]
 *         default: N
 *         description: Filter by archived status (Y=archived, N=active)
 *       - in: query
 *         name: product_type
 *         schema:
 *           type: string
 *           enum: [R, D]
 *         description: Filter by product type (R=Regular, D=Digital)
 *       - in: query
 *         name: product_id
 *         schema:
 *           type: integer
 *         description: Filter by product ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of items to return
 *     responses:
 *       200:
 *         description: A list of items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Item'
 *                 count:
 *                   type: integer
 *                   example: 25
 *                 filters:
 *                   type: object
 *                   properties:
 *                     archived:
 *                       type: string
 *                       example: N
 *                     product_type:
 *                       type: string
 *                       example: R
 *                     product_id:
 *                       type: integer
 *                       example: 123
 *       500:
 *         description: Server error
 */
router.get('/', async (req, res) => {
  try {
    const { archived = 'N', product_type, product_id, limit = 100 } = req.query;
    
    // Build query with filters
    let query = `
      SELECT 
        i.id, i.product_id, i.product_type, i.code, i.archived,
        i.status_id, i.stock_status_id, i.vendor_color, i.vendor_code,
        ps.name as status, ps.descr as status_descr,
        ss.name as stock_status, ss.descr as stock_status_descr,
        GROUP_CONCAT(DISTINCT c.name ORDER BY ic.n_order SEPARATOR ' / ') as colors
      FROM T_ITEM i
      LEFT JOIN P_PRODUCT_STATUS ps ON ps.id = i.status_id
      LEFT JOIN P_STOCK_STATUS ss ON ss.id = i.stock_status_id
      LEFT JOIN T_ITEM_COLOR ic ON ic.item_id = i.id
      LEFT JOIN P_COLOR c ON c.id = ic.color_id
    `;
    
    const conditions = [];
    const values = [];
    
    if (archived !== undefined) {
      conditions.push('i.archived = ?');
      values.push(archived);
    }
    
    if (product_type) {
      conditions.push('i.product_type = ?');
      values.push(product_type);
    }
    
    if (product_id) {
      conditions.push('i.product_id = ?');
      values.push(parseInt(product_id));
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' GROUP BY i.id ORDER BY i.id DESC';
    
    if (limit) {
      query += ' LIMIT ?';
      values.push(parseInt(limit));
    }
    
    const items = await itemModel.executeQuery(query, values);
    
    res.json({
      success: true,
      data: items,
      count: items.length,
      filters: { archived, product_type, product_id }
    });
    
  } catch (error) {
    logger.error('Error fetching items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch items',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/items:
 *   post:
 *     summary: Create a new item
 *     description: Create a new item with all related data
 *     tags: [Items]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - product_id
 *               - product_type
 *               - code
 *             properties:
 *               product_id:
 *                 type: integer
 *                 description: Product ID
 *                 example: 123
 *               product_type:
 *                 type: string
 *                 enum: [R, D]
 *                 description: Product type (R=Regular, D=Digital)
 *                 example: "R"
 *               code:
 *                 type: string
 *                 description: Item code
 *                 example: "ITEM-001"
 *               status_id:
 *                 type: integer
 *                 description: Product status ID
 *                 example: 1
 *               stock_status_id:
 *                 type: integer
 *                 description: Stock status ID
 *                 example: 1
 *               vendor_color:
 *                 type: string
 *                 description: Vendor color name
 *                 example: "Forest Green"
 *               vendor_code:
 *                 type: string
 *                 description: Vendor item code
 *                 example: "VEN-001"
 *               roll_location_id:
 *                 type: integer
 *                 description: Roll location ID
 *                 example: 1
 *               roll_yardage:
 *                 type: number
 *                 format: float
 *                 description: Roll yardage
 *                 example: 50.5
 *               bin_location_id:
 *                 type: integer
 *                 description: Bin location ID
 *                 example: 1
 *               bin_quantity:
 *                 type: integer
 *                 description: Bin quantity
 *                 example: 10
 *               min_order_qty:
 *                 type: integer
 *                 description: Minimum order quantity
 *                 example: 5
 *               colors:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of color IDs
 *                 example: [1, 2, 3]
 *               shelves:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of shelf IDs
 *                 example: [1, 2]
 *               showcase:
 *                 type: object
 *                 properties:
 *                   visible:
 *                     type: string
 *                     enum: [Y, N]
 *                     description: Showcase visibility
 *                     example: "Y"
 *                   url_title:
 *                     type: string
 *                     description: URL title for showcase
 *                     example: "beautiful-fabric"
 *                   pic_big_url:
 *                     type: string
 *                     description: Big picture URL
 *                     example: "images/item-big.jpg"
 *                   pic_hd_url:
 *                     type: string
 *                     description: HD picture URL
 *                     example: "images/item-hd.jpg"
 *     responses:
 *       201:
 *         description: Item created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Item'
 *                 message:
 *                   type: string
 *                   example: "Item created successfully"
 *       400:
 *         description: Invalid input data
 *       500:
 *         description: Server error
 */
router.post('/', async (req, res) => {
  try {
    const itemData = req.body;
    
    // Validate required fields
    if (!itemData.product_id || !itemData.product_type || !itemData.code) {
      return res.status(400).json({
        success: false,
        error: 'product_id, product_type, and code are required'
      });
    }
    
    // Validate product_type
    if (!['R', 'D'].includes(itemData.product_type)) {
      return res.status(400).json({
        success: false,
        error: 'product_type must be R (Regular) or D (Digital)'
      });
    }
    
    // Create the item
    const newItem = await itemModel.saveItem(itemData);
    
    res.status(201).json({
      success: true,
      data: newItem,
      message: 'Item created successfully'
    });
    
  } catch (error) {
    logger.error('Error creating item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create item',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const itemData = req.body;
    
    // Check if item exists
    const existingItem = await itemModel.findById(id);
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }
    
    // Validate product_type if provided
    if (itemData.product_type && !['R', 'D'].includes(itemData.product_type)) {
      return res.status(400).json({
        success: false,
        error: 'product_type must be R (Regular) or D (Digital)'
      });
    }
    
    // Update the item
    const updatedItem = await itemModel.saveItem(itemData, parseInt(id));
    
    res.json({
      success: true,
      data: updatedItem,
      message: 'Item updated successfully'
    });
    
  } catch (error) {
    logger.error('Error updating item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update item',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if item exists
    const existingItem = await itemModel.findById(id);
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }
    
    // Archive the item (soft delete)
    const result = await itemModel.update(id, { archived: 'Y' });
    
    if (result) {
      res.json({
        success: true,
        message: 'Item archived successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to archive item'
      });
    }
    
  } catch (error) {
    logger.error('Error archiving item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive item',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/items/{id}/restore:
 *   post:
 *     summary: Restore (unarchive) an item
 *     description: Restore an archived item by setting its archived status to 'N'
 *     tags: [Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Item ID
 *     responses:
 *       200:
 *         description: Item restored successfully
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
 *                   example: "Item restored successfully"
 *       404:
 *         description: Item not found
 *       500:
 *         description: Server error
 */
router.post('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if item exists (including archived items)
    const existingItem = await itemModel.findById(id);
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }
    
    // Restore the item (unarchive)
    const result = await itemModel.update(id, { archived: 'N' });
    
    if (result) {
      res.json({
        success: true,
        message: 'Item restored successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to restore item'
      });
    }
    
  } catch (error) {
    logger.error('Error restoring item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore item',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/items/{id}:
 *   get:
 *     summary: Get item details
 *     description: Retrieve detailed information for a specific item
 *     tags: [Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Item ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [R, D]
 *         description: Product type (R=Regular, D=Digital). If not provided, will be determined automatically.
 *     responses:
 *       200:
 *         description: Item details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Item'
 *                 item_id:
 *                   type: integer
 *                 product_type:
 *                   type: string
 *       400:
 *         description: Invalid product type
 *       404:
 *         description: Item not found
 *       500:
 *         description: Server error
 *   put:
 *     summary: Update an existing item
 *     description: Update an existing item with all related data
 *     tags: [Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               product_id:
 *                 type: integer
 *                 description: Product ID
 *                 example: 123
 *               product_type:
 *                 type: string
 *                 enum: [R, D]
 *                 description: Product type (R=Regular, D=Digital)
 *                 example: "R"
 *               code:
 *                 type: string
 *                 description: Item code
 *                 example: "ITEM-001-UPDATED"
 *               vendor_color:
 *                 type: string
 *                 description: Vendor color name
 *                 example: "Deep Forest Green"
 *               vendor_code:
 *                 type: string
 *                 description: Vendor item code
 *                 example: "VEN-001-UPD"
 *               colors:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of color IDs
 *                 example: [1, 2, 4]
 *     responses:
 *       200:
 *         description: Item updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Item'
 *                 message:
 *                   type: string
 *                   example: "Item updated successfully"
 *       404:
 *         description: Item not found
 *       400:
 *         description: Invalid input data
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Delete (archive) an item
 *     description: Soft delete an item by setting its archived status to 'Y'
 *     tags: [Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Item ID
 *     responses:
 *       200:
 *         description: Item archived successfully
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
 *                   example: "Item archived successfully"
 *       404:
 *         description: Item not found
 *       500:
 *         description: Server error
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;
    
    // Validate product type if provided
    if (type && !['R', 'D'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product type. Must be R (Regular) or D (Digital)'
      });
    }
    
    // If type not provided, we need to get it from the item
    let productType = type;
    if (!productType) {
      const basicItem = await itemModel.findById(id);
      if (!basicItem) {
        return res.status(404).json({
          success: false,
          error: 'Item not found'
        });
      }
      productType = basicItem.product_type;
    }
    
    const item = await itemModel.getItemDetails(parseInt(id), productType);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }
    
    res.json({
      success: true,
      data: item,
      item_id: parseInt(id),
      product_type: productType
    });
  } catch (error) {
    logger.error('Error fetching item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch item',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/items/{id}/info/{type}:
 *   get:
 *     summary: Get item info for tag display
 *     description: Retrieve formatted item information for tag display
 *     tags: [Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Item ID
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [R, D]
 *         description: Product type (R=Regular, D=Digital)
 *     responses:
 *       200:
 *         description: Item info for tag
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
 *                     item_id:
 *                       type: integer
 *                     product_id:
 *                       type: integer
 *                     product_name:
 *                       type: string
 *                     code:
 *                       type: string
 *                 item_id:
 *                   type: integer
 *                 product_type:
 *                   type: string
 *       400:
 *         description: Invalid product type
 *       404:
 *         description: Item not found
 *       500:
 *         description: Server error
 */
router.get('/:id/info/:type', async (req, res) => {
  try {
    const { id, type } = req.params;
    
    // Validate product type
    if (!['R', 'D'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product type. Must be R (Regular) or D (Digital)'
      });
    }
    
    const itemInfo = await itemModel.getItemInfoForTag(type, parseInt(id));
    
    if (!itemInfo) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }
    
    res.json({
      success: true,
      data: itemInfo,
      item_id: parseInt(id),
      product_type: type
    });
  } catch (error) {
    logger.error('Error fetching item info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch item info',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/items/{id}/colors:
 *   get:
 *     summary: Get colors for an item
 *     description: Retrieve all colors associated with a specific item
 *     tags: [Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Item ID
 *     responses:
 *       200:
 *         description: List of item colors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Color'
 *                 count:
 *                   type: integer
 *                 item_id:
 *                   type: integer
 *       500:
 *         description: Server error
 */
router.get('/:id/colors', async (req, res) => {
  try {
    const { id } = req.params;
    const colors = await colorModel.getItemColors(parseInt(id));
    
    res.json({
      success: true,
      data: colors,
      count: colors.length,
      item_id: parseInt(id)
    });
  } catch (error) {
    logger.error('Error fetching item colors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch item colors',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/items/{id}/colors:
 *   post:
 *     summary: Add a color to an item
 *     description: Associate a color with a specific item
 *     tags: [Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - color_id
 *             properties:
 *               color_id:
 *                 type: integer
 *                 description: Color ID to add
 *               n_order:
 *                 type: integer
 *                 description: Display order for the color
 *     responses:
 *       201:
 *         description: Color added successfully
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
 *                 item_id:
 *                   type: integer
 *                 color_id:
 *                   type: integer
 *       400:
 *         description: Missing color_id
 *       500:
 *         description: Server error
 */
router.post('/:id/colors', async (req, res) => {
  try {
    const { id } = req.params;
    const { color_id, n_order } = req.body;
    
    if (!color_id) {
      return res.status(400).json({
        success: false,
        error: 'color_id is required'
      });
    }
    
    const result = await colorModel.addItemColor(parseInt(id), parseInt(color_id), n_order);
    
    res.status(201).json({
      success: true,
      data: result,
      item_id: parseInt(id),
      color_id: parseInt(color_id)
    });
  } catch (error) {
    logger.error('Error adding item color:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add item color',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/items/{id}/colors/{colorId}:
 *   delete:
 *     summary: Remove a color from an item
 *     description: Remove the association between a color and an item
 *     tags: [Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Item ID
 *       - in: path
 *         name: colorId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Color ID to remove
 *     responses:
 *       200:
 *         description: Color removed successfully
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
 *                   example: Color removed from item
 *                 item_id:
 *                   type: integer
 *                 color_id:
 *                   type: integer
 *       404:
 *         description: Color not found for this item
 *       500:
 *         description: Server error
 */
router.delete('/:id/colors/:colorId', async (req, res) => {
  try {
    const { id, colorId } = req.params;
    const success = await colorModel.removeItemColor(parseInt(id), parseInt(colorId));
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Color not found for this item'
      });
    }
    
    res.json({
      success: true,
      message: 'Color removed from item',
      item_id: parseInt(id),
      color_id: parseInt(colorId)
    });
  } catch (error) {
    logger.error('Error removing item color:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove item color',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
