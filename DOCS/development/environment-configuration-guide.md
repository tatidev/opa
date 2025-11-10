# Environment Configuration Guide

## Overview
The Opuzen API uses a sophisticated environment strategy to support both fast unit testing and comprehensive integration testing against live NetSuite systems.

## Quick Start

### For Daily Development (Fast Tests)
```bash
npm run test:unit        # Unit tests (~1s)
npm run test:watch       # TDD mode
```

### For Integration Testing (Live NetSuite)
```bash
npm run netsuite:live:config    # Test configuration
npm run netsuite:live:auth      # Test authentication  
npm run netsuite:live:create    # Test item creation
npm run netsuite:live           # Full integration test
```

## Environment Tiers

| Environment | NetSuite | Database | Speed | Purpose |
|-------------|----------|----------|-------|---------|
| **test** | 🎭 Mocked | 🎭 Mocked | ⚡ ~1s | Unit testing, TDD |
| **development** | 🔗 Live Sandbox | 🔗 Real DB | 🐌 ~30s | Integration testing |
| **production** | 🔗 Live Production | 🔗 Real DB | 🐌 Variable | Live system |

## Configuration Files

### Environment Detection
The system automatically detects the environment based on `NODE_ENV`:

```javascript
// src/config/environments.js
function getCurrentEnvironment() {
  return process.env.NODE_ENV || 'development';
}
```

### NetSuite Configuration
Dynamic configuration based on environment:

```javascript
function getNetSuiteConfig() {
  const env = getCurrentEnvironment();
  
  // Test environment - use mocked configuration
  if (env === 'test') {
    return {
      accountId: 'TEST_ACCOUNT',
      baseUrl: 'https://test-account.suitetalk.api.netsuite.com',
      isMocked: true
    };
  }

  // Development/Production - use real NetSuite
  const envSuffix = env === 'development' ? 'SANDBOX' : 'PROD';
  return {
    accountId: process.env[`NETSUITE_ACCOUNT_ID_${envSuffix}`],
    baseUrl: process.env[`NETSUITE_BASE_URL_${envSuffix}`],
    isMocked: false
  };
}
```

## Environment Variables

### Development Environment (.env)
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=opuzen_dev

# NetSuite Sandbox Configuration (for development testing)
NETSUITE_ACCOUNT_ID_SANDBOX=your_sandbox_account_id
NETSUITE_CONSUMER_KEY=your_sandbox_consumer_key
NETSUITE_CONSUMER_SECRET=your_sandbox_consumer_secret
NETSUITE_ACCESS_TOKEN=your_sandbox_access_token
NETSUITE_ACCESS_TOKEN_SECRET=your_sandbox_access_token_secret

# Development Testing Flags
NETSUITE_LIVE_TEST=true
ENABLE_INTEGRATION_TESTS=true

# Server Configuration
NODE_ENV=development
PORT=3000
```

### Production Environment
```env
# NetSuite Production Configuration
NETSUITE_ACCOUNT_ID_PROD=your_production_account_id
NETSUITE_CONSUMER_KEY_PROD=your_production_consumer_key
NETSUITE_CONSUMER_SECRET_PROD=your_production_consumer_secret
NETSUITE_ACCESS_TOKEN_PROD=your_production_access_token
NETSUITE_ACCESS_TOKEN_SECRET_PROD=your_production_access_token_secret

NODE_ENV=production
```

### Test Environment
No environment variables needed - everything is mocked automatically when `NODE_ENV=test`.

## NPM Scripts Reference

### Unit Testing (Mocked)
```bash
# Fast unit tests (recommended for daily development)
npm run test:unit                # All unit tests (~1s)
npm run test:watch               # Watch mode for TDD
npm run test:coverage            # Unit tests with coverage

# Standard Jest commands
npm test                         # All tests (including slow integration)
```

### Integration Testing (Live NetSuite)
```bash
# Live NetSuite integration tests
npm run test:integration         # Live sandbox testing
npm run test:integration:mock    # Mocked integration tests

# Live NetSuite testing utilities
npm run netsuite:live            # Full integration test suite
npm run netsuite:live:config     # Test configuration only
npm run netsuite:live:auth       # Test authentication only  
npm run netsuite:live:create     # Test item creation only
```

### Legacy NetSuite Scripts (Still Available)
```bash
npm run netsuite:test            # Legacy test script
npm run netsuite:validate        # Configuration validation
npm run restlet:test             # RESTlet testing
```

## Live Testing Script

The `scripts/test-netsuite-live.js` script provides comprehensive testing against real NetSuite:

### Configuration Test
```bash
npm run netsuite:live:config
```
**Output Example:**
```
Environment Configuration:
  Environment: development ✅
  Live Testing: true ✅
  Mocked NetSuite: false ✅

