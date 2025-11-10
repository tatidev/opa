# 🔴 LIVE NetSuite Testing - Step-by-Step Checklist

## 📊 **Keep Dashboard Open**
**URL**: http://localhost:3000/api/sync-dashboard/
*(Auto-refreshes every 10 seconds - keep this window visible)*

---

## ✅ **STEP 1: Verify/Deploy NetSuite Webhook**

### **Check if Webhook Script Exists**

**In NetSuite**:
1. Go to: **Customization → Scripting → Scripts**
2. Search for: "Item Pricing" or "Webhook"
3. Look for script ID: `customscript_item_pricing_webhook`

**If Script EXISTS** ✅:
- Click to open it
- Verify it's **Deployed**
- Check **Deployments** tab
- Note the deployment status

**If Script DOES NOT EXIST** ❌:
- Proceed to deployment below

---

### **Deploy ItemPricingUpdateWebhook.js** (If needed)

**File Location**: `netsuite-scripts/ItemPricingUpdateWebhook.js`

**Deployment Steps**:

1. **Upload Script**:
   - Navigate: **Customization → Scripting → Scripts → New**
   - Click **+** or **SuiteScript** button
   - Upload: `ItemPricingUpdateWebhook.js`

2. **Configure Script**:
   - **Name**: Item Pricing Update Webhook
   - **ID**: `customscript_item_pricing_webhook` (or auto-generated)
   - **Description**: Sends webhook when inventory item pricing changes

3. **Set Script Parameters**:
   
   | Parameter | Script ID | Value | Notes |
   |-----------|-----------|-------|-------|
   | **Webhook URL** | `custscript_webhook_url` | Your API URL + `/api/ns-to-opms/webhook` | See URL options below |
   | **Webhook Secret** | `custscript_webhook_secret` | `your-webhook-secret` | Must match .env file |

   **Webhook URL Options**:
   - **Production**: `https://your-production-api.com/api/ns-to-opms/webhook`
   - **Staging**: `https://your-staging-api.com/api/ns-to-opms/webhook`
   - **Local (requires ngrok)**: `https://your-ngrok-url.ngrok.io/api/ns-to-opms/webhook`

4. **Deploy Script**:
   - Click **Deployments** tab → **New Deployment**
   - **Applied To**: Inventory Item
   - **Status**: Testing (initially) → Released (after verification)
   - **Event Type**: After Submit
   - **Execute As**: Administrator
   - **Audience**: All Roles
   - **Save**

5. **Verify Deployment**:
   ```
   ✅ Script Status: Testing or Released
   ✅ Deployed: Yes
   ✅ Record Type: Inventory Item
   ✅ Event: After Submit
   ✅ Parameters configured
   ```

**⚠️ IMPORTANT**: If using localhost, you need **ngrok** or similar:
```bash
# Install ngrok if needed
brew install ngrok

# Expose localhost:3000
ngrok http 3000

# Use the ngrok HTTPS URL in NetSuite script parameters
```

---

## ✅ **STEP 2: Create NetSuite Test Item**

### **Item Configuration**

**Navigation**: **Lists → Accounting → Items → New → Inventory Item**

**Required Fields**:

| Field | Value | Critical? |
|-------|-------|-----------|
| **Item Name/Number** | `opmsAPI-LIVE-TEST` | ✅ YES - Must start with opmsAPI- |
| **Display Name** | `Live Sync Test Item` | Optional |
| **Subsidiary** | *(Your subsidiary)* | Required |
| **Asset Account** | *(Your inventory GL)* | Required |
| **Income Account** | *(Your sales GL)* | Required |
| **COGS Account** | *(Your COGS GL)* | Required |
| **Tax Schedule** | *(Your tax schedule)* | Required |

