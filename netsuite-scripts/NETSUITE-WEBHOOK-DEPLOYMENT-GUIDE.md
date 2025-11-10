# 🔧 NetSuite Webhook Deployment - Complete Guide
## Item Pricing Update Webhook for NS → OPMS Sync

---

## 📋 **Prerequisites**

Before you begin:
- ✅ NetSuite Administrator access
- ✅ Production NetSuite account (Account ID: 11516011)
- ✅ Production API deployed and accessible
- ✅ Dashboard open: http://localhost:3000/api/sync-dashboard/

**Your Configuration**:
- **Webhook URL**: `https://api.domain.com/api/ns-to-opms/webhook`
- **Webhook Secret**: `your-webhook-secret`
- **NetSuite Account**: 11516011 (Production)

---

## 🚀 **STEP 1: Upload SuiteScript to NetSuite**

### **1.1 Navigate to Scripts**

1. Log into **NetSuite Production** account
2. Go to: **Customization → Scripting → Scripts**
3. Click: **New Script** (blue button, top right)

### **1.2 Upload Script File**

1. **File Upload Section** appears
2. Click: **+** (plus icon) or **Choose File**
3. Navigate to your local file:
   ```
   netsuite-scripts/ItemPricingUpdateWebhook.js
   ```
4. Select the file and click **Open**
5. Click **Create Script Record** button

### **1.3 Configure Script Settings**

NetSuite will analyze the file and show the Script Configuration page:

**Basic Information**:
| Field | Value |
|-------|-------|
| **Name** | Item Pricing Update Webhook |
| **ID** | `customscript_item_pricing_webhook` |
| **Description** | Sends webhook to Opuzen API when inventory item pricing changes |
| **Script File** | ItemPricingUpdateWebhook.js |
| **Script Type** | User Event Script (auto-detected) |

