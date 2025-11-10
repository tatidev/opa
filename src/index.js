// Load environment variables FIRST before any other modules
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createLogger, format, transports } = require('winston');
const swaggerUi = require('swagger-ui-express');

const db = require('./config/database');
const logger = require('./utils/logger');
const apiRoutes = require('./routes');
const swaggerSpecs = require('./config/swagger');
const ProductModel = require('./models/ProductModel');
const OpmsToNetSuiteSyncService = require('./services/OpmsToNetSuiteSyncService');
const { apiLimiter, strictLimiter, batchLimiter } = require('./middleware/rateLimiter');

// Initialize express app
const app = express();

// SECURITY: Configure trust proxy for ALB deployment
// Trust only the first proxy (AWS ALB) for accurate client IP detection
// This is required for rate limiting to work correctly with X-Forwarded-For headers
app.set('trust proxy', 1);

// SECURITY: CORS_ORIGIN must be configured - never use fallback origins
if (!process.env.CORS_ORIGIN) {
  const error = 'CRITICAL SECURITY ERROR: CORS_ORIGIN environment variable is not set. Application cannot start without explicit CORS configuration.';
  logger.error(error);
  throw new Error(error);
}

// Middleware
// SECURITY: Enable Content Security Policy with dashboard compatibility
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts (required for dashboard)
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles (required for dashboard)
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"], // Prevent clickjacking
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN,  // No fallback - must be explicitly configured
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true  // Allow cookies and authentication headers
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// SECURITY: Apply rate limiting to protect against DoS attacks
app.use('/api/', apiLimiter);  // General API protection (1000 req/15min)

// Set timeouts for long-running operations (4000 seconds - max ALB timeout)
app.use((req, res, next) => {
  // For batch operations, extend socket timeout to match ALB (4000 seconds)
  if (req.path.includes('/batch-resync') || req.path.includes('/trigger-batch')) {
    req.socket.setTimeout(4000000); // 4000 seconds (max ALB timeout)
  }
  next();
});

// Serve static files (dashboard)
const path = require('path');
app.use('/dashboard', express.static(path.join(__dirname, 'public')));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

/**
 * @swagger
 * /:
 *   get:
 *     summary: API root
 *     description: Returns basic information about the API
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                   example: Opuzen API
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *                 status:
 *                   type: string
 *                   example: running
 *                 endpoints:
 *                   type: object
 */
// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Opuzen API',
    version: '1.1.0',
    status: 'running',
    endpoints: {
      root: '/',
      health: '/health',
      api: '/api'
    }
  });
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: Check the health status of the API and its dependencies
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: development
 *                 database:
 *                   type: string
 *                   example: connected
 *       500:
 *         description: Unhealthy status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: unhealthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                 database:
 *                   type: string
 *                   example: error
 */
// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbStatus = await db.testConnection();
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: dbStatus ? 'connected' : 'disconnected'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: 'error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// API Documentation
// Serve the raw swagger spec as JSON
app.get('/api-docs/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpecs);
});

// Serve the Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Opuzen API Documentation',
  swaggerOptions: {
    url: '/api-docs/swagger.json'
  }
}));

// Mount API routes
app.use('/api', apiRoutes);

// Inject database connection into import controller
const importRoutesModule = require('./routes/import');
if (importRoutesModule.injectDatabase) {
    importRoutesModule.injectDatabase(db);
    logger.info('Database connection injected into import controller');
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.url}`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize database and start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Initialize database with AWS Secrets Manager
    await db.initializeDatabase();
    logger.info('Database initialized with AWS Secrets Manager');
    
    // Test database connection
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }
    
    // Ensure the cache table exists
    const productModel = new ProductModel();
    await productModel.ensureCacheTableExists();
    logger.info('Product cache table initialized');
    
    // Initialize OPMS-to-NetSuite sync service
    // NOTE: OPMS_SYNC_ENABLED environment variable is IGNORED
    // Sync is controlled ONLY by database configuration (netsuite_opms_sync_config table)
    // This ensures runtime sync control via dashboard toggle works properly
    try {
      await OpmsToNetSuiteSyncService.initialize();
      logger.info('OPMS-to-NetSuite sync service initialized successfully');
      logger.info('Sync control: Database configuration only (dashboard toggle)');
    } catch (error) {
      logger.error('Failed to initialize OPMS-to-NetSuite sync service:', error.message);
      // Don't exit - let the API run without sync if there's an issue
    }
    
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info('API endpoints available:');
      logger.info('  GET  /api/products');
      logger.info('  GET  /api/products/:id');
      logger.info('  GET  /api/products/:id/items/:type');
      logger.info('  GET  /api/products/:id/info/:type');
      logger.info('  GET  /api/products/:id/specsheet/:type');
      logger.info('  GET  /api/items/:id');
      logger.info('  GET  /api/items/:id/info/:type');
      logger.info('  GET  /api/items/:id/colors');
      logger.info('  GET  /api/colors');
      logger.info('  GET  /api/colors/:id');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

// Export app for testing
module.exports = app; 