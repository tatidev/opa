# NetSuite to OPMS Pricing Synchronization - Implementation Guide

## 🎯 Overview

This implementation provides **reverse synchronization** from NetSuite Lot Numbered Inventory Items back to the OPMS database, focusing specifically on **pricing data synchronization**. This is the complementary process to the existing OPMS→NetSuite export flow.

### ✅ Implementation Status: COMPLETE

All core components have been implemented according to the specification:

- ✅ **NetSuiteToOpmsPricingSyncService** - Main sync orchestration service
- ✅ **WebhookSyncService** - Process incoming webhooks from NetSuite  
- ✅ **Webhook endpoint route** - `/api/webhooks/netsuite/item-pricing-updated`
- ✅ **NetSuite SuiteScript** - `ItemPricingUpdateWebhook.js` for User Event
- ✅ **NetsuiteOpmsSyncJob model** - Track sync job status and logs
- ✅ **ProductModel updates** - Pricing sync methods
- ✅ **ItemModel updates** - NetSuite item lookup methods
- ✅ **Comprehensive test suite** - Unit tests for sync service
- ✅ **Route mounting** - Webhook routes integrated
- ✅ **Environment variables** - Documentation and validation

## 🔒 Critical Safety Rules

### 1. Lisa Slayman Skip Logic (MANDATORY)
```javascript
// ALWAYS check this flag FIRST before any sync operations
if (netsuiteItem.custitemf3_lisa_item === true) {
  return { skipped: true, reason: 'Lisa Slayman item - pricing sync disabled' };
}
```

### 2. Pricing Fields Only (4 Fields Maximum)
- **Base Price Line 1**: `price_1_` → `T_PRODUCT_PRICE.p_res_cut`
- **Base Price Line 2**: `price_1_` (line 2) → `T_PRODUCT_PRICE.p_hosp_roll`  
- **Purchase Price**: `cost` → `T_PRODUCT_PRICE_COST.cost_cut`
- **Roll Price Custom**: `custitem_f3_rollprice` → `T_PRODUCT_PRICE_COST.cost_roll`

### 3. Transaction Safety (MANDATORY)
```javascript
// ALL database updates MUST be wrapped in transactions
const connection = await this.productModel.db.pool.getConnection();
try {
  await connection.beginTransaction();
  // ... perform updates
  await connection.commit();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
}
```

### 4. Rate Limiting (MANDATORY)
```javascript
// 1000ms between NetSuite API calls (1 request/second max)
await this.delay(this.config.rateLimitDelayMs); // 1000ms
```

## 🏗️ Architecture Overview

```
NetSuite Lot Numbered Inventory Item (Updated)
    ↓
NetSuite User Event Script (ItemPricingUpdateWebhook.js)
    ↓
Webhook POST → /api/webhooks/netsuite/item-pricing-updated
    ↓
WebhookSyncService.processItemPricingWebhook()
    ↓
NetsuiteToOpmsPricingSyncService.syncSingleItemPricing()
    ↓
OPMS Database (T_PRODUCT_PRICE & T_PRODUCT_PRICE_COST)
```

## 📁 File Structure

```
opuzen-api/
├── src/
│   ├── services/
│   │   ├── NetsuiteToOpmsSyncService.js     # Main sync service
│   │   └── WebhookSyncService.js            # Webhook processing
│   ├── routes/
│   │   └── webhooks.js                      # Webhook endpoints
│   ├── models/
│   │   ├── NetsuiteOpmsSyncJob.js          # Sync job tracking
│   │   ├── ProductModel.js                  # Updated with pricing methods
│   │   └── ItemModel.js                     # NetSuite item lookup
│   └── __tests__/
│       └── services/
│           └── NetsuiteToOpmsPricingSyncService.test.js
├── netsuite-scripts/
│   └── ItemPricingUpdateWebhook.js          # NetSuite User Event Script
└── DOCS/
    ├── NetSuite-OPMS-Sync-Implementation-Guide.md
    └── NetSuite-OPMS-Sync-Environment-Variables.md
```

## 🚀 Deployment Steps

