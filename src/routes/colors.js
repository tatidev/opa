const express = require('express');
const router = express.Router();
const ColorModel = require('../models/ColorModel');
const logger = require('../utils/logger');

// Instantiate model
const colorModel = new ColorModel();

/**
 * @swagger
 * /api/colors:
 *   get:
 *     summary: Get all colors
 *     description: Retrieve a list of all colors with optional filtering
 *     tags: [Colors]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter colors by name
 *       - in: query
 *         name: archived
 *         schema:
 *           type: string
 *           enum: [Y, N]
 *         default: N
 *         description: Filter by archived status (Y=archived, N=active)
 *     responses:
 *       200:
 *         description: A list of colors
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
 *                   example: 10
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
    const { name, archived = 'N' } = req.query;
    
    const filters = {};
    if (name) filters.name = name;
    if (archived !== undefined) filters.archived = archived;
    
    const colors = await colorModel.getAllColors(filters);
    
    res.json({
      success: true,
      data: colors,
      count: colors.length,
      filters: filters
    });
  } catch (error) {
    logger.error('Error fetching colors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch colors',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/colors/{id}:
 *   get:
 *     summary: Get color by ID
 *     description: Retrieve detailed information for a specific color
 *     tags: [Colors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Color ID
 *     responses:
 *       200:
 *         description: Color details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Color'
 *       404:
 *         description: Color not found
 *       500:
 *         description: Server error
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const color = await colorModel.findById(id);
    
    if (!color) {
      return res.status(404).json({
        success: false,
        error: 'Color not found'
      });
    }
    
    res.json({
      success: true,
      data: color
    });
  } catch (error) {
    logger.error('Error fetching color:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch color',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/colors/{id}/items:
 *   get:
 *     summary: Get items that use a specific color
 *     description: Retrieve all items associated with a specific color
 *     tags: [Colors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Color ID
 *     responses:
 *       200:
 *         description: List of items using the color
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
 *                 color_id:
 *                   type: integer
 *       500:
 *         description: Server error
 */
router.get('/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    const items = await colorModel.getItemsByColor(parseInt(id));
    
    res.json({
      success: true,
      data: items,
      count: items.length,
      color_id: parseInt(id)
    });
  } catch (error) {
    logger.error('Error fetching items by color:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch items by color',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
