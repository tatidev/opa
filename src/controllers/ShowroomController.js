const express = require('express');
const router = express.Router();
const ShowroomModel = require('../models/ShowroomModel');
const UserModel = require('../models/UserModel');
const validation = require('../utils/validation');
const logger = require('../utils/logger');
const { authenticate, requireAdmin, requireShowroomAccess } = require('../middleware/auth');

// Instantiate models
const showroomModel = new ShowroomModel();
const userModel = new UserModel();

/**
 * @swagger
 * components:
 *   schemas:
 *     Showroom:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Showroom ID
 *           example: 1
 *         name:
 *           type: string
 *           description: Showroom name
 *           example: Main Office
 *         abbreviation:
 *           type: string
 *           description: Showroom abbreviation
 *           example: MO
 *         address:
 *           type: string
 *           description: Physical address
 *           example: 123 Main St
 *         city:
 *           type: string
 *           description: City
 *           example: New York
 *         state:
 *           type: string
 *           description: State
 *           example: NY
 *         zip:
 *           type: string
 *           description: ZIP code
 *           example: 10001
 *         country:
 *           type: string
 *           description: Country
 *           example: USA
 *         phone:
 *           type: string
 *           description: Phone number
 *           example: +1234567890
 *         email:
 *           type: string
 *           description: Email address
 *           example: main@example.com
 *         contact_person:
 *           type: string
 *           description: Contact person
 *           example: John Doe
 *         is_active:
 *           type: boolean
 *           description: Active status
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     
 *     CreateShowroomRequest:
 *       type: object
 *       required:
 *         - name
 *         - abbreviation
 *       properties:
 *         name:
 *           type: string
 *           description: Showroom name
 *           example: Main Office
 *         abbreviation:
 *           type: string
 *           description: Showroom abbreviation
 *           example: MO
 *         address:
 *           type: string
 *           description: Physical address
 *           example: 123 Main St
 *         city:
 *           type: string
 *           description: City
 *           example: New York
 *         state:
 *           type: string
 *           description: State
 *           example: NY
 *         zip:
 *           type: string
 *           description: ZIP code
 *           example: 10001
 *         country:
 *           type: string
 *           description: Country
 *           example: USA
 *         phone:
 *           type: string
 *           description: Phone number
 *           example: +1234567890
 *         email:
 *           type: string
 *           description: Email address
 *           example: main@example.com
 *         contact_person:
 *           type: string
 *           description: Contact person
 *           example: John Doe
 *     
 *     UpdateShowroomRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Showroom name
 *           example: Main Office
 *         abbreviation:
 *           type: string
 *           description: Showroom abbreviation
 *           example: MO
 *         address:
 *           type: string
 *           description: Physical address
 *           example: 123 Main St
 *         city:
 *           type: string
 *           description: City
 *           example: New York
 *         state:
 *           type: string
 *           description: State
 *           example: NY
 *         zip:
 *           type: string
 *           description: ZIP code
 *           example: 10001
 *         country:
 *           type: string
 *           description: Country
 *           example: USA
 *         phone:
 *           type: string
 *           description: Phone number
 *           example: +1234567890
 *         email:
 *           type: string
 *           description: Email address
 *           example: main@example.com
 *         contact_person:
 *           type: string
 *           description: Contact person
 *           example: John Doe
 *         is_active:
 *           type: boolean
 *           description: Active status
 *           example: true
 *     
 *     ShowroomListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             showrooms:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Showroom'
 *             pagination:
 *               type: object
 *               properties:
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 10
 *                 total:
 *                   type: integer
 *                   example: 50
 *                 pages:
 *                   type: integer
 *                   example: 5
 */

/**
 * @swagger
 * /api/showrooms:
 *   get:
 *     summary: List all showrooms
 *     description: Get a paginated list of all showrooms
 *     tags: [Showroom Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in name, abbreviation, city, state
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Showrooms retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShowroomListResponse'
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 10, search, active } = req.query;
        
        // Build filters
        const filters = {};
        if (search) filters.search = search;
        if (active !== undefined) filters.active = active === 'true';
        
        // Get showrooms with pagination
        const result = await showroomModel.getAllShowrooms({
            page: parseInt(page),
            limit: parseInt(limit),
            ...filters
        });
        
        logger.info('Showrooms list retrieved', {
            userId: req.user.id,
            page: parseInt(page),
            limit: parseInt(limit),
            filters
        });
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        logger.error('Get showrooms error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve showrooms',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/showrooms:
 *   post:
 *     summary: Create new showroom
 *     description: Create a new showroom (Admin only)
 *     tags: [Showroom Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateShowroomRequest'
 *     responses:
 *       201:
 *         description: Showroom created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Showroom'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       409:
 *         description: Showroom name or abbreviation already exists
 *       500:
 *         description: Server error
 */
