# Opuzen API

A Node.js REST API for Opuzen with NetSuite integration capabilities.

## Overview

This API provides a comprehensive set of endpoints for managing Opuzen products, items, and colors. The API is fully documented with:

- **Interactive Swagger Documentation** - Available at `/api-docs` endpoint
- **Postman Collection** - For advanced testing and integration
- **[Comprehensive Documentation Guide](DOCS/API_Documentation_Guide.md)** - Detailed usage instructions

## Prerequisites

- Node.js 18 or higher
- Docker and Docker Compose
- MySQL 8.0 database (local or remote)

## Setup

1. Clone the repository
2. Create a `.env` file based on `.env.example` and fill in your database credentials
3. Install dependencies:
   ```bash
   npm install
   ```

## Documentation

### 📚 Core Documentation
- [API Documentation Guide](DOCS/API_Documentation_Guide.md) - Comprehensive guide to using the API documentation
- [Development Guide](DOCS/development-guide.md) - Detailed instructions for setting up and running the API
- [Dependencies Guide](DOCS/dependencies.md) - Comprehensive information about project dependencies
- [Development Planning](DOCS/development-planning.md) - Project roadmap and development tracking

### 🧪 Testing & Environment Strategy
- [Environment Configuration Guide](DOCS/development/environment-configuration-guide.md) - **NEW!** Comprehensive environment strategy (test/dev/prod)
- [Testing Standards and Conventions](DOCS/ai-specs/development/test-standards-and-conventions.md) - Testing best practices and Jest standards
- [Git Hooks Guide](DOCS/development/git-hooks-guide.md) - Automated testing with git hooks

### 🔗 NetSuite Integration
- [NetSuite Integration README](DOCS/NetSuite-Integrations/README-NetSuite-Integration.md) - NetSuite integration overview
- [Item Field Mapping](DOCS/NetSuite-Integrations/Item-Field-Mapping.md) - OPMS to NetSuite field mapping
- [Display Name Implementation Guide](DOCS/NetSuite-Integrations/Display-Name-Implementation-Guide.md) - Display name formatting logic
- [Bulk Delete API Documentation](DOCS/NetSuite-Integrations/Bulk-Delete-API-Documentation.md) - Bulk operations API

### 🔄 NetSuite → OPMS Pricing Sync (NEW!)
**Complete Testing & Deployment Suite**

👉 **[📑 DOCUMENTATION INDEX](netsuite-scripts/test-ns-to-opms-sync/INDEX.md)** - Complete navigation guide

**Key Documents**:
- [📋 Testing Summary](netsuite-scripts/test-ns-to-opms-sync/TESTING-COMPLETE-SUMMARY.md) - **START HERE** - Test results & production guide
- [🚀 Production Deployment](PRODUCTION-DEPLOYMENT-NS-TO-OPMS-SYNC.md) - **Production checklist & monitoring**
- [🚀 Quick Start](netsuite-scripts/test-ns-to-opms-sync/QUICK-START.md) - Fast testing reference
- [📖 Complete Guide](netsuite-scripts/test-ns-to-opms-sync/README.md) - Comprehensive testing documentation
- [📊 Dashboard Guide](netsuite-scripts/test-ns-to-opms-sync/DASHBOARD-AND-LIVE-TESTING-GUIDE.md) - Monitoring dashboard usage
- [🔧 NetSuite Webhook Setup](netsuite-scripts/NETSUITE-WEBHOOK-DEPLOYMENT-GUIDE.md) - SuiteScript deployment guide

**Status**: ✅ Tested & Validated (4/4 tests passed - 100%) | Ready for Production Deployment  
**Dashboard**: http://localhost:3000/api/sync-dashboard/ (localhost) | https://api.domain.com/api/sync-dashboard/ (production)  
**Test Results**: All sync logic validated | Lisa Slayman skip working | Transaction safety confirmed

### 🔍 Product Search & Features  
- [Product Search Implementation](DOCS/Product_Search_Implementation.md) - Details on how the product search was implemented
- [Product Search Cache Table](DOCS/Product_Search_Cache_Table.md) - Comprehensive documentation for the cached_product_spec_view table system

### 🤖 AI Model Specifications
- [Environment Strategy Model Spec](DOCS/ai-specs/development/environment-strategy.md) - **NEW!** AI model spec for environment strategy
- [Legacy OPMS Database Compatibility](DOCS/ai-specs/database/legacy-opms-compatibility.md) - **NEW!** Critical legacy database integration requirements
- [Display Name Formatting Model Spec](DOCS/ai-specs/construction/ns-intgr/inv-item/model_spec_display-name-formatting.md) - Display name formatting logic spec

