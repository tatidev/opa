const express = require('express');
const router = express.Router();
const UserModel = require('../models/UserModel');
const RoleModel = require('../models/RoleModel');
const ShowroomModel = require('../models/ShowroomModel');
const validation = require('../utils/validation');
const logger = require('../utils/logger');
const { authenticate, requireAdmin, requireSelfOrAdmin, requireRole } = require('../middleware/auth');

// Instantiate models
const userModel = new UserModel();
const roleModel = new RoleModel();
const showroomModel = new ShowroomModel();

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateUserRequest:
 *       type: object
 *       required:
 *         - username
 *         - email
 *         - password
 *         - first_name
 *         - last_name
 *       properties:
 *         username:
 *           type: string
 *           description: Unique username
 *           example: john_doe
 *         email:
 *           type: string
 *           format: email
 *           description: Unique email address
 *           example: john@example.com
 *         password:
 *           type: string
 *           description: Password (8+ characters)
 *           example: securePassword123
 *         first_name:
 *           type: string
 *           description: First name
 *           example: John
 *         last_name:
 *           type: string
 *           description: Last name
 *           example: Doe
 *         phone:
 *           type: string
 *           description: Phone number
 *           example: +1234567890
 *         company:
 *           type: string
 *           description: Company name
 *           example: Example Corp
 *         roles:
 *           type: array
 *           items:
 *             type: integer
 *           description: Array of role IDs
 *           example: [1, 2]
 *         showrooms:
 *           type: array
 *           items:
 *             type: integer
 *           description: Array of showroom IDs
 *           example: [1]
 *     
 *     UpdateUserRequest:
 *       type: object
 *       properties:
 *         username:
 *           type: string
 *           description: Username
 *           example: john_doe
 *         email:
 *           type: string
 *           format: email
 *           description: Email address
 *           example: john@example.com
 *         first_name:
 *           type: string
 *           description: First name
 *           example: John
 *         last_name:
 *           type: string
 *           description: Last name
 *           example: Doe
 *         phone:
 *           type: string
 *           description: Phone number
 *           example: +1234567890
 *         company:
 *           type: string
 *           description: Company name
 *           example: Example Corp
 *         is_active:
 *           type: boolean
 *           description: Account active status
 *           example: true
 *         roles:
 *           type: array
 *           items:
 *             type: integer
 *           description: Array of role IDs
 *           example: [1, 2]
 *         showrooms:
 *           type: array
 *           items:
 *             type: integer
 *           description: Array of showroom IDs
 *           example: [1]
 *     
 *     UpdatePasswordRequest:
 *       type: object
 *       required:
 *         - currentPassword
 *         - newPassword
 *       properties:
 *         currentPassword:
 *           type: string
 *           description: Current password
 *         newPassword:
 *           type: string
 *           description: New password (8+ characters)
 *     
 *     UserListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             users:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
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
 * /api/users:
 *   get:
 *     summary: List all users
 *     description: Get a paginated list of all users (Admin/Manager only)
 *     tags: [User Management]
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
 *         description: Search in username, first_name, last_name, email
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by role name
 *       - in: query
 *         name: showroom
 *         schema:
 *           type: integer
 *         description: Filter by showroom ID
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserListResponse'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Server error
 */
