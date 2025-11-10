/**
 * NetSuite REST API Client
 * Handles authentication and API requests to NetSuite
 * 
 * OAuth 1.0a Authentication - .env Variable Mapping:
 * ================================================
 * NETSUITE_CONSUMER_KEY    → oauth_consumer_key (OAuth consumer identifier)
 * NETSUITE_CONSUMER_SECRET → OAuth consumer secret (for signature generation)
 * NETSUITE_TOKEN_ID        → oauth_token (OAuth token identifier)
 * NETSUITE_TOKEN_SECRET    → OAuth token secret (for signature generation)
 * NETSUITE_REALM           → OAuth realm (NetSuite account identifier)
 */

const axios = require('axios');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const dotenv = require('dotenv');
const logger = require('../utils/logger');

// Load environment variables
dotenv.config();

// NetSuite API configuration
const {
  NETSUITE_BASE_URL = 'https://11516011-sb1.suitetalk.api.netsuite.com',
  NETSUITE_REALM = '11516011_SB1',
  NETSUITE_CONSUMER_KEY,
  NETSUITE_CONSUMER_SECRET,
  NETSUITE_TOKEN_ID,
  NETSUITE_TOKEN_SECRET
} = process.env;

// Debug log for environment variables (redacted for security)
logger.debug('NetSuite Client Initialized', {
  baseUrlConfigured: !!NETSUITE_BASE_URL,
  realmConfigured: !!NETSUITE_REALM,
  consumerKeyConfigured: !!NETSUITE_CONSUMER_KEY,
  consumerSecretConfigured: !!NETSUITE_CONSUMER_SECRET,
  tokenIdConfigured: !!NETSUITE_TOKEN_ID,
  tokenSecretConfigured: !!NETSUITE_TOKEN_SECRET
});

// Create OAuth 1.0a instance with clear .env variable mapping
const oauth = OAuth({
  consumer: { 
    key: NETSUITE_CONSUMER_KEY,     // .env: NETSUITE_CONSUMER_KEY
    secret: NETSUITE_CONSUMER_SECRET // .env: NETSUITE_CONSUMER_SECRET
  },
  signature_method: 'HMAC-SHA256',
  hash_function(base_string, key) {
    return crypto.createHmac('sha256', key).update(base_string).digest('base64');
  },
  realm: NETSUITE_REALM,  // 🔧 FIXED: Added missing realm parameter (matches working RESTlet service)
  parameter_separator: ',',
  encode_rfc3986: function(str) {
    return encodeURIComponent(str)
      .replace(/!/g, '%21')
      .replace(/\*/g, '%2A')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/'/g, '%27');
  }
});

/**
 * Make authenticated request to NetSuite REST API
 * 
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} endpoint - API endpoint path
 * @param {Object} data - Request body for POST/PUT requests
 * @param {Object} params - URL query parameters
 * @returns {Promise} - API response
 */
