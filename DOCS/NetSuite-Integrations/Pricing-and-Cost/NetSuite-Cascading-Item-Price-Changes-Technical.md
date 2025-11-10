# NetSuite Cascading Item Price Changes
## Bi-Directional Pricing Sync with OPMS Integration

**Last Updated:** October 25, 2025  
**Status:** ✅ Production Tested & Stable  
**Version:** v1.7.0

---

## 🎯 **Overview**

This system implements automated pricing synchronization between NetSuite and OPMS with intelligent cascading updates across all sibling lot-numbered inventory items sharing the same parent product.

**Key Feature:** When pricing is updated in any NetSuite item, the changes automatically cascade to all sibling items with the same OPMS parent product ID (`custitem_opms_prod_id`).

---

## 📊 **Pricing Fields and Cascade Behavior**

### **Bidirectional Fields (Cascade to All Siblings)**

| NetSuite Field | OPMS Table | OPMS Field | Cascade Direction | Notes |
|---|---|---|---|---|
| **Base Price Line 1** | T_PRODUCT_PRICE | p_res_cut | NS Item --> OPMS Product --> NS Sibling Items | Residential cut price |
| **Price Level 1, Line 5** | T_PRODUCT_PRICE | p_hosp_roll | NS Item --> OPMS Product --> NS Sibling Items  | Hospital roll price |
| **Roll Price (Custom)** | T_PRODUCT_PRICE_COST | cost_roll | NS Item --> OPMS Product --> NS Sibling Items  | Custom field: custitem_f3_rollprice |

### **One-Way Field (NetSuite → OPMS Only)**

| NetSuite Field | OPMS Table | OPMS Field | Cascade Direction | Why No Cascade Back |
|---|---|---|---|---|
| **Purchase Cost** | T_PRODUCT_PRICE_COST | cost_cut | → NetSuite to OPMS | Average costing - see explanation below |

---

## 🔄 **Complete Pricing Cascade Flow**

### **User Updates Pricing in NetSuite**

```
User updates pricing in NetSuite item (e.g., 6148-4501)
  ↓ (User Event Script triggers)
Webhook sent to OPMS API
  ↓ (ItemPricingUpdateWebhook.js)
OPMS Product Pricing Tables Updated
  ├─ T_PRODUCT_PRICE (p_res_cut, p_hosp_roll)
  └─ T_PRODUCT_PRICE_COST (cost_cut, cost_roll)
  ↓ (Cascade trigger via NsToOpmsWebhookService.js)
All Sibling OPMS Items Queued (same product_id)
  ↓ (OpmsChangeDetectionService.manualTriggerProduct)
OPMS→NetSuite Sync Queue Processing
  ↓ (NetSuiteSyncQueueService.js)
NetSuite RESTlet Updates All Sibling Items
  ├─ price_1_ (Base Price Line 1) ✓
  ├─ price_1_5 (Price Level 1, Line 5) ✓
  ├─ custitem_f3_rollprice (Roll Price) ✓
  └─ cost (Purchase Cost) ⚠️ Attempted but not persisted
  ↓ (RESTlet API calls, NOT UI saves)
✅ Cascade Complete - NO WEBHOOK FIRED
  (Prevents infinite loop: RESTlet updates don't trigger User Event scripts)
```

---

## 🛡️ **Infinite Loop Prevention**

**How Loop Prevention Works:**

1. **NetSuite User Event Script** (`ItemPricingUpdateWebhook.js`):
   - Triggers ONLY on **manual UI saves** (afterSubmit user event)
   - Script type: User Event (attached to record save operations)

2. **NetSuite RESTlet** (`RESTletUpsertInventoryItem-PROD.js`):
   - Updates records via **API calls** (programmatic updates)
   - Does NOT trigger User Event scripts
   - Updates are "silent" from webhook perspective

**Result:** User save → Webhook → OPMS → Cascade → RESTlet updates → **NO webhook** → Loop prevented ✓

---

## ⚠️ **Why Purchase Cost Doesn't Cascade**

### **NetSuite Average Costing Method**

NetSuite lot-numbered inventory items use **Average Costing** by default. This means:

**How Purchase Cost is Calculated:**
```
Average Cost = Total Value of Inventory / Total Quantity on Hand
```

