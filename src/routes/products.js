const express = require('express');
const router = express.Router();
const ProductModel = require('../models/ProductModel');
const ItemModel = require('../models/ItemModel');
const logger = require('../utils/logger');

// Instantiate models
const productModel = new ProductModel();
const itemModel = new ItemModel();

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: List all products
 *     description: Retrieve a list of all products with optional filtering
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: archived
 *         schema:
 *           type: string
 *           enum: [Y, N]
 *         default: N
 *         description: Filter by archived status (Y=archived, N=active)
 *     responses:
 *       200:
 *         description: A list of products
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
 *                     $ref: '#/components/schemas/Product'
 *                 count:
 *                   type: integer
 *                 filters:
 *                   type: object
 *                   properties:
 *                     archived:
 *                       type: string
 *                       example: N
 *       500:
 *         description: Server error
 */
router.get('/', async (req, res) => {
  try {
    const { archived = 'N' } = req.query;
    
    const filters = { archived };
    const products = await productModel.findAll(filters);
    
    res.json({
      success: true,
      data: products,
      count: products.length,
      filters: filters
    });
  } catch (error) {
    logger.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/products/search:
 *   post:
 *     summary: Search products for datatable
 *     description: Search products with server-side processing for datatables
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               search:
 *                 type: object
 *                 properties:
 *                   value:
 *                     type: string
 *                     description: Search term
 *               draw:
 *                 type: integer
 *                 description: Draw counter for datatable
 *               start:
 *                 type: integer
 *                 description: Starting record index
 *               length:
 *                 type: integer
 *                 description: Number of records to retrieve
 *               order:
 *                 type: array
 *                 description: Sorting information
 *     responses:
 *       200:
 *         description: Search results for datatable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 draw:
 *                   type: integer
 *                 recordsTotal:
 *                   type: integer
 *                 recordsFiltered:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Server error
 */
router.post('/search', async (req, res) => {
  try {
    const { search, draw, start, length, order } = req.body;
    
    // Get products based on search term
    const searchTerm = search?.value || '';
    const result = await productModel.searchProducts(searchTerm, {
      start: parseInt(start) || 0,
      length: parseInt(length) || 10,
      order: order || []
    });
    
    // Format the response to match legacy app's format
    const response = {
      draw: parseInt(draw),
      recordsTotal: result.total,
      recordsFiltered: result.filtered,
      tableData: result.data, // Legacy app expects data in tableData property
      arr: result.data // For legacy compatibility
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Error searching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search products',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     description: Retrieve detailed information for a specific product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await productModel.findById(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    logger.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create a new product
 *     description: Create a new product with all related data
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - product_name
 *               - product_type
 *               - vendor
 *             properties:
 *               product_name:
 *                 type: string
 *                 description: Product name
 *                 example: "Premium Fabric Collection"
 *               product_type:
 *                 type: string
 *                 enum: [R, D]
 *                 description: Product type (R=Regular, D=Digital)
 *                 example: "R"
 *               width:
 *                 type: number
 *                 format: float
 *                 description: Product width in inches
 *                 example: 54.0
 *               vrepeat:
 *                 type: number
 *                 format: float
 *                 description: Vertical repeat in inches
 *                 example: 12.5
 *               hrepeat:
 *                 type: number
 *                 format: float
 *                 description: Horizontal repeat in inches
 *                 example: 13.75
 *               outdoor:
 *                 type: string
 *                 enum: [Y, N]
 *                 description: Outdoor fabric indicator
 *                 example: "N"
 *               lightfastness:
 *                 type: number
 *                 description: Lightfastness rating
 *                 example: 4
 *               seam_slippage:
 *                 type: string
 *                 description: Seam slippage information
 *                 example: "Class 3"
 *               dig_product_name:
 *                 type: string
 *                 description: Digital product name (for digital products)
 *                 example: "Digital Collection Name"
 *               dig_width:
 *                 type: number
 *                 format: float
 *                 description: Digital product width (for digital products)
 *                 example: 60.0
 *               vendor:
 *                 type: object
 *                 properties:
 *                   vendor_id:
 *                     type: integer
 *                     description: Vendor ID
 *                     example: 1
 *               price:
 *                 type: object
 *                 properties:
 *                   p_hosp_cut:
 *                     type: number
 *                     format: float
 *                     description: Hospital cut price
 *                     example: 25.50
 *                   p_hosp_roll:
 *                     type: number
 *                     format: float
 *                     description: Hospital roll price
 *                     example: 24.00
 *                   p_res_cut:
 *                     type: number
 *                     format: float
 *                     description: Residential cut price
 *                     example: 32.75
 *                   p_dig_res:
 *                     type: number
 *                     format: float
 *                     description: Digital residential price
 *                     example: 28.50
 *                   p_dig_hosp:
 *                     type: number
 *                     format: float
 *                     description: Digital hospital price
 *                     example: 26.25
 *               cost:
 *                 type: object
 *                 properties:
 *                   fob:
 *                     type: string
 *                     description: FOB information
 *                     example: "Shanghai"
 *                   cost_cut:
 *                     type: number
 *                     format: float
 *                     description: Cost per cut
 *                     example: 12.50
 *                   cost_roll:
 *                     type: number
 *                     format: float
 *                     description: Cost per roll
 *                     example: 11.75
 *               content_front:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     content_id:
 *                       type: integer
 *                       description: Content type ID
 *                       example: 1
 *                     perc:
 *                       type: number
 *                       format: float
 *                       description: Percentage
 *                       example: 65.0
 *               uses:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   description: Use type ID
 *                   example: 1
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *                 message:
 *                   type: string
 *                   example: "Product created successfully"
 *       400:
 *         description: Invalid input data
 *       500:
 *         description: Server error
 */
router.post('/', async (req, res) => {
  try {
    const { product_type, ...productData } = req.body;
    
    // Validate required fields
    if (!productData.product_name || !productData.product_name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Product name is required'
      });
    }
    
    if (!product_type || !['R', 'D'].includes(product_type)) {
      return res.status(400).json({
        success: false,
        error: 'Product type is required and must be R (Regular) or D (Digital)'
      });
    }
    
    // Validate vendor for regular products
    if (product_type === 'R' && (!productData.vendor || !productData.vendor.vendor_id)) {
      return res.status(400).json({
        success: false,
        error: 'Vendor is required for regular products'
      });
    }
    
    // Validate digital product specific fields
    if (product_type === 'D') {
      if (!productData.style || !productData.ground) {
        return res.status(400).json({
          success: false,
          error: 'Style and ground are required for digital products'
        });
      }
    }
    
    // Add user_id if available (would typically come from authentication middleware)
    productData.user_id = req.user?.id || 0;
    
    // Create the product
    const newProduct = await productModel.saveProduct(product_type, productData);
    
    res.status(201).json({
      success: true,
      data: newProduct,
      message: 'Product created successfully'
    });
    
  } catch (error) {
    logger.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create product',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update an existing product
 *     description: Update an existing product with all related data
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               product_name:
 *                 type: string
 *                 description: Product name
 *                 example: "Updated Premium Fabric Collection"
 *               product_type:
 *                 type: string
 *                 enum: [R, D]
 *                 description: Product type (R=Regular, D=Digital)
 *                 example: "R"
 *               width:
 *                 type: number
 *                 format: float
 *                 description: Product width in inches
 *                 example: 54.0
 *               vendor:
 *                 type: object
 *                 properties:
 *                   vendor_id:
 *                     type: integer
 *                     description: Vendor ID
 *                     example: 1
 *               price:
 *                 type: object
 *                 properties:
 *                   p_hosp_cut:
 *                     type: number
 *                     format: float
 *                     description: Hospital cut price
 *                     example: 26.50
 *                   p_res_cut:
 *                     type: number
 *                     format: float
 *                     description: Residential cut price
 *                     example: 33.75
 *     responses:
 *       200:
 *         description: Product updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *                 message:
 *                   type: string
 *                   example: "Product updated successfully"
 *       404:
 *         description: Product not found
 *       400:
 *         description: Invalid input data
 *       500:
 *         description: Server error
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { product_type, ...productData } = req.body;
    
    // Check if product exists
    const existingProduct = await productModel.findById(id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    // Validate required fields
    if (!productData.product_name || !productData.product_name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Product name is required'
      });
    }
    
    if (!product_type || !['R', 'D'].includes(product_type)) {
      return res.status(400).json({
        success: false,
        error: 'Product type is required and must be R (Regular) or D (Digital)'
      });
    }
    
    // Validate vendor for regular products
    if (product_type === 'R' && (!productData.vendor || !productData.vendor.vendor_id)) {
      return res.status(400).json({
        success: false,
        error: 'Vendor is required for regular products'
      });
    }
    
    // Validate digital product specific fields
    if (product_type === 'D') {
      if (!productData.style || !productData.ground) {
        return res.status(400).json({
          success: false,
          error: 'Style and ground are required for digital products'
        });
      }
    }
    
    // Add user_id if available (would typically come from authentication middleware)
    productData.user_id = req.user?.id || 0;
    
    // Update the product
    const updatedProduct = await productModel.saveProduct(product_type, productData, id);
    
    res.json({
      success: true,
      data: updatedProduct,
      message: 'Product updated successfully'
    });
    
  } catch (error) {
    logger.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete (archive) a product
 *     description: Soft delete a product by setting its archived status to 'Y'
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [R, D]
 *         description: Product type (R=Regular, D=Digital)
 *     responses:
 *       200:
 *         description: Product archived successfully
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
 *                   example: "Product archived successfully"
 *       404:
 *         description: Product not found
 *       400:
 *         description: Invalid product type
 *       500:
 *         description: Server error
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;
    
    // Validate product type
    if (!type || !['R', 'D'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Product type is required and must be R (Regular) or D (Digital)'
      });
    }
    
    // Check if product exists
    const existingProduct = await productModel.findById(id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    // Archive the product (soft delete)
    const result = await productModel.archiveProduct(id, type);
    
    if (result) {
      res.json({
        success: true,
        message: 'Product archived successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to archive product'
      });
    }
    
  } catch (error) {
    logger.error('Error archiving product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive product',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/products/{id}/restore:
 *   post:
 *     summary: Restore (unarchive) a product
 *     description: Restore an archived product by setting its archived status to 'N'
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [R, D]
 *         description: Product type (R=Regular, D=Digital)
 *     responses:
 *       200:
 *         description: Product restored successfully
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
 *                   example: "Product restored successfully"
 *       404:
 *         description: Product not found
 *       400:
 *         description: Invalid product type
 *       500:
 *         description: Server error
 */
router.post('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;
    
    // Validate product type
    if (!type || !['R', 'D'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Product type is required and must be R (Regular) or D (Digital)'
      });
    }
    
    // Check if product exists (including archived products)
    const existingProduct = await productModel.findById(id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    // Restore the product (unarchive)
    const result = await productModel.retrieveProduct(id, type);
    
    if (result) {
      res.json({
        success: true,
        message: 'Product restored successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to restore product'
      });
    }
    
  } catch (error) {
    logger.error('Error restoring product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore product',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/products/{id}/items/{type}:
 *   get:
 *     summary: Get items for a product
 *     description: Retrieve all items associated with a specific product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [R, D]
 *         description: Product type (R=Regular, D=Digital)
 *     responses:
 *       200:
 *         description: List of items for the product
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
 *                 product_id:
 *                   type: integer
 *                 product_type:
 *                   type: string
 *       400:
 *         description: Invalid product type
 *       500:
 *         description: Server error
 */
router.get('/:id/items/:type', async (req, res) => {
  try {
    const { id, type } = req.params;
    
    // Validate product type
    if (!['R', 'D'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product type. Must be R (Regular) or D (Digital)'
      });
    }
    
    const items = await itemModel.getItemDetailsByProductId(parseInt(id), type);
    
    res.json({
      success: true,
      data: items,
      count: items.length,
      product_id: parseInt(id),
      product_type: type
    });
  } catch (error) {
    logger.error('Error fetching items for product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch items for product',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/products/{id}/info/{type}:
 *   get:
 *     summary: Get product info for tag display
 *     description: Retrieve formatted product information for tag display
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [R, D]
 *         description: Product type (R=Regular, D=Digital)
 *     responses:
 *       200:
 *         description: Product info for tag
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
 *                     product_id:
 *                       type: integer
 *                     product_name:
 *                       type: string
 *                     width:
 *                       type: string
 *       400:
 *         description: Invalid product type
 *       404:
 *         description: Product not found
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
    
    const productInfo = await productModel.getProductInfoForTag(type, parseInt(id));
    
    if (!productInfo) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: productInfo
    });
  } catch (error) {
    logger.error('Error fetching product info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product info',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/products/{id}/specsheet/{type}:
 *   get:
 *     summary: Get product specification sheet
 *     description: Retrieve detailed specification sheet for a product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [R, D]
 *         description: Product type (R=Regular, D=Digital)
 *     responses:
 *       200:
 *         description: Product specification sheet
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
 *       400:
 *         description: Invalid product type
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
router.get('/:id/specsheet/:type', async (req, res) => {
  try {
    const { id, type } = req.params;
    
    // Validate product type
    if (!['R', 'D'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product type. Must be R (Regular) or D (Digital)'
      });
    }
    
    const specsheet = await productModel.getProductSpecsheet(type, parseInt(id));
    
    if (!specsheet) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: specsheet
    });
  } catch (error) {
    logger.error('Error fetching product specsheet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product specsheet',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/products/cache/rebuild:
 *   post:
 *     summary: Rebuild the product cache
 *     description: Rebuilds the entire product cache table
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Cache rebuilt successfully
 *       500:
 *         description: Error rebuilding cache
 */
router.post('/cache/rebuild', async (req, res) => {
    try {
        const result = await productModel.buildCachedProductSpecView();
        if (result) {
            return res.status(200).json({ message: 'Product cache rebuilt successfully' });
        } else {
            return res.status(500).json({ error: 'Failed to rebuild product cache' });
        }
    } catch (error) {
        logger.error(`Error rebuilding product cache: ${error.message}`, { error });
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/products/cache/refresh/{id}/{type}:
 *   post:
 *     summary: Refresh a product in the cache
 *     description: Refreshes a specific product in the cache table
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [R, D]
 *         description: Product type (R=regular, D=digital)
 *     responses:
 *       200:
 *         description: Product cache refreshed successfully
 *       404:
 *         description: Product not found
 *       500:
 *         description: Error refreshing product cache
 */
router.post('/cache/refresh/:id/:type', async (req, res) => {
    try {
        const { id, type } = req.params;
        const result = await productModel.refreshCachedProductRow(id, type);
        
        if (result) {
            return res.status(200).json({ message: 'Product cache refreshed successfully' });
        } else {
            return res.status(404).json({ error: 'Product not found or failed to refresh cache' });
        }
    } catch (error) {
        logger.error(`Error refreshing product cache: ${error.message}`, { error });
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/products/search/items:
 *   post:
 *     summary: Search items for datatable
 *     description: Search items with server-side processing for datatables, matching legacy get_product_items functionality
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               item_id:
 *                 type: string
 *                 description: Optional item ID
 *               product_id:
 *                 type: string
 *                 description: Optional product ID
 *               product_type:
 *                 type: string
 *                 description: Optional product type (R, D, SP, or item_id)
 *     responses:
 *       200:
 *         description: Search results for datatable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tableData:
 *                   type: array
 *                   items:
 *                     type: object
 *                 product_type:
 *                   type: string
 *                 product_id:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.post('/search/items', async (req, res) => {
  try {
    const { item_id, product_id, product_type } = req.body;
    
    // Get items based on provided parameters
    const tableData = await itemModel.searchItems({
      item_id,
      product_id,
      product_type
    });
    
    // Format the response to match legacy app's format
    const response = {
      tableData,
      product_type,
      product_id
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Error searching items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search items',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/products/typeahead_products_list:
 *   post:
 *     summary: Search products and items for typeahead
 *     description: Search products and items for typeahead, matching legacy typeahead_products_list functionality
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *                 description: Search term
 *               itemsOnly:
 *                 type: boolean
 *                 description: If true, only return items
 *               includeDigital:
 *                 type: boolean
 *                 description: If true, include digital products
 *     responses:
 *       200:
 *         description: Search results for typeahead
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   description:
 *                     type: string
 *                   id:
 *                     type: string
 *                   label:
 *                     type: string
 *       500:
 *         description: Server error
 */
router.post('/typeahead_products_list', async (req, res) => {
  try {
    const { query, itemsOnly, includeDigital } = req.body;
    
    // Validate that query is provided and not empty
    if (!query || query.trim().length === 0) {
      return res.json([]);
    }
    
    // Search products and items
    const results = await productModel.searchByName(query, {
      itemsOnly: itemsOnly === true,
      includeDigital: includeDigital !== false
    });
    
    res.json(results);
  } catch (error) {
    logger.error('Error in typeahead search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search products',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/products/search/advanced:
 *   post:
 *     summary: Advanced product search with full-text search
 *     description: Search products using full-text search capabilities for better relevance
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - searchTerm
 *             properties:
 *               searchTerm:
 *                 type: string
 *                 description: Search term
 *               limit:
 *                 type: integer
 *                 description: Maximum number of results
 *                 default: 50
 *     responses:
 *       200:
 *         description: Advanced search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 count:
 *                   type: integer
 *       500:
 *         description: Server error
 */
router.post('/search/advanced', async (req, res) => {
  try {
    const { searchTerm, limit } = req.body;
    
    if (!searchTerm || searchTerm.trim().length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }
    
    const results = await productModel.advancedSearch(searchTerm, { limit });
    
    res.json({
      success: true,
      data: results,
      count: results.length
    });
  } catch (error) {
    logger.error('Error in advanced search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform advanced search',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/products/search/filters:
 *   post:
 *     summary: Search products with filters
 *     description: Search products using various filters
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               searchTerm:
 *                 type: string
 *                 description: Search term
 *               outdoor:
 *                 type: string
 *                 enum: [Y, N]
 *                 description: Outdoor fabric filter
 *               productType:
 *                 type: string
 *                 enum: [R, D]
 *                 description: Product type filter
 *               vendorId:
 *                 type: string
 *                 description: Vendor abbreviation filter
 *               priceMin:
 *                 type: number
 *                 description: Minimum price filter
 *               priceMax:
 *                 type: number
 *                 description: Maximum price filter
 *               widthMin:
 *                 type: number
 *                 description: Minimum width filter
 *               widthMax:
 *                 type: number
 *                 description: Maximum width filter
 *               limit:
 *                 type: integer
 *                 description: Maximum number of results
 *     responses:
 *       200:
 *         description: Filtered search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 count:
 *                   type: integer
 *       500:
 *         description: Server error
 */
router.post('/search/filters', async (req, res) => {
  try {
    const filters = req.body;
    const results = await productModel.searchWithFilters(filters);
    
    res.json({
      success: true,
      data: results,
      count: results.length
    });
  } catch (error) {
    logger.error('Error in filtered search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform filtered search',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/products/search/suggestions:
 *   post:
 *     summary: Get search suggestions
 *     description: Get search suggestions based on partial input
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - partial
 *             properties:
 *               partial:
 *                 type: string
 *                 description: Partial search term
 *               limit:
 *                 type: integer
 *                 description: Maximum number of suggestions
 *                 default: 10
 *     responses:
 *       200:
 *         description: Search suggestions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       suggestion:
 *                         type: string
 *                       type:
 *                         type: string
 *       500:
 *         description: Server error
 */
router.post('/search/suggestions', async (req, res) => {
  try {
    const { partial, limit } = req.body;
    
    if (!partial || partial.trim().length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    const suggestions = await productModel.getSearchSuggestions(partial, limit);
    
    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    logger.error('Error getting search suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get search suggestions',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/products/cache/status:
 *   get:
 *     summary: Check cache table status
 *     description: Check if the cache table exists and has data
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Cache status information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 exists:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.get('/cache/status', async (req, res) => {
  try {
    // Check if cache table exists
    const existsQuery = `
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'cached_product_spec_view'
    `;
    const existsResult = await productModel.executeQuery(existsQuery);
    const exists = existsResult[0].count > 0;
    
    let count = 0;
    let message = '';
    
    if (exists) {
      const countResult = await productModel.executeQuery('SELECT COUNT(*) as count FROM cached_product_spec_view');
      count = countResult[0].count;
      message = count > 0 ? 'Cache table exists and has data' : 'Cache table exists but is empty';
    } else {
      message = 'Cache table does not exist';
    }
    
    res.json({
      success: true,
      exists,
      count,
      message
    });
  } catch (error) {
    logger.error('Error checking cache status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check cache status',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/products/cache/initialize:
 *   post:
 *     summary: Initialize cache table
 *     description: Create and populate the cache table if it doesn't exist
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Cache initialized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.post('/cache/initialize', async (req, res) => {
  try {
    const result = await productModel.ensureCacheTableExists();
    
    if (result) {
      res.json({
        success: true,
        message: 'Cache table initialized successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to initialize cache table'
      });
    }
  } catch (error) {
    logger.error('Error initializing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize cache table',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/products/{id}/mini-forms/{type}:
 *   get:
 *     summary: Get mini-form data with actual file URLs for a product
 *     description: Returns abrasion, firecodes, front content, and back content data with real file paths
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [R, D]
 *         description: Product type (R for Regular, D for Digital)
 *     responses:
 *       200:
 *         description: Mini-form data with file URLs
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
router.get('/:id/mini-forms/:type', async (req, res) => {
  try {
    const { id, type } = req.params;
    
    if (!['R', 'D'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product type. Must be R (Regular) or D (Digital)'
      });
    }
    
    // Use the new ProductModel method to get mini-forms data
    const miniFormsData = await productModel.getMiniFormsData(parseInt(id));
    
    res.json({
      success: true,
      data: {
        productId: parseInt(id),
        productType: type,
        ...miniFormsData
      }
    });
    
  } catch (error) {
    logger.error('Error fetching mini-forms data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/products/{id}/with-miniforms:
 *   get:
 *     summary: Get product with all mini-forms data included
 *     description: Retrieve product details with front content, back content, abrasion, and firecodes data
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product with mini-forms data
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
 *                   description: Product with mini-forms data
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
router.get('/:id/with-miniforms', async (req, res) => {
  try {
    const { id } = req.params;
    
    const productWithMiniforms = await productModel.getProductWithMiniforms(parseInt(id));
    
    if (!productWithMiniforms) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: productWithMiniforms
    });
    
  } catch (error) {
    logger.error('Error fetching product with mini-forms:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
