# NetSuite to OPMS Sync - Step-by-Step Implementation Guide

**Date:** January 19, 2025  
**Purpose:** Complete guide for implementing and testing NetSuite → OPMS pricing synchronization  
**Audience:** Developers, System Administrators, and Non-NetSuite Admins

---

## 📋 **Overview**

This guide walks you through implementing the NetSuite → OPMS pricing sync system, which automatically updates OPMS pricing when NetSuite inventory item prices change. The sync uses webhooks for real-time updates and includes the critical "Lisa Slayman skip logic" for business rule compliance.

### **What This Sync Does**
- ✅ **Monitors NetSuite** for inventory item pricing changes
- ✅ **Sends webhooks** to your API when prices change
- ✅ **Updates OPMS database** with new pricing data
- ✅ **Skips Lisa Slayman items** automatically (business rule)
- ✅ **Logs all activity** for monitoring and debugging

---

## 🚀 **Phase 1: Environment Setup**

### **Step 1.1: Configure Environment Variables**

Add these variables to your environment configuration (`.env` file or deployment environment):

```bash
# NS to OPMS Sync Configuration
NS_TO_OPMS_WEBHOOK_SECRET=your-secure-webhook-secret-here
NS_TO_OPMS_ENDPOINT_URL=https://your-api-domain.com/api/ns-to-opms/webhook
NS_TO_OPMS_MAX_RETRIES=3
NS_TO_OPMS_RETRY_DELAY_MS=5000
NS_TO_OPMS_BATCH_SIZE=50
NS_TO_OPMS_RATE_LIMIT_MS=1000

# Your existing NetSuite OAuth credentials (unchanged)
NETSUITE_ACCOUNT_ID=your_account_id
NETSUITE_CONSUMER_KEY=oauth_consumer_key
NETSUITE_CONSUMER_SECRET=oauth_consumer_secret
NETSUITE_TOKEN_ID=oauth_token_id
NETSUITE_TOKEN_SECRET=oauth_token_secret

# Your existing OPMS database credentials (unchanged)
OPMS_DB_HOST=localhost
OPMS_DB_USER=opms_user
OPMS_DB_PASSWORD=secure_password
OPMS_DB_NAME=opms_database
OPMS_DB_PORT=3306
```

> **💡 Explanation for Non-NetSuite Admins:**
> 
> **Environment Variables** are configuration settings that tell your application how to connect to different systems:
> - `NS_TO_OPMS_WEBHOOK_SECRET`: A password that NetSuite will send with each webhook to prove it's really NetSuite calling your API
> - `NS_TO_OPMS_ENDPOINT_URL`: The web address where NetSuite will send pricing updates
> - The retry/delay settings control how the system handles errors (how many times to retry, how long to wait, etc.)

### **Step 1.2: Generate Secure Webhook Secret**

Generate a secure webhook secret:

```bash
# Generate a 32-character random secret
openssl rand -hex 32
```

Use this generated value for `NS_TO_OPMS_WEBHOOK_SECRET`.

### **Step 1.3: Validate Environment Setup**

Create a validation script to check your configuration:

```bash
# Test environment variables
node -e "
const requiredVars = [
  'NS_TO_OPMS_WEBHOOK_SECRET',
  'OPMS_DB_HOST',
  'NETSUITE_ACCOUNT_ID'
];

const missing = requiredVars.filter(v => !process.env[v]);
if (missing.length) {
  console.error('❌ Missing variables:', missing.join(', '));
  process.exit(1);
}
console.log('✅ Environment variables validated');
"
```

---

## 🖥️ **Phase 2: API Service Deployment**

### **Step 2.1: Deploy Updated API Code**

Deploy your API with the new NS → OPMS sync functionality:

```bash
# If using PM2
pm2 restart your-api-app

# If using Docker
docker-compose up -d --build

# If running directly
npm start
```

### **Step 2.2: Verify API Health**

Test that the new endpoints are working:

```bash
# Test API health
curl http://localhost:3000/api/health

# Test NS → OPMS sync health
curl http://localhost:3000/api/ns-to-opms/health
```

**Expected Response:**
```json
{
  "status": "OK",
  "message": "NetSuite to OPMS sync service is running",
  "timestamp": "2024-01-15T10:30:00Z",
  "stats": {
    "received": 0,
    "processed": 0,
    "skipped": 0,
    "failed": 0
  }
}
```

### **Step 2.3: Check Swagger Documentation**

