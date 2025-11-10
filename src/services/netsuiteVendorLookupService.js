const axios = require('axios');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const dotenv = require('dotenv');
const logger = require('../utils/logger');

// Load environment variables
dotenv.config();

class NetSuiteVendorLookupService {
  constructor() {
    // Validate environment variables
    const requiredEnvVars = [
      'NETSUITE_CONSUMER_KEY',
      'NETSUITE_CONSUMER_SECRET', 
      'NETSUITE_TOKEN_ID',
      'NETSUITE_TOKEN_SECRET',
      'NETSUITE_ACCOUNT_ID'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    // Initialize OAuth for NetSuite API calls
    this.oauth = OAuth({
      consumer: {
        key: process.env.NETSUITE_CONSUMER_KEY,
        secret: process.env.NETSUITE_CONSUMER_SECRET,
      },
      signature_method: 'HMAC-SHA256',
      hash_function(base_string, key) {
        return crypto
          .createHmac('sha256', key)
          .update(base_string)
          .digest('base64');
      },
    });

    this.token = {
      key: process.env.NETSUITE_TOKEN_ID,
      secret: process.env.NETSUITE_TOKEN_SECRET,
    };

    // Use the correct NetSuite SuiteTalk URL format (hyphen instead of underscore)
    const accountId = process.env.NETSUITE_ACCOUNT_ID.replace('_', '-').toLowerCase();
    this.baseUrl = `https://${accountId}.suitetalk.api.netsuite.com/rest/platform/v1`;
    
    logger.info(`🔧 NetSuite Vendor Lookup Service initialized for account: ${process.env.NETSUITE_ACCOUNT_ID}`);
  }

  /**
   * Find NetSuite vendor ID by name matching using REST API
   * @param {string} vendorName - The vendor name to search for
   * @returns {Promise<Object|null>} - {id, name} or null if not found
   */
  async findVendorByName(vendorName) {
    try {
      logger.info(`🔍 Searching NetSuite for vendor: "${vendorName}"`);

      // Use NetSuite REST API to search vendors
      const searchUrl = `${this.baseUrl}/record/vendor`;
      const searchParams = {
        q: `companyname IS "${vendorName}" OR entityid IS "${vendorName}"`,
        limit: 20
      };

      // Create OAuth headers
      const requestData = {
        url: searchUrl,
        method: 'GET',
        data: searchParams
      };

      const authHeader = this.oauth.toHeader(this.oauth.authorize(requestData, this.token));

      const response = await axios.get(searchUrl, {
        params: searchParams,
        headers: {
          ...authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (response.data && response.data.items && response.data.items.length > 0) {
        // Look for exact matches first
        const exactMatch = response.data.items.find(vendor => 
          (vendor.companyname && vendor.companyname.toLowerCase() === vendorName.toLowerCase()) ||
          (vendor.entityid && vendor.entityid.toLowerCase() === vendorName.toLowerCase())
        );

        if (exactMatch) {
          logger.info(`✅ Found exact match: NetSuite ID ${exactMatch.id} (${exactMatch.companyname || exactMatch.entityid})`);
          return {
            id: exactMatch.id,
            name: exactMatch.companyname || exactMatch.entityid
          };
        }

        // If no exact match, look for partial matches
        const partialMatch = response.data.items.find(vendor => {
          const companyName = (vendor.companyname || '').toLowerCase();
          const entityId = (vendor.entityid || '').toLowerCase();
          const searchName = vendorName.toLowerCase();
          
          return companyName.includes(searchName) || 
                 searchName.includes(companyName) ||
                 entityId.includes(searchName);
        });

        if (partialMatch) {
          logger.info(`⚠️  Found partial match: NetSuite ID ${partialMatch.id} (${partialMatch.companyname || partialMatch.entityid})`);
          return {
            id: partialMatch.id,
            name: partialMatch.companyname || partialMatch.entityid
          };
        }
      }

      logger.warn(`❌ No NetSuite vendor found for: "${vendorName}"`);
      return null;

    } catch (error) {
      logger.error(`❌ Error searching NetSuite vendor "${vendorName}":`, error.message);
      logger.error(`❌ Full error:`, error);
      if (error.response) {
        logger.error(`   Response status: ${error.response.status}`);
        logger.error(`   Response data:`, error.response.data);
      }
      console.error('Full error object:', error);
      return null;
    }
  }

  /**
   * Find multiple vendors by name
   * @param {Array<string>} vendorNames - Array of vendor names to search for
   * @returns {Promise<Array>} - Array of {name, id, netsuiteId, found}
   */
  async findMultipleVendors(vendorNames) {
    const results = [];
    
    for (const vendorName of vendorNames) {
      const result = await this.findVendorByName(vendorName);
      results.push({
        name: vendorName,
        found: !!result,
        netsuiteId: result?.id || null,
        netsuiteName: result?.name || null
      });
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return results;
  }

  /**
   * Test vendor lookup with a known vendor
   * @param {string} testVendorName - Vendor name to test with
   */
  async testVendorLookup(testVendorName = "Anne Kirk Textiles") {
    logger.info(`🧪 Testing vendor lookup with: "${testVendorName}"`);
    
    const result = await this.findVendorByName(testVendorName);
    
    if (result) {
      logger.info(`✅ Test successful: Found NetSuite ID ${result.id} for "${result.name}"`);
      return result;
    } else {
      logger.error(`❌ Test failed: Could not find "${testVendorName}" in NetSuite`);
      return null;
    }
  }
}

module.exports = NetSuiteVendorLookupService;