**When Purchase Cost Updates:**
1. **Inventory Receipt** - Receiving new inventory updates average cost
2. **Purchase Order Receipt** - Items received against POs affect average
3. **Manual Adjustment** - User can manually override (but this is rare)
4. **NetSuite Recalculates** - System automatically updates based on transactions

**Why API Updates do not and should not cascade to sibling items:**

When our RESTlet tries to set `cost` field:
```javascript
inventoryItem.setValue({ fieldId: 'cost', value: 21.97 });  // Executes
inventoryItem.save();  // Saves successfully
// But NetSuite immediately recalculates based on inventory receipts
// Value reverts to calculated average cost
```

**The field CAN be set**, but NetSuite's costing engine **immediately recalculates** it based on actual inventory transactions, overriding any API-provided value.

### **Purchase Cost Behavior Across Sibling Items**

**Critical Understanding:** Each NetSuite lot-numbered inventory item has its **OWN independent average cost** based on its individual inventory receipt history.

**Example - ACDC Product (OPMS Product ID 2823):**

| NetSuite Item | Color | Average Cost | Based On |
|---|---|---|---|
| 6148-4501 | Teal | $21.95 | 100 units received @ $21.95 |
| 6148-4506 | Graphite | $22.10 | 80 units received @ $22.10 |
| 6148-4511 | Natural | $21.80 | 120 units received @ $21.80 |

**Each sibling maintains independent costing** - this is intentional NetSuite behavior and cannot be overridden via API.

---

## 📋 **Field Mapping Reference**

### **NetSuite → OPMS Mapping**

**Webhook Payload (ItemPricingUpdateWebhook.js):**
```javascript
{
  price_1_: getPriceFromSublist(record, 0),  // Base Price Line 1
  price_1_5: getPriceFromSublist(record, 4), // Price Level 1, Line 5
  cost: record.getValue('cost'),              // Purchase Cost
  custitem_f3_rollprice: record.getValue('custitem_f3_rollprice')  // Roll Price Custom
}
```

**OPMS Database Updates (NsToOpmsSyncService.js):**
```sql
-- Customer Pricing
UPDATE T_PRODUCT_PRICE 
SET p_res_cut = :price_1_,
    p_hosp_roll = :price_1_5
WHERE product_id = :product_id AND product_type = 'R';

-- Vendor Costs
UPDATE T_PRODUCT_PRICE_COST
SET cost_cut = :cost,
    cost_roll = :custitem_f3_rollprice
WHERE product_id = :product_id;
```

### **OPMS → NetSuite Mapping**

**Data Extraction (OpmsDataTransformService.js):**
```javascript
// Extract pricing from OPMS tables
const pricing = {
  p_res_cut: query T_PRODUCT_PRICE.p_res_cut,
  p_hosp_roll: query T_PRODUCT_PRICE.p_hosp_roll,
  cost_cut: query T_PRODUCT_PRICE_COST.cost_cut,
  cost_roll: query T_PRODUCT_PRICE_COST.cost_roll
};

// Transform to NetSuite payload
{
  price_1_: pricing.p_res_cut,      // Base Price Line 1
  price_1_5: pricing.p_hosp_roll,   // Price Level 1, Line 5  
  custitem_f3_rollprice: pricing.cost_roll  // Roll Price Custom
}
```

**RESTlet Updates (RESTletUpsertInventoryItem-PROD.js):**
```javascript
// Customer Pricing - Pricing Sublist
inventoryItem.selectLine({ sublistId: 'price1', line: 0 });
inventoryItem.setCurrentSublistValue({
  sublistId: 'price1',
  fieldId: 'price_1_',
  value: price_1_
});
inventoryItem.commitLine({ sublistId: 'price1' });

// Repeat for line 4 (price_1_5)

// Purchase Cost - Body Field (attempts but doesn't persist)
inventoryItem.setValue({ fieldId: 'cost', value: cost });

// Roll Price Custom - Custom Field
inventoryItem.setValue({ fieldId: 'custitem_f3_rollprice', value: rollprice });
```

---

## 🎯 **Business Rules**

### **Rule 1: NetSuite is Source of Truth for Pricing**
- All pricing changes MUST originate in NetSuite
- Manual OPMS database pricing updates do NOT trigger cascades
- This prevents OPMS from overriding NetSuite's authoritative pricing

### **Rule 2: Cascade Trigger Requirements**
- Pricing update must come via NetSuite webhook
- Only pricing updates from NetSuite UI trigger cascades
- Database triggers in OPMS do NOT trigger cascades for pricing tables

