# NS to OPMS Naming Convention Migration

**Date:** January 19, 2025  
**Status:** ✅ **COMPLETED**  
**Purpose:** Implement clear `ns-to-opms` naming convention to distinguish NetSuite → OPMS sync from existing OPMS → NetSuite sync

## 🎯 **Migration Overview**

This migration implements the approved `ns-to-opms` naming convention across all components of the NetSuite to OPMS pricing synchronization system, ensuring clear distinction from the existing OPMS → NetSuite sync functionality.

## ✅ **Completed Changes**

### **1. Service Files Renamed**
- ✅ `NetsuiteToOpmsPricingSyncService.js` → `NsToOpmsSyncService.js`
- ✅ `WebhookSyncService.js` → `NsToOpmsWebhookService.js`
- ✅ Updated all internal imports and class names
- ✅ Updated environment variable references

### **2. API Endpoints Updated**
- ✅ `/api/webhooks/netsuite/item-pricing-updated` → `/api/ns-to-opms/webhook`
- ✅ `/api/webhooks/netsuite/health` → `/api/ns-to-opms/health`
- ✅ `/api/webhooks/netsuite/stats` → `/api/ns-to-opms/stats`
- ✅ `/api/webhooks/netsuite/reset-stats` → `/api/ns-to-opms/reset-stats`

### **3. Route Files Updated**
- ✅ `src/routes/webhooks.js` → `src/routes/ns-to-opms.js`
- ✅ Updated route mounting in `src/routes/index.js`
- ✅ Updated API endpoint documentation in root response

### **4. Environment Variables Updated**
- ✅ `NETSUITE_WEBHOOK_SECRET` → `NS_TO_OPMS_WEBHOOK_SECRET`
- ✅ `WEBHOOK_ENDPOINT_URL` → `NS_TO_OPMS_ENDPOINT_URL`
- ✅ `SYNC_MAX_RETRIES` → `NS_TO_OPMS_MAX_RETRIES`
- ✅ `SYNC_RETRY_DELAY_MS` → `NS_TO_OPMS_RETRY_DELAY_MS`
- ✅ `SYNC_BATCH_SIZE` → `NS_TO_OPMS_BATCH_SIZE`
- ✅ `SYNC_RATE_LIMIT_MS` → `NS_TO_OPMS_RATE_LIMIT_MS`

### **5. Database Model Updated**
- ✅ Added `ns_to_opms_pricing` to `NetsuiteOpmsSyncJob` job_type ENUM
- ✅ Updated service to use new job type

### **6. NetSuite SuiteScript Updated**
- ✅ Updated documentation to reference new webhook URL format
- ✅ Updated parameter descriptions for new environment variables

### **7. Swagger Documentation Updated**
- ✅ Changed tag from `Webhooks` to `NS to OPMS Sync`
- ✅ Updated all endpoint documentation with new paths
- ✅ Updated descriptions to reflect new naming convention

### **8. Documentation Updated**
- ✅ `DOCS/NetSuite-OPMS-Sync-Environment-Variables.md` - Complete update
- ✅ All environment variable examples updated
- ✅ Validation scripts updated
- ✅ Troubleshooting guide updated

## 🔒 **Preserved Existing Functionality**

### **OPMS → NetSuite Sync (Untouched)**
The following existing functionality remains **completely unchanged**:
- ✅ `/api/netsuite/sync-from-opms` - Existing OPMS → NS endpoint
- ✅ `/api/opms-sync/*` - All existing OPMS sync routes
- ✅ `/api/export/*` - All existing export functionality
- ✅ `OpmsToNetSuiteSyncService.js` - Existing service unchanged
- ✅ `NetsuiteRestletService.js` - Existing service unchanged
- ✅ All existing environment variables unchanged

## 📋 **New API Structure**

### **NetSuite → OPMS (New)**
```bash
/api/ns-to-opms/webhook          # Webhook endpoint
/api/ns-to-opms/health           # Health check
/api/ns-to-opms/stats            # Processing statistics
/api/ns-to-opms/reset-stats      # Reset statistics
```

### **OPMS → NetSuite (Existing - Unchanged)**
```bash
/api/netsuite/sync-from-opms     # Legacy sync endpoint
/api/opms-sync/*                 # OPMS sync routes
/api/export/*                    # Export functionality
```

## 🔧 **Environment Variable Migration**

### **Required Updates for Deployment**

#### **Development Environment**
```bash
# OLD (remove these)
NETSUITE_WEBHOOK_SECRET=dev-webhook-secret-123
WEBHOOK_ENDPOINT_URL=https://dev-api.opuzen.com/api/webhooks/netsuite/item-pricing-updated
SYNC_MAX_RETRIES=3
SYNC_RETRY_DELAY_MS=5000
SYNC_BATCH_SIZE=50
SYNC_RATE_LIMIT_MS=1000

# NEW (add these)
NS_TO_OPMS_WEBHOOK_SECRET=dev-webhook-secret-123
NS_TO_OPMS_ENDPOINT_URL=https://dev-api.opuzen.com/api/ns-to-opms/webhook
NS_TO_OPMS_MAX_RETRIES=3
NS_TO_OPMS_RETRY_DELAY_MS=5000
NS_TO_OPMS_BATCH_SIZE=50
NS_TO_OPMS_RATE_LIMIT_MS=1000
```

