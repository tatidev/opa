/**
 * Environment Configuration Management
 * Handles different environments: test, development, production
 */

// Load environment variables only if not in test
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config();
}

/**
 * Environment Types
 */
const ENVIRONMENTS = {
  TEST: 'test',
  DEVELOPMENT: 'development', 
  PRODUCTION: 'production'
};

/**
 * Get current environment
 */
function getCurrentEnvironment() {
  return process.env.NODE_ENV || ENVIRONMENTS.DEVELOPMENT;
}

/**
 * Check if we're in a specific environment
 */
function isTest() {
  return getCurrentEnvironment() === ENVIRONMENTS.TEST;
}

function isDevelopment() {
  return getCurrentEnvironment() === ENVIRONMENTS.DEVELOPMENT;
}

function isProduction() {
  return getCurrentEnvironment() === ENVIRONMENTS.PRODUCTION;
}

/**
 * NetSuite Configuration based on environment
 */
function getNetSuiteConfig() {
  const env = getCurrentEnvironment();
  
  // Test environment - use mocked configuration
  if (env === ENVIRONMENTS.TEST) {
    return {
      accountId: 'TEST_ACCOUNT',
      baseUrl: 'https://test-account.suitetalk.api.netsuite.com',
      consumerKey: 'test_consumer_key',
      consumerSecret: 'test_consumer_secret',
      accessToken: 'test_access_token',
      accessTokenSecret: 'test_access_token_secret',
      defaultTaxScheduleId: '999',
      defaultSubsidiaryId: '888',
      apiVersion: 'v1',
      isMocked: true
    };
  }

  // Development/Production - use real NetSuite configuration
  const isDevEnv = env === ENVIRONMENTS.DEVELOPMENT;
  const envSuffix = isDevEnv ? 'SANDBOX' : 'PROD';
  
  return {
    accountId: process.env[`NETSUITE_ACCOUNT_ID_${envSuffix}`],
    baseUrl: process.env[`NETSUITE_BASE_URL_${envSuffix}`] || 
             `https://${process.env[`NETSUITE_ACCOUNT_ID_${envSuffix}`]?.replace(/_/g, '-').toLowerCase()}.suitetalk.api.netsuite.com`,
    consumerKey: process.env.NETSUITE_CONSUMER_KEY,
    consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
    accessToken: process.env.NETSUITE_ACCESS_TOKEN,
    accessTokenSecret: process.env.NETSUITE_ACCESS_TOKEN_SECRET,
    defaultTaxScheduleId: process.env[`NETSUITE_DEFAULT_TAX_SCHEDULE_ID_${envSuffix}`] || '1',
    defaultSubsidiaryId: process.env[`NETSUITE_DEFAULT_SUBSIDIARY_ID_${envSuffix}`] || '1',
    apiVersion: 'v1',
    isMocked: false
  };
}

/**
 * Database Configuration based on environment
 */
function getDatabaseConfig() {
  const env = getCurrentEnvironment();
  
  // Test environment - return mock configuration
  if (env === ENVIRONMENTS.TEST) {
    return {
      host: 'localhost',
      port: 3306,
      user: 'test',
      password: 'test',
      database: 'test_db',
      isMocked: true
    };
  }

  // Development/Production - use real database
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'opuzen',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
    isMocked: false
  };
}

/**
 * Check if live testing is enabled
 * This allows running integration tests against real NetSuite in development
 */
function isLiveTestingEnabled() {
  return process.env.NETSUITE_LIVE_TEST === 'true' || process.env.ENABLE_INTEGRATION_TESTS === 'true';
}

/**
 * Get test configuration
 * Determines whether to use mocked or live services for testing
 */
function getTestConfig() {
  const env = getCurrentEnvironment();
  
  return {
    environment: env,
    useMockedNetSuite: env === ENVIRONMENTS.TEST && !isLiveTestingEnabled(),
    useMockedDatabase: env === ENVIRONMENTS.TEST,
    enableIntegrationTests: isLiveTestingEnabled(),
    logLevel: process.env.LOG_LEVEL || (env === ENVIRONMENTS.TEST ? 'error' : 'info')
  };
}

module.exports = {
  ENVIRONMENTS,
  getCurrentEnvironment,
  isTest,
  isDevelopment, 
  isProduction,
  getNetSuiteConfig,
  getDatabaseConfig,
  isLiveTestingEnabled,
  getTestConfig
};