### **Rule 3: Sibling Item Definition**
- Sibling items = All NetSuite items with same `custitem_opms_prod_id`
- Corresponds to OPMS items with same `T_ITEM.product_id`
- Cascade applies to ALL siblings regardless of color, status, or vendor

### **Rule 4: Purchase Cost Exception**
- Purchase Cost captured from NetSuite → OPMS ✓
- Purchase Cost does NOT cascade back to siblings ✓
- Each NetSuite item maintains independent average cost ✓

---

## 🔧 **Technical Implementation**

### **Components Involved**

**NetSuite Side:**
- `ItemPricingUpdateWebhook.js` - User Event script captures pricing changes
- `RESTletUpsertInventoryItem-PROD.js` - RESTlet receives cascade updates

**OPMS API Side:**
- `NsToOpmsWebhookService.js` - Processes incoming webhooks
- `NsToOpmsSyncService.js` - Updates OPMS database
- `OpmsChangeDetectionService.js` - Triggers cascade for siblings
- `OpmsDataTransformService.js` - Extracts and transforms pricing data
- `NetSuiteSyncQueueService.js` - Processes cascade queue
- `netsuiteRestletService.js` - Sends updates to NetSuite

**Database Tables:**
- `T_PRODUCT_PRICE` - Customer pricing (p_res_cut, p_hosp_roll)
- `T_PRODUCT_PRICE_COST` - Vendor costs (cost_cut, cost_roll)
- `opms_sync_queue` - Cascade job queue
- `netsuite_opms_sync_jobs` - Webhook job tracking

### **Cascade Trigger Logic**

**Location:** `src/services/NsToOpmsWebhookService.js` (lines 168-209)

```javascript
// After successful NetSuite→OPMS pricing sync
if (result.opmsProductId) {
  const OpmsChangeDetectionService = require('./OpmsChangeDetectionService');
  const changeDetectionService = new OpmsChangeDetectionService();
  
  // Trigger sync for entire product (all items)
  await changeDetectionService.manualTriggerProduct(
    result.opmsProductId,
    'Product pricing updated via NetSuite webhook - cascading to all items',
    'HIGH',  // High priority for pricing cascades
    {
      source: 'ns_to_opms_webhook_cascade',
      webhook_job_id: syncJob.id
    }
  );
}
```

---

## 📝 **Usage Examples**

### **Example 1: Update Customer Pricing**

**Scenario:** Update Base Price Line 1 from $69.00 to $75.00 on item 6148-4501

