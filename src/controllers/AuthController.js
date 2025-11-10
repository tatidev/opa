const express = require('express');
const router = express.Router();
const UserModel = require('../models/UserModel');
const RoleModel = require('../models/RoleModel');
const ShowroomModel = require('../models/ShowroomModel');
const jwt = require('../utils/jwt');
const validation = require('../utils/validation');
const { rateLimitAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

// Instantiate models
const userModel = new UserModel();
const roleModel = new RoleModel();
const showroomModel = new ShowroomModel();

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - identifier
 *         - password
 *       properties:
 *         identifier:
 *           type: string
 *           description: Username or email address
 *           example: john_doe
 *         password:
 *           type: string
 *           description: User password
 *           example: securePassword123
 *     
 *     LoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               $ref: '#/components/schemas/User'
 *             tokens:
 *               $ref: '#/components/schemas/TokenPair'
 *     
 *     TokenPair:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *           description: JWT access token
 *           example: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
 *         refreshToken:
 *           type: string
 *           description: JWT refresh token
 *           example: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
 *         expiresIn:
 *           type: string
 *           description: Token expiration time
 *           example: 24h
 *     
 *     RefreshRequest:
 *       type: object
 *       required:
 *         - refreshToken
 *       properties:
 *         refreshToken:
 *           type: string
 *           description: Valid refresh token
 *           example: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
 *     
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: User ID
 *           example: 1
 *         username:
 *           type: string
 *           description: Username
 *           example: john_doe
 *         email:
 *           type: string
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
 *         email_verified:
 *           type: boolean
 *           description: Email verification status
 *           example: true
 *         last_login:
 *           type: string
 *           format: date-time
 *           description: Last login timestamp
 *         roles:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *         showrooms:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               name:
 *                 type: string
 *               abbreviation:
 *                 type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *   
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user with username/email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Validation failed
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: Authentication failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Invalid credentials
 *                 message:
 *                   type: string
 *       423:
 *         description: Account locked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Account locked
 *                 message:
 *                   type: string
 *       429:
 *         description: Too many attempts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Too many attempts
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.post('/login', rateLimitAuth(5, 15 * 60 * 1000), async (req, res) => {
    try {
        const { identifier, password } = req.body;
        
        // Validate input
        const validation_result = validation.validateLogin({ identifier, password });
        if (!validation_result.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: validation_result.errors
            });
        }
        
        // Find user
        const user = await userModel.findByIdentifier(identifier);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials',
                message: 'Username or password is incorrect'
            });
        }
        
        // Check account status
        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                error: 'Account deactivated',
                message: 'Your account has been deactivated. Please contact support.'
            });
        }
        
        // Check if account is locked
        if (userModel.isUserLocked(user)) {
            return res.status(423).json({
                success: false,
                error: 'Account locked',
                message: 'Account is temporarily locked due to failed login attempts. Please try again later.'
            });
        }
        
        // Verify password
        const isPasswordValid = await userModel.verifyPassword(password, user.password_hash);
        if (!isPasswordValid) {
            // Handle failed login
            await userModel.handleFailedLogin(user.id);
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials',
                message: 'Username or password is incorrect'
            });
        }
        
        // Get user with roles and showrooms
        const userWithDetails = await userModel.findWithRolesAndShowrooms(user.id);
        
        // Generate tokens
        const tokens = jwt.generateTokenPair(userWithDetails);
        
        // Update last login
        await userModel.updateLastLogin(user.id);
        
        // Remove sensitive data from response
        const userResponse = { ...userWithDetails };
        delete userResponse.password_hash;
        
        logger.info(`User login successful: ${user.username}`, {
            userId: user.id,
            username: user.username,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        
        res.json({
            success: true,
            data: {
                user: userResponse,
                tokens: tokens
            }
        });
        
    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Generate new access token using refresh token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshRequest'
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/TokenPair'
 *       400:
 *         description: Invalid refresh token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Invalid refresh token
 *       500:
 *         description: Server error
 */
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: 'Refresh token required',
                message: 'Refresh token is required'
            });
        }
        
        // Refresh token
        const tokens = await jwt.refreshAccessToken(refreshToken, async (userId) => {
            return await userModel.findWithRolesAndShowrooms(userId);
        });
        
        if (!tokens) {
            return res.status(400).json({
                success: false,
                error: 'Invalid refresh token',
                message: 'Refresh token is invalid or expired'
            });
        }
        
        logger.info('Token refreshed successfully', {
            userId: tokens.userId,
            ip: req.ip
        });
        
        res.json({
            success: true,
            data: tokens
        });
        
    } catch (error) {
        logger.error('Token refresh error:', error);
        res.status(500).json({
            success: false,
            error: 'Token refresh failed',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: User logout
 *     description: Logout user (client should discard tokens)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
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
 *                   example: Logout successful
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.post('/logout', async (req, res) => {
    try {
        // In a more advanced implementation, you might want to blacklist the token
        // For now, we'll just log the logout and let the client handle token removal
        
        const authHeader = req.headers.authorization;
        const token = jwt.extractTokenFromHeader(authHeader);
        
        if (token) {
            const decoded = jwt.decodeToken(token);
            if (decoded) {
                logger.info('User logout', {
                    userId: decoded.userId,
                    username: decoded.username,
                    ip: req.ip
                });
            }
        }
        
        res.json({
            success: true,
            message: 'Logout successful'
        });
        
    } catch (error) {
        logger.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     description: Get authenticated user's profile information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
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
 *       500:
 *         description: Server error
 */
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = jwt.extractTokenFromHeader(authHeader);
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'No token provided'
            });
        }
        
        const decoded = jwt.verifyToken(token);
        if (!decoded) {
            return res.status(401).json({
                success: false,
                error: 'Invalid token',
                message: 'Token is invalid or expired'
            });
        }
        
        const user = await userModel.findWithRolesAndShowrooms(decoded.userId);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'User not found',
                message: 'User associated with token no longer exists'
            });
        }
        
        res.json({
            success: true,
            data: user
        });
        
    } catch (error) {
        logger.error('Get current user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user profile',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router; 