**Inventory Settings**:
- ✅ **Lot Numbered Item**: **CHECKED** *(this is what we're testing!)*
- ✅ **Track Lot Numbers**: Yes
- ✅ **Inactive**: **UNCHECKED** (item must be active)

**Custom Fields - OPMS Integration**:

| Field | Internal ID | Value | Purpose |
|-------|-------------|-------|---------|
| **OPMS Item ID** | `custitem_opms_item_id` | `43992` | Links to OPMS test item |
| **OPMS Product ID** | `custitem_opms_prod_id` | `7756` | Links to OPMS test product |
| **Lisa Slayman Item** | `custitemf3_lisa_item` | ☐ **UNCHECKED** | Must be FALSE for sync to work |

**Initial Pricing** (for later updates):

| Field | Value | Syncs To |
|-------|-------|----------|
| **Base Price (Price 1)** | `$10.00` | OPMS: p_res_cut |
| **Price Level 2** | `$20.00` | OPMS: p_hosp_roll |
| **Purchase Price (Cost)** | `$5.00` | OPMS: cost_cut |
| **Roll Price** (custitem_f3_rollprice) | `$8.00` | OPMS: cost_roll |

**Save the Item** → Note the **Internal ID** from the URL

---

## ✅ **STEP 3: Trigger Live Sync**

### **Dashboard Preparation**:
1. **Open Dashboard**: http://localhost:3000/api/sync-dashboard/
2. **Position Windows**: Dashboard on one side, NetSuite on other
3. **Watch for**: Auto-refresh indicator, recent updates section

### **Trigger Sync in NetSuite**:

1. **Open the item**: `opmsAPI-LIVE-TEST`

2. **Update Pricing**:
   - Base Price (Price 1): `$10.00` → `$125.00`
   - Price Level 2: `$20.00` → `$175.00`
   - Cost: `$5.00` → `$45.00`
   - Roll Price: `$8.00` → `$55.00`

3. **Save** the item

4. **Watch What Happens**:
   - ⏱️ NetSuite saves (1-2 seconds)
   - 🔔 `afterSubmit` trigger fires
   - 📡 Webhook sent to API (should be instant)
   - 💾 OPMS database updated
   - 📊 Dashboard shows update (within 10 seconds)

---

## ✅ **STEP 4: Verify Sync Success**

### **Check Dashboard** (Primary Verification):

**Look for**:
- ✅ **Success Rate**: Should increase to 100%
- ✅ **Total Syncs**: Should increment by 1
- ✅ **Recent Updates**: New entry showing `opmsAPI-LIVE-TEST`
- ✅ **Pricing Values**: Should match what you entered in NetSuite

**If Successful**:
```
Recent Pricing Updates
━━━━━━━━━━━━━━━━━━━━━━━━━
opmsAPI-LIVE-TEST         Just now
Live Sync Test Item

Customer Cut:  $125.00
Customer Roll: $175.00
Vendor Cut:    $45.00
Vendor Roll:   $55.00
```

### **Check OPMS Database** (Secondary Verification):

Run this SQL in your database tool:
```sql
SELECT 
    'Sync Verification' as Check,
    i.code as ItemCode,
    p.name as ProductName,
    CONCAT('$', pp.p_res_cut) as CustomerCut,
    CONCAT('$', pp.p_hosp_roll) as CustomerRoll,
    CONCAT('$', ppc.cost_cut) as VendorCut,
    CONCAT('$', ppc.cost_roll) as VendorRoll,
    pp.date as UpdatedAt,
    pp.user_id as UpdatedBy
FROM T_ITEM i
JOIN T_PRODUCT p ON i.product_id = p.id
LEFT JOIN T_PRODUCT_PRICE pp ON pp.product_id = p.id
LEFT JOIN T_PRODUCT_PRICE_COST ppc ON ppc.product_id = p.id
WHERE i.code = 'opmsAPI-LIVE-TEST'
  OR i.code = 'opmsAPI01';
```

**Expected Results**:
- ✅ ItemCode: `opmsAPI-LIVE-TEST`
- ✅ CustomerCut: `$125.00`
- ✅ CustomerRoll: `$175.00`
- ✅ VendorCut: `$45.00`
- ✅ VendorRoll: `$55.00`
- ✅ UpdatedBy: `1` (Sync Service)

### **Check NetSuite Execution Log** (If Issues):

**In NetSuite**:
1. Go to: **Customization → Scripting → Script Execution Log**
2. Filter by: Script = Item Pricing Update Webhook
3. Look for:
   - ✅ "Pricing Webhook Sent" (AUDIT level)
   - ✅ Response Code: 200
   - ❌ Any ERROR messages

---

## 🧪 **STEP 5: Test Lisa Slayman Skip Logic** (Live)

Now verify the skip logic works in production:

1. **In NetSuite**, open item: `opmsAPI-LIVE-TEST`

2. **Check the checkbox**: ✅ **Lisa Slayman Item**

3. **Change pricing** again:
   - Base Price: `$125.00` → `$200.00`

4. **Save** the item

5. **Expected Behavior**:
   - ✅ Webhook sent by NetSuite
   - ✅ API receives webhook
   - ✅ **Sync SKIPPED** (not processed)
   - ✅ **OPMS unchanged** (still $125)
   - ✅ Dashboard shows "Skipped" status
   - ✅ Reason: "Lisa Slayman item - pricing sync disabled"

6. **Verify in OPMS**:
   ```sql
   -- Should still show $125, NOT $200
   SELECT p_res_cut FROM T_PRODUCT_PRICE WHERE product_id = 7756;
   ```

---

## 🎯 **Success Criteria**

### **Minimum Success**:
- ✅ Webhook triggers when pricing changes in NetSuite
- ✅ API receives webhook (200 OK response)
- ✅ OPMS database updates with new pricing
- ✅ Dashboard shows the update
- ✅ Lisa Slayman skip logic works

### **Full Success**:
- ✅ All of the above
- ✅ Processing time < 1 second
- ✅ Dashboard shows update within 10 seconds (auto-refresh)
- ✅ No errors in NetSuite execution log
- ✅ Complete audit trail in sync tables
- ✅ Multiple pricing updates work consecutively

---

## 🚨 **Troubleshooting**

### **Webhook Not Firing**:

**Check**:
1. Script is deployed and status = Released/Testing
2. Pricing fields actually changed (must be different values)
3. Item type is Inventory Item (not Assembly, Kit, etc.)
4. Operation is EDIT (not CREATE or DELETE)

**NetSuite Execution Log** should show:
- ✅ Script execution triggered
- ✅ "Sending Pricing Webhook" audit log
- ✅ "Pricing Webhook Sent" audit log

### **Webhook Fails to Reach API**:

**Check**:
1. Webhook URL is publicly accessible (not localhost)
2. API server is running (test with `curl http://your-api/api/health`)
3. Firewall/network allows NetSuite to reach your API
4. SSL certificate is valid (if using HTTPS)

**NetSuite Execution Log** will show:
- ❌ Response code: 404, 500, timeout, etc.
- ❌ Connection error messages

### **API Receives But Doesn't Sync**:

**Check**:
1. Lisa Slayman checkbox is UNCHECKED in NetSuite
2. Webhook secret matches (401 error if mismatch)
3. OPMS item exists with matching code
4. Database connection working

**Dashboard** will show:
- ⚠️ Skipped status (if Lisa Slayman)
- ⚠️ Failed status (if other error)

---

## 📞 **Real-Time Support Commands**

```bash
# Check API health
curl http://localhost:3000/api/health

# Check webhook stats
curl http://localhost:3000/api/ns-to-opms/health

# Check dashboard metrics
curl http://localhost:3000/api/sync-dashboard/metrics

# Watch server logs live
tail -f server.log

# Check recent OPMS pricing updates
mysql -h localhost -u pklopuzen -plocaldev opuzen_loc_master_app -e "
SELECT i.code, p.name, pp.p_res_cut, pp.date 
FROM T_PRODUCT_PRICE pp
JOIN T_PRODUCT p ON pp.product_id = p.id
JOIN T_ITEM i ON i.product_id = p.id
WHERE pp.user_id = 1
ORDER BY pp.date DESC
LIMIT 5;
"
```

---

## 📋 **Testing Workflow Summary**

```
1. Deploy SuiteScript to NetSuite ✓
   ↓
2. Create Test Item in NetSuite ✓
   ↓
3. Update Pricing in NetSuite ✓
   ↓
4. NetSuite Fires afterSubmit Trigger
   ↓
5. Webhook Sent to API
   ↓
6. API Processes Webhook
   ↓
7. OPMS Database Updated
   ↓
8. Dashboard Shows Update (auto-refresh)
   ↓
9. Verify in OPMS Database ✓
   ↓
10. Test Lisa Slayman Skip ✓
```

---

## 🎉 **Ready to Begin?**

Your dashboard is live and waiting for webhooks!

**Current Status**:
- ✅ Dashboard: http://localhost:3000/api/sync-dashboard/
- ✅ API Server: Running on port 3000
- ✅ Webhook Endpoint: /api/ns-to-opms/webhook
- ✅ Webhook Secret: your-webhook-secret
- ✅ Test Data: opmsAPI01 (Product ID: 7756, Item ID: 43992)

**Next Action**: Deploy SuiteScript to NetSuite (see Step 1 above)

---

## 📝 **Notes During Testing**

Record your observations:

**Test 1: First Pricing Update**
- Time triggered: _______________
- Webhook received: Yes / No
- Sync success: Yes / No
- Dashboard updated: Yes / No
- Processing time: ________ ms

**Test 2: Lisa Slayman Skip**
- Skip logic worked: Yes / No
- OPMS unchanged: Yes / No
- Dashboard showed skip: Yes / No

**Issues Encountered**:
_________________________________
_________________________________
_________________________________