**Expected Behavior:**
1. ✅ Webhook captures change → OPMS Product 2823 updated
2. ✅ Cascade triggers for all 9 ACDC sibling items
3. ✅ All 9 NetSuite items updated to $75.00 Base Price Line 1
4. ✅ No infinite loop (RESTlet updates don't trigger webhooks)

**Verification:**
- Check all ACDC items (6148-xxxx) - all show $75.00
- Check OPMS T_PRODUCT_PRICE - p_res_cut = 75.00
- Check sync logs - 9 cascade jobs created and completed

### **Example 2: Update Purchase Cost**

**Scenario:** Receive inventory for item 6148-4501, NetSuite calculates new average cost $22.50

**Expected Behavior:**
1. ✅ Webhook captures change → OPMS Product 2823 cost_cut updated to $22.50
2. ✅ Cascade triggers for all 9 ACDC sibling items
3. ❌ Sibling items do NOT get $22.50 cost (each maintains own average)
4. ✅ But customer pricing and roll price DO cascade

**Why:** Each NetSuite item has independent inventory receipts and therefore independent average costs.

---

## ⚙️ **Configuration**

### **Environment Variables**

```bash
# NetSuite Webhook Authentication
NS_TO_OPMS_WEBHOOK_SECRET=opuzen-ns-to-opms-20560d247a41b83fabb5d7ff5df74a1b

# NetSuite Webhook URL (must point to production)
NS_TO_OPMS_ENDPOINT_URL=https://api.opuzen-service.com/api/ns-to-opms/webhook

# Sync Configuration
OPMS_SYNC_ENABLED=true
NS_TO_OPMS_MAX_RETRIES=3
NS_TO_OPMS_RATE_LIMIT_MS=1000
```

### **NetSuite Script Parameters**

**ItemPricingUpdateWebhook Deployment:**
- **Price Update Webhook URL:** `https://api.opuzen-service.com/api/ns-to-opms/webhook`
- **Webhook Secret:** `opuzen-ns-to-opms-20560d247a41b83fabb5d7ff5df74a1b`
- **Status:** Released
- **Log Level:** Debug

---

## 🐛 **Troubleshooting**

### **Pricing Not Cascading**

**Symptom:** Pricing updated in NetSuite but siblings not updated

**Check:**
1. Is webhook URL correct in NetSuite script parameters?
2. Is production OPMS API running? `ps aux | grep node`
3. Check webhook logs: `tail -f /home/ubuntu/opms-api.log | grep webhook`
4. Verify cascade triggered: Look for "Triggering cascade sync for product siblings"

### **Purchase Cost Not Updating**

**Symptom:** Purchase cost shows different value than expected

**This is NORMAL:**  
Purchase cost is controlled by NetSuite's average costing algorithm based on inventory receipts. It will NOT match sibling items or be settable via API.

**To update purchase cost:**
- Create inventory receipt with new cost
- NetSuite will recalculate average automatically
- New average will sync to OPMS via webhook

### **Infinite Loop Concern**

**Symptom:** Worried about pricing updates causing infinite sync loops

**Verification:**
```bash
# Check for multiple cascades in short time
ssh ubuntu@52.53.252.247 "cd /opuzen-efs/prod/opms-api && node -e \"
const db = require('./src/config/database');
(async () => {
  const [jobs] = await db.query(\\\`
    SELECT COUNT(*) as count
    FROM opms_sync_queue
    WHERE created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      AND JSON_EXTRACT(event_data, '\\\$.trigger_source') = 'MANUAL_PRODUCT_API'
      AND product_id = :product_id
  \\\`, { product_id: YOUR_PRODUCT_ID });
  
  console.log('Cascade jobs in last 5 minutes:', jobs[0].count);
  console.log(jobs[0].count === 2 ? 'Normal (1 cascade)' : 'Possible loop!');
  process.exit(0);
})();
\""
```

**Expected:** 2 jobs per cascade (one per sibling item), not increasing numbers

---

## 📚 **NetSuite Average Costing Deep Dive**

### **How NetSuite Calculates Average Cost**

**Average Cost Formula:**
```
Average Cost = (Existing Inventory Value + New Receipt Value) / 
               (Existing Quantity + New Receipt Quantity)
```

**Example Transaction Flow:**

**Starting Point:**
- Quantity on Hand: 100 units
- Total Value: $2,000
- Average Cost: $20.00/unit

**Inventory Receipt:**
- Received: 50 units @ $26.00/unit
- Receipt Value: $1,300

**New Average Cost Calculation:**
```
Total Value: $2,000 + $1,300 = $3,300
Total Quantity: 100 + 50 = 150 units
New Average Cost: $3,300 / 150 = $22.00/unit
```

**NetSuite automatically updates the `cost` field to $22.00**

### **Why API Cannot Override Average Cost**

**NetSuite's Costing Engine Priority:**
1. **Highest Priority:** Inventory transaction costing calculations
2. **Medium Priority:** Manual user overrides in UI (temporary)
3. **Lowest Priority:** API setValue() calls

**When RESTlet sets cost:**
```javascript
// Our code executes successfully
inventoryItem.setValue({ fieldId: 'cost', value: 21.97 });
inventoryItem.save();  // Saves without error

// But immediately after save
// NetSuite Costing Engine runs
if (costingMethod === 'AVERAGE') {
  recalculateAverageCost(item);  // Overwrites our value
}
```

**Result:** Field appears to save, but value is recalculated immediately.

### **NetSuite Costing Methods Comparison**

| Costing Method | Cost Field Behavior | API Settable | Use Case |
|---|---|---|---|
| **Average** | Auto-calculated | ❌ No | Standard inventory (our items) |
| **FIFO** | Auto-calculated | ❌ No | First-in-first-out tracking |
| **LIFO** | Auto-calculated | ❌ No | Last-in-first-out tracking |
| **Standard** | User-defined | ✅ Yes | Manufacturing with standard costs |
| **Lot Numbered** | Varies by lot | ❌ No | Lot-specific costing |

**Our Items:** Use Average costing → Cost field NOT API-settable

---

## ✅ **What IS Working**

### **Confirmed Working Features**

**✅ Bidirectional Customer Pricing Cascade:**
- Update Base Price Line 1 in any item → All siblings updated
- Update Price Level 1, Line 5 in any item → All siblings updated
- Verified with Product 2823 (ACDC) - 9 sibling items
- Verified with Product 7799 (AAA TEST PKL02) - 2 sibling items

**✅ Bidirectional Custom Roll Price Cascade:**
- Update custitem_f3_rollprice in any item → All siblings updated
- Field persists correctly in NetSuite
- Syncs back to OPMS cost_roll

**✅ One-Way Purchase Cost Sync:**
- NetSuite cost changes captured via webhook ✓
- OPMS T_PRODUCT_PRICE_COST.cost_cut updated ✓
- Does not cascade back (correct NetSuite behavior) ✓

**✅ Infinite Loop Prevention:**
- RESTlet API updates do not trigger webhooks ✓
- Single cascade per pricing update ✓
- No runaway sync jobs ✓

---

## 🔮 **Future Considerations**

### **If You Need to Update Purchase Cost Across Siblings**

**Option 1: Inventory Receipts (Recommended)**
- Create inventory receipts for all sibling items
- NetSuite will calculate average costs individually
- This is the "NetSuite way" and maintains data integrity

**Option 2: Change to Standard Costing (Not Recommended)**
- Change item costing method to "Standard"
- Allows API to set cost field
- **Downside:** Loses automatic average cost calculation
- **Impact:** Requires manual cost management

**Option 3: Custom Cost Field (Alternative)**
- Create new custom field for "Target Cost" or "OPMS Cost"
- This field CAN cascade and persist
- Keep standard average cost for NetSuite operations
- Use custom field for pricing decisions/reporting

---

## 📞 **Support**

### **Monitoring Pricing Cascades**

**View Recent Cascades:**
```bash
ssh ubuntu@52.53.252.247 "tail -100 /home/ubuntu/opms-api.log | grep '💰'"
```

**Check Cascade for Specific Product:**
```sql
SELECT * FROM opms_sync_queue
WHERE product_id = 2823
  AND JSON_EXTRACT(event_data, '$.trigger_source') = 'MANUAL_PRODUCT_API'
ORDER BY created_at DESC
LIMIT 10;
```

### **Common Questions**

**Q: Why do sibling items have different purchase costs?**  
A: Each item has independent inventory receipt history. NetSuite calculates average cost per-item based on actual receipts for that specific item.

**Q: Can we force all siblings to have the same purchase cost?**  
A: Not with Average costing. NetSuite's costing engine will always recalculate based on inventory transactions. This is intentional and maintains accounting accuracy.

**Q: Does the webhook capture purchase cost changes?**  
A: Yes! When NetSuite recalculates average cost (from receipts), the webhook captures the new value and updates OPMS. This is one-way: NetSuite → OPMS.

---

## 📊 **Testing**

### **Verify Pricing Cascade Works**

**Test Steps:**
1. Open any NetSuite lot-numbered inventory item
2. Update Base Price Line 1 (e.g., change $69.00 to $75.00)
3. Save the item
4. Wait 5-10 seconds for cascade
5. Check sibling items - all should show $75.00
6. Verify in OPMS: `SELECT p_res_cut FROM T_PRODUCT_PRICE WHERE product_id = X`

**Expected Result:** All siblings updated, OPMS matches, no errors

### **Verify Purchase Cost Behavior**

**Test Steps:**
1. Note current purchase cost for item A: $21.95
2. Create inventory receipt: 10 units @ $30.00
3. NetSuite recalculates: New average cost $22.35
4. Check webhook: Should capture $22.35 → OPMS updated
5. Check sibling item B: Should still show its own average (e.g., $21.80)

**Expected Result:** Each item maintains independent cost, webhook captures changes

---

## 🏁 **Conclusion**

The pricing cascade system is **working as designed**:
- ✅ Customer pricing cascades bidirectionally
- ✅ Custom roll price cascades bidirectionally  
- ✅ Purchase cost syncs one-way (NetSuite → OPMS only)
- ✅ Infinite loop prevention active
- ✅ NetSuite average costing respected

**The inability to cascade purchase cost is a NetSuite platform limitation with Average Costing, not a bug in our integration.**

---

**Document Version:** 1.0  
**Last Tested:** October 25, 2025  
**Production Status:** ✅ Stable

