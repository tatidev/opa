/**
 * NetSuite Custom RESTlet Service
 * Uses custom SuiteScript RESTlet for inventory item creation
 * Replaces the standard NetSuite REST API approach
 * 
 * OAuth 1.0a Authentication - .env Variable Mapping:
 * ================================================
 * NETSUITE_CONSUMER_KEY    → oauth_consumer_key (OAuth consumer identifier)
 * NETSUITE_CONSUMER_SECRET → OAuth consumer secret (for signature generation)
 * NETSUITE_TOKEN_ID        → oauth_token (OAuth token identifier)
 * NETSUITE_TOKEN_SECRET    → OAuth token secret (for signature generation)
 * NETSUITE_REALM           → OAuth realm (NetSuite account identifier)
 */

// Load environment variables
require('dotenv').config();

const fetch = require('node-fetch');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const logger = require('../utils/logger');
const ProductModel = require('../models/ProductModel');

/**
 * Map OPMS compliance values to NetSuite text field values
 * @param {string} opmsValue - OPMS compliance value (Y/N/D)
 * @returns {string} NetSuite text field value (Yes/No/ - )
 */
function mapComplianceValue(opmsValue) {
  if (!opmsValue || opmsValue === '') return ' - ';
  
  switch (opmsValue.toUpperCase()) {
    case 'Y':
      return 'Yes';
    case 'N':
      return 'No';
    case 'D':
      return ' - ';
    default:
      logger.warn(`Unknown compliance value: ${opmsValue}, defaulting to " - "`);
      return ' - ';
  }
}

/**
 * NetSuite RESTlet Configuration
 */
const restletConfig = {
        dev: {
            baseUrl: 'https://11516011-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl',
            scriptId: '1471',  // Same as sandbox for dev environment
            deployId: '1',  // 🔧 UPDATED: New deployment ID
            // Prefer realm variable; fallback to account id
            accountId: process.env.NETSUITE_REALM_SANDBOX || process.env.NETSUITE_ACCOUNT_ID_SANDBOX
        },
        sandbox: {
            baseUrl: 'https://11516011-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl',
            scriptId: '1471',  // 🔧 FIXED: Updated to correct script ID
            deployId: '1',  // 🔧 UPDATED: New deployment ID
            // Prefer realm variable; fallback to account id
            accountId: process.env.NETSUITE_REALM_SANDBOX || process.env.NETSUITE_ACCOUNT_ID_SANDBOX
        },
  prod: {
    baseUrl: 'https://11516011.restlets.api.netsuite.com/app/site/hosting/restlet.nl',
    scriptId: '1903',
    deployId: '1',
    // Prefer realm variable; fallback to account id
    accountId: process.env.NETSUITE_REALM_PROD || process.env.NETSUITE_ACCOUNT_ID_PROD
  }
};

/**
 * Get current environment configuration
 * @param {('dev'|'sandbox'|'prod')} envOverride Optional explicit environment
 */
function getConfig(envOverride) {
  const environment = envOverride || process.env.NETSUITE_ENVIRONMENT || process.env.NODE_ENV || 'sandbox';
  
  // For test environment, return mock configuration
  if (environment === 'test') {
    return {
      baseUrl: 'https://test-mock.restlets.api.netsuite.com/app/site/hosting/restlet.nl',
      scriptId: 'TEST_SCRIPT',
      deployId: 'TEST_DEPLOY',
      accountId: 'TEST_ACCOUNT',
      isMocked: true
    };
  }
  
  const config = restletConfig[environment];
  
  if (!config) {
    throw new Error(`Invalid environment: ${environment}`);
  }
  
  if (!config.accountId) {
    throw new Error(`NetSuite ${environment} configuration missing. Set NETSUITE_ACCOUNT_ID_${environment.toUpperCase()} environment variable.`);
  }
  
  // DEBUG (safe): Log resolved environment and routing (no secrets)
  try {
    logger.info('NetSuite RESTlet routing resolved', {
      environment,
      baseUrl: config.baseUrl,
      scriptId: config.scriptId,
      deployId: config.deployId,
      accountId: config.accountId
    });
  } catch (e) { /* noop */ }

  return config;
}

/**
 * Create OAuth 1.0a instance - explicit .env variable mapping
 */
