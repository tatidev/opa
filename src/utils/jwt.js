const jwt = require('jsonwebtoken');
const logger = require('./logger');

// SECURITY: JWT_SECRET must be configured - never use fallback secrets
if (!process.env.JWT_SECRET) {
    const error = 'CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not set. Application cannot start without a secure JWT secret.';
    logger.error(error);
    throw new Error(error);
}

// SECURITY: Enforce minimum secret length in production
if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32) {
    const error = 'CRITICAL SECURITY ERROR: JWT_SECRET must be at least 32 characters in production.';
    logger.error(error);
    throw new Error(error);
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Generate JWT access token
 * @param {Object} payload - Token payload
 * @returns {string} JWT token
 */
function generateAccessToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { 
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'opuzen-api',
        audience: 'opuzen-client'
    });
}

/**
 * Generate JWT refresh token
 * @param {Object} payload - Token payload
 * @returns {string} JWT refresh token
 */
function generateRefreshToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { 
        expiresIn: JWT_REFRESH_EXPIRES_IN,
        issuer: 'opuzen-api',
        audience: 'opuzen-client'
    });
}

/**
 * Generate both access and refresh tokens
 * @param {Object} user - User object
 * @returns {Object} Token pair
 */
function generateTokenPair(user) {
    const payload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles || [],
        showrooms: user.showrooms || []
    };

    return {
        accessToken: generateAccessToken(payload),
        refreshToken: generateRefreshToken({ userId: user.id }),
        expiresIn: JWT_EXPIRES_IN
    };
}

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded payload or null if invalid
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET, {
            issuer: 'opuzen-api',
            audience: 'opuzen-client'
        });
    } catch (error) {
        logger.debug('Token verification failed:', error.message);
        return null;
    }
}

/**
 * Decode JWT token without verification (for expired tokens)
 * @param {string} token - JWT token to decode
 * @returns {Object|null} Decoded payload or null if invalid
 */
function decodeToken(token) {
    try {
        return jwt.decode(token);
    } catch (error) {
        logger.debug('Token decode failed:', error.message);
        return null;
    }
}

/**
 * Check if token is expired
 * @param {string} token - JWT token
 * @returns {boolean} Whether token is expired
 */
function isTokenExpired(token) {
    const decoded = decodeToken(token);
    if (!decoded) return true;
    
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
}

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token or null if not found
 */
function extractTokenFromHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7);
}

/**
 * Get token expiration time
 * @param {string} token - JWT token
 * @returns {Date|null} Expiration date or null if invalid
 */
function getTokenExpiration(token) {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return null;
    
    return new Date(decoded.exp * 1000);
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @param {Function} getUserById - Function to get user by ID
 * @returns {Object|null} New token pair or null if invalid
 */
async function refreshAccessToken(refreshToken, getUserById) {
    try {
        const decoded = verifyToken(refreshToken);
        if (!decoded || !decoded.userId) {
            return null;
        }

        const user = await getUserById(decoded.userId);
        if (!user) {
            return null;
        }

        return generateTokenPair(user);
    } catch (error) {
        logger.error('Error refreshing token:', error);
        return null;
    }
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    generateTokenPair,
    verifyToken,
    decodeToken,
    isTokenExpired,
    extractTokenFromHeader,
    getTokenExpiration,
    refreshAccessToken
}; 