Verify the API documentation is updated:

```bash
# Open Swagger UI in browser
open http://localhost:3000/api-docs
```

Look for the **"NS to OPMS Sync"** section with the new endpoints.

---

## 🔧 **Phase 3: NetSuite Configuration**

> **💡 Explanation for Non-NetSuite Admins:**
> 
> **NetSuite** is your business management software. We need to install a small script inside NetSuite that will automatically notify your API whenever someone changes an item's price. This is called a "webhook" - think of it like NetSuite sending a text message to your API saying "Hey, the price of item ABC just changed to $25.99."

### **Step 3.1: Access NetSuite Customization**

1. **Log into NetSuite** as an Administrator
2. **Navigate to:** Customization → Scripting → Scripts
3. **Click:** "New"

> **💡 Explanation for Non-NetSuite Admins:**
> 
> **NetSuite Scripting** is where you can add custom automation to NetSuite. Think of it like adding a smart assistant that watches for specific events (like price changes) and takes action automatically.

### **Step 3.2: Upload the Webhook Script**

1. **Select Script Type:** "User Event Script"
2. **Upload Script File:** `netsuite-scripts/ItemPricingUpdateWebhook.js`
3. **Set Script Properties:**
   - **Name:** "Item Pricing Update Webhook"
   - **ID:** `customscript_item_pricing_webhook`
   - **Description:** "Sends webhook to OPMS API when item pricing changes"

> **💡 Explanation for Non-NetSuite Admins:**
> 
> **User Event Scripts** are programs that run automatically when someone does something in NetSuite (like saving a record). In our case, this script runs every time someone saves changes to an inventory item, and if the price changed, it sends a notification to your API.

### **Step 3.3: Configure Script Parameters**

Add these script parameters:

| Parameter ID | Type | Default Value |
|--------------|------|---------------|
| `custscript_webhook_url` | Free-Form Text | `https://your-api-domain.com/api/ns-to-opms/webhook` |
| `custscript_webhook_secret` | Password | `your-webhook-secret-here` |

> **💡 Explanation for Non-NetSuite Admins:**
> 
> **Script Parameters** are settings that tell the script where to send notifications and how to authenticate. Think of them like putting your API's phone number and password into NetSuite's contacts, so it knows how to reach your system securely.

### **Step 3.4: Deploy the Script**

1. **Click:** "Save & Deploy"
2. **Set Deployment Properties:**
   - **Title:** "Item Pricing Webhook Deployment"
   - **ID:** `customdeploy_item_pricing_webhook`
   - **Status:** "Released"
   - **Log Level:** "Debug" (for initial testing)

3. **Set Event Context:**
   - **Record Type:** "Inventory Item"
   - **Event Type:** "After Submit"
   - **Execution Context:** "User Interface"

> **💡 Explanation for Non-NetSuite Admins:**
> 
> **Deployment** is like turning on the script. The settings tell NetSuite:
> - **Record Type:** Only watch inventory items (not customers, vendors, etc.)
> - **Event Type:** "After Submit" means run the script after someone saves changes
> - **Execution Context:** Run when people use the regular NetSuite interface

### **Step 3.5: Test NetSuite Script Installation**

1. **Go to:** Lists → Accounting → Items
2. **Find any inventory item**
3. **Edit the item** and change a price field
4. **Save the item**
5. **Check:** Customization → Scripting → Script Deployments → View Logs

**Expected Log Entry:**
```
AUDIT | Sending Pricing Webhook | itemId: FAB-001-BLUE, lisaSlayman: false
AUDIT | Pricing Webhook Sent | responseCode: 200
```

---

## 🧪 **Phase 4: Testing & Validation**

### **Step 4.1: Test Lisa Slayman Skip Logic**

This is the most critical test - ensuring Lisa Slayman items are never synced.

**Test Setup:**
1. Find an inventory item in NetSuite
2. Check the "Lisa Slayman Item" checkbox (field: `custitemf3_lisa_item`)
3. Save the item
4. Change a price field
5. Save again

**Expected Behavior:**
```bash
# Check your API logs - should show:
curl http://localhost:3000/api/ns-to-opms/stats
```

**Expected Response:**
```json
{
  "syncStats": {
    "received": 1,
    "processed": 0,
    "skipped": 1,
    "failed": 0
  }
}
```

