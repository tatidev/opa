# 🚀 Sync Dashboard & Live NetSuite Testing Guide

## ✅ **What We've Built**

### **1. Professional Live Sync Monitoring Dashboard**

**Access URL**: `http://localhost:3000/api/sync-dashboard/`

**Features**:
- ✨ **Real-time Metrics**: Success rates, job counts, processing times
- 📊 **Recent Activity Feed**: Latest pricing updates with before/after values
- 🎯 **Auto-refresh**: Live updates every 10 seconds
- 📱 **Responsive Design**: Works on desktop, tablet, mobile
- 🎨 **Modern UI**: Beautiful gradient design, smooth animations
- 📈 **Performance Stats**: Average duration, hourly activity charts

**API Endpoints Created**:
- `GET /api/sync-dashboard/` - Dashboard HTML page
- `GET /api/sync-dashboard/metrics` - Real-time sync metrics
- `GET /api/sync-dashboard/recent-jobs` - Recent sync job details
- `GET /api/sync-dashboard/live-stats` - Live webhook statistics

---

### **2. Complete Test Suite Results**

**Test Results**: ✅ **4/4 Tests PASSED (100%)**

| Test Case | Status | Result |
|-----------|--------|--------|
| Normal Pricing Sync | ✅ PASSED | All 4 fields synced correctly |
| Lisa Slayman Skip Logic | ✅ PASSED | Items properly skipped |
| Invalid Data Handling | ✅ PASSED | Bad data rejected, DB protected |
| Missing Item Handling | ✅ PASSED | Errors handled gracefully |

**Database Impact**:
- Test Product ID: 7756
- Test Item ID: 43992  
- Test Item Code: `opmsAPI01`
- Pricing successfully synced: $100/$150/$40/$50

---

## 🔴 **PHASE 2: Live NetSuite Testing**

Now we'll test the **real end-to-end integration** with actual NetSuite webhooks.

### **Prerequisites Checklist**

Before proceeding, verify:
- ✅ API server running (port 3000)
- ✅ Dashboard accessible at http://localhost:3000/api/sync-dashboard/
- ✅ NetSuite Administrator access
- ✅ NetSuite Sandbox or Production account ready
- ✅ Webhook secret configured: `NS_TO_OPMS_WEBHOOK_SECRET=your-webhook-secret`

---

## 📋 **Live NetSuite Testing Steps**

### **Step 1: Deploy NetSuite SuiteScript**

**File to Deploy**: `netsuite-scripts/ItemPricingUpdateWebhook.js`

**NetSuite Deployment Steps**:
1. Navigate to: **Customization → Scripting → Scripts → New**
2. Upload file: `ItemPricingUpdateWebhook.js`
3. Set Script Type: **User Event Script**
4. Configure Script Parameters:
   - `custscript_webhook_url` = `https://your-api-domain.com/api/ns-to-opms/webhook`
     (or `http://localhost:3000/api/ns-to-opms/webhook` for local testing)
   - `custscript_webhook_secret` = `your-webhook-secret`
5. Deploy Script:
   - Record Type: **Inventory Item**
   - Event Types: **After Submit**
   - Status: **Testing** (for initial deployment)

**⚠️ Important**: For localhost testing, NetSuite cannot reach your local machine. You'll need either:
- **Option A**: Deploy API to public server (AWS, Heroku, etc.)
- **Option B**: Use ngrok/localtunnel to expose localhost
- **Option C**: Test via Postman/manual webhook simulation (what we did)

---

### **Step 2: Create NetSuite Test Item**

**In NetSuite**:
1. Go to: **Lists → Accounting → Items → New → Inventory Item**
2. Set **Item Name/Number**: `opmsAPI01`
3. Enable **Lot Numbered Item**
4. Set **Lisa Slayman Item**: ☐ UNCHECKED (FALSE)
5. Set Initial Pricing:
   - Base Price Line 1: `$10.00`
   - Base Price Line 2: `$20.00`
   - Cost: `$5.00`
   - Roll Price (custitem_f3_rollprice): `$8.00`
6. Set Custom Fields:
   - OPMS Item ID: `43992`
   - OPMS Product ID: `7756`
7. **Save** the item

---

### **Step 3: Trigger Live Webhook**

**In NetSuite**:
1. Open the item: `opmsAPI01`
2. **Update pricing**:
   - Base Price Line 1: `$10.00` → `$125.00`
   - Base Price Line 2: `$20.00` → `$175.00`
   - Cost: `$5.00` → `$45.00`
   - Roll Price: `$8.00` → `$55.00`
3. **Save** the item

**What Should Happen**:
1. NetSuite SuiteScript `afterSubmit` trigger fires
2. Webhook sent to your API: `/api/ns-to-opms/webhook`
3. API processes pricing update
4. OPMS database updated with new prices
5. Dashboard shows the update in real-time

---

### **Step 4: Verify Sync Success**