NetSuite Configuration:
  Account ID: 11516011_SB1 ✅
  Base URL: https://11516011-sb1.suitetalk.api.netsuite.com ✅
  API Version: v1 ✅
  Is Mocked: false ✅
```

### Authentication Test
```bash
npm run netsuite:live:auth
```
Tests OAuth header generation and credential validation.

### Item Creation Test
```bash
npm run netsuite:live:create
```
Creates a real test item in NetSuite to validate end-to-end functionality.

### Full Integration Test
```bash
npm run netsuite:live
```
Runs all tests: configuration, authentication, item creation, and tax schedules.

## Development Workflow

### 1. Daily Development (TDD Approach)
```bash
# Start with fast unit tests
npm run test:watch

# Make changes, tests run automatically (~1s each)
# Fast feedback loop for development
```

### 2. Feature Validation (Integration Testing)
```bash
# After implementing a feature, test against real NetSuite
npm run netsuite:live:config     # Verify setup
npm run netsuite:live:create     # Test the feature

# Or run full integration suite
npm run netsuite:live
```

### 3. Pre-commit Validation
```bash
# Git hooks automatically run:
npm run test:unit                # Fast pre-commit tests (~1s)

# Manual pre-commit check:
npm run test:coverage            # Unit tests with coverage
```

### 4. CI/CD Pipeline
```bash
# Stage 1: Fast feedback (always)
npm run test:unit

# Stage 2: Integration validation (if credentials available)
npm run test:integration:mock    # Mocked integration tests
npm run test:integration         # Live integration tests (optional)
```

## Troubleshooting

### Common Issues

#### 1. "NetSuite configuration missing"
**Cause**: Environment variables not set or wrong `NODE_ENV`
**Solution**:
```bash
# Check current environment
npm run netsuite:live:config

# Verify environment variables are set
echo $NODE_ENV
echo $NETSUITE_ACCOUNT_ID_SANDBOX
```

#### 2. "Tests taking too long"
**Cause**: Running integration tests instead of unit tests
**Solution**:
```bash
# Use fast unit tests for development
npm run test:unit                # ~1s execution

# Instead of:
npm test                         # ~30s+ execution
```

#### 3. "Authentication errors in live testing"
**Cause**: Invalid NetSuite credentials
**Solution**:
```bash
# Test authentication specifically
npm run netsuite:live:auth

# Check credentials in .env file
# Verify sandbox account is active
```

#### 4. "Network timeouts in tests"
**Cause**: Integration tests running when unit tests expected
**Solution**:
```bash
# Ensure NODE_ENV=test for unit tests
NODE_ENV=test npm run test:unit

# Check test environment isolation
```

### Environment Debugging

#### Check Current Configuration
```bash
npm run netsuite:live:config
```

#### Verify Test Environment Isolation
```javascript
// In test files, verify environment is properly set
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('NetSuite Config:', getNetSuiteConfig());
```

#### Test Network Connectivity
```bash
# Test NetSuite connectivity
npm run netsuite:live:auth

# Test item creation
npm run netsuite:live:create
```

## Best Practices

### 1. Development Testing
- Use `npm run test:unit` for daily development (fast feedback)
- Use `npm run netsuite:live` before major commits (integration validation)
- Keep unit tests fast (<2 seconds total execution)

### 2. Environment Management
- Never mix test and live credentials
- Use environment-specific variable names
- Validate configuration on application startup

### 3. CI/CD Integration
- Run unit tests on every commit (fast feedback)
- Run integration tests on important branches
- Use conditional integration testing based on credential availability

### 4. Debugging
- Use live testing scripts for diagnostics
- Check environment detection first
- Validate credentials separately from application logic

## Security Considerations

### 1. Credential Management
- Never commit real credentials to version control
- Use environment-specific credential files
- Rotate credentials regularly

### 2. Test Isolation
- Unit tests should never touch real systems
- Use proper mocking for all external services
- Validate environment isolation in test setup

### 3. Sandbox Safety
- Use dedicated sandbox accounts for testing
- Implement cleanup procedures for test data
- Monitor sandbox usage and limits

## Performance Optimization

### 1. Test Execution Speed
- Unit tests: Target <2 seconds total
- Integration tests: Accept 30+ seconds for thoroughness
- Use parallel execution where possible

### 2. Network Efficiency
- Mock network calls in unit tests
- Use real network calls only for integration validation
- Implement proper timeout handling

### 3. Resource Management
- Clean up test data after integration tests
- Use connection pooling for database tests
- Monitor resource usage in CI/CD pipelines