### 🗄️ Database Schema Documentation
- [OPMS Schema Analysis](DOCS/database/schema/opms-schema-analysis.md) - **NEW!** Complete legacy OPMS database schema analysis
- [T_* Tables Summary](DOCS/database/schema/t-tables-summary.md) - **NEW!** Summary of all 35 core OPMS tables
- [Full Schema Files](DOCS/database/schema/) - **NEW!** Extracted schema files from production dump

## Development

### 🚀 Quick Start

```bash
# Using Docker
docker-compose up

# Or locally
npm run dev
```

The API will be available at `http://localhost:3000`

### 🧪 Testing Strategy

This project uses a **three-tier testing strategy** for optimal development workflow:

#### Fast Unit Tests (Recommended for Daily Development)
```bash
npm run test:unit        # Unit tests (~1s) - Perfect for TDD
npm run test:watch       # Watch mode for continuous testing
npm run test:coverage    # Unit tests with coverage report
```

#### Integration Testing (Live NetSuite Validation)
```bash
npm run netsuite:live:config    # Test NetSuite configuration
npm run netsuite:live:auth      # Test authentication
npm run netsuite:live:create    # Test item creation
npm run netsuite:live           # Full integration test suite
```

#### Complete Test Suite
```bash
npm test                        # All tests (unit + integration)
npm run test:integration        # Live NetSuite integration tests
npm run test:integration:mock   # Mocked integration tests
```

**💡 Pro Tip**: Use `npm run test:unit` for daily development (1 second execution) and `npm run netsuite:live` for feature validation against real NetSuite Sandbox.

See [Environment Configuration Guide](DOCS/development/environment-configuration-guide.md) for complete testing documentation.

## 🔗 Legacy OPMS Reference

The `legacy_opms/` folder contains a **read-only** clone of the original OPMS codebase for reference during API development. This folder:

- **Contains legacy PHP/CodeIgniter OPMS code** for reference and understanding existing business logic
- **Is completely isolated** from this API project via `.gitignore`
- **Has push protection enabled** to prevent accidental modifications to the legacy repository
- **Should never be used for active development** - only for reference

For complete usage guidelines, see [`legacy_opms/LEGACY_OPMS_README.md`](legacy_opms/LEGACY_OPMS_README.md).

## API Endpoints

The API provides comprehensive endpoints for managing products, items, and colors. For a complete list of available endpoints and interactive documentation, please refer to:

- [API Documentation Guide](DOCS/API_Documentation_Guide.md) - Comprehensive documentation with usage examples
- Swagger UI: Available at `/api-docs` when the server is running
- Postman Collection: Import `opuzen-api.postman_collection.json` into Postman

### Key Endpoints

- `GET /api/products` - List all products with filtering options
- `POST /api/products/search` - Search products with advanced filtering (matches legacy PHP behavior)
- `GET /api/products/:id` - Get specific product details
- `GET /api/products/:id/items/:type` - Get items for a product (type: R or D)
- `GET /api/items/:id` - Get item details
- `GET /api/colors` - List all colors
- `GET /health` - Health check endpoint

## Docker Configuration

The application is configured to run in Docker with the following features:

- Hot reloading for development
- Connection to host machine's database using `host.docker.internal`
- Volume mounting for live code updates
- Environment variable support

## Database Connection

The API is configured to connect to a MySQL database. In development, it connects to the host machine's database using `host.docker.internal`. For production, update the database host in the environment variables.

## Security

- Helmet.js for security headers
- CORS enabled
- Environment variable configuration
- Error handling middleware

## Logging

The application uses Winston for logging. Logs are output to the console in JSON format with timestamps.

## Environment Configuration

### Development Environment (.env)
```env
# Node Environment
NODE_ENV=development
PORT=3000

# Database Configuration
DB_HOST=host.docker.internal
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=opuzen_db

# NetSuite Sandbox Configuration (for live testing)
NETSUITE_ACCOUNT_ID_SANDBOX=your_sandbox_account_id
NETSUITE_CONSUMER_KEY=your_sandbox_consumer_key
NETSUITE_CONSUMER_SECRET=your_sandbox_consumer_secret
NETSUITE_ACCESS_TOKEN=your_sandbox_access_token
NETSUITE_ACCESS_TOKEN_SECRET=your_sandbox_access_token_secret

# Testing Configuration
NETSUITE_LIVE_TEST=true              # Enable live NetSuite testing
ENABLE_INTEGRATION_TESTS=true       # Enable integration tests

# Security
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRATION=24h

# Logging
LOG_LEVEL=debug

# CORS
CORS_ORIGIN=http://localhost:3000
```

### Testing Environment
No environment variables needed for unit tests - everything is automatically mocked when `NODE_ENV=test`.

For complete environment configuration details, see [Environment Configuration Guide](DOCS/development/environment-configuration-guide.md).
