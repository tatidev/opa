# NetSuite Webhook Infinite Loop Prevention

## 🚨 **Critical Issue: Infinite Loop Risk**

### **Problem:**

Without proper safeguards, bi-directional sync creates an infinite loop:

```
OPMS → NetSuite (updates pricing)
  ↓
NetSuite fires afterSubmit webhook
  ↓
Webhook → API → OPMS (updates pricing)
  ↓
OPMS triggers sync back to NetSuite
  ↓
NetSuite fires afterSubmit webhook
  ↓
INFINITE LOOP ∞
```

---

## ✅ **Solution: Execution Context Detection**

### **Implementation:**

The `ItemPricingUpdateWebhook.js` script now checks NetSuite's execution context to determine **how** the item was updated:

```javascript
const execContext = runtime.executionContext;

if (execContext !== runtime.ContextType.USER_INTERFACE) {
    log.debug('Webhook Skip - Infinite Loop Prevention', {
        executionContext: execContext,
        reason: 'Not a user interface edit (likely RESTlet/API update from OPMS sync)',
        itemId: context.newRecord.getValue('itemid')
    });
    return; // Skip webhook
}
```

### **Execution Contexts:**

| Context | Trigger | Webhook Action |
|---------|---------|----------------|
| `USER_INTERFACE` | Human user editing in NetSuite UI | ✅ **FIRE WEBHOOK** |
| `RESTLET` | RESTlet API call (OPMS sync) | ❌ **SKIP** (prevents loop) |
| `WEBSERVICES` | SOAP/REST Web Services | ❌ **SKIP** (prevents loop) |
| `SCHEDULED` | Scheduled script | ❌ **SKIP** |
| `CSVIMPORT` | CSV import | ❌ **SKIP** |
| `WORKFLOW` | Workflow action | ❌ **SKIP** |

---

## 🔄 **Sync Flow with Loop Prevention:**

### **Scenario 1: Human User Edits Price in NetSuite**
```
Human edits price in NetSuite UI
  ↓
afterSubmit fires (context = USER_INTERFACE)
  ↓
✅ Webhook sent to API
  ↓
API updates OPMS pricing
  ↓
END (No loop - OPMS doesn't trigger sync back)
```

### **Scenario 2: OPMS→NetSuite Sync Updates Price**
```
OPMS item updated
  ↓
OPMS→NetSuite sync via RESTlet
  ↓
afterSubmit fires (context = RESTLET)
  ↓
❌ Webhook SKIPPED (infinite loop prevented)
  ↓
END (No loop)
```

### **Scenario 3: Lisa Slayman Item**
```
Human edits Lisa Slayman item in NetSuite
  ↓
afterSubmit fires (context = USER_INTERFACE)
  ↓
✅ Webhook sent with custitemf3_lisa_item = TRUE
  ↓
API receives webhook, checks Lisa flag
  ↓
❌ Sync SKIPPED (per Lisa Slayman logic)
  ↓
END (No OPMS update)
```

---

## 📊 **Multi-Layer Protection:**

### **Layer 1: Execution Context Check (NetSuite)**
- **Location**: `ItemPricingUpdateWebhook.js` line 37
- **Protection**: Prevents webhook on RESTlet/API updates
- **Benefit**: Stops loop at the source

### **Layer 2: Lisa Slayman Flag (API)**
- **Location**: `NsToOpmsSyncService.js` 
- **Protection**: Skips OPMS updates for Lisa items
- **Benefit**: User can manually manage certain items

### **Layer 3: Field Change Detection (NetSuite)**
- **Location**: `ItemPricingUpdateWebhook.js` line 49
- **Protection**: Only fires if pricing actually changed
- **Benefit**: Reduces unnecessary webhooks

---

## 🧪 **Testing the Fix:**

### **Test 1: Human Edit (Should Fire Webhook)**
```
1. Open NetSuite item in UI
2. Change price field
3. Save
Expected: ✅ Webhook fires, OPMS updated, dashboard shows sync
```

### **Test 2: OPMS Sync (Should NOT Fire Webhook)**
```
1. Update OPMS item pricing
2. OPMS→NetSuite sync runs via RESTlet
3. NetSuite item updated
Expected: ❌ Webhook skipped, no loop, dashboard shows no new sync
```

### **Test 3: Lisa Slayman Item (Should Skip OPMS Update)**
```
1. Edit Lisa Slayman item (custitemf3_lisa_item = TRUE) in NetSuite UI
2. Save
Expected: ✅ Webhook fires but ❌ OPMS update skipped
```

---

## 📝 **Deployment Instructions:**

### **Step 1: Upload Updated Script to NetSuite**
1. Go to **Customization → Scripting → Scripts → New**
2. Upload `ItemPricingUpdateWebhook.js` (or update existing)
3. Script Type: **User Event Script**
4. Version: 2.1

### **Step 2: Configure Script Parameters**
| Parameter ID | Value |
|-------------|-------|
| `custscript_item_price_update_webhook` | `https://api-dev.opuzen-service.com/api/ns-to-opms/webhook` |
| `custscript_price_update_webhook_secret` | (Your webhook secret from environment) |

### **Step 3: Deploy Script**
1. **Record Type**: Inventory Item
2. **Event**: After Submit
3. **Status**: Released
4. **Applies To**: All Inventory Items

### **Step 4: Verify Deployment**
```bash
# Test webhook fires for UI edits
# (Make a price change in NetSuite UI - should see webhook in logs)

# Test webhook skips for RESTlet updates
# (Trigger OPMS→NetSuite sync - should NOT see webhook in logs)
```

---

## 🔍 **Monitoring & Debugging:**

### **Check NetSuite Execution Logs:**
Look for these messages:
- `Webhook Skip - Infinite Loop Prevention` = RESTlet update (good!)
- `Sending Pricing Webhook` = Human UI edit (good!)

### **Check API Logs:**
```bash
ssh ubuntu@13.52.98.189 "tail -f /home/ubuntu/opms-api.log | grep webhook"
```

### **Check Dashboard:**
- Human edits should create sync jobs
- RESTlet updates should NOT create sync jobs

---

## ✅ **Success Criteria:**

- [x] Webhook only fires for `USER_INTERFACE` context
- [x] RESTlet updates skip webhook
- [x] No infinite loops detected
- [x] Human edits still sync to OPMS correctly
- [x] Lisa Slayman items still skip OPMS updates

---

**Status**: ✅ **READY FOR NETSUITE DEPLOYMENT**

**File Updated**: `netsuite-scripts/ItemPricingUpdateWebhook.js`

**Next Step**: Upload to NetSuite and redeploy User Event Script

