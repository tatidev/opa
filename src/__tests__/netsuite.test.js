/**
 * NetSuite Integration Tests
 * 
 * NOTE: These tests require proper NetSuite credentials in the environment variables.
 * They are designed to be run against a real NetSuite instance.
 * 
 * To run these tests specifically:
 * npm test -- netsuite.test.js
 */

const netsuiteClient = require('../services/netsuiteClient');
const NetSuiteModel = require('../models/NetSuiteModel');
const request = require('supertest');
const app = require('../index');

// Skip tests if NetSuite credentials are not configured
const runTests = process.env.NETSUITE_CONSUMER_KEY && 
                process.env.NETSUITE_CONSUMER_SECRET && 
                process.env.NETSUITE_TOKEN_ID && 
                process.env.NETSUITE_TOKEN_SECRET;

// Helper function to conditionally skip tests
const conditionalTest = runTests ? test : test.skip;

describe('NetSuite Integration', () => {
  // Test environment setup
  beforeAll(() => {
    if (!runTests) {
      console.warn('⚠️ Skipping NetSuite tests: Missing NetSuite credentials in environment variables');
    }
  });

  describe('NetSuite Client', () => {
    conditionalTest('should fetch metadata catalog', async () => {
      try {
        const result = await netsuiteClient.getMetadataCatalog();
        expect(result).toBeDefined();
        expect(Array.isArray(result.items)).toBe(true);
      } catch (error) {
        console.error('Error in NetSuite metadata test:', error.message);
        throw error;
      }
    }, 15000); // Increased timeout for API call

    conditionalTest('should fetch inventory item metadata', async () => {
      try {
        const result = await netsuiteClient.getRecordMetadata('inventoryitem');
        expect(result).toBeDefined();
        expect(result.name).toBe('inventoryitem');
        expect(Array.isArray(result.links)).toBe(true);
        expect(result.links.length).toBeGreaterThan(0);
      } catch (error) {
        console.error('Error in NetSuite inventory metadata test:', error.message);
        throw error;
      }
    }, 15000);

    conditionalTest('should fetch inventory items', async () => {
      try {
        const result = await netsuiteClient.getInventoryItems({ limit: 5 });
        expect(result).toBeDefined();
        expect(Array.isArray(result.items)).toBe(true);
        if (result.items.length > 0) {
          expect(result.items[0].id).toBeDefined();
        }
      } catch (error) {
        console.error('Error in NetSuite inventory items test:', error.message);
        throw error;
      }
    }, 15000);

    conditionalTest('should fetch assembly items', async () => {
      try {
        const result = await netsuiteClient.getAssemblyItems({ limit: 5 });
        expect(result).toBeDefined();
        expect(Array.isArray(result.items)).toBe(true);
      } catch (error) {
        console.error('Error in NetSuite assembly items test:', error.message);
        throw error;
      }
    }, 15000);
  });

  describe('NetSuite Model', () => {
    // These tests would require a database connection and are more complex
    // They are included here as placeholders and should be implemented when ready
    
    test('should have syncInventoryItems method', () => {
      expect(typeof NetSuiteModel.syncInventoryItems).toBe('function');
    });

    test('should have syncAssemblyItems method', () => {
      expect(typeof NetSuiteModel.syncAssemblyItems).toBe('function');
    });

    test('should have getSyncHistory method', () => {
      expect(typeof NetSuiteModel.getSyncHistory).toBe('function');
    });
  });

  describe('Bulk Delete API', () => {
    test('should return dry run results for bulk delete endpoint', async () => {
      const response = await request(app)
        .post('/api/netsuite/items/bulk-delete')
        .send({ queryLimit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('dryRun', true);
      expect(response.body).toHaveProperty('summary');
      expect(response.body.summary).toHaveProperty('totalItemsInNetSuite');
      expect(response.body.summary).toHaveProperty('apiCreatedItems');
      expect(response.body.summary).toHaveProperty('itemsToDelete');
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body).toHaveProperty('message');
    });

    test('should handle pattern filtering', async () => {
      const response = await request(app)
        .post('/api/netsuite/items/bulk-delete')
        .send({ pattern: 'NONEXISTENT-*', queryLimit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.summary.itemsToDelete).toBe(0);
      expect(response.body.items).toHaveLength(0);
    });

    test('should validate request body structure', async () => {
      const response = await request(app)
        .post('/api/netsuite/items/bulk-delete')
        .send({ invalidParam: 'test' })
        .expect(200);

      // Should still work with default values
      expect(response.body.success).toBe(true);
      expect(response.body.dryRun).toBe(true);
    });
  });
}); 