router.post('/', authenticate, requireAdmin, async (req, res) => {
    try {
        const showroomData = req.body;
        
        // Validate input
        const validation_result = validation.validateCreateShowroom(showroomData);
        if (!validation_result.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: validation_result.errors
            });
        }
        
        // Check if showroom name or abbreviation already exists
        const existingShowroom = await showroomModel.findByName(showroomData.name);
        if (existingShowroom) {
            return res.status(409).json({
                success: false,
                error: 'Showroom name already exists',
                message: 'A showroom with this name already exists'
            });
        }
        
        const existingAbbreviation = await showroomModel.findByAbbreviation(showroomData.abbreviation);
        if (existingAbbreviation) {
            return res.status(409).json({
                success: false,
                error: 'Showroom abbreviation already exists',
                message: 'A showroom with this abbreviation already exists'
            });
        }
        
        // Create showroom
        const showroom = await showroomModel.createShowroom(showroomData);
        
        logger.info('Showroom created', {
            createdBy: req.user.id,
            showroomId: showroom.id,
            name: showroom.name,
            abbreviation: showroom.abbreviation
        });
        
        res.status(201).json({
            success: true,
            data: showroom
        });
        
    } catch (error) {
        logger.error('Create showroom error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create showroom',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/showrooms/{id}:
 *   get:
 *     summary: Get showroom by ID
 *     description: Get a specific showroom by ID
 *     tags: [Showroom Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Showroom ID
 *     responses:
 *       200:
 *         description: Showroom retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Showroom'
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Showroom not found
 *       500:
 *         description: Server error
 */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const showroomId = parseInt(req.params.id);
        
        if (isNaN(showroomId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid showroom ID',
                message: 'Showroom ID must be a valid number'
            });
        }
        
        const showroom = await showroomModel.findById(showroomId);
        
        if (!showroom) {
            return res.status(404).json({
                success: false,
                error: 'Showroom not found',
                message: 'Showroom with the specified ID does not exist'
            });
        }
        
        res.json({
            success: true,
            data: showroom
        });
        
    } catch (error) {
        logger.error('Get showroom error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve showroom',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/showrooms/{id}:
 *   put:
 *     summary: Update showroom
 *     description: Update a showroom's information (Admin only)
 *     tags: [Showroom Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Showroom ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateShowroomRequest'
 *     responses:
 *       200:
 *         description: Showroom updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Showroom'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Showroom not found
 *       409:
 *         description: Showroom name or abbreviation already exists
 *       500:
 *         description: Server error
 */
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const showroomId = parseInt(req.params.id);
        const updateData = req.body;
        
        if (isNaN(showroomId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid showroom ID',
                message: 'Showroom ID must be a valid number'
            });
        }
        
        // Validate input
        const validation_result = validation.validateUpdateShowroom(updateData);
        if (!validation_result.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: validation_result.errors
            });
        }
        
        // Check if showroom exists
        const existingShowroom = await showroomModel.findById(showroomId);
        if (!existingShowroom) {
            return res.status(404).json({
                success: false,
                error: 'Showroom not found',
                message: 'Showroom with the specified ID does not exist'
            });
        }
        
        // Check for name/abbreviation conflicts
        if (updateData.name && updateData.name !== existingShowroom.name) {
            const conflictShowroom = await showroomModel.findByName(updateData.name);
            if (conflictShowroom && conflictShowroom.id !== showroomId) {
                return res.status(409).json({
                    success: false,
                    error: 'Showroom name already exists',
                    message: 'A showroom with this name already exists'
                });
            }
        }
        
        if (updateData.abbreviation && updateData.abbreviation !== existingShowroom.abbreviation) {
            const conflictShowroom = await showroomModel.findByAbbreviation(updateData.abbreviation);
            if (conflictShowroom && conflictShowroom.id !== showroomId) {
                return res.status(409).json({
                    success: false,
                    error: 'Showroom abbreviation already exists',
                    message: 'A showroom with this abbreviation already exists'
                });
            }
        }
        
        // Update showroom
        const showroom = await showroomModel.updateShowroom(showroomId, updateData);
        
        logger.info('Showroom updated', {
            updatedBy: req.user.id,
            showroomId: showroomId,
            changes: Object.keys(updateData)
        });
        
        res.json({
            success: true,
            data: showroom
        });
        
    } catch (error) {
        logger.error('Update showroom error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update showroom',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/showrooms/{id}/users:
 *   get:
 *     summary: Get showroom users
 *     description: Get all users assigned to a showroom (Admin or showroom access required)
 *     tags: [Showroom Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Showroom ID
 *     responses:
 *       200:
 *         description: Showroom users retrieved successfully
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
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Showroom not found
 *       500:
 *         description: Server error
 */
router.get('/:id/users', authenticate, requireShowroomAccess('id'), async (req, res) => {
    try {
        const showroomId = parseInt(req.params.id);
        
        if (isNaN(showroomId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid showroom ID',
                message: 'Showroom ID must be a valid number'
            });
        }
        
        // Check if showroom exists
        const showroom = await showroomModel.findById(showroomId);
        if (!showroom) {
            return res.status(404).json({
                success: false,
                error: 'Showroom not found',
                message: 'Showroom with the specified ID does not exist'
            });
        }
        
        // Get users assigned to this showroom
        const users = await showroomModel.getShowroomUsers(showroomId);
        
        res.json({
            success: true,
            data: users
        });
        
    } catch (error) {
        logger.error('Get showroom users error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve showroom users',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/showrooms/{id}/users/{userId}:
 *   post:
 *     summary: Assign user to showroom
 *     description: Assign a user to a showroom (Admin only)
 *     tags: [Showroom Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Showroom ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User assigned to showroom successfully
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
 *                   example: User assigned to showroom successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Showroom or user not found
 *       409:
 *         description: User already assigned to showroom
 *       500:
 *         description: Server error
 */
router.post('/:id/users/:userId', authenticate, requireAdmin, async (req, res) => {
    try {
        const showroomId = parseInt(req.params.id);
        const userId = parseInt(req.params.userId);
        
        if (isNaN(showroomId) || isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid ID',
                message: 'Showroom ID and User ID must be valid numbers'
            });
        }
        
        // Check if showroom exists
        const showroom = await showroomModel.findById(showroomId);
        if (!showroom) {
            return res.status(404).json({
                success: false,
                error: 'Showroom not found',
                message: 'Showroom with the specified ID does not exist'
            });
        }
        
        // Check if user exists
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                message: 'User with the specified ID does not exist'
            });
        }
        
        // Check if user is already assigned to showroom
        const hasAccess = await userModel.hasShowroomAccess(userId, showroomId);
        if (hasAccess) {
            return res.status(409).json({
                success: false,
                error: 'User already assigned',
                message: 'User is already assigned to this showroom'
            });
        }
        
        // Assign user to showroom
        await userModel.assignShowroom(userId, showroomId);
        
        logger.info('User assigned to showroom', {
            assignedBy: req.user.id,
            userId: userId,
            showroomId: showroomId
        });
        
        res.json({
            success: true,
            message: 'User assigned to showroom successfully'
        });
        
    } catch (error) {
        logger.error('Assign user to showroom error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to assign user to showroom',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/showrooms/{id}/users/{userId}:
 *   delete:
 *     summary: Remove user from showroom
 *     description: Remove a user from a showroom (Admin only)
 *     tags: [Showroom Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Showroom ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User removed from showroom successfully
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
 *                   example: User removed from showroom successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Showroom or user not found
 *       409:
 *         description: User not assigned to showroom
 *       500:
 *         description: Server error
 */
router.delete('/:id/users/:userId', authenticate, requireAdmin, async (req, res) => {
    try {
        const showroomId = parseInt(req.params.id);
        const userId = parseInt(req.params.userId);
        
        if (isNaN(showroomId) || isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid ID',
                message: 'Showroom ID and User ID must be valid numbers'
            });
        }
        
        // Check if showroom exists
        const showroom = await showroomModel.findById(showroomId);
        if (!showroom) {
            return res.status(404).json({
                success: false,
                error: 'Showroom not found',
                message: 'Showroom with the specified ID does not exist'
            });
        }
        
        // Check if user exists
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                message: 'User with the specified ID does not exist'
            });
        }
        
        // Check if user is assigned to showroom
        const hasAccess = await userModel.hasShowroomAccess(userId, showroomId);
        if (!hasAccess) {
            return res.status(409).json({
                success: false,
                error: 'User not assigned',
                message: 'User is not assigned to this showroom'
            });
        }
        
        // Remove user from showroom
        await userModel.removeShowroom(userId, showroomId);
        
        logger.info('User removed from showroom', {
            removedBy: req.user.id,
            userId: userId,
            showroomId: showroomId
        });
        
        res.json({
            success: true,
            message: 'User removed from showroom successfully'
        });
        
    } catch (error) {
        logger.error('Remove user from showroom error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove user from showroom',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router; 