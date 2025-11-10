/**
 * Authentication Utilities
 * Provides JWT token generation and validation for testing and application use
 */

const jwt = require('jsonwebtoken');

// Use a test secret for development/testing
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-development';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Generate a JWT token for a user
 * @param {Object} user - User object with id, username, role, etc.
 * @param {Object} options - Optional token options (expiresIn, etc.)
 * @returns {string} JWT token
 */
function generateToken(user, options = {}) {
    const payload = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role || 'user',
        // Add any other user properties needed
        ...(user.showroom_id && { showroom_id: user.showroom_id })
    };

    const tokenOptions = {
        expiresIn: options.expiresIn || JWT_EXPIRES_IN,
        issuer: 'opuzen-api',
        subject: user.id?.toString()
    };

    return jwt.sign(payload, JWT_SECRET, tokenOptions);
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
}

/**
 * Generate a refresh token (longer-lived)
 * @param {Object} user - User object
 * @returns {string} Refresh token
 */
function generateRefreshToken(user) {
    const payload = {
        id: user.id,
        username: user.username,
        type: 'refresh'
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: '7d', // Refresh tokens last 7 days
        issuer: 'opuzen-api',
        subject: user.id?.toString()
    });
}

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token or null if not found
 */
function extractTokenFromHeader(authHeader) {
    if (!authHeader) return null;
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return null;
    }
    
    return parts[1];
}

/**
 * Middleware to authenticate JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function authenticateToken(req, res, next) {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access token required'
        });
    }

    try {
        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
}

/**
 * Middleware to check if user has required role
 * @param {string|Array} allowedRoles - Role or array of roles allowed
 * @returns {Function} Express middleware function
 */
function requireRole(allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions'
            });
        }

        next();
    };
}

module.exports = {
    generateToken,
    verifyToken,
    generateRefreshToken,
    extractTokenFromHeader,
    authenticateToken,
    requireRole
};