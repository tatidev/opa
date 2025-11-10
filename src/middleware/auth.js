const jwt = require('../utils/jwt');
const UserModel = require('../models/UserModel');
const logger = require('../utils/logger');

const userModel = new UserModel();

/**
 * Authentication middleware
 * Verifies JWT token and adds user to request object
 */
const authenticate = async (req, res, next) => {
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
        
        // Get fresh user data to ensure user is still active
        const user = await userModel.findByIdSafe(decoded.userId);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'User not found',
                message: 'User associated with token no longer exists'
            });
        }
        
        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                error: 'Account deactivated',
                message: 'Your account has been deactivated'
            });
        }
        
        // Add user info to request object
        req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            is_active: user.is_active,
            email_verified: user.email_verified,
            roles: decoded.roles || [],
            showrooms: decoded.showrooms || []
        };
        
        next();
    } catch (error) {
        logger.error('Authentication error:', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication failed',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Optional authentication middleware
 * Adds user to request if token is valid, but doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = jwt.extractTokenFromHeader(authHeader);
        
        if (!token) {
            req.user = null;
            return next();
        }
        
        const decoded = jwt.verifyToken(token);
        if (!decoded) {
            req.user = null;
            return next();
        }
        
        const user = await userModel.findByIdSafe(decoded.userId);
        if (!user || !user.is_active) {
            req.user = null;
            return next();
        }
        
        req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            is_active: user.is_active,
            email_verified: user.email_verified,
            roles: decoded.roles || [],
            showrooms: decoded.showrooms || []
        };
        
        next();
    } catch (error) {
        logger.error('Optional authentication error:', error);
        req.user = null;
        next();
    }
};

/**
 * Role-based authorization middleware
 * @param {string|Array} roles - Required role(s)
 * @returns {Function} Middleware function
 */
const requireRole = (roles) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                    message: 'Please log in first'
                });
            }
            
            const requiredRoles = Array.isArray(roles) ? roles : [roles];
            const userRoles = req.user.roles.map(role => role.name || role);
            
            // Check if user has admin role (admin can access everything)
            if (userRoles.includes('admin')) {
                return next();
            }
            
            // Check if user has any of the required roles
            const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
            
            if (!hasRequiredRole) {
                return res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions',
                    message: `Required role(s): ${requiredRoles.join(', ')}`
                });
            }
            
            next();
        } catch (error) {
            logger.error('Role authorization error:', error);
            return res.status(500).json({
                success: false,
                error: 'Authorization failed',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    };
};

/**
 * Showroom-based authorization middleware
 * @param {string} showroomParam - Request parameter name for showroom ID
 * @returns {Function} Middleware function
 */
const requireShowroomAccess = (showroomParam = 'showroomId') => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                    message: 'Please log in first'
                });
            }
            
            const showroomId = req.params[showroomParam] || req.body[showroomParam];
            if (!showroomId) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing showroom ID',
                    message: 'Showroom ID is required'
                });
            }
            
            const userRoles = req.user.roles.map(role => role.name || role);
            
            // Admin can access all showrooms
            if (userRoles.includes('admin')) {
                return next();
            }
            
            // Check if user has access to this showroom
            const userShowrooms = req.user.showrooms.map(showroom => showroom.id || showroom);
            
            if (!userShowrooms.includes(parseInt(showroomId))) {
                return res.status(403).json({
                    success: false,
                    error: 'Showroom access denied',
                    message: 'You do not have access to this showroom'
                });
            }
            
            next();
        } catch (error) {
            logger.error('Showroom authorization error:', error);
            return res.status(500).json({
                success: false,
                error: 'Authorization failed',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    };
};

/**
 * Self or admin authorization middleware
 * Allows users to access their own resources or admins to access any
 * @param {string} userParam - Request parameter name for user ID
 * @returns {Function} Middleware function
 */
const requireSelfOrAdmin = (userParam = 'userId') => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                    message: 'Please log in first'
                });
            }
            
            const targetUserId = req.params[userParam] || req.body[userParam];
            if (!targetUserId) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing user ID',
                    message: 'User ID is required'
                });
            }
            
            const userRoles = req.user.roles.map(role => role.name || role);
            
            // Admin can access any user
            if (userRoles.includes('admin')) {
                return next();
            }
            
            // User can access their own resources
            if (req.user.id === parseInt(targetUserId)) {
                return next();
            }
            
            return res.status(403).json({
                success: false,
                error: 'Access denied',
                message: 'You can only access your own resources'
            });
        } catch (error) {
            logger.error('Self or admin authorization error:', error);
            return res.status(500).json({
                success: false,
                error: 'Authorization failed',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    };
};

/**
 * Admin-only authorization middleware
 */
const requireAdmin = requireRole('admin');

/**
 * Manager or admin authorization middleware
 */
const requireManager = requireRole(['admin', 'manager']);

/**
 * Rate limiting middleware for authentication endpoints
 * @param {number} maxAttempts - Maximum attempts
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Function} Middleware function
 */
const rateLimitAuth = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
    const attempts = new Map();
    
    return (req, res, next) => {
        const key = req.ip;
        const now = Date.now();
        
        if (!attempts.has(key)) {
            attempts.set(key, []);
        }
        
        const userAttempts = attempts.get(key);
        
        // Remove old attempts outside the window
        const validAttempts = userAttempts.filter(time => now - time < windowMs);
        attempts.set(key, validAttempts);
        
        if (validAttempts.length >= maxAttempts) {
            return res.status(429).json({
                success: false,
                error: 'Too many attempts',
                message: `Too many authentication attempts. Try again in ${Math.ceil(windowMs / 60000)} minutes.`
            });
        }
        
        // Add current attempt
        validAttempts.push(now);
        attempts.set(key, validAttempts);
        
        next();
    };
};

module.exports = {
    authenticate,
    optionalAuth,
    requireRole,
    requireShowroomAccess,
    requireSelfOrAdmin,
    requireAdmin,
    requireManager,
    rateLimitAuth
}; 