const oauth = OAuth({
  consumer: { 
    key: process.env.NETSUITE_CONSUMER_KEY,     // .env: NETSUITE_CONSUMER_KEY
    secret: process.env.NETSUITE_CONSUMER_SECRET // .env: NETSUITE_CONSUMER_SECRET
  },
  signature_method: 'HMAC-SHA256',
  hash_function(base_string, key) {
    return crypto.createHmac('sha256', key).update(base_string).digest('base64');
  },
  realm: process.env.NETSUITE_REALM,  // 🔧 FIXED: Added realm parameter
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
 * Build OAuth authentication headers for RESTlet calls
 * @param {string} method
 * @param {string} url
 * @param {string} realmOverride Optional realm/account ID override
 */
function buildAuthHeaders(method, url, realmOverride, envOverride) {
  // Explicit .env variable assignment for clarity
  const isProd = envOverride === 'prod';
  const netsuiteConsumerKey = isProd ? (process.env.NETSUITE_CONSUMER_KEY_PROD || process.env.NETSUITE_CONSUMER_KEY) : process.env.NETSUITE_CONSUMER_KEY;
  const netsuiteConsumerSecret = isProd ? (process.env.NETSUITE_CONSUMER_SECRET_PROD || process.env.NETSUITE_CONSUMER_SECRET) : process.env.NETSUITE_CONSUMER_SECRET;
  const netsuiteTokenId = isProd ? (process.env.NETSUITE_TOKEN_ID_PROD || process.env.NETSUITE_TOKEN_ID) : process.env.NETSUITE_TOKEN_ID;
  const netsuiteTokenSecret = isProd ? (process.env.NETSUITE_TOKEN_SECRET_PROD || process.env.NETSUITE_TOKEN_SECRET) : process.env.NETSUITE_TOKEN_SECRET;
  // Prefer explicit realm override (from config), then env-specific REALM vars, then generic NETSUITE_REALM
  const netsuiteRealm = 
    realmOverride || 
    (isProd 
      ? (process.env.NETSUITE_REALM_PROD || process.env.NETSUITE_ACCOUNT_ID_PROD) 
      : (process.env.NETSUITE_REALM_SANDBOX || process.env.NETSUITE_ACCOUNT_ID_SANDBOX)) 
    || process.env.NETSUITE_REALM;

  // DEBUG (safe): Log realm and environment being used (no secrets)
  try {
    logger.info('NetSuite OAuth realm resolved', {
      isProd,
      realm: netsuiteRealm
    });
  } catch (e) { /* noop */ }
  
  // Ensure environment variables are set
  if (!netsuiteConsumerKey || !netsuiteConsumerSecret || 
      !netsuiteTokenId || !netsuiteTokenSecret) {
    throw new Error('NetSuite OAuth credentials not configured');
  }
  
  // Prepare request data for OAuth signing
  const request_data = { url, method };
  
  // OAuth token configuration - explicit .env variable mapping
  const oauthToken = {
    key: netsuiteTokenId,        // .env: NETSUITE_TOKEN_ID → oauth_token
    secret: netsuiteTokenSecret  // .env: NETSUITE_TOKEN_SECRET → signing secret
  };
  
  // Get OAuth data with timestamp and nonce
  const authData = oauth.authorize(request_data, oauthToken);
  
  // Construct Authorization header with explicit .env variable mapping
  let authHeader = `OAuth realm="${netsuiteRealm}",`;
  authHeader += `oauth_consumer_key="${netsuiteConsumerKey}",`;
  authHeader += `oauth_token="${netsuiteTokenId}",`;  // .env: NETSUITE_TOKEN_ID
  authHeader += `oauth_signature_method="${authData.oauth_signature_method}",`;
  authHeader += `oauth_timestamp="${authData.oauth_timestamp}",`;
  authHeader += `oauth_nonce="${authData.oauth_nonce}",`;
  authHeader += `oauth_version="${authData.oauth_version}",`;
  authHeader += `oauth_signature="${encodeURIComponent(authData.oauth_signature)}"`;
  
  return {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Connection': 'keep-alive',
    'User-Agent': 'Opuzen-API/1.0'
  };
}

/**
 * Build RESTlet endpoint URL
 * @param {('dev'|'sandbox'|'prod')} envOverride Optional explicit environment
 */
function buildRestletUrl(envOverride) {
  const config = getConfig(envOverride);
  return `${config.baseUrl}?script=${config.scriptId}&deploy=${config.deployId}`;
}

/**
 * Test RESTlet connectivity
 */
async function testConnection(envOverride) {
  const config = getConfig(envOverride);
  const url = buildRestletUrl(envOverride);
  const headers = buildAuthHeaders('GET', url, config.accountId, envOverride);
  
  logger.info('Testing RESTlet connectivity...');
  logger.debug('RESTlet URL:', url);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RESTlet connection failed: ${response.status} - ${response.statusText}: ${errorText}`);
    }
    
    const result = await response.json();
    logger.info('✓ RESTlet connection successful:', result.message);
    return result;
    
  } catch (error) {
    logger.error('RESTlet connection failed:', error.message);
    throw error;
  }
}

/**
 * Upsert lot numbered inventory item using custom RESTlet (CREATE or UPDATE)
 * This function now performs upsert operations as required by cursor rules
 */
async function createLotNumberedInventoryItem(itemData, options = {}) {
  const config = getConfig(options.envOverride);
  
  // Mock implementation for test environment
  if (config.isMocked) {
    logger.info(`MOCK: Creating NetSuite lot numbered inventory item via RESTlet: ${itemData.itemId}`);
    
    // Simulate validation errors for test cases - support both field name formats
    if (!itemData.custitem_opms_product_id && !itemData.custitem_opms_prod_id) {
      throw new Error('custitem_opms_prod_id is required and must be a valid integer');
    }
    
    if (!itemData.custitem_opms_item_id) {
      throw new Error('custitem_opms_item_id is required and must be a valid integer');
    }
    
    if (itemData.itemId && itemData.itemId.length > 40) {
      throw new Error('Item ID cannot exceed 40 characters');
    }
    
    // Return mock success response with comprehensive field validation
    const mockCustomFields = {
      // Core OPMS Data
      custitem_opms_item_id: itemData.custitem_opms_item_id,
      custitem_opms_prod_id: itemData.custitem_opms_prod_id || itemData.custitem_opms_product_id,
      custitem_opms_parent_product_name: itemData.custitem_opms_parent_product_name || itemData.parentProductName,
      custitem_opms_fabric_width: itemData.custitem_opms_fabric_width || itemData.fabricWidth,
      custitem_is_repeat: itemData.custitem_is_repeat || itemData.custitem_opms_is_repeat,
      custitem_opms_item_colors: itemData.custitem_opms_item_colors || itemData.itemColors,
      custitem_opms_vendor_color: itemData.custitem_opms_vendor_color,
      custitem_opms_vendor_prod_name: itemData.custitem_opms_vendor_prod_name,
      custitem_opms_finish: itemData.custitem_opms_finish || itemData.finish,
      custitem_opms_fabric_cleaning: itemData.custitem_opms_fabric_cleaning || itemData.cleaning,
      custitem_opms_product_origin: itemData.custitem_opms_product_origin || itemData.origin,
      
      // Mini-Forms (comma-separated text format)
      custitem_opms_front_content: itemData.frontContentJson || (itemData.frontContent ? 'Mock text content' : ''),
      custitem_opms_back_content: itemData.backContentJson || (itemData.backContent ? 'Mock text content' : ''),
      custitem_opms_abrasion: itemData.abrasionJson || (itemData.abrasion ? 'Mock test results' : ''),
      custitem_opms_firecodes: itemData.firecodesJson || (itemData.firecodes ? 'Mock fire codes' : ''),
      
      // Pattern/Repeat
      custitem_vertical_repeat: itemData.custitem_vertical_repeat || itemData.vrepeat,
      custitem_horizontal_repeat: itemData.custitem_horizontal_repeat || itemData.hrepeat,
      
      // Compliance
      custitem_prop65_compliance: itemData.custitem_prop65_compliance || itemData.prop65Compliance,
      custitem_ab2998_compliance: itemData.custitem_ab2998_compliance || itemData.ab2998Compliance,
      custitem_tariff_harmonized_code: itemData.custitem_tariff_harmonized_code || itemData.tariffCode,
      
      // Business Logic
      custitemf3_lisa_item: itemData.custitemf3_lisa_item !== undefined ? itemData.custitemf3_lisa_item : false,
      custitem_f3_rollprice: itemData.custitem_f3_rollprice ? parseFloat(itemData.custitem_f3_rollprice) : null,
      
      // Application
      custitem_item_application: itemData.custitem_item_application
    };

    return {
      success: true,
      itemId: itemData.itemId,
      internalId: Math.floor(Math.random() * 10000) + 1000, // Random mock ID
      id: Math.floor(Math.random() * 10000) + 1000,
      message: 'MOCK: Successfully created lot numbered inventory item',
      customFields: mockCustomFields,
      isMocked: true
    };
  }
  
  const url = buildRestletUrl(options.envOverride);
  const headers = buildAuthHeaders('POST', url, config.accountId, options.envOverride);
  
  logger.info(`Upserting NetSuite lot numbered inventory item via RESTlet: ${itemData.itemId}`);
  
  // Debug: Check if descriptions are in itemData before transformation
  logger.info('🔍 Checking itemData for descriptions BEFORE transformToRestletPayload:');
  logger.info(`  purchasedescription: ${itemData.purchasedescription ? itemData.purchasedescription.length + ' chars' : 'NOT PRESENT'}`);
  logger.info(`  salesdescription: ${itemData.salesdescription ? itemData.salesdescription.length + ' chars' : 'NOT PRESENT'}`);
  
  try {
    // Transform OPMS data to RESTlet format
    // Mark as OPMS sync operation to ensure no prefixes are used
    const payload = transformToRestletPayload(itemData, { isOpmsSync: true });
    
    // Debug: Check if descriptions made it through transformation
    logger.info('🔍 Checking payload AFTER transformToRestletPayload:');
    logger.info(`  purchasedescription: ${payload.purchasedescription ? payload.purchasedescription.length + ' chars' : 'NOT PRESENT'}`);
    logger.info(`  salesdescription: ${payload.salesdescription ? payload.salesdescription.length + ' chars' : 'NOT PRESENT'}`);

    
    if (options.dryRun) {
      logger.info('Dry run - RESTlet payload:', JSON.stringify(payload, null, 2));
      return {
        success: true,
        dryRun: true,
        payload: payload,
        itemId: itemData.itemId
      };
    }
    
    // DEBUG: Log the actual payload being sent
    logger.info('🚀 Sending payload to NetSuite RESTlet:');
    logger.info(JSON.stringify(payload, null, 2));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    
    // DEBUG: Log response status first
    logger.info(`📡 Response Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`❌ HTTP Error Response: ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    // DEBUG: Log the full response
    logger.info('📥 RESTlet Response:', JSON.stringify(result, null, 2));
    
    if (!result.success) {
      const errorMsg = typeof result.error === 'object' ? JSON.stringify(result.error) : result.error;
      throw new Error(`RESTlet error: ${errorMsg}`);
    }
    
    const operation = result.operation || 'UPSERT';
    logger.info(`✓ Successfully ${operation.toLowerCase()}ed NetSuite lot numbered inventory item: ${itemData.itemId} (NetSuite ID: ${result.id})`);
    return result;
    
  } catch (error) {
    logger.error(`RESTlet API error for item ${itemData.itemId}:`, error.message);
    throw error;
  }
}

/**
 * Transform OPMS item data to RESTlet payload format
 * @param {Object} itemData - Item data to transform
 * @param {Object} options - Transformation options
 * @param {boolean} options.isOpmsSync - If true, never use prefixes (for data integrity)
 * @param {boolean} options.skipTestPrefix - Skip opmsAPI- prefix for non-sync operations
 */
function transformToRestletPayload(itemData, options = {}) {
  // Debug: Check if descriptions are in itemData
  console.log('\n🔍 transformToRestletPayload - Checking for descriptions:');
  console.log('  purchasedescription present:', !!itemData.purchasedescription);
  console.log('  salesdescription present:', !!itemData.salesdescription);
  if (itemData.purchasedescription) {
    console.log('  purchasedescription length:', itemData.purchasedescription.length);
  }
  if (itemData.salesdescription) {
    console.log('  salesdescription length:', itemData.salesdescription.length);
  }
  
  // Extract required fields - support OPMS T_ITEM.code mapping
  const itemId = itemData.itemid || itemData.itemId || itemData.code;
  let upcCode = itemData.upcCode || itemData.upccode || itemData.code || itemId; // Use code or itemId as fallback
  if (typeof upcCode === 'string' && upcCode.length > 20) {
    upcCode = upcCode.slice(0, 20);
  }
  if (!upcCode || String(upcCode).length === 0) {
    upcCode = String(Math.floor(1000000000 + Math.random() * 9000000000)); // 10-digit fallback
  }
  const taxScheduleId = itemData.taxschedule?.id || process.env.NETSUITE_DEFAULT_TAX_SCHEDULE_ID_SANDBOX || "1";
  
  // Determine prefix usage based on context
  // OPMS sync operations should NEVER use prefixes for data integrity
  // Other operations (testing, exports, manual creation) may use prefixes
  const isOpmsSync = options.isOpmsSync || false;
  const isProduction = process.env.NODE_ENV === 'production' || 
                      process.env.NETSUITE_ENVIRONMENT === 'production' ||
                      process.env.OPMS_ENVIRONMENT === 'production';
  const shouldSkipPrefix = options.skipTestPrefix || false;
  
  // OPMS sync: NEVER use prefixes (data integrity requirement)
  // Other operations: Use prefixes in non-production environments unless explicitly skipped
  const itemIdPrefix = (isOpmsSync || isProduction || shouldSkipPrefix) ? '' : 'opmsAPI-';
  
  // Build base payload
  const payload = {
    itemId: `${itemIdPrefix}${itemId}`,
    upcCode: upcCode,
    taxScheduleId: taxScheduleId
  };
  
  // Add optional fields if provided
  if (itemData.description || itemData.displayname) {
    payload.description = itemData.description || itemData.displayname;
  }
  
  // Format Display Name according to Opuzen naming convention
  if (itemData.displayname || (itemData.product_name && itemData.colors)) {
    const productModel = new ProductModel();
    const formattedDisplayName = productModel.formatDisplayName(
      itemData.product_name || itemData.displayname, 
      itemData.colors
    );
    payload.displayName = formattedDisplayName || itemData.displayname;
  } else if (itemData.displayname) {
    payload.displayName = itemData.displayname;
  }
  
  if (itemData.incomeAccountId) {
    payload.incomeAccountId = itemData.incomeAccountId;
  }
  
  if (itemData.cogsAccountId) {
    payload.cogsAccountId = itemData.cogsAccountId;
  }
  
  // ENHANCEMENT: Add OPMS custom fields
  if (itemData.opmsProductId) {
    payload.opmsProductId = itemData.opmsProductId;
  }
  
  if (itemData.opmsItemId) {
    payload.opmsItemId = itemData.opmsItemId;
  }
  
  // Add Width field (custitem1)
  if (itemData.width) {
    payload.width = itemData.width;
  }
  
  // Add VR (Vertical Repeat) field - needs custom field in NetSuite
  if (itemData.vrepeat) {
    payload.vrepeat = itemData.vrepeat;
  }
  
  // Add HR (Horizontal Repeat) field - needs custom field in NetSuite  
  if (itemData.hrepeat) {
    payload.hrepeat = itemData.hrepeat;
  }
  
  // Add Prop 65 Compliance field - support both API and OPMS field names
  if (itemData.prop65Compliance) {
    // Direct API field name (already mapped)
    payload.prop65Compliance = itemData.prop65Compliance;
  } else if (itemData.prop_65) {
    // OPMS database field name - map OPMS values (Y/N/D) to NetSuite values (yes/no/don't know)
    payload.prop65Compliance = mapComplianceValue(itemData.prop_65);
  }
  
  // Add AB 2998 Compliance field - support both API and OPMS field names
  if (itemData.ab2998Compliance) {
    // Direct API field name (already mapped)
    payload.ab2998Compliance = itemData.ab2998Compliance;
  } else if (itemData.ab_2998_compliant) {
    // OPMS database field name - map OPMS values (Y/N/D) to NetSuite values (yes/no/don't know)
    payload.ab2998Compliance = mapComplianceValue(itemData.ab_2998_compliant);
  }
  
  // Add Tariff/Harmonized Code field - support both API and OPMS field names
  if (itemData.tariffCode) {
    // Direct API field name
    payload.tariffCode = itemData.tariffCode;
  } else if (itemData.tariff_code) {
    // OPMS database field name
    payload.tariffCode = itemData.tariff_code;
  }
  
  // Add Native Vendor field (internal ID) - CRITICAL for vendor association
  if (itemData.vendor) {
    payload.vendor = itemData.vendor;
  }
  
  // Add Native Vendor Name field
  if (itemData.vendorname) {
    payload.vendorname = itemData.vendorname;
  }
  
  // Add Native Vendor Code field
  if (itemData.vendorcode) {
    payload.vendorcode = itemData.vendorcode;
  }
  
  // Add Custom Vendor Color field
  if (itemData.custitem_opms_vendor_color) {
    payload.custitem_opms_vendor_color = itemData.custitem_opms_vendor_color;
  }

  // Add Custom Vendor Product Name field
  if (itemData.custitem_opms_vendor_prod_name) {
    payload.custitem_opms_vendor_prod_name = itemData.custitem_opms_vendor_prod_name;
  }
  
  // Add VR/HR custom fields
  if (itemData.custitem_vertical_repeat) {
    payload.custitem_vertical_repeat = itemData.custitem_vertical_repeat;
  }
  
  if (itemData.custitem_horizontal_repeat) {
    payload.custitem_horizontal_repeat = itemData.custitem_horizontal_repeat;
  }
  
  // Add compliance custom fields
  if (itemData.custitem_prop65_compliance) {
    payload.custitem_prop65_compliance = itemData.custitem_prop65_compliance;
  }
  
  if (itemData.custitem_ab2998_compliance) {
    payload.custitem_ab2998_compliance = itemData.custitem_ab2998_compliance;
  }
  
  if (itemData.custitem_tariff_harmonized_code) {
    payload.custitem_tariff_harmonized_code = itemData.custitem_tariff_harmonized_code;
  }
  
  // Add Item Application field
  if (itemData.custitem_item_application) {
    payload.custitem_item_application = itemData.custitem_item_application;
  }
  
  // Add OPMS mapping fields
  if (itemData.custitem_opms_parent_product_name) {
    payload.custitem_opms_parent_product_name = itemData.custitem_opms_parent_product_name;
  }
  
  if (itemData.custitem_opms_item_id) {
    payload.custitem_opms_item_id = itemData.custitem_opms_item_id;
  }
  
  // Support both field name formats for OPMS Product ID - send as custitem_opms_prod_id (actual NetSuite field name)
  if (itemData.custitem_opms_product_id) {
    payload.custitem_opms_prod_id = itemData.custitem_opms_product_id;
  } else if (itemData.custitem_opms_prod_id) {
    payload.custitem_opms_prod_id = itemData.custitem_opms_prod_id;
  }
  
  // Add missing field mappings for complete field coverage - use correct NetSuite field names
  if (itemData.custitem_opms_is_repeat) {
    payload.custitem_is_repeat = itemData.custitem_opms_is_repeat;
  } else if (itemData.custitem_is_repeat) {
    payload.custitem_is_repeat = itemData.custitem_is_repeat;
  }
  
  if (itemData.custitemf3_lisa_item !== undefined) {
    payload.custitemf3_lisa_item = itemData.custitemf3_lisa_item;
  }
  
  if (itemData.custitem_f3_rollprice) {
    payload.custitem_f3_rollprice = itemData.custitem_f3_rollprice;
  }

  // PRICING CASCADE: Add pricing fields for NetSuite→OPMS→NetSuite cascade
  if (itemData.price_1_ !== undefined && itemData.price_1_ !== null) {
    payload.price_1_ = itemData.price_1_;
  }
  
  if (itemData.price_1_5 !== undefined && itemData.price_1_5 !== null) {
    payload.price_1_5 = itemData.price_1_5;
  }
  
  if (itemData.cost !== undefined && itemData.cost !== null) {
    payload.cost = itemData.cost;
  }

  // Add Legacy Vendor Name field (DEPRECATED - use vendorname for native field)
  if (itemData.vendorName) {
    // Direct API field name (legacy custom field)
    payload.vendorName = itemData.vendorName;
  } else if (itemData.vendor_name) {
    // OPMS database field name (legacy custom field)
    payload.vendorName = itemData.vendor_name;
  }
  
  if (itemData.vendorProductName) {
    // Direct API field name
    payload.vendorProductName = itemData.vendorProductName;
  } else if (itemData.vendor_product_name) {
    // OPMS database field name
    payload.vendorProductName = itemData.vendor_product_name;
  }
  
  if (itemData.vendorColor) {
    // Direct API field name
    payload.vendorColor = itemData.vendorColor;
  } else if (itemData.vendor_color) {
    // OPMS database field name
    payload.vendorColor = itemData.vendor_color;
  }
  
  if (itemData.vendorCode) {
    // Direct API field name (legacy custom field)
    payload.vendorCode = itemData.vendorCode;
  } else if (itemData.vendor_code) {
    // OPMS database field name (legacy custom field)
    payload.vendorCode = itemData.vendor_code;
  }
  
  // Add Finish field - support both API and OPMS field names
  if (itemData.finish) {
    // Direct API field name
    payload.finish = itemData.finish;
  } else if (itemData.finish_names) {
    // OPMS database field name (comma-separated list from GROUP_CONCAT)
    payload.finish = itemData.finish_names;
  }
  
  // Add Fabric Width field - support both API and OPMS field names
  if (itemData.fabricWidth) {
    // Direct API field name
    payload.fabricWidth = itemData.fabricWidth;
  } else if (itemData.width) {
    // OPMS database field name (T_PRODUCT.width)
    payload.fabricWidth = itemData.width;
  }
  
  // Add Item Colors field - support both API and OPMS field names (comma-separated list)
  if (itemData.itemColors) {
    // Direct API field name
    payload.itemColors = itemData.itemColors;
  } else if (itemData.color) {
    // OPMS database field name (GROUP_CONCAT from P_COLOR.name)
    // Convert ' / ' separator to ', ' for NetSuite
    payload.itemColors = itemData.color.replace(/ \/ /g, ', ');
  }
  
  // Add Cleaning field - support both API and OPMS field names
  if (itemData.cleaning) {
    // Direct API field name
    payload.cleaning = itemData.cleaning;
  } else if (itemData.cleaning_names) {
    // OPMS database field name (comma-separated list from GROUP_CONCAT)
    payload.cleaning = itemData.cleaning_names;
  }
  
  // Add Origin field - support both API and OPMS field names
  if (itemData.origin) {
    // Direct API field name
    payload.origin = itemData.origin;
  } else if (itemData.origin_names) {
    // OPMS database field name (comma-separated list from GROUP_CONCAT)
    payload.origin = itemData.origin_names;
  }
  
  // Add Parent Product Name field - support both API and OPMS field names
  if (itemData.parentProductName) {
    // Direct API field name
    payload.parentProductName = itemData.parentProductName;
  } else if (itemData.product_name) {
    // OPMS database field name (T_PRODUCT.name)
    payload.parentProductName = itemData.product_name;
  }
  
  // Add Repeat field (custitem5) - checkbox
  if (typeof itemData.repeat === 'boolean') {
    payload.repeat = itemData.repeat;
  }
  
  // Add Front Content field (custitem_opms_front_content) - Comma-separated text format
  if (itemData.frontContentJson) {
    // Already formatted string (from export scripts)
    payload.frontContentJson = itemData.frontContentJson;
  } else if (itemData.custitem_opms_front_content && typeof itemData.custitem_opms_front_content === 'string') {
    // Accept preformatted text from upstream payloads
    payload.frontContentJson = itemData.custitem_opms_front_content;
  } else if (itemData.frontContent) {
    if (Array.isArray(itemData.frontContent)) {
      // Structured data - generate comma-separated text from array
      payload.frontContentJson = generateContentText(itemData.frontContent, 'Front Content');
    } else if (typeof itemData.frontContent === 'string') {
      // Direct text string
      payload.frontContentJson = itemData.frontContent;
    }
  }
  
  // Add Back Content field (custitem_opms_back_content) - Comma-separated text format
  if (itemData.backContentJson) {
    // Already formatted string (from export scripts)
    payload.backContentJson = itemData.backContentJson;
  } else if (itemData.custitem_opms_back_content && typeof itemData.custitem_opms_back_content === 'string') {
    // Accept preformatted text from upstream payloads
    payload.backContentJson = itemData.custitem_opms_back_content;
  } else if (itemData.backContent) {
    if (Array.isArray(itemData.backContent)) {
      // Structured data - generate comma-separated text from array
      payload.backContentJson = generateContentText(itemData.backContent, 'Back Content');
    } else if (typeof itemData.backContent === 'string') {
      // Direct text string
      payload.backContentJson = itemData.backContent;
    }
  }
  
  // Add Abrasion field (custitem_opms_abrasion) - Comma-separated text format
  if (itemData.abrasionJson) {
    // Already formatted string (from export scripts)
    payload.abrasionJson = itemData.abrasionJson;
  } else if (itemData.custitem_opms_abrasion && typeof itemData.custitem_opms_abrasion === 'string') {
    // Accept preformatted text from upstream payloads
    payload.abrasionJson = itemData.custitem_opms_abrasion;
  } else if (itemData.abrasion) {
    if (Array.isArray(itemData.abrasion)) {
      // Structured data - generate comma-separated text from array
      payload.abrasionJson = generateAbrasionText(itemData.abrasion, 'Abrasion');
    } else if (typeof itemData.abrasion === 'string') {
      // Direct text string
      payload.abrasionJson = itemData.abrasion;
    }
  }
  
  // Add Firecodes field (custitem_opms_firecodes) - Comma-separated text format
  if (itemData.firecodesJson) {
    // Already formatted string (from export scripts)
    payload.firecodesJson = itemData.firecodesJson;
  } else if (itemData.custitem_opms_firecodes && typeof itemData.custitem_opms_firecodes === 'string') {
    // Accept preformatted text from upstream payloads
    payload.firecodesJson = itemData.custitem_opms_firecodes;
  } else if (itemData.firecodes) {
    if (Array.isArray(itemData.firecodes)) {
      // Structured data - generate comma-separated text from array
      payload.firecodesJson = generateFirecodesText(itemData.firecodes, 'Firecodes');
    } else if (typeof itemData.firecodes === 'string') {
      // Direct text string
      payload.firecodesJson = itemData.firecodes;
    }
  }
  
  // Ensure defaults for mini-form fields when source data is blank/missing
  if (!payload.frontContentJson) {
    payload.frontContentJson = ' - ';
  }
  if (!payload.backContentJson) {
    payload.backContentJson = ' - ';
  }
  if (!payload.abrasionJson) {
    payload.abrasionJson = ' - ';
  }
  if (!payload.firecodesJson) {
    payload.firecodesJson = ' - ';
  }
  
  // Add Purchase Description field (purchasedescription) - native NetSuite field
  if (itemData.purchasedescription) {
    payload.purchasedescription = itemData.purchasedescription;
    logger.debug('📝 Added purchasedescription to RESTlet payload', {
      length: itemData.purchasedescription.length,
      preview: itemData.purchasedescription.substring(0, 60) + '...'
    });
  } else {
    logger.warn('⚠️  purchasedescription not found in itemData', {
      availableFields: Object.keys(itemData).join(', ')
    });
  }
  
  // Add Sales Description field (salesdescription) - native NetSuite field
  if (itemData.salesdescription) {
    payload.salesdescription = itemData.salesdescription;
    logger.debug('📝 Added salesdescription to RESTlet payload', {
      length: itemData.salesdescription.length,
      preview: itemData.salesdescription.substring(0, 60) + '...'
    });
  } else {
    logger.warn('⚠️  salesdescription not found in itemData', {
      availableFields: Object.keys(itemData).join(', ')
    });
  }
  
  // Add NetSuite constants (if provided in itemData)
  if (itemData.usebins !== undefined) {
    payload.usebins = itemData.usebins;
  }
  if (itemData.matchbilltoreceipt !== undefined) {
    payload.matchbilltoreceipt = itemData.matchbilltoreceipt;
  }
  if (itemData.custitem_aln_1_auto_numbered !== undefined) {
    payload.custitem_aln_1_auto_numbered = itemData.custitem_aln_1_auto_numbered;
  }
  if (itemData.unitstype !== undefined) {
    payload.unitstype = itemData.unitstype;
  }
  if (itemData.custitem_aln_2_number_format !== undefined) {
    payload.custitem_aln_2_number_format = itemData.custitem_aln_2_number_format;
  }
  if (itemData.custitem_aln_3_initial_sequence !== undefined) {
    payload.custitem_aln_3_initial_sequence = itemData.custitem_aln_3_initial_sequence;
  }
  
  logger.debug('🎯 transformToRestletPayload complete', {
    totalFields: Object.keys(payload).length,
    hasPurchaseDesc: !!payload.purchasedescription,
    hasSalesDesc: !!payload.salesdescription,
    hasConstants: !!(itemData.usebins || itemData.unitstype)
  });
  
  // Debug: Verify descriptions are in final payload
  console.log('\n🎯 Final payload check:');
  console.log('  Total fields in payload:', Object.keys(payload).length);
  console.log('  purchasedescription in payload:', !!payload.purchasedescription);
  console.log('  salesdescription in payload:', !!payload.salesdescription);
  
  return payload;
}

/**
 * Generate comma-separated text from content array
 */
function generateContentText(contentArray, title) {
  if (!contentArray || !Array.isArray(contentArray) || contentArray.length === 0) {
    return 'src empty data';
  }
  
  // Extract content with percentages and format as comma-separated text
  const textParts = contentArray
    .filter(item => item.percentage || item.content || item.dropdown)
    .map(item => {
      const percentage = item.percentage ? `${item.percentage}%` : '';
      const content = item.content || item.dropdown || '';
      
      if (percentage && content) {
        return `${percentage} ${content}`;
      } else if (percentage) {
        return percentage;
      } else if (content) {
        return content;
      }
      return '';
    })
    .filter(text => text.length > 0);
  
  return textParts.length > 0 ? textParts.join(', ') : ' - ';
}

/**
 * Generate HTML table from content array (DISABLED - kept for future use)
 */
function generateContentHtml(contentArray, title) {
  // HTML generation disabled - using comma-separated text format
  return generateContentText(contentArray, title);
  
  /* ORIGINAL HTML CODE - DISABLED BUT KEPT FOR FUTURE USE
  if (!contentArray || !Array.isArray(contentArray) || contentArray.length === 0) {
    return '';
  }
  
  // 🎨 BEAUTIFUL CONTENT STYLING - Consistent Blue Theme
  const themeColor = title.toLowerCase().includes('front') ? '#4a90e2' : '#8b4513';
  const gradientStart = title.toLowerCase().includes('front') ? '#4a90e2' : '#8b4513';
  const gradientEnd = title.toLowerCase().includes('front') ? '#357abd' : '#654321';
  const lightBg = title.toLowerCase().includes('front') ? '#e6f2ff' : '#f5e6d3';
  const emoji = title.toLowerCase().includes('front') ? '🧵' : '🔧';
  
  let html = `<div style="margin:15px 0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">`;
  html += `<h3 style="background:linear-gradient(135deg,${gradientStart} 0%,${gradientEnd} 100%);color:white;margin:0;padding:12px 16px;font-size:16px;font-weight:600;text-shadow:1px 1px 2px rgba(0,0,0,0.3);">${emoji} ${title}</h3>`;
  html += `<table style="border-collapse:collapse;width:100%;background:white;">`;
  html += `<thead><tr style="background:linear-gradient(135deg,${lightBg} 0%,#ffffff 100%);">`;
  html += `<th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:${themeColor};text-align:left;">Percentage</th>`;
  html += `<th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:${themeColor};text-align:left;">Content</th>`;
  html += `</tr></thead><tbody>`;
  
  contentArray.forEach((item, index) => {
    const rowBg = index % 2 === 0 ? '#fafafa' : 'white';
    const cellStyle = `border:1px solid #e0e0e0;padding:10px 8px;background:${rowBg};`;
    
    html += `<tr style="transition:background-color 0.2s ease;">`;
    html += `<td style="${cellStyle}font-weight:600;color:${themeColor};">${item.percentage || ''}</td>`;
    html += `<td style="${cellStyle}font-weight:500;">${item.content || item.dropdown || ''}</td>`;
    html += `</tr>`;
  });
  
  html += `</tbody></table>`;
  html += `<div style="padding:8px 16px;background:#f8f9fa;font-size:12px;color:#666;font-style:italic;border-top:1px solid #e0e0e0;">`;
  html += `✓ Real OPMS Database Content | ✓ Authentic Product Specifications`;
  html += `</div></div>`;
  
  return html;
  */
}

/**
 * Update an existing lot numbered inventory item via RESTlet
 * @param {Object} itemData - Item data with id and fields to update
 * @returns {Object} Response from NetSuite RESTlet
 */
async function updateLotNumberedInventoryItem(itemData) {
  logger.info(`Updating NetSuite lot numbered inventory item: ${itemData.id}`, { itemId: itemData.id });
  
  try {
    // Transform the payload (similar to create but for updates)
    const payload = transformToUpdatePayload(itemData);
    
    const config = getConfig();
    const restletUrl = buildRestletUrl(config);
    const authHeaders = buildAuthHeaders('PUT', restletUrl);
    
    logger.debug('Sending PUT request to RESTlet', { 
      url: restletUrl,
      payloadKeys: Object.keys(payload)
    });
    
    const response = await fetch(restletUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify(payload)
    });
    
    const responseText = await response.text();
    logger.debug('RESTlet PUT response', { 
      status: response.status, 
      statusText: response.statusText,
      responseLength: responseText.length 
    });
    
    if (!response.ok) {
      throw new Error(`RESTlet error: ${response.status} ${response.statusText}: ${responseText}`);
    }
    
    const result = JSON.parse(responseText);
    
    if (!result.success) {
      throw new Error(`RESTlet error: ${result.error || 'Unknown error'}`);
    }
    
    logger.info(`✓ Successfully updated NetSuite lot numbered inventory item: ${itemData.id} (NetSuite ID: ${result.id})`);
    return result;
    
  } catch (error) {
    logger.error(`RESTlet API error for item ${itemData.id}:`, { error: error.message });
    throw error;
  }
}

/**
 * Transform item data to RESTlet payload format for updates
 * @param {Object} itemData - Raw item data
 * @returns {Object} Formatted payload for RESTlet
 */
function transformToUpdatePayload(itemData) {
  const payload = {
    id: itemData.id
  };
  
  // Add action for RESTlet routing
  if (itemData.action) {
    payload.action = itemData.action;
  }
  
  // Add inactive status if provided
  if (itemData.hasOwnProperty('isinactive')) {
    payload.isinactive = itemData.isinactive;
  }
  
  // Add display name if provided
  if (itemData.displayName) {
    payload.displayName = itemData.displayName;
  }
  
  // Add Front Content field (custitem_opms_front_content) - Comma-separated text format
  if (itemData.frontContent && Array.isArray(itemData.frontContent)) {
    payload.frontContentJson = generateContentText(itemData.frontContent, 'Front Content');
  }
  
  // Add Back Content field (custitem_opms_back_content) - Comma-separated text format  
  if (itemData.backContent && Array.isArray(itemData.backContent)) {
    payload.backContentJson = generateContentText(itemData.backContent, 'Back Content');
  }
  
  // Add Abrasion field (custitem_opms_abrasion) - Comma-separated text format
  if (itemData.abrasion && Array.isArray(itemData.abrasion)) {
    payload.abrasionJson = generateAbrasionText(itemData.abrasion, 'Abrasion');
  }
  
  // Add Firecodes field (custitem_opms_firecodes) - Comma-separated text format
  if (itemData.firecodes && Array.isArray(itemData.firecodes)) {
    payload.firecodesJson = generateFirecodesText(itemData.firecodes, 'Firecodes');
  }
  
  return payload;
}

/**
 * Generate comma-separated text from abrasion array
 */
function generateAbrasionText(abrasionArray, title) {
  if (!abrasionArray || !Array.isArray(abrasionArray) || abrasionArray.length === 0) {
    return ' - ';
  }
  
  // Extract abrasion test data and format as comma-separated text
  const textParts = abrasionArray
    .filter(item => item.test || item.rubs || item.result)
    .map(item => {
      const parts = [];
      if (item.test) parts.push(item.test);
      if (item.rubs) parts.push(`${item.rubs} rubs`);
      if (item.result) parts.push(item.result);
      if (item.cycles) parts.push(`${item.cycles} cycles`);
      return parts.join(' ');
    })
    .filter(text => text.length > 0);
  
  return textParts.length > 0 ? textParts.join(', ') : ' - ';
}

/**
 * Generate comma-separated text from firecodes array
 */
function generateFirecodesText(firecodesArray, title) {
  if (!firecodesArray || !Array.isArray(firecodesArray) || firecodesArray.length === 0) {
    return ' - ';
  }
  
  // Extract firecode data and format as comma-separated text
  const textParts = firecodesArray
    .filter(item => item.standard || item.result || item.code)
    .map(item => {
      const parts = [];
      if (item.standard) parts.push(item.standard);
      if (item.code) parts.push(item.code);
      if (item.result) parts.push(item.result);
      return parts.join(' ');
    })
    .filter(text => text.length > 0);
  
  return textParts.length > 0 ? textParts.join(', ') : ' - ';
}

/**
 * Generate HTML table from abrasion array (complex mini-form data) - DISABLED
 */
function generateAbrasionHtml(abrasionArray, title) {
  // HTML generation disabled - using comma-separated text format
  return generateAbrasionText(abrasionArray, title);
  
  /* ORIGINAL HTML CODE - DISABLED BUT KEPT FOR FUTURE USE
  if (!abrasionArray || !Array.isArray(abrasionArray) || abrasionArray.length === 0) {
    return '';
  }
  
  // 🎨 BEAUTIFUL ABRASION STYLING - Gorgeous Orange/Red Gradient
  let html = `<div style="margin:15px 0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">`;
  html += `<h3 style="background:linear-gradient(135deg,#ff6b35 0%,#f7931e 50%,#ff4500 100%);color:white;margin:0;padding:12px 16px;font-size:16px;font-weight:600;text-shadow:1px 1px 2px rgba(0,0,0,0.3);">🔬 Abrasion Test Results</h3>`;
  html += `<table style="border-collapse:collapse;width:100%;background:white;">`;
  html += `<thead><tr style="background:linear-gradient(135deg,#ffebe6 0%,#fff2e6 100%);">`;
  html += `<th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:#d2691e;text-align:left;">Test Method</th>`;
  html += `<th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:#d2691e;text-align:center;">Rubs</th>`;
  html += `<th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:#d2691e;text-align:center;">Limit</th>`;
  html += `<th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:#d2691e;text-align:center;">Certificates</th>`;
  html += `<th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:#d2691e;text-align:center;">Public</th>`;
  html += `<th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:#d2691e;text-align:center;">In Spec</th></tr></thead><tbody>`;
  
  abrasionArray.forEach((item, index) => {
    const rowBg = index % 2 === 0 ? '#fafafa' : 'white';
    const cellStyle = `border:1px solid #e0e0e0;padding:10px 8px;background:${rowBg};`;
    
    html += `<tr style="transition:background-color 0.2s ease;">`;
    html += `<td style="${cellStyle}font-weight:500;">${item.test || 'Standard Test'}</td>`;
    html += `<td style="${cellStyle}text-align:center;font-weight:600;color:#ff6b35;">${item.rubs ? item.rubs.toLocaleString() : 'N/A'}</td>`;
    html += `<td style="${cellStyle}text-align:center;">${item.limit || 'Unknown'}</td>`;
    
    // Handle file downloads with beautiful styling
    html += `<td style="${cellStyle}text-align:center;">`;
    if (item.files && Array.isArray(item.files) && item.files.length > 0) {
      const fileLinks = item.files.map(file => 
        `<a href="${file.url}" target="_blank" style="color:#ff6b35;text-decoration:none;font-weight:500;padding:2px 6px;background:#fff2e6;border-radius:3px;border:1px solid #ffcab0;display:inline-block;margin:1px;">📄 ${file.name}</a>`
      ).join(' ');
      html += fileLinks;
    } else {
      html += '<span style="color:#999;">No files</span>';
    }
    html += `</td>`;
    
    html += `<td style="${cellStyle}text-align:center;font-size:16px;">${item.publicVisible ? '<span style="color:#28a745;">✓</span>' : '<span style="color:#dc3545;">✗</span>'}</td>`;
    html += `<td style="${cellStyle}text-align:center;font-size:16px;">${item.inVendorSpecsheet ? '<span style="color:#28a745;">✓</span>' : '<span style="color:#dc3545;">✗</span>'}</td>`;
    html += `</tr>`;
  });
  
  html += `</tbody></table>`;
  html += `<div style="padding:8px 16px;background:#f8f9fa;font-size:12px;color:#666;font-style:italic;border-top:1px solid #e0e0e0;">`;
  html += `✓ Real OPMS Test Data | ✓ Certified Laboratory Results`;
  html += `</div></div>`;
  
  return html;
  */
}

/**
 * Generate HTML table from firecodes array (mini-form data with file downloads) - DISABLED
 */
function generateFirecodesHtml(firecodesArray, title) {
  // HTML generation disabled - using comma-separated text format
  return generateFirecodesText(firecodesArray, title);
  
  /* ORIGINAL HTML CODE - DISABLED BUT KEPT FOR FUTURE USE
  if (!firecodesArray || !Array.isArray(firecodesArray) || firecodesArray.length === 0) {
    return '';
  }
  
  // 🎨 BEAUTIFUL FIRECODE STYLING - Gorgeous Red/Purple Gradient
  let html = `<div style="margin:15px 0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">`;
  html += `<h3 style="background:linear-gradient(135deg,#dc143c 0%,#b22222 50%,#8b0000 100%);color:white;margin:0;padding:12px 16px;font-size:16px;font-weight:600;text-shadow:1px 1px 2px rgba(0,0,0,0.3);">🔥 Fire Code Certifications</h3>`;
  html += `<table style="border-collapse:collapse;width:100%;background:white;">`;
  html += `<thead><tr style="background:linear-gradient(135deg,#ffe6e6 0%,#fff0f0 100%);">`;
  html += `<th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:#8b0000;text-align:left;">Fire Code Standard</th>`;
  html += `<th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:#8b0000;text-align:center;">Pass Rate</th>`;
  html += `<th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:#8b0000;text-align:center;">Certificates</th>`;
  html += `<th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:#8b0000;text-align:center;">Public</th>`;
  html += `<th style="border:1px solid #e0e0e0;padding:12px 8px;font-weight:600;color:#8b0000;text-align:center;">In Spec</th></tr></thead><tbody>`;
  
  firecodesArray.forEach((item, index) => {
    const rowBg = index % 2 === 0 ? '#fafafa' : 'white';
    const cellStyle = `border:1px solid #e0e0e0;padding:10px 8px;background:${rowBg};`;
    
    html += `<tr style="transition:background-color 0.2s ease;">`;
    html += `<td style="${cellStyle}font-weight:500;">${item.fireCode || item.firecodeLabel || 'Fire Safety Standard'}</td>`;
    html += `<td style="${cellStyle}text-align:center;font-weight:600;color:#dc143c;">${item.percentage || 'Certified'}</td>`;
    
    // Handle file downloads with beautiful styling
    html += `<td style="${cellStyle}text-align:center;">`;
    if (item.files && Array.isArray(item.files) && item.files.length > 0) {
      const fileLinks = item.files.map(file => 
        `<a href="${file.url}" target="_blank" style="color:#dc143c;text-decoration:none;font-weight:500;padding:2px 6px;background:#ffe6e6;border-radius:3px;border:1px solid #ffb3b3;display:inline-block;margin:1px;">🔥 ${file.name}</a>`
      ).join(' ');
      html += fileLinks;
    } else {
      html += '<span style="color:#999;">No certificates</span>';
    }
    html += `</td>`;
    
    html += `<td style="${cellStyle}text-align:center;font-size:16px;">${item.publicVisible ? '<span style="color:#28a745;">✓</span>' : '<span style="color:#dc3545;">✗</span>'}</td>`;
    html += `<td style="${cellStyle}text-align:center;font-size:16px;">${item.inVendorSpecsheet ? '<span style="color:#28a745;">✓</span>' : '<span style="color:#dc3545;">✗</span>'}</td>`;
    html += `</tr>`;
  });
  
  html += `</tbody></table>`;
  html += `<div style="padding:8px 16px;background:#f8f9fa;font-size:12px;color:#666;font-style:italic;border-top:1px solid #e0e0e0;">`;
  html += `✓ Real OPMS Fire Safety Data | ✓ Certified Test Results`;
  html += `</div></div>`;
  
  return html;
  */
}

/**
 * Create multiple inventory items in bulk
 */
async function createItemsBulk(itemsData, options = {}) {
  const results = [];
  const batchSize = options.batchSize || 5;
  const delay = options.delay || 2000; // 2 second delay between items
  
  logger.info(`Creating ${itemsData.length} items via RESTlet (batch size: ${batchSize})`);
  
  for (let i = 0; i < itemsData.length; i++) {
    const itemData = itemsData[i];
    
    try {
      const result = await createLotNumberedInventoryItem(itemData, options);
      results.push({
        success: true,
        itemId: itemData.itemid || itemData.itemId,
        result: result
      });
      
      // Add delay between requests to avoid rate limiting
      if (i < itemsData.length - 1 && delay > 0) {
        logger.debug(`Waiting ${delay}ms before next item...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
    } catch (error) {
      results.push({
        success: false,
        itemId: itemData.itemid || itemData.itemId,
        error: error.message
      });
    }
  }
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  logger.info(`Bulk creation complete: ${successful} successful, ${failed} failed`);
  
  return {
    total: itemsData.length,
    successful: successful,
    failed: failed,
    results: results
  };
}

/**
 * Delete a lot numbered inventory item via RESTlet
 * @param {string} itemId - NetSuite internal ID of the item to delete
 * @returns {Promise<Object>} RESTlet response
 */
async function deleteLotNumberedInventoryItem(itemId) {
  logger.info(`Deleting NetSuite lot numbered inventory item: ${itemId}`);
  
  try {
    const config = getConfig();
    const restletUrl = buildRestletUrl(config);
    const authHeaders = buildAuthHeaders('POST', restletUrl);
    
    const payload = { action: 'delete', id: itemId };
    
    logger.debug('Sending POST request with delete action to RESTlet', { 
      itemId, 
      payload,
      restletUrl, 
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' }
    });
    
    const response = await fetch(restletUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify(payload)
    });
    
    const responseText = await response.text();
    logger.debug('RESTlet DELETE response', { status: response.status, responseText });
    
    if (!response.ok) {
      throw new Error(`RESTlet error: ${response.status} ${response.statusText}: ${responseText}`);
    }
    
    const result = JSON.parse(responseText);
    
    if (!result.success) {
      throw new Error(`RESTlet error: ${result.error || 'Unknown error'}`);
    }
    
    logger.info(`✅ Successfully deleted NetSuite lot numbered inventory item: ${result.itemId} (NetSuite ID: ${result.id})`);
    return result;
    
  } catch (error) {
    logger.error(`RESTlet DELETE error for item ${itemId}:`, { error: error.message });
    throw error;
  }
}

/**
 * Bulk delete items matching a pattern using the management RESTlet
 * 
 * @param {Object} options - Delete options
 * @param {boolean} options.dryRun - If true, only return items that would be deleted
 * @param {string} options.itemPattern - Pattern to match item names
 * @param {number} options.maxItems - Maximum number of items to delete
 * @returns {Promise<Object>} Bulk delete results
 */
/**
 * Get all vendors from NetSuite
 * @returns {Promise<Array>} Array of vendor objects with id and name
 */
async function getAllVendors() {
  try {
    logger.info('🔍 Fetching all vendors from NetSuite');
    
    const config = getConfig();
    const url = buildRestletUrl();
    
    // Create a simple payload to request vendor list
    const payload = {
      action: 'GET_VENDORS'
    };
    
    const authHeaders = buildAuthHeaders('POST', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify(payload)
    });
    
    const responseText = await response.text();
    
    if (!response.ok) {
      throw new Error(`NetSuite RESTlet error: ${response.status} ${response.statusText}: ${responseText}`);
    }
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`Invalid JSON response from NetSuite RESTlet: ${responseText}`);
    }
    
    logger.info(`📥 Retrieved ${result.vendors ? result.vendors.length : 0} vendors from NetSuite`);
    return result.vendors || [];
    
  } catch (error) {
    logger.error('❌ Failed to fetch vendors from NetSuite:', error.message);
    throw error;
  }
}

/**
 * Get all vendors available for itemvendor sublist from NetSuite
 * @returns {Promise<Array>} Array of vendor objects with id and name
 */
async function getItemVendors() {
  try {
    logger.info('🔍 Fetching itemvendor list vendors from NetSuite');
    
    const config = getConfig();
    const url = buildRestletUrl();
    
    // Create payload to request itemvendor vendors
    const payload = {
      action: 'GET_ITEMVENDOR_VENDORS'
    };
    
    const authHeaders = buildAuthHeaders('POST', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify(payload)
    });
    
    const responseText = await response.text();
    
    if (!response.ok) {
      throw new Error(`NetSuite RESTlet error: ${response.status} ${response.statusText} - ${responseText}`);
    }
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      logger.error('Failed to parse NetSuite response as JSON:', responseText);
      throw new Error(`Invalid JSON response from NetSuite: ${parseError.message}`);
    }
    
    if (result.error) {
      throw new Error(`NetSuite RESTlet error: ${result.error}`);
    }
    
    logger.info(`✅ Successfully retrieved ${result.vendors?.length || 0} itemvendor vendors from NetSuite`);
    return result.vendors || [];
    
  } catch (error) {
    logger.error('Failed to get itemvendor vendors from NetSuite:', error.message);
    throw error;
  }
}

async function bulkDeleteItems({ dryRun = true, itemPattern = "opmsAPI-", maxItems = 50 }) {
  const netsuiteManageService = require('./netsuiteManageItemService');
  
  logger.info('Starting bulk delete operation', { dryRun, itemPattern, maxItems });
  
  const result = {
    success: false,
    itemsProcessed: 0,
    itemsDeleted: 0,
    errors: [],
    dryRun,
    itemsFound: [],
    details: []
  };
  
  try {
    // Step 1: Search for items to delete using proper NetSuite search (most recent first)
    logger.info(`Searching for items matching pattern "${itemPattern}" (max: ${maxItems})`);
    
    const foundItems = await netsuiteManageService.searchItems(itemPattern, maxItems);
    
    // Convert search results to deletion format
    const itemsToDelete = foundItems.map(item => ({
      id: item.internalId,
      itemid: item.itemId,
      displayname: item.displayName,
      isinactive: item.isInactive
    }));
    
    result.itemsFound = itemsToDelete;
    result.itemsProcessed = itemsToDelete.length;
    
    logger.info(`✅ Found ${itemsToDelete.length} items matching pattern "${itemPattern}" using proper search`, {
      itemIds: itemsToDelete.map(item => item.itemid)
    });
    
    if (dryRun) {
      result.success = true;
      result.message = `DRY RUN: Found ${itemsToDelete.length} items that would be deleted`;
      return result;
    }
    
    // Step 2: Delete the items
    for (const item of itemsToDelete) {
      try {
        logger.info(`Deleting item: ${item.itemid} (ID: ${item.id})`);
        
        await netsuiteManageService.smartDelete(item.id);
        
        result.itemsDeleted++;
        result.details.push({
          itemId: item.id,
          itemName: item.itemid,
          status: 'deleted',
          action: 'smart_delete'
        });
        
        logger.info(`Successfully processed item: ${item.itemid}`);
        
      } catch (error) {
        logger.error(`Failed to delete item ${item.itemid}:`, error);
        result.errors.push({
          itemId: item.id,
          itemName: item.itemid,
          error: error.message
        });
        result.details.push({
          itemId: item.id,
          itemName: item.itemid,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    result.success = true;
    result.message = `Successfully processed ${result.itemsDeleted} items, ${result.errors.length} errors`;
    
    logger.info('Bulk delete operation completed', {
      itemsProcessed: result.itemsProcessed,
      itemsDeleted: result.itemsDeleted,
      errors: result.errors.length
    });
    
    return result;
    
  } catch (error) {
    logger.error('Bulk delete operation failed:', error);
    result.errors.push({
      operation: 'bulk_delete',
      error: error.message
    });
    result.message = `Bulk delete failed: ${error.message}`;
    return result;
  }
}



module.exports = {
  getConfig,
  buildAuthHeaders,
  buildRestletUrl,
  testConnection,
  testConnectivity: testConnection, // Alias for compatibility
  createLotNumberedInventoryItem,
  updateLotNumberedInventoryItem,
  deleteLotNumberedInventoryItem,
  createItemsBulk,
  transformToRestletPayload,
  generateAbrasionHtml,
  generateFirecodesHtml,
  generateContentText,
  generateAbrasionText,
  generateFirecodesText,
  bulkDeleteItems,
  getItemVendors
}; 