> **💡 Explanation for Non-NetSuite Admins:**
> 
> **Lisa Slayman Skip Logic** is a critical business rule. Some inventory items are marked with a special "Lisa Slayman" flag, and these items should NEVER have their pricing synchronized to OPMS. This is a safety feature to prevent certain items from being accidentally updated.

### **Step 4.2: Test Valid Pricing Sync**

**Test Setup:**
1. Find an inventory item WITHOUT the Lisa Slayman checkbox
2. Note the current price
3. Change the price to a different value
4. Save the item

**Verify in API:**
```bash
# Check webhook stats
curl http://localhost:3000/api/ns-to-opms/stats
```

**Expected Response:**
```json
{
  "syncStats": {
    "received": 2,
    "processed": 1,
    "skipped": 1,
    "failed": 0
  }
}
```

**Verify in OPMS Database:**
```sql
-- Check if pricing was updated in OPMS
-- Replace 'YOUR-ITEM-CODE' with the actual NetSuite item ID

-- Check customer pricing
SELECT 
    pp.product_id,
    pp.p_res_cut,
    pp.p_hosp_roll,
    pp.date,
    i.code as item_code
FROM T_PRODUCT_PRICE pp
JOIN T_ITEM i ON i.product_id = pp.product_id
WHERE i.code = 'YOUR-ITEM-CODE'
ORDER BY pp.date DESC
LIMIT 1;

-- Check vendor costs
SELECT 
    ppc.product_id,
    ppc.cost_cut,
    ppc.cost_roll,
    ppc.date,
    i.code as item_code
FROM T_PRODUCT_PRICE_COST ppc
JOIN T_ITEM i ON i.product_id = ppc.product_id
WHERE i.code = 'YOUR-ITEM-CODE'
ORDER BY ppc.date DESC
LIMIT 1;
```

### **Step 4.3: Test Error Handling**

**Test Invalid Item:**
```bash
# Manually send webhook for non-existent item
curl -X POST http://localhost:3000/api/ns-to-opms/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NS_TO_OPMS_WEBHOOK_SECRET" \
  -d '{
    "eventType": "item.pricing.updated",
    "itemData": {
      "itemid": "NONEXISTENT-ITEM-999",
      "internalid": "99999",
      "custitemf3_lisa_item": false,
      "price_1_": "25.99"
    },
    "timestamp": "2024-01-15T10:45:00Z",
    "source": "manual_test"
  }'
```

**Expected Response:** 500 error with "OPMS item not found" message

**Test Invalid Authentication:**
```bash
# Test with wrong webhook secret
curl -X POST http://localhost:3000/api/ns-to-opms/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wrong-secret" \
  -d '{}'
```

**Expected Response:** 401 Unauthorized

---

## 📊 **Phase 5: Monitoring & Maintenance**

### **Step 5.1: Set Up Monitoring**

**Daily Health Checks:**
```bash
# Add to your monitoring system
curl http://localhost:3000/api/ns-to-opms/health
```

**Weekly Statistics Review:**
```bash
# Check processing statistics
curl http://localhost:3000/api/ns-to-opms/stats
```

**Key Metrics to Monitor:**
- **Success Rate:** Should be >95%
- **Lisa Slayman Skip Rate:** Should match your business expectations
- **Processing Time:** Should be <5 seconds per webhook
- **Failed Items:** Investigate any consistent failures

### **Step 5.2: Log Monitoring**

**Important Log Patterns to Watch:**

✅ **Success Patterns:**
```
INFO: Received pricing webhook | itemId: FAB-001-BLUE
INFO: Webhook processed | result: success
```

⚠️ **Skip Patterns (Expected):**
```
INFO: Skipping pricing sync | reason: Lisa Slayman item - pricing sync disabled
```

❌ **Error Patterns (Investigate):**
```
ERROR: OPMS item not found for NetSuite item: ITEM-123
ERROR: Webhook processing error | error: Database connection failed
```

### **Step 5.3: Troubleshooting Common Issues**

**Issue: Webhooks Not Being Received**
1. Check NetSuite script deployment status
2. Verify webhook URL is accessible from internet
3. Check NetSuite script logs for errors
4. Verify script parameters are correct

**Issue: Authentication Failures**
1. Verify `NS_TO_OPMS_WEBHOOK_SECRET` matches NetSuite script parameter
2. Check webhook secret hasn't been accidentally changed
3. Verify Authorization header format: `Bearer your-secret`