**Check Dashboard**:
- Open: `http://localhost:3000/api/sync-dashboard/`
- Look for recent update showing the pricing change
- Verify success rate is 100%

**Check OPMS Database**:
```sql
SELECT 
    p_res_cut as 'Cut (Should be 125.00)',
    p_hosp_roll as 'Roll (Should be 175.00)'
FROM T_PRODUCT_PRICE
WHERE product_id = 7756;

SELECT 
    cost_cut as 'Cut (Should be 45.00)',
    cost_roll as 'Roll (Should be 55.00)'
FROM T_PRODUCT_PRICE_COST
WHERE product_id = 7756;
```

---

### **Step 5: Test Lisa Slayman Skip Logic**

**In NetSuite**:
1. Open item: `opmsAPI01`
2. **Check** the "Lisa Slayman Item" checkbox
3. **Update pricing** again (change any value)
4. **Save** the item

**Expected Result**:
- ✅ Webhook received
- ✅ Sync **SKIPPED** (not processed)
- ✅ OPMS pricing **UNCHANGED**
- ✅ Dashboard shows "skipped" status
- ✅ Reason: "Lisa Slayman item - pricing sync disabled"

---

## 🔍 **Monitoring & Verification**

### **Real-Time Dashboard Monitoring**

**URL**: `http://localhost:3000/api/sync-dashboard/`

**What to Watch**:
- **Success Rate**: Should stay at 100% for successful syncs
- **Recent Updates**: Shows each pricing change as it happens
- **Processing Time**: Should be < 500ms per update
- **Activity Summary**: Completed/Failed/Running counts

### **API Endpoints for Testing**

```bash
# Get sync metrics
curl http://localhost:3000/api/sync-dashboard/metrics

# Get recent sync jobs
curl http://localhost:3000/api/sync-dashboard/recent-jobs

# Get live webhook stats  
curl http://localhost:3000/api/sync-dashboard/live-stats

# Health check
curl http://localhost:3000/api/ns-to-opms/health
```

---

## 🐛 **Troubleshooting Live Testing**

### **Issue: Webhook Not Received**

**Symptoms**: NetSuite item updated but no sync occurs

**Solutions**:
1. Check SuiteScript is deployed and enabled
2. Verify webhook URL in script parameters
3. Check webhook secret matches `.env` file
4. Review NetSuite Execution Log for script errors
5. Ensure API is publicly accessible (not localhost)

### **Issue: Sync Skipped Unexpectedly**

**Symptoms**: Item shows "skipped" when it should sync

**Solutions**:
1. Check Lisa Slayman checkbox in NetSuite (must be unchecked)
2. Verify pricing fields actually changed (no change = no webhook)
3. Review dashboard for skip reason

### **Issue: Database Not Updating**

**Symptoms**: Webhook received but OPMS unchanged

**Solutions**:
1. Check API server logs for errors
2. Verify database connection (health endpoint)
3. Run validation SQL queries
4. Check transaction rollback logs

---

## 📊 **Success Criteria for Live Testing**

### **Minimum Requirements**:
- ✅ NetSuite item created with ID: `opmsAPI01`
- ✅ SuiteScript deployed and active
- ✅ Webhook successfully sends to API
- ✅ API processes webhook (200 OK response)
- ✅ OPMS database updates with new pricing
- ✅ Dashboard shows the update in real-time

### **Gold Standard**:
- ✅ Multiple pricing updates sync successfully
- ✅ Lisa Slayman skip logic verified in production
- ✅ Dashboard auto-refresh working smoothly
- ✅ Zero errors in NetSuite execution log
- ✅ Sub-second processing times
- ✅ Complete audit trail in sync tables

---

## 🎉 **What's Next**

After successful live testing:

1. **Production Deployment**:
   - Deploy SuiteScript to Production NetSuite
   - Update webhook URL to production API
   - Monitor first few syncs closely

2. **Documentation**:
   - Document SuiteScript deployment process
   - Create runbook for monitoring
   - Train team on dashboard usage

3. **Monitoring Setup**:
   - Set up alerts for sync failures
   - Configure log rotation
   - Establish performance baselines

4. **Cleanup**:
   - Remove test data from OPMS
   - Delete test item from NetSuite
   - Archive test results

---

## 📞 **Support & Resources**

**Dashboard**: http://localhost:3000/api/sync-dashboard/  
**API Docs**: http://localhost:3000/api-docs  
**Health Check**: http://localhost:3000/api/health  
**Webhook Stats**: http://localhost:3000/api/ns-to-opms/health  

**Files Created**:
- `src/routes/sync-dashboard.js` - Dashboard API routes
- `src/public/sync-dashboard.html` - Dashboard UI
- `src/index.js` - Updated to serve static files
- `src/routes/index.js` - Mounted dashboard routes

---

**Status**: ✅ **Ready for Live NetSuite Testing!**

The dashboard is live and monitoring is active. You can now proceed with NetSuite SuiteScript deployment and real webhook testing.




