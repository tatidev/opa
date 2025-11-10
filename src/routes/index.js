/**
 * API Routes
 * 
 * This file exports all API routes.
 */

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();

// Import route modules
const colorsRoutes = require('./colors');
const itemsRoutes = require('./items');
const productsRoutes = require('./products');
const vendorsRoutes = require('./vendors');
const netsuiteRoutes = require('./netsuite');
const netsuiteImportRoutes = require('../controllers/NetSuiteImportController');
const exportRoutes = require('./export');
const importRoutesModule = require('./import');
const importRoutes = importRoutesModule.router;
const opmsyncRoutes = require('./opms-sync');
const syncDashboardRoutes = require('./sync-dashboard');
const dryRunSyncRoutes = require('../controllers/DryRunSyncController');
// Load ns-to-opms routes
const nsToOpmsRoutes = require('./ns-to-opms');
// const syncRoutes = require('./sync'); // TODO: Enable when Sequelize dependency resolved

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Opuzen API is running',
    timestamp: new Date().toISOString()
  });
});

// Mount routes
router.use('/colors', colorsRoutes);
router.use('/items', itemsRoutes);
router.use('/products', productsRoutes);
router.use('/vendors', vendorsRoutes);
router.use('/netsuite', netsuiteRoutes);
router.use('/netsuite-import', netsuiteImportRoutes);
router.use('/export', exportRoutes);
router.use('/import', importRoutes);
router.use('/opms-sync', opmsyncRoutes);
router.use('/ns-to-opms', nsToOpmsRoutes);
router.use('/sync-dashboard', syncDashboardRoutes);
router.use('/dry-run', dryRunSyncRoutes);
// router.use('/sync', syncRoutes); // TODO: Enable when Sequelize dependency resolved

// Root endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Opuzen API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      colors: '/api/colors',
      items: '/api/items',
      products: '/api/products',
      netsuite: '/api/netsuite',
      netsuiteImport: '/api/netsuite-import',
      export: '/api/export',
      import: '/api/import',
      opmsSync: '/api/opms-sync',
      nsToOpms: '/api/ns-to-opms',
      syncDashboard: '/api/sync-dashboard',
      dryRun: '/api/dry-run'
      // sync: '/api/sync' // TODO: Enable when Sequelize dependency resolved
    }
  });
});

module.exports = router;
