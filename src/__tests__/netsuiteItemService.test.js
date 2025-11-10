/**
 * NetSuite Item Creation Service Tests
 * Implementation of test cases from SPEC-NetSuite-Item-Creation.md Section 8
 */

const sinon = require('sinon');
const netsuiteService = require('../services/netsuiteItemService');

describe('NetSuite Item Creation Service', () => {
  let fetchStub;
  let originalEnv;
  
  beforeEach(() => {
    // Store original env vars
    originalEnv = { ...process.env };
    
    // Mock environment variables for testing
    process.env.NODE_ENV = 'test';
    process.env.NETSUITE_ACCOUNT_ID_SANDBOX = 'TEST_ACCOUNT';
    process.env.NETSUITE_CONSUMER_KEY = 'test_consumer_key';
    process.env.NETSUITE_ACCESS_TOKEN = 'test_access_token';
    process.env.NETSUITE_ACCESS_TOKEN_SECRET = 'test_token_secret';
    
    // Stub the fetch function
    fetchStub = sinon.stub(global, 'fetch');
  });
  
  afterEach(() => {
    fetchStub.restore();
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Configuration Management', () => {
    it('should load sandbox configuration correctly', () => {
      const config = netsuiteService.getConfig();
      
      expect(config.accountId).toBe('TEST_ACCOUNT');
      expect(config.baseUrl).toContain('test-account.suitetalk.api.netsuite.com');
      expect(config.apiVersion).toBe('v1');
    });
    
    it('should throw error when account ID is missing', () => {
      // Temporarily change to development environment to test missing config
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      delete process.env.NETSUITE_ACCOUNT_ID_SANDBOX;
      
      expect(() => netsuiteService.getConfig()).toThrow('NetSuite sandbox configuration missing');
      
      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Tax Configuration Validation', () => {
    // Test Case 1: Basic item creation with tax schedule (should pass)
    it('should validate basic item with tax schedule successfully', () => {
      const testItem = {
        itemid: "TEST-ITEM-001",
        displayname: "Test Item 001",
        taxschedule: { id: "1" },
        subsidiary: { id: "1" },
        asset: true,
        trackquantity: true
      };
      
      expect(() => netsuiteService.validateTaxConfiguration(testItem)).not.toThrow();
    });
    
    // Test Case 2: Item creation without tax schedule (should fail)
    it('should throw error when tax schedule is missing', () => {
      const testItem = {
        itemid: "TEST-ITEM-002",
        displayname: "Test Item 002",
        subsidiary: { id: "1" },
        asset: true,
        trackquantity: true
        // Missing taxschedule - should trigger validation error
      };
      
      expect(() => netsuiteService.validateTaxConfiguration(testItem))
        .toThrow('Tax schedule assignment is required for inventory items');
    });
    
    it('should throw error when subsidiary is missing', () => {
      const testItem = {
        itemid: "TEST-ITEM-003",
        displayname: "Test Item 003",
        taxschedule: { id: "1" },
        asset: true,
        trackquantity: true
        // Missing subsidiary - should trigger validation error
      };
      
      expect(() => netsuiteService.validateTaxConfiguration(testItem))
        .toThrow('Subsidiary assignment is required for tax schedule functionality');
    });
    
    it('should throw error when item ID is missing', () => {
      const testItem = {
        displayname: "Test Item Without ID",
        taxschedule: { id: "1" },
        subsidiary: { id: "1" }
        // Missing itemid - should trigger validation error
      };
      
      expect(() => netsuiteService.validateTaxConfiguration(testItem))
        .toThrow('Item ID is required');
    });
    
    it('should set default values for trackquantity and asset', () => {
      const testItem = {
        itemid: "TEST-ITEM-004",
        taxschedule: { id: "1" },
        subsidiary: { id: "1" }
        // Missing trackquantity and asset - should be set to defaults
      };
      
      netsuiteService.validateTaxConfiguration(testItem);
      
      expect(testItem.trackquantity).toBe(true);
      expect(testItem.asset).toBe(true);
    });
  });

  describe('Payload Building', () => {
    it('should build correct payload structure', () => {
      const itemData = {
        itemid: "TEST-PAYLOAD-001",
        displayname: "Test Payload Item",
        description: "Test description",
        taxschedule: { id: "2" },
        subsidiary: { id: "3" },
        weight: 1.5,
        weightunit: "Lb"
      };
      
      const config = { defaultTaxScheduleId: "1", defaultSubsidiaryId: "1" };
      const payload = netsuiteService.buildItemPayload(itemData, config);
      
      expect(payload.itemid).toBe("TEST-PAYLOAD-001");
      expect(payload.displayname).toBe("Test Payload Item");
      expect(payload.taxschedule.id).toBe("2");
      expect(payload.subsidiary.id).toBe("3");
      expect(payload.asset).toBe(true);
      expect(payload.trackquantity).toBe(true);
      expect(payload.weight).toBe(1.5);
      expect(payload.weightunit).toBe("Lb");
    });
    
    it('should use default tax schedule and subsidiary when not provided', () => {
      const itemData = {
        itemid: "TEST-DEFAULTS-001",
        displayname: "Test Default Values"
      };
      
      const config = { 
        defaultTaxScheduleId: "999", 
        defaultSubsidiaryId: "888" 
      };
      
      const payload = netsuiteService.buildItemPayload(itemData, config);
      
      expect(payload.taxschedule?.id).toBe("999");
      expect(payload.subsidiary?.id).toBe("888");
    });
    
    it('should remove null and empty values from payload', () => {
      const itemData = {
        itemid: "TEST-CLEANUP-001",
        displayname: "Test Cleanup",
        description: "",
        weight: null,
        taxschedule: { id: "1" },
        subsidiary: { id: "1" }
      };
      
      const config = { defaultTaxScheduleId: "1", defaultSubsidiaryId: "1" };
      const payload = netsuiteService.buildItemPayload(itemData, config);
      
      expect(payload).not.toHaveProperty('description');
      expect(payload).not.toHaveProperty('weight');
      expect(payload.itemid).toBe("TEST-CLEANUP-001");
    });
  });

  describe('Error Handling', () => {
    it('should identify and handle tax schedule errors', () => {
      const error = new Error('Tax schedule is required for this item type');
      
      expect(() => netsuiteService.handleNetSuiteError(error, 'TEST-001'))
        .toThrow('Tax Schedule Error for item TEST-001');
    });
    
    it('should identify and handle subsidiary errors', () => {
      const error = new Error('Invalid subsidiary reference');
      
      expect(() => netsuiteService.handleNetSuiteError(error, 'TEST-002'))
        .toThrow('Subsidiary Error for item TEST-002');
    });
    
    it('should identify and handle permission errors', () => {
      const error = new Error('You do not have permission to access this resource');
      
      expect(() => netsuiteService.handleNetSuiteError(error, 'TEST-003'))
        .toThrow('Permission Error for item TEST-003');
    });
    
    it('should identify and handle rate limiting errors', () => {
      const error = new Error('Rate limit exceeded, please try again later');
      
      expect(() => netsuiteService.handleNetSuiteError(error, 'TEST-004'))
        .toThrow('Rate Limit Error for item TEST-004');
    });
    
    it('should handle generic NetSuite errors', () => {
      const error = new Error('Generic API error');
      
      expect(() => netsuiteService.handleNetSuiteError(error, 'TEST-005'))
        .toThrow('NetSuite API Error for item TEST-005');
    });
  });

  describe('Authentication', () => {
    it('should build OAuth headers when credentials are available', () => {
      const headers = netsuiteService.buildAuthHeaders();
      
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['prefer']).toBe('return=representation');
      expect(headers['Authorization']).toContain('OAuth');
      expect(headers['Authorization']).toContain('test_consumer_key');
    });
    
    it('should throw error when no authentication credentials are available', () => {
      // Temporarily change to development environment to test missing auth
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      delete process.env.NETSUITE_CONSUMER_KEY;
      delete process.env.NETSUITE_ACCESS_TOKEN;
      
      expect(() => netsuiteService.buildAuthHeaders())
        .toThrow('NetSuite authentication credentials not configured');
        
      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Item Creation', () => {
    it('should create inventory item successfully', async () => {
      const mockResponse = {
        id: '12345',
        itemid: 'TEST-SUCCESS-001',
        displayname: 'Test Success Item',
        links: []
      };
      
      fetchStub.resolves({
        ok: true,
        json: async () => mockResponse
      });
      
      const testItem = {
        itemid: "TEST-SUCCESS-001",
        displayname: "Test Success Item",
        taxschedule: { id: "1" },
        subsidiary: { id: "1" }
      };
      
      const result = await netsuiteService.createLotNumberedInventoryItem(testItem);
      
      expect(result.id).toBe('12345');
      expect(result.itemid).toBe('TEST-SUCCESS-001');
    });
    
    it('should handle API errors during item creation', async () => {
      fetchStub.resolves({
        ok: false,
        status: 400,
        text: async () => 'Bad Request: Tax schedule is required'
      });
      
      const testItem = {
        itemid: "TEST-ERROR-001",
        displayname: "Test Error Item",
        taxschedule: { id: "1" },
        subsidiary: { id: "1" }
      };
      
      try {
        await netsuiteService.createLotNumberedInventoryItem(testItem);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Tax Schedule Error');
      }
    });
  });

  describe('Bulk Operations', () => {
    it('should process bulk items in batches', async () => {
      const mockResponse = {
        id: '12345',
        itemid: 'BULK-TEST',
        displayname: 'Bulk Test Item'
      };
      
      fetchStub.resolves({
        ok: true,
        json: async () => mockResponse
      });
      
      const testItems = [
        { itemid: "BULK-001", displayname: "Bulk Item 1", taxschedule: { id: "1" }, subsidiary: { id: "1" } },
        { itemid: "BULK-002", displayname: "Bulk Item 2", taxschedule: { id: "1" }, subsidiary: { id: "1" } },
        { itemid: "BULK-003", displayname: "Bulk Item 3", taxschedule: { id: "1" }, subsidiary: { id: "1" } }
      ];
      
      const options = { batchSize: 2, delayMs: 10 }; // Small delay for testing
      const result = await netsuiteService.createItemsBulk(testItems, options);
      
      expect(result.total).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
    });
    
    it('should handle partial failures in bulk operations', async () => {
      fetchStub.onFirstCall().resolves({
        ok: true,
        json: async () => ({ id: '12345', itemid: 'BULK-SUCCESS' })
      });
      
      fetchStub.onSecondCall().resolves({
        ok: false,
        status: 400,
        text: async () => 'Tax schedule error'
      });
      
      const testItems = [
        { itemid: "BULK-SUCCESS", taxschedule: { id: "1" }, subsidiary: { id: "1" } },
        { itemid: "BULK-FAIL", taxschedule: { id: "999" }, subsidiary: { id: "1" } }
      ];
      
      const result = await netsuiteService.createItemsBulk(testItems, { delayMs: 10 });
      
      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      
      const successItem = result.results.find(r => r.success);
      const failItem = result.results.find(r => !r.success);
      
      expect(successItem.item).toBe('BULK-SUCCESS');
      expect(failItem.item).toBe('BULK-FAIL');
    });
  });

  describe('Two-Step Creation Fallback', () => {
    it('should fall back to two-step creation on tax schedule error', async () => {
      // First call fails with tax schedule error
      fetchStub.onFirstCall().resolves({
        ok: false,
        status: 400,
        text: async () => 'Tax schedule validation error'
      });
      
      // Second call (without tax schedule) succeeds
      fetchStub.onSecondCall().resolves({
        ok: true,
        json: async () => ({ id: '12345', itemid: 'FALLBACK-TEST' })
      });
      
      // Third call (update with tax schedule) succeeds
      fetchStub.onThirdCall().resolves({
        ok: true,
        json: async () => ({ id: '12345', itemid: 'FALLBACK-TEST', taxschedule: { id: '1' } })
      });
      
      const testItem = {
        itemid: "FALLBACK-TEST",
        displayname: "Fallback Test Item",
        taxschedule: { id: "1" },
        subsidiary: { id: "1" }
      };
      
      const result = await netsuiteService.createItemWithFallback(testItem);
      
      expect(result.id).toBe('12345');
      expect(fetchStub.callCount).toBe(3); // Failed create, successful create without tax, update with tax
    });
  });
});

describe('Integration Tests', () => {
  // These tests would run against actual NetSuite sandbox (when credentials are provided)
  describe.skip('Live NetSuite API Tests', () => {
    // Skip all live NetSuite tests - they require real credentials
    // To run these tests, set NETSUITE_LIVE_TEST=true and provide sandbox credentials
    
    it('should fetch tax schedules from NetSuite', async () => {
      try {
        const taxSchedules = await netsuiteService.getTaxSchedules();
        expect(taxSchedules).toEqual(expect.any(Array));
      } catch (error) {
        if (error.message.includes('authentication')) {
          console.warn('NetSuite authentication failed - skipping test');
          return;
        }
        throw error;
      }
    }, 10000); // 10 second timeout
    
    it('should fetch subsidiary nexus configuration', async () => {
      try {
        const nexusConfig = await netsuiteService.getSubsidiaryNexusConfig('1');
        expect(nexusConfig).toEqual(expect.any(Array));
      } catch (error) {
        if (error.message.includes('authentication')) {
          console.warn('NetSuite authentication failed - skipping test');
          return;
        }
        throw error;
      }
    }, 10000);
  });
}); 