router.get('/', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const { page = 1, limit = 10, search, role, showroom, active } = req.query;
        
        // Build filters
        const filters = {};
        if (search) filters.search = search;
        if (role) filters.role = role;
        if (showroom) filters.showroom = parseInt(showroom);
        if (active !== undefined) filters.active = active === 'true';
        
        // Get users with pagination
        const result = await userModel.getAllUsersWithDetails({
            page: parseInt(page),
            limit: parseInt(limit),
            ...filters
        });
        
        logger.info('Users list retrieved', {
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
        logger.error('Get users error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve users',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create new user
 *     description: Create a new user account (Admin/Manager only)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       409:
 *         description: Username or email already exists
 *       500:
 *         description: Server error
 */
router.post('/', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const userData = req.body;
        
        // Validate input
        const validation_result = validation.validateCreateUser(userData);
        if (!validation_result.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: validation_result.errors
            });
        }
        
        // Check if username or email already exists
        const existingUser = await userModel.findByIdentifier(userData.username);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'Username already exists',
                message: 'A user with this username already exists'
            });
        }
        
        const existingEmail = await userModel.findByIdentifier(userData.email);
        if (existingEmail) {
            return res.status(409).json({
                success: false,
                error: 'Email already exists',
                message: 'A user with this email already exists'
            });
        }
        
        // Create user
        const user = await userModel.createUser(userData);
        
        // Assign roles if provided
        if (userData.roles && userData.roles.length > 0) {
            for (const roleId of userData.roles) {
                await userModel.assignRole(user.id, roleId);
            }
        }
        
        // Assign showrooms if provided
        if (userData.showrooms && userData.showrooms.length > 0) {
            for (const showroomId of userData.showrooms) {
                await userModel.assignShowroom(user.id, showroomId);
            }
        }
        
        // Get user with full details
        const userWithDetails = await userModel.findWithRolesAndShowrooms(user.id);
        
        logger.info('User created', {
            createdBy: req.user.id,
            userId: user.id,
            username: user.username,
            email: user.email
        });
        
        res.status(201).json({
            success: true,
            data: userWithDetails
        });
        
    } catch (error) {
        logger.error('Create user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create user',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Get a specific user by ID (Self or Admin)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/:id', authenticate, requireSelfOrAdmin('id'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID',
                message: 'User ID must be a valid number'
            });
        }
        
        const user = await userModel.findWithRolesAndShowrooms(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                message: 'User with the specified ID does not exist'
            });
        }
        
        res.json({
            success: true,
            data: user
        });
        
    } catch (error) {
        logger.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve user',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user
 *     description: Update a user's information (Self or Admin)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserRequest'
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       409:
 *         description: Username or email already exists
 *       500:
 *         description: Server error
 */
router.put('/:id', authenticate, requireSelfOrAdmin('id'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const updateData = req.body;
        
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID',
                message: 'User ID must be a valid number'
            });
        }
        
        // Validate input
        const validation_result = validation.validateUpdateUser(updateData);
        if (!validation_result.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: validation_result.errors
            });
        }
        
        // Check if user exists
        const existingUser = await userModel.findById(userId);
        if (!existingUser) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                message: 'User with the specified ID does not exist'
            });
        }
        
        // Check for username/email conflicts
        if (updateData.username && updateData.username !== existingUser.username) {
            const conflictUser = await userModel.findByIdentifier(updateData.username);
            if (conflictUser && conflictUser.id !== userId) {
                return res.status(409).json({
                    success: false,
                    error: 'Username already exists',
                    message: 'A user with this username already exists'
                });
            }
        }
        
        if (updateData.email && updateData.email !== existingUser.email) {
            const conflictUser = await userModel.findByIdentifier(updateData.email);
            if (conflictUser && conflictUser.id !== userId) {
                return res.status(409).json({
                    success: false,
                    error: 'Email already exists',
                    message: 'A user with this email already exists'
                });
            }
        }
        
        // Restrict certain fields for non-admin users
        if (req.user.id === userId && !req.user.roles.includes('admin')) {
            // Users can't change their own active status or roles/showrooms
            delete updateData.is_active;
            delete updateData.roles;
            delete updateData.showrooms;
        }
        
        // Update user
        const user = await userModel.updateUser(userId, updateData);
        
        // Update roles if provided (admin only)
        if (updateData.roles && req.user.roles.includes('admin')) {
            // Remove all existing roles and add new ones
            await userModel.removeAllRoles(userId);
            for (const roleId of updateData.roles) {
                await userModel.assignRole(userId, roleId);
            }
        }
        
        // Update showrooms if provided (admin only)
        if (updateData.showrooms && req.user.roles.includes('admin')) {
            // Remove all existing showrooms and add new ones
            await userModel.removeAllShowrooms(userId);
            for (const showroomId of updateData.showrooms) {
                await userModel.assignShowroom(userId, showroomId);
            }
        }
        
        // Get updated user with full details
        const updatedUser = await userModel.findWithRolesAndShowrooms(userId);
        
        logger.info('User updated', {
            updatedBy: req.user.id,
            userId: userId,
            changes: Object.keys(updateData)
        });
        
        res.json({
            success: true,
            data: updatedUser
        });
        
    } catch (error) {
        logger.error('Update user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update user',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/users/{id}/password:
 *   put:
 *     summary: Update user password
 *     description: Update a user's password (Self only)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePasswordRequest'
 *     responses:
 *       200:
 *         description: Password updated successfully
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
 *                   example: Password updated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authenticated or incorrect current password
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.put('/:id/password', authenticate, requireSelfOrAdmin('id'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { currentPassword, newPassword } = req.body;
        
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID',
                message: 'User ID must be a valid number'
            });
        }
        
        // Validate input
        const validation_result = validation.validateUpdatePassword({ currentPassword, newPassword });
        if (!validation_result.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: validation_result.errors
            });
        }
        
        // Get user
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                message: 'User with the specified ID does not exist'
            });
        }
        
        // Only allow users to change their own password (unless admin)
        if (req.user.id !== userId && !req.user.roles.includes('admin')) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: 'You can only change your own password'
            });
        }
        
        // Verify current password (unless admin changing other user's password)
        if (req.user.id === userId || !req.user.roles.includes('admin')) {
            const isCurrentPasswordValid = await userModel.verifyPassword(currentPassword, user.password_hash);
            if (!isCurrentPasswordValid) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid current password',
                    message: 'Current password is incorrect'
                });
            }
        }
        
        // Update password
        await userModel.updatePassword(userId, newPassword);
        
        logger.info('Password updated', {
            updatedBy: req.user.id,
            userId: userId,
            isAdmin: req.user.roles.includes('admin')
        });
        
        res.json({
            success: true,
            message: 'Password updated successfully'
        });
        
    } catch (error) {
        logger.error('Update password error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update password',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Deactivate user
 *     description: Deactivate a user account (Admin only)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deactivated successfully
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
 *                   example: User deactivated successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       409:
 *         description: Cannot deactivate own account
 *       500:
 *         description: Server error
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID',
                message: 'User ID must be a valid number'
            });
        }
        
        // Prevent self-deactivation
        if (req.user.id === userId) {
            return res.status(409).json({
                success: false,
                error: 'Cannot deactivate own account',
                message: 'You cannot deactivate your own account'
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
        
        // Deactivate user
        await userModel.deactivateUser(userId);
        
        logger.info('User deactivated', {
            deactivatedBy: req.user.id,
            userId: userId,
            username: user.username
        });
        
        res.json({
            success: true,
            message: 'User deactivated successfully'
        });
        
    } catch (error) {
        logger.error('Deactivate user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to deactivate user',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router; 