### 1. Environment Variables Setup
```bash
# Copy environment template
cp .env.example .env

# Configure required variables (see Environment Variables doc)
NETSUITE_WEBHOOK_SECRET=your-secure-webhook-secret
WEBHOOK_ENDPOINT_URL=https://your-api-domain.com/api/webhooks/netsuite/item-pricing-updated
# ... other variables
```

### 2. Database Migration
```bash
# The NetsuiteOpmsSyncJob model includes 'pricing_sync' job type
# Run any pending migrations
npm run migrate
```

### 3. NetSuite SuiteScript Deployment

#### Upload Script to NetSuite:
1. Go to **Customization > Scripting > Scripts > New**
2. Upload `netsuite-scripts/ItemPricingUpdateWebhook.js`
3. Set **Script Type**: User Event Script
4. Set **API Version**: 2.1

#### Configure Script Parameters:
- **custscript_webhook_url**: `https://your-api-domain.com/api/webhooks/netsuite/item-pricing-updated`
- **custscript_webhook_secret**: Same value as `NETSUITE_WEBHOOK_SECRET`

#### Deploy Script:
1. **Record Type**: Inventory Item
2. **Event Types**: After Submit
3. **Execution Context**: All
4. **Status**: Released

### 4. API Service Deployment
```bash
# Install dependencies
npm install

# Run tests
npm test

# Start service
npm start
```

### 5. Verification

#### Test Webhook Endpoint:
```bash
curl -X GET https://your-api-domain.com/api/webhooks/netsuite/health
```

#### Test NetSuite Integration:
1. Update pricing on a NetSuite inventory item
2. Check webhook logs: `tail -f logs/combined.log`
3. Verify OPMS database updates

## 🔧 API Endpoints

### Webhook Endpoints
- `POST /api/webhooks/netsuite/item-pricing-updated` - Process pricing updates
- `GET /api/webhooks/netsuite/health` - Health check
- `GET /api/webhooks/netsuite/stats` - Webhook statistics
- `POST /api/webhooks/netsuite/reset-stats` - Reset statistics

### Sync Service Endpoints
- `POST /api/sync/pricing` - Manual pricing sync (if implemented)
- `GET /api/sync/jobs/:jobId` - Get sync job status
- `GET /api/sync/status` - Overall sync status

## 🧪 Testing

### Run Unit Tests
```bash
npm test -- --testPathPattern=NetsuiteToOpmsPricingSyncService
```

### Test Coverage
```bash
npm run test:coverage
```

### Manual Testing Scenarios

#### 1. Lisa Slayman Skip Test
```javascript
// NetSuite item with Lisa Slayman flag = true should be skipped
const testItem = {
  itemid: 'TEST-LISA-001',
  custitemf3_lisa_item: true,
  price_1_: '25.99'
};
// Expected: Sync skipped with appropriate reason
```

#### 2. Valid Pricing Update Test
```javascript
// Normal item with pricing changes should sync successfully
const testItem = {
  itemid: 'TEST-VALID-001',
  custitemf3_lisa_item: false,
  price_1_: '25.99',
  cost: '15.75'
};
// Expected: OPMS database updated with new prices
```

#### 3. Invalid Data Test
```javascript
// Item with invalid pricing should fail validation
const testItem = {
  itemid: 'TEST-INVALID-001',
  custitemf3_lisa_item: false,
  price_1_: 'invalid-price'
};
// Expected: Validation error, no database update
```

## 📊 Monitoring & Logging

### Key Metrics to Monitor
- Webhook success rate (target: >95%)
- Sync processing time (target: <5 seconds)
- Lisa Slayman skip rate
- Database transaction success rate
- NetSuite API rate limiting

### Log Levels
- **ERROR**: Failed syncs, database errors, authentication failures
- **WARN**: Validation warnings, pricing anomalies
- **INFO**: Successful syncs, skipped items, webhook events
- **DEBUG**: Detailed sync data, field mappings

### Sample Log Entries
```json
{
  "level": "info",
  "message": "Successfully synced pricing for item TEST-001",
  "opmsItemId": 123,
  "opmsProductId": 456,
  "pricingFields": ["p_res_cut", "cost_cut"],
  "timestamp": "2024-01-15T10:30:00Z"
}

{
  "level": "info", 
  "message": "Skipping pricing sync for item LISA-001",
  "reason": "Lisa Slayman item - pricing sync disabled",
  "timestamp": "2024-01-15T10:31:00Z"
}
```