async function makeRequest(method, endpoint, data = null, params = {}) {
  try {
    // Ensure environment variables are set
    if (!NETSUITE_CONSUMER_KEY || !NETSUITE_CONSUMER_SECRET || 
        !NETSUITE_TOKEN_ID || !NETSUITE_TOKEN_SECRET) {
      throw new Error('NetSuite API credentials not configured');
    }

    // Build URL with query parameters for OAuth signing
    let url = `${NETSUITE_BASE_URL}${endpoint}`;
    if (params && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString();
      url += `?${queryString}`;
    }
    
    // Prepare request data for OAuth signing
    const request_data = {
      url,
      method
    };

    // OAuth token configuration - explicit .env variable mapping
    const oauthToken = {
      key: NETSUITE_TOKEN_ID,         // .env: NETSUITE_TOKEN_ID → oauth_token
      secret: NETSUITE_TOKEN_SECRET   // .env: NETSUITE_TOKEN_SECRET → signing secret
    };
    
    // Get OAuth data with timestamp and nonce
    const authData = oauth.authorize(request_data, oauthToken);
    
    // Construct Authorization header with explicit .env variable mapping
    const oauthRealm = NETSUITE_REALM;                    // .env: NETSUITE_REALM
    const oauthConsumerKey = NETSUITE_CONSUMER_KEY;       // .env: NETSUITE_CONSUMER_KEY
    const oauthTokenKey = NETSUITE_TOKEN_ID;              // .env: NETSUITE_TOKEN_ID
    
    let authHeader = `OAuth realm="${oauthRealm}",`;
    authHeader += `oauth_consumer_key="${oauthConsumerKey}",`;
    authHeader += `oauth_token="${oauthTokenKey}",`;
    authHeader += `oauth_signature_method="${authData.oauth_signature_method}",`;
    authHeader += `oauth_timestamp="${authData.oauth_timestamp}",`;
    authHeader += `oauth_nonce="${authData.oauth_nonce}",`;
    authHeader += `oauth_version="${authData.oauth_version}",`;
    authHeader += `oauth_signature="${encodeURIComponent(authData.oauth_signature)}"`;

    // Log request details for debugging
    logger.debug('Making NetSuite API request', {
      method,
      endpoint,
      hasParams: Object.keys(params).length > 0,
      hasData: !!data,
      oauth_consumer_key: oauthConsumerKey.substring(0, 10) + '...',
      oauth_token: oauthTokenKey.substring(0, 10) + '...',
      oauth_signature: authData.oauth_signature.substring(0, 10) + '...'
    });

    // Make API request with headers that match Postman
    const response = await axios({
      url: `${NETSUITE_BASE_URL}${endpoint}`,
      method,
      data,
      params,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'Connection': 'keep-alive',
        'User-Agent': 'Opuzen-API/1.0'
      }
    });

    return response.data;
  } catch (error) {
    // Handle API errors
    if (error.response) {
      logger.error('NetSuite API Error', {
        status: error.response.status,
        data: error.response.data,
        endpoint
      });
      
      // Add detailed error message for authentication issues
      if (error.response.status === 401) {
        logger.error('NetSuite Authentication Error', {
          message: 'Authentication failed with corrected OAuth implementation.',
          suggestion: 'Check if credentials have changed or if there are additional requirements.'
        });
      }
      
      throw new Error(`NetSuite API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    logger.error('NetSuite Request Error', { message: error.message, endpoint });
    throw error;
  }
}

/**
 * Get metadata catalog for available record types
 * 
 * @returns {Promise} - List of available record types
 */
async function getMetadataCatalog() {
  return makeRequest('GET', '/services/rest/record/v1/metadata-catalog');
}

/**
 * Get metadata for a specific record type
 * 
 * @param {string} recordType - Record type (e.g., 'lotnumberedinventoryitem')
 * @returns {Promise} - Record type metadata
 */
async function getRecordMetadata(recordType) {
  return makeRequest('GET', `/services/rest/record/v1/metadata-catalog/${recordType}`);
}

/**
 * Get records of a specific type, ordered from most recent first
 * 
 * @param {string} recordType - Record type (e.g., 'inventoryitem')
 * @param {Object} params - Query parameters for filtering
 * @param {Object} options - Additional options
 * @param {boolean} options.sortByMostRecent - Sort by most recent first (default: true)
 * @returns {Promise} - List of records ordered from most recent first
 */
async function getRecords(recordType, params = {}, options = {}) {
  const { sortByMostRecent = true } = options;
  
  // Add ordering to get most recent items first
  const queryParams = { ...params };
  
  if (sortByMostRecent && !queryParams.orderBy && !queryParams.sortBy) {
    // Try multiple NetSuite ordering parameter formats
    queryParams.orderBy = 'id DESC';  // Primary format
    queryParams.sortBy = 'id';        // Alternative format
    queryParams.sortOrder = 'DESC';   // Alternative format
  }
  
  logger.debug(`Getting ${recordType} records with most recent first`, {
    recordType,
    queryParams,
    sortByMostRecent
  });
  
  // Make the request
  const response = await makeRequest('GET', `/services/rest/record/v1/${recordType}`, null, queryParams);
  
  // If NetSuite API ordering didn't work, sort manually by ID descending
  if (response && response.items && sortByMostRecent) {
    response.items.sort((a, b) => {
      const idA = parseInt(a.id) || 0;
      const idB = parseInt(b.id) || 0;
      return idB - idA; // Descending order (most recent first)
    });
    
    logger.debug(`Sorted ${response.items.length} items by ID descending (most recent first)`, {
      firstItemId: response.items[0]?.id,
      lastItemId: response.items[response.items.length - 1]?.id
    });
  }
  
  return response;
}

/**
 * Get a specific record by ID
 * 
 * @param {string} recordType - Record type (e.g., 'lotnumberedinventoryitem')
 * @param {string} id - Record ID
 * @returns {Promise} - Record data
 */
async function getRecordById(recordType, id) {
  return makeRequest('GET', `/services/rest/record/v1/${recordType}/${id}`);
}

/**
 * Search for inventory items
 * 
 * @param {Object} params - Search parameters
 * @returns {Promise} - Search results
 */
async function getInventoryItems(params = {}) {
  return getRecords('lotnumberedinventoryitem', params);
}

/**
 * Get a specific inventory item by ID
 * 
 * @param {string} id - Inventory item ID
 * @returns {Promise} - Inventory item data
 */
async function getInventoryItemById(id) {
  return getRecordById('lotnumberedinventoryitem', id);
}

/**
 * Search for assembly items
 * 
 * @param {Object} params - Search parameters
 * @returns {Promise} - Search results
 */
async function getAssemblyItems(params = {}) {
  return getRecords('assemblyitem', params);
}

/**
 * Get a specific assembly item by ID
 * 
 * @param {string} id - Assembly item ID
 * @returns {Promise} - Assembly item data
 */
async function getAssemblyItemById(id) {
  return getRecordById('assemblyitem', id);
}

/**
 * Create a new lot numbered inventory item
 * 
 * @param {Object} data - Lot numbered inventory item data
 * @returns {Promise} - Created lot numbered inventory item
 */
async function createLotNumberedInventoryItem(data) {
  return makeRequest('POST', '/services/rest/record/v1/lotnumberedinventoryitem', data);
}

/**
 * Update an existing lot numbered inventory item
 * 
 * @param {string} id - Lot numbered inventory item ID
 * @param {Object} data - Updated lot numbered inventory item data
 * @returns {Promise} - Updated lot numbered inventory item
 */
async function updateLotNumberedInventoryItem(id, data) {
  return makeRequest('PATCH', `/services/rest/record/v1/lotnumberedinventoryitem/${id}`, data);
}

/**
 * Create or update an inventory item (upsert)
 * 
 * @param {Object} data - Inventory item data
 * @param {string} externalId - External ID to check for existing item
 * @returns {Promise} - Created or updated inventory item
 */
async function upsertInventoryItem(data, externalId) {
  try {
    // For now, always create new items since search queries have auth issues
    // TODO: Implement proper duplicate checking once search permissions are resolved
    logger.info('Creating new inventory item', { externalId });
    
    // Add required fields for NetSuite
    const enhancedData = {
      ...data,
      // Add required accounts if not present
      assetAccount: data.assetAccount || { id: "126" }, // Default asset account
      cogsAccount: data.cogsAccount || { id: "156" }, // Default COGS account
      incomeAccount: data.incomeAccount || { id: "151" }, // Default income account
    };
    
    // Tax schedule field discovered from HTML inspection but currently blocked by API permissions
    // Field name: taxschedule (lowercase)
    // Expected value: { id: "1" } for "Taxable" schedule
    // TODO: This requires NetSuite admin to configure API role permissions for tax schedules
    
    return createLotNumberedInventoryItem(enhancedData);
  } catch (error) {
    // Check if this is the tax schedule error
    if (error.message.includes('Tax Schedule')) {
      const taxScheduleError = new Error(
        'NetSuite Tax Schedule API Permission Issue: The API role lacks permission to set tax schedules. ' +
        'Contact NetSuite admin to: 1) Grant tax schedule permissions to API role, or 2) Create items manually in UI first.'
      );
      taxScheduleError.originalError = error;
      taxScheduleError.fieldName = 'taxschedule';
      taxScheduleError.expectedValue = { id: "1" };
      throw taxScheduleError;
    }
    
    logger.error('Error in upsertInventoryItem', { 
      error: error.message, 
      externalId 
    });
    throw error;
  }
}

/**
 * Check if an inventory item exists by itemId
 * 
 * @param {string} itemId - Item ID to check
 * @returns {Promise<boolean>} - True if item exists
 */
async function inventoryItemExists(itemId) {
  try {
    const items = await getInventoryItems({ 
      q: `itemId IS "${itemId}"` 
    });
    return items.items && items.items.length > 0;
  } catch (error) {
    logger.error('Error checking inventory item existence', { 
      error: error.message, 
      itemId 
    });
    return false;
  }
}

module.exports = {
  makeRequest,
  getMetadataCatalog,
  getRecordMetadata,
  getRecords,
  getRecordById,
  getInventoryItems,
  getInventoryItemById,
  getAssemblyItems,
  getAssemblyItemById,
  createLotNumberedInventoryItem,
  updateLotNumberedInventoryItem,
  upsertInventoryItem,
  inventoryItemExists
}; 