**Owner Information**:
| Field | Value |
|-------|-------|
| **Owner** | Your admin user |
| **Status** | Testing (we'll change to Released later) |

**Script Parameters** (CRITICAL):

Click **Add** or **New Parameter** twice to create two parameters:

**Parameter 1: Webhook URL**
| Field | Value |
|-------|-------|
| **ID** | `custscript_webhook_url` |
| **Name** | Webhook URL |
| **Type** | Free-Form Text |
| **Display Type** | Normal |
| **Default Value** | `https://api.domain.com/api/ns-to-opms/webhook` |
| **Description** | Opuzen API webhook endpoint for pricing sync |
| **Mandatory** | Yes (check the box) |

**Parameter 2: Webhook Secret**
| Field | Value |
|-------|-------|
| **ID** | `custscript_webhook_secret` |
| **Name** | Webhook Secret |
| **Type** | Free-Form Text |
| **Display Type** | Password (or Normal if Password not available) |
| **Default Value** | `your-webhook-secret` |
| **Description** | Authentication secret for webhook (NS_TO_OPMS_WEBHOOK_SECRET) |
| **Mandatory** | Yes (check the box) |

**Save** the script (click **Save** button at bottom)

---

## 🚀 **STEP 2: Deploy the Script**

After saving, you'll be on the Script Record page.

### **2.1 Create Deployment**

1. Click the **Deployments** subtab (at top of page)
2. Click: **New Deployment** button
3. Fill out deployment form:

**Deployment Settings**:
| Field | Value | Notes |
|-------|-------|-------|
| **Title** | Item Pricing Webhook - Production |  |
| **ID** | `customdeploy_item_pricing_webhook_prod` | Auto-generated OK |
| **Status** | **Testing** | Start with Testing, switch to Released after verification |
| **Log Level** | **Debug** | For initial testing; change to Audit after stable |

**Audience**:
| Field | Value |
|-------|-------|
| **All Roles** | ✅ Checked | Webhook should fire for any user updating items |
| **All Employees** | ✅ Checked |  |

**Event Details** (CRITICAL):
| Field | Value |
|-------|-------|
| **Record Type** | **Inventory Item** | This tells NetSuite which records trigger the script |
| **Before Load** | ☐ Unchecked | Not needed |
| **Before Submit** | ☐ Unchecked | Not needed |
| **After Submit** | ✅ **CHECKED** | ⭐ CRITICAL - This is when webhook fires |

**Execute As**:
| Field | Value |
|-------|-------|
| **Execute As Role** | Administrator | Ensures script has permissions |

**Script Parameters** (should auto-populate from script):
- ✅ `custscript_webhook_url` = `https://api.domain.com/api/ns-to-opms/webhook`
- ✅ `custscript_webhook_secret` = `your-webhook-secret`

**Save** the deployment

---

## ✅ **STEP 3: Verify Deployment**

### **3.1 Check Deployment Status**

On the Script Record page → Deployments subtab:

You should see:
```
Deployment: Item Pricing Webhook - Production
Status: Testing (green)
Record Type: Inventory Item
After Submit: Yes
```

### **3.2 Test Script Execution**

**Option A: Check Existing Items** (Quick Test)
1. Open any existing inventory item
2. Change a pricing field slightly (e.g., Cost: $10.00 → $10.01)
3. Save
4. Check **Customization → Scripting → Script Execution Log**
5. Filter: Script = Item Pricing Update Webhook
6. Look for execution with status = "Success" or "Complete"

**Option B: Use Our Test Item** (Recommended)
- Create the test item first (see Step 4 below)

---

## 🆕 **STEP 4: Create NetSuite Test Item**

### **4.1 Create Lot Numbered Inventory Item**

1. Navigate: **Lists → Accounting → Items → New → Inventory Item**

2. **Basic Information**:
   - **Item Name/Number**: `opmsAPI-LIVE-TEST`
   - **Display Name**: `Live Pricing Sync Test`
   - **UPC Code**: *(leave blank or enter test value)*

3. **Classification** (Required fields vary by account):
   - **Subsidiary**: *(Select your subsidiary)*
   - **Category**: *(Select appropriate category or leave default)*
   - **Tax Schedule**: *(Select your tax schedule)*

4. **Accounting** (Required):
   - **Asset Account**: *(Your inventory asset account)*
   - **Income Account**: *(Your sales income account)*
   - **COGS Account**: *(Your cost of goods sold account)*

5. **Inventory Settings**:
   - ✅ **Lot Numbered Item**: **CHECKED** ⭐
   - ✅ **Track Lot Numbers**: Yes
   - **Inactive**: ☐ UNCHECKED (must be active)

6. **Custom Fields** (Search for these in the item form):
   
   **OPMS Integration Fields**:
   - **OPMS Item ID** (`custitem_opms_item_id`): `43992`
   - **OPMS Product ID** (`custitem_opms_prod_id`): `7756`
   - **OPMS Parent Product Name**: `opmsAPI-SYNC-TEST-PRODUCT`
   
   **Skip Logic Field** (CRITICAL):
   - **Lisa Slayman Item** (`custitemf3_lisa_item`): ☐ **UNCHECKED** (FALSE)

7. **Pricing** (Click Pricing tab):
   
   **Base Price**:
   - **Price 1** (Base Price): `10.00`
   - **Price Level 2** (if available): `20.00`
   
   **Purchasing**:
   - **Cost** (Purchase Price): `5.00`
   - **Preferred Vendor**: *(Optional - select if needed)*
   
   **Custom Pricing**:
   - **Roll Price** (`custitem_f3_rollprice`): `8.00`

8. **Save** the item

9. **Note the Internal ID**: After saving, look at the URL:
   ```
   https://[account].app.netsuite.com/app/common/item/item.nl?id=12345
                                                                   ^^^^^
   Internal ID = 12345
   ```

---

## 🔥 **STEP 5: Trigger Live Webhook Test**

### **5.1 Prepare to Monitor**

**Before making changes**:
1. ✅ Dashboard open: http://localhost:3000/api/sync-dashboard/
2. ✅ NetSuite Execution Log open (in another tab)
3. ✅ Terminal visible (to see live server logs)

### **5.2 Update Pricing in NetSuite**

1. **Open item**: `opmsAPI-LIVE-TEST`

2. **Go to Pricing tab**

3. **Change pricing fields**:
   - Price 1: `$10.00` → `$125.00` 💰
   - Price Level 2: `$20.00` → `$175.00` 💰
   - Cost: `$5.00` → `$45.00` 💰
   - Roll Price: `$8.00` → `$55.00` 💰

4. **Click Save**

5. **Watch for**:
   - NetSuite: "Record saved" message
   - NetSuite Execution Log: New entry appears
   - Terminal: Webhook request logged
   - Dashboard: Metrics update (within 10 seconds)

---

## 📊 **STEP 6: Verify Sync Success**

### **6.1 Check Dashboard** (Primary)

**Watch For**:
- ✅ Success Rate increases
- ✅ Total Syncs increments by 1
- ✅ Recent Updates shows new entry:
  ```
  opmsAPI-LIVE-TEST          Just now
  Live Pricing Sync Test
  
  Customer Cut:  $125.00
  Customer Roll: $175.00
  Vendor Cut:    $45.00
  Vendor Roll:   $55.00
  ```

### **6.2 Check NetSuite Execution Log**

**In NetSuite**:
1. Go to: **Customization → Scripting → Script Execution Log**
2. **Filter**:
   - Script: Item Pricing Update Webhook
   - Status: All
   - Date: Today
3. **Look for latest entry**:
   - ✅ Status: **Success** or **Complete**
   - ✅ Type: **AUDIT**
   - ✅ Title: "Pricing Webhook Sent"
   - ✅ Details should show: Response Code: 200

**Click on the log entry** to see details:
```json
{
  "itemId": "opmsAPI-LIVE-TEST",
  "responseCode": 200,
  "responseBody": "{\"success\":true,...}",
  "lisaSlayman": false
}
```

### **6.3 Check OPMS Database**

**Run this SQL**:
```sql
SELECT 
    'Live Test Results' as Status,
    i.code as ItemCode,
    CONCAT('$', pp.p_res_cut) as CustomerCut,
    CONCAT('$', pp.p_hosp_roll) as CustomerRoll,
    CONCAT('$', ppc.cost_cut) as VendorCut,
    CONCAT('$', ppc.cost_roll) as VendorRoll,
    pp.user_id as SyncedBy,
    DATE_FORMAT(pp.date, '%Y-%m-%d %H:%i:%s') as SyncedAt
FROM T_ITEM i
JOIN T_PRODUCT p ON i.product_id = p.id
LEFT JOIN T_PRODUCT_PRICE pp ON pp.product_id = p.id
LEFT JOIN T_PRODUCT_PRICE_COST ppc ON ppc.product_id = p.id
WHERE i.code IN ('opmsAPI-LIVE-TEST', 'opmsAPI01')
ORDER BY pp.date DESC;
```

**Expected**:
- ItemCode: `opmsAPI-LIVE-TEST`
- CustomerCut: `$125.00`
- CustomerRoll: `$175.00`
- VendorCut: `$45.00`
- VendorRoll: `$55.00`
- SyncedBy: `1` (Sync Service)

---

## 🧪 **STEP 7: Test Lisa Slayman Skip Logic**

Now verify the safety skip logic works:

### **7.1 Enable Skip Flag**

1. **In NetSuite**, open item: `opmsAPI-LIVE-TEST`
2. **Find**: Lisa Slayman Item checkbox
3. **Check** the box: ✅ (set to TRUE)
4. **Save** (don't change pricing yet)

### **7.2 Update Pricing (Should Be Skipped)**

1. **Open item** again: `opmsAPI-LIVE-TEST`
2. **Change pricing**:
   - Price 1: `$125.00` → `$999.00`
3. **Save**

### **7.3 Verify Skip Worked**

**NetSuite Execution Log**:
- ✅ Script executed
- ✅ Webhook sent
- ✅ Response code: 200

**Dashboard**:
- ✅ Shows "Skipped" status
- ✅ Reason: "Lisa Slayman item - pricing sync disabled"

**OPMS Database**:
```sql
-- Should STILL show $125.00, NOT $999.00
SELECT p_res_cut FROM T_PRODUCT_PRICE 
WHERE product_id = 7756;
```

**If it shows $125.00** → ✅ **Skip logic works perfectly!**  
**If it shows $999.00** → ❌ **Skip logic failed - needs investigation**

---

## 🚨 **Troubleshooting Guide**

### **Issue: "Script not found in Execution Log"**

**Cause**: Script didn't trigger

**Check**:
1. ✅ Deployment status = Testing or Released (NOT Inactive)
2. ✅ Record Type = Inventory Item
3. ✅ After Submit event is checked
4. ✅ You edited an EXISTING item (not created new)
5. ✅ You actually CHANGED a pricing field

**Try**: Update a different pricing field and save again

---

### **Issue: "Execution Log shows error"**

**Common Errors**:

**Error: "Webhook URL not configured"**
- **Fix**: Add script parameter `custscript_webhook_url` with your API URL

**Error: "Webhook Secret not configured"**
- **Fix**: Add script parameter `custscript_webhook_secret`

**Error: "Connection timeout" or "Unable to reach host"**
- **Cause**: API endpoint not accessible from NetSuite
- **Fix**: Verify API is deployed and publicly accessible
- **Test**: Try accessing `https://api.domain.com/api/health` from browser

**Error: "401 Unauthorized"**
- **Cause**: Webhook secret mismatch
- **Fix**: Ensure script parameter matches .env file exactly

---

### **Issue: "Execution Log shows Success but OPMS not updated"**

**Check**:
1. **NetSuite Response Code**: Should be 200
2. **Response Body**: Should contain `"success":true`
3. **Dashboard**: Check for error messages
4. **Terminal Logs**: Look for sync errors

**Debug**:
```bash
# Check recent API logs
curl https://api.domain.com/api/ns-to-opms/health

# Check sync job logs
curl https://api.domain.com/api/sync-dashboard/recent-jobs
```

---

### **Issue: "Dashboard not showing update"**

**Check**:
1. ✅ Auto-refresh enabled (checkbox checked)
2. ✅ No JavaScript errors in browser console (F12)
3. ✅ API endpoints responding:
   ```bash
   curl https://api.domain.com/api/sync-dashboard/metrics
   ```
4. ✅ Manual refresh works (click Refresh button)

---

## 📸 **NetSuite Screenshot Reference**

### **What to Look For**:

**Scripts List Page**:
```
Name: Item Pricing Update Webhook
ID: customscript_item_pricing_webhook
Type: User Event
Deployments: 1 active
```

**Deployment Page**:
```
Status: Testing → Released
Applied To: Inventory Item  
Event: After Submit ✓
Parameters: 2 configured
```

**Execution Log Entry** (Success):
```
Type: AUDIT
Title: Pricing Webhook Sent
Details: {"itemId":"opmsAPI-LIVE-TEST","responseCode":200,...}
```

---

## ✅ **Success Checklist**

After completing all steps:

- [ ] SuiteScript uploaded to NetSuite
- [ ] Script parameters configured (URL + Secret)
- [ ] Script deployed to Inventory Item, After Submit
- [ ] Test item created (`opmsAPI-LIVE-TEST`)
- [ ] Pricing updated in NetSuite
- [ ] Webhook fired (visible in Execution Log)
- [ ] API received webhook (200 OK response)
- [ ] OPMS database updated
- [ ] Dashboard shows the update
- [ ] Lisa Slayman skip logic tested and working

---

## 🎉 **Once Verified**

### **Switch to Production Mode**:

1. Open script deployment
2. Change **Status**: Testing → **Released**
3. Change **Log Level**: Debug → **Audit** (reduce log noise)
4. Save

### **Monitor Going Forward**:

- **Dashboard**: http://localhost:3000/api/sync-dashboard/
- **Execution Log**: Check periodically for errors
- **Database**: Monitor pricing updates

---

## 📞 **Need Help?**

**Common Questions**:

**Q**: What if I don't see script parameters section?  
**A**: Click **Parameters** subtab on Script Record page, then **New Parameter**

**Q**: Can I test in Sandbox first?  
**A**: Yes! Change webhook URL to point to sandbox/test API endpoint

**Q**: How do I know if webhook reached the API?  
**A**: Check terminal logs for `POST /api/ns-to-opms/webhook` entries

**Q**: What if pricing fields don't map to OPMS correctly?  
**A**: Verify field IDs in SuiteScript match your NetSuite configuration

---

**Status**: 📄 **Step-by-Step Guide Complete**

Follow this guide carefully and you'll have live NetSuite webhook integration working in ~15 minutes!