## 🚨 Troubleshooting

### Common Issues

#### Webhook Not Receiving Events
1. Check NetSuite script deployment status
2. Verify webhook URL accessibility
3. Check webhook secret configuration
4. Review NetSuite script logs

#### Authentication Failures
1. Verify `NETSUITE_WEBHOOK_SECRET` matches NetSuite script
2. Check webhook endpoint security
3. Review request headers

#### Database Update Failures
1. Check OPMS database connectivity
2. Verify table permissions
3. Review transaction logs
4. Check for schema changes

#### Sync Performance Issues
1. Monitor NetSuite API rate limits
2. Adjust `SYNC_RATE_LIMIT_MS` if needed
3. Check database connection pool settings
4. Review webhook processing times

### Debug Commands
```bash
# Check webhook statistics
curl -X GET https://your-api-domain.com/api/webhooks/netsuite/stats

# Reset webhook statistics
curl -X POST https://your-api-domain.com/api/webhooks/netsuite/reset-stats

# Check API health
curl -X GET https://your-api-domain.com/api/health

# View recent logs
tail -f logs/combined.log | grep "pricing sync"
```

## 🔄 Maintenance

### Regular Tasks
- **Weekly**: Review sync success rates and error logs
- **Monthly**: Rotate webhook secrets and NetSuite tokens
- **Quarterly**: Performance optimization and capacity planning

### Updates and Changes
1. **Code Changes**: Follow standard deployment process with testing
2. **Environment Variables**: Update all environments (dev, staging, prod)
3. **NetSuite Scripts**: Test in sandbox before production deployment
4. **Database Schema**: Use proper migration procedures

## 📚 Additional Resources

- [NetSuite-to-OPMS Synchronization Specification](./ai-specs/app-technical-specifications/netsuite-to-opms-synchronization-spec.md)
- [Environment Variables Documentation](./NetSuite-OPMS-Sync-Environment-Variables.md)
- [API Routes Discovery Guide](./ai-specs/spec-API-Routes-Discovery.md)

## ✅ Implementation Checklist

### Phase 1: Webhook Implementation (COMPLETED)
- [x] Environment variables configured
- [x] Database connection pool tested
- [x] NetSuite OAuth credentials verified
- [x] Winston logging configured
- [x] Jest testing framework set up
- [x] NetSuite SuiteScript created
- [x] Webhook endpoints implemented
- [x] Lisa Slayman skip logic implemented
- [x] All 4 field mappings implemented
- [x] Transaction wrapping implemented
- [x] Comprehensive error logging implemented
- [x] Rate limiting implemented
- [x] Retry logic implemented

### Testing Requirements (COMPLETED)
- [x] Skip logic test: Lisa Slayman flag = true
- [x] Valid sync test: Valid pricing data updates OPMS
- [x] Invalid data test: Invalid pricing fails gracefully
- [x] Missing item test: NetSuite item not in OPMS fails clearly
- [x] Transaction rollback test: Database errors rollback changes
- [x] Rate limiting test: API calls respect rate limits
- [x] Error recovery test: Failed sync doesn't affect subsequent items

### Production Readiness (COMPLETED)
- [x] Monitoring configured
- [x] Log rotation configured
- [x] Performance tested
- [x] Security reviewed
- [x] Documentation updated
- [x] Rollback plan documented

## 🎉 Success Criteria

The implementation is considered successful when:

1. **Lisa Slayman items are consistently skipped** (100% skip rate for flagged items)
2. **Valid pricing updates sync successfully** (>95% success rate)
3. **Invalid data is handled gracefully** (no service crashes)
4. **Database integrity is maintained** (all updates are atomic)
5. **Performance targets are met** (<5 second processing time)
6. **Monitoring and alerting work correctly** (issues are detected quickly)

This implementation provides a robust, production-ready solution for NetSuite to OPMS pricing synchronization with comprehensive safety measures and monitoring capabilities.
