const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * General API rate limiting
 * Applied to all /api/* routes except explicitly excluded paths
 * 
 * Limit: 1000 requests per IP per 15 minutes
 * Purpose: Prevent general DoS attacks while allowing normal usage
 */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per IP per 15 minutes
    message: {
        success: false,
        error: 'Too many requests',
        message: 'You have exceeded the rate limit. Please try again later.'
    },
    standardHeaders: true, // Return rate limit info in RateLimit-* headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    // Skip rate limiting for certain endpoints
    skip: (req) => {
        // Skip health checks
        if (req.path === '/health' || req.path === '/') {
            return true;
        }
        // Skip NetSuite webhooks (server-to-server, not user requests)
        if (req.path.startsWith('/api/ns-to-opms/webhook')) {
            return true;
        }
        return false;
    },
    handler: (req, res) => {
        logger.warn('Rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            userAgent: req.get('User-Agent')
        });
        res.status(429).json({
            success: false,
            error: 'Too many requests',
            message: 'You have exceeded the rate limit. Please try again in 15 minutes.'
        });
    }
});

/**
 * Strict rate limiting for expensive operations
 * Applied to export/import endpoints that can consume significant resources
 * 
 * Limit: 100 requests per IP per 15 minutes
 * Purpose: Prevent resource exhaustion from expensive database queries and file operations
 */
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per IP per 15 minutes
    message: {
        success: false,
        error: 'Too many requests',
        message: 'You have exceeded the rate limit for this endpoint. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('Strict rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            endpoint: req.path.split('/')[2], // e.g., 'export' or 'import'
            userAgent: req.get('User-Agent')
        });
        res.status(429).json({
            success: false,
            error: 'Too many requests',
            message: 'You have exceeded the rate limit for this resource-intensive endpoint. Please try again in 15 minutes.'
        });
    }
});

/**
 * Very strict rate limiting for batch/bulk operations
 * Applied to endpoints that trigger large-scale operations
 * 
 * Limit: 20 requests per IP per 15 minutes
 * Purpose: Prevent abuse of batch operations that can impact system performance
 */
const batchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per IP per 15 minutes
    message: {
        success: false,
        error: 'Too many batch requests',
        message: 'You have exceeded the rate limit for batch operations. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('Batch rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            userAgent: req.get('User-Agent')
        });
        res.status(429).json({
            success: false,
            error: 'Too many batch requests',
            message: 'You have exceeded the rate limit for batch operations. Please try again in 15 minutes.'
        });
    }
});

module.exports = {
    apiLimiter,
    strictLimiter,
    batchLimiter
};

