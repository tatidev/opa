const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const ProductImportService = require('../services/ProductImportService');

/**
 * NetSuite Import Controller
 * Handles API endpoints for importing OPMS products into NetSuite
 */
class NetSuiteImportController {
  
  /**
   * Import products from OPMS to NetSuite
   * POST /api/netsuite/import
   */
  static async importProducts(req, res) {
    try {
      const { productCount = 5, dryRun = false } = req.body;
      
      logger.info('Starting NetSuite product import', { 
        productCount, 
        dryRun,
        timestamp: new Date().toISOString() 
      });

      const importService = new ProductImportService();
      
      // Get test products
      const testProducts = await importService.getTestProducts(productCount);
      
      if (dryRun) {
        // Dry run - just return what would be imported
        const summary = {
          totalProducts: testProducts.length,
          totalItems: testProducts.reduce((sum, product) => sum + product.items.length, 0),
          products: testProducts.map(product => ({
            productId: product.productId,
            name: product.name,
            itemCount: product.items.length,
            items: product.items.map(item => ({
              itemId: item.itemId,
              colorName: item.colorName
            }))
          }))
        };
        
        return res.json({
          success: true,
          message: 'Dry run completed',
          summary
        });
      }
      
      // Actual import
      const importResults = await importService.importProducts(testProducts);
      
      // Check if tax schedule error occurred
      const hasKnownTaxError = importResults.products.some(product => 
        product.errors.some(error => 
          error.error && error.error.includes('Tax Schedule')
        )
      );
      
      if (hasKnownTaxError) {
        return res.status(206).json({
          success: false,
          message: 'Import failed due to NetSuite tax schedule configuration',
          error: 'NetSuite requires tax schedule configuration. Please create a "Taxable" tax schedule in NetSuite UI.',
          results: importResults,
          recommendation: 'Contact NetSuite admin to configure tax schedules or create items manually first.'
        });
      }
      
      res.json({
        success: true,
        message: 'Products imported successfully',
        results: importResults
      });
      
    } catch (error) {
      logger.error('Error in product import', { 
        error: error.message,
        stack: error.stack 
      });
      
      res.status(500).json({
        success: false,
        message: 'Import failed',
        error: error.message
      });
    }
  }
  
  /**
   * Get import status and history
   * GET /api/netsuite/import/status
   */
  static async getImportStatus(req, res) {
    try {
      // TODO: Query api_netsuite_sync_log table for import history
      
      res.json({
        success: true,
        status: 'ready',
        message: 'NetSuite import service is ready',
        lastImport: null, // TODO: Get from sync log
        configuration: {
          authenticationStatus: 'connected',
          taxScheduleStatus: 'configuration_required'
        }
      });
      
    } catch (error) {
      logger.error('Error getting import status', { error: error.message });
      
      res.status(500).json({
        success: false,
        message: 'Failed to get import status',
        error: error.message
      });
    }
  }
  
  /**
   * Test NetSuite connection
   * GET /api/netsuite/test-connection
   */
  static async testConnection(req, res) {
    try {
      const netsuiteClient = require('../services/netsuiteClient');
      
      // Test basic connectivity
      const result = await netsuiteClient.getInventoryItems({ limit: 1 });
      
      res.json({
        success: true,
        message: 'NetSuite connection successful',
        itemCount: result.totalResults,
        testResult: {
          canConnect: true,
          canReadItems: true,
          sampleItemId: result.items[0]?.id
        }
      });
      
    } catch (error) {
      logger.error('NetSuite connection test failed', { error: error.message });
      
      res.status(500).json({
        success: false,
        message: 'NetSuite connection failed',
        error: error.message
      });
    }
  }
  
  /**
   * Get available products for import
   * GET /api/netsuite/products
   */
  static async getAvailableProducts(req, res) {
    try {
      const { limit = 10 } = req.query;
      const importService = new ProductImportService();
      
      const products = await importService.getTestProducts(parseInt(limit));
      
      res.json({
        success: true,
        products: products.map(product => ({
          productId: product.productId,
          name: product.name,
          category: product.category,
          itemCount: product.items.length,
          totalColors: product.items.reduce((sum, item) => sum + item.colors.length, 0)
        }))
      });
      
    } catch (error) {
      logger.error('Error getting available products', { error: error.message });
      
      res.status(500).json({
        success: false,
        message: 'Failed to get available products',
        error: error.message
      });
    }
  }
}

// Define routes
router.post('/import', NetSuiteImportController.importProducts);
router.get('/import/status', NetSuiteImportController.getImportStatus);
router.get('/test-connection', NetSuiteImportController.testConnection);
router.get('/products', NetSuiteImportController.getAvailableProducts);

module.exports = router; 