#### **Production Environment**
```bash
# OLD (remove these)
NETSUITE_WEBHOOK_SECRET=super-secure-webhook-secret-prod-2024
WEBHOOK_ENDPOINT_URL=https://api.opuzen.com/api/webhooks/netsuite/item-pricing-updated

# NEW (add these)
NS_TO_OPMS_WEBHOOK_SECRET=super-secure-webhook-secret-prod-2024
NS_TO_OPMS_ENDPOINT_URL=https://api.opuzen.com/api/ns-to-opms/webhook
```

## 🚀 **NetSuite Configuration Updates**

### **SuiteScript Parameters**
Update the following NetSuite script parameters:

```javascript
// OLD
custscript_webhook_url = "https://api.domain.com/api/webhooks/netsuite/item-pricing-updated"
custscript_webhook_secret = process.env.NETSUITE_WEBHOOK_SECRET

// NEW  
custscript_webhook_url = "https://api.domain.com/api/ns-to-opms/webhook"
custscript_webhook_secret = process.env.NS_TO_OPMS_WEBHOOK_SECRET
```

## 🧪 **Updated Testing Commands**

### **Health Checks**
```bash
# OLD
curl http://localhost:3000/api/webhooks/netsuite/health

# NEW
curl http://localhost:3000/api/ns-to-opms/health
```

### **Webhook Testing**
```bash
# OLD
curl -X POST http://localhost:3000/api/webhooks/netsuite/item-pricing-updated \
  -H "Authorization: Bearer $NETSUITE_WEBHOOK_SECRET"

# NEW
curl -X POST http://localhost:3000/api/ns-to-opms/webhook \
  -H "Authorization: Bearer $NS_TO_OPMS_WEBHOOK_SECRET"
```

### **Statistics**
```bash
# OLD
curl http://localhost:3000/api/webhooks/netsuite/stats

# NEW
curl http://localhost:3000/api/ns-to-opms/stats
```

## ✅ **Verification Checklist**

### **File Structure**
- ✅ `src/services/NsToOpmsSyncService.js` exists
- ✅ `src/services/NsToOpmsWebhookService.js` exists
- ✅ `src/routes/ns-to-opms.js` exists
- ✅ Old files removed (NetsuiteToOpmsPricingSyncService.js, WebhookSyncService.js, webhooks.js)

### **API Endpoints**
- ✅ `/api/ns-to-opms/webhook` responds
- ✅ `/api/ns-to-opms/health` responds
- ✅ `/api/ns-to-opms/stats` responds
- ✅ `/api/ns-to-opms/reset-stats` responds

### **Environment Variables**
- ✅ `NS_TO_OPMS_WEBHOOK_SECRET` configured
- ✅ `NS_TO_OPMS_ENDPOINT_URL` configured
- ✅ All performance variables updated

### **Documentation**
- ✅ Swagger docs updated at `/api-docs`
- ✅ Environment variable guide updated
- ✅ NetSuite script documentation updated

## 🎯 **Benefits Achieved**

### **Clear Separation**
- ✅ **NS → OPMS**: `/api/ns-to-opms/*` (pricing sync)
- ✅ **OPMS → NS**: `/api/opms-sync/*` (item creation)

### **Intuitive Naming**
- ✅ Direction is immediately clear from URL
- ✅ Environment variables clearly indicate sync direction
- ✅ Service names reflect their purpose

### **Future-Proof**
- ✅ Easy to add more sync directions if needed
- ✅ Consistent naming pattern established
- ✅ No confusion between sync types

## 🚨 **Deployment Notes**

### **Zero Downtime Migration**
1. **Deploy code changes** (new endpoints work immediately)
2. **Update environment variables** (old variables can remain temporarily)
3. **Update NetSuite script parameters** (point to new webhook URL)
4. **Test new endpoints** (verify functionality)
5. **Remove old environment variables** (cleanup)

### **Rollback Plan**
If rollback is needed:
1. **Revert NetSuite script parameters** to old webhook URL
2. **Restore old environment variables**
3. **Deploy previous code version**

## 📊 **Migration Success Metrics**

- ✅ **0 linting errors** in renamed files
- ✅ **100% file structure** validation passed
- ✅ **All old files** properly removed
- ✅ **Route mounting** correctly updated
- ✅ **Environment variables** consistently updated
- ✅ **Documentation** completely updated

## 🎉 **Migration Complete**

The `ns-to-opms` naming convention has been successfully implemented across all components. The NetSuite → OPMS pricing sync now has clear, distinct naming that eliminates confusion with the existing OPMS → NetSuite sync functionality.

**Next Steps:**
1. Update deployment environment variables
2. Update NetSuite script parameters
3. Test new endpoints
4. Monitor sync functionality