**Issue: OPMS Items Not Found**
1. Verify NetSuite `itemid` matches OPMS `T_ITEM.code`
2. Check if OPMS item is archived
3. Verify database connectivity

**Issue: Database Update Failures**
1. Check OPMS database connectivity
2. Verify database user permissions
3. Check for database locks or conflicts

---

## 🎯 **Phase 6: Production Deployment**

### **Step 6.1: Pre-Production Checklist**

- ✅ All tests passing in development environment
- ✅ Lisa Slayman skip logic verified
- ✅ Database updates confirmed working
- ✅ Error handling tested
- ✅ Monitoring configured
- ✅ NetSuite script deployed and tested
- ✅ Environment variables configured
- ✅ Backup and rollback plan ready

### **Step 6.2: Production Deployment Steps**

1. **Deploy API Code:**
   ```bash
   # Deploy with zero downtime
   pm2 reload your-api-app
   ```

2. **Update Environment Variables:**
   ```bash
   # Production webhook URL
   NS_TO_OPMS_ENDPOINT_URL=https://api.opuzen.com/api/ns-to-opms/webhook
   ```

3. **Update NetSuite Script Parameters:**
   - Change webhook URL to production endpoint
   - Update webhook secret if different

4. **Verify Production Health:**
   ```bash
   curl https://api.opuzen.com/api/ns-to-opms/health
   ```

### **Step 6.3: Post-Deployment Monitoring**

**First 24 Hours:**
- Monitor webhook statistics every hour
- Check error logs for any issues
- Verify Lisa Slayman items are being skipped
- Confirm successful price updates in OPMS

**First Week:**
- Daily statistics review
- Weekly error pattern analysis
- Performance monitoring
- User feedback collection

---

## 🚨 **Emergency Procedures**

### **Disable Sync Immediately**

If you need to stop all sync activity immediately:

**Option 1: Disable NetSuite Script**
1. Go to NetSuite → Customization → Scripting → Script Deployments
2. Find "Item Pricing Webhook Deployment"
3. Change Status to "Not Scheduled"
4. Save

**Option 2: Block Webhooks at API Level**
```bash
# Temporarily change webhook secret to block all incoming webhooks
# Update environment variable to a different value
NS_TO_OPMS_WEBHOOK_SECRET=DISABLED-FOR-MAINTENANCE
```

### **Rollback Procedure**

If issues arise and rollback is needed:

1. **Disable NetSuite script** (see above)
2. **Revert API deployment** to previous version
3. **Restore previous environment variables**
4. **Verify old system is working**
5. **Investigate issues** before re-attempting

---

## 📋 **Success Criteria**

Your NS → OPMS sync is successfully implemented when:

- ✅ **Lisa Slayman items are consistently skipped** (100% skip rate)
- ✅ **Valid pricing updates sync successfully** (>95% success rate)
- ✅ **NetSuite price changes appear in OPMS** within 30 seconds
- ✅ **Error handling works gracefully** (no service crashes)
- ✅ **Monitoring shows healthy statistics**
- ✅ **All 4 pricing fields sync correctly:**
  - `price_1_` → `T_PRODUCT_PRICE.p_res_cut`
  - `price_2_` → `T_PRODUCT_PRICE.p_hosp_roll`
  - `cost` → `T_PRODUCT_PRICE_COST.cost_cut`
  - `custitem_f3_rollprice` → `T_PRODUCT_PRICE_COST.cost_roll`

---

## 🎉 **Congratulations!**

You have successfully implemented NetSuite → OPMS pricing synchronization! Your system now automatically keeps OPMS pricing in sync with NetSuite changes while respecting critical business rules like the Lisa Slayman skip logic.

**For ongoing support:**
- Monitor the health endpoint daily
- Review statistics weekly
- Keep this guide handy for troubleshooting
- Document any custom modifications for your team

---

## 📞 **Quick Reference Commands**

```bash
# Health check
curl http://localhost:3000/api/ns-to-opms/health

# Statistics
curl http://localhost:3000/api/ns-to-opms/stats

# Reset stats (testing only)
curl -X POST http://localhost:3000/api/ns-to-opms/reset-stats

# Test webhook (replace secret)
curl -X POST http://localhost:3000/api/ns-to-opms/webhook \
  -H "Authorization: Bearer $NS_TO_OPMS_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"item.pricing.updated","itemData":{"itemid":"TEST","internalid":"123","custitemf3_lisa_item":true},"timestamp":"2024-01-15T10:30:00Z","source":"test"}'
```
