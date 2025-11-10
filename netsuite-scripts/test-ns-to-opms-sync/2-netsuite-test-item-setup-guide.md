# NetSuite Test Item Setup Guide
## NetSuite to OPMS Pricing Sync Testing

---

## Prerequisites
✅ OPMS test data created via `1-setup-opms-test-data.sql`  
✅ NetSuite Administrator access  
✅ Note the OPMS Product ID and Item ID from SQL script output

---

## Step 1: Create Lot Numbered Inventory Item in NetSuite

### Navigation:
**Lists → Accounting → Items → New → Inventory Item**

### Required Fields:

| Field | Value | Notes |
|-------|-------|-------|
| **Item Name/Number** | `opmsAPI-SYNC-TEST-001` | ⚠️ CRITICAL: Must match OPMS T_ITEM.code |
| **Display Name** | `Test Sync Item - Pricing Test` | Descriptive name |
| **Subsidiary** | *Your subsidiary* | Required |
| **Tax Schedule** | *Your tax schedule* | As appropriate |
| **Asset Account** | *Your inventory account* | Standard inventory GL |
| **Income Account** | *Your income account* | Standard sales GL |
| **COGS Account** | *Your COGS account* | Standard COGS GL |

### Inventory Settings:
- ✅ **Item Type**: Inventory Item
- ✅ **Lot Numbered Item**: Check this box
- ✅ **Inactive**: Unchecked (item must be active)

### Custom Fields:
| Field | Internal ID | Value | Purpose |
|-------|-------------|-------|---------|
| **Lisa Slayman Item** | `custitemf3_lisa_item` | ☐ **UNCHECKED** | Skip logic test - must be FALSE initially |
| **Roll Price** | `custitem_f3_rollprice` | `50.00` | Vendor roll cost |
| **OPMS Item ID** | `custitem_opms_item_id` | *[From SQL output]* | Link to OPMS |
| **OPMS Product ID** | `custitem_opms_prod_id` | *[From SQL output]* | Link to OPMS |

### Pricing Fields (THE 4 CRITICAL SYNC FIELDS):

#### Base Price Tab → Price Level 1 (Residential Cut):
| Field | Value | Syncs To |
|-------|-------|----------|
| **Base Price (Line 1)** | `100.00` | OPMS: `T_PRODUCT_PRICE.p_res_cut` |

#### Base Price Tab → Price Level 2 (Hospital Roll):
| Field | Value | Syncs To |
|-------|-------|----------|
| **Base Price (Line 2)** | `150.00` | OPMS: `T_PRODUCT_PRICE.p_hosp_roll` |

#### Purchasing Tab:
| Field | Value | Syncs To |
|-------|-------|----------|
| **Purchase Price (Cost)** | `40.00` | OPMS: `T_PRODUCT_PRICE_COST.cost_cut` |

#### Custom Field:
| Field | Value | Syncs To |
|-------|-------|----------|
| **Roll Price (Custom)** | `50.00` | OPMS: `T_PRODUCT_PRICE_COST.cost_roll` |

---

## Step 2: Save and Verify NetSuite Item

After saving, verify the following:

### Item Record Verification:
```
Item ID:           opmsAPI-SYNC-TEST-001
Display Name:      Test Sync Item - Pricing Test
Type:              Inventory Item
Lot Numbered:      ✅ Yes
Status:            Active

PRICING VERIFICATION:
-------------------------------------------
Base Price (Line 1):         $100.00  ← Will sync to p_res_cut
Base Price (Line 2):         $150.00  ← Will sync to p_hosp_roll
Purchase Price (Cost):       $40.00   ← Will sync to cost_cut
Roll Price (custitem_f3_rollprice): $50.00   ← Will sync to cost_roll

CUSTOM FIELDS:
-------------------------------------------
Lisa Slayman Item:           ☐ FALSE (unchecked)
OPMS Item ID:                [Your OPMS Item ID]
OPMS Product ID:             [Your OPMS Product ID]
```

### NetSuite Internal ID:
After saving, note the NetSuite **Internal ID** from the URL:
```
URL: https://[account].app.netsuite.com/app/common/item/item.nl?id=12345
                                                                    ^^^^^
                                                            Internal ID = 12345
```

**Document this Internal ID** - you'll need it for testing.

---

## Step 3: Verify Item is Ready for Sync

### Pre-Sync Checklist:
- ✅ Item ID matches OPMS: `opmsAPI-SYNC-TEST-001`
- ✅ Item is ACTIVE (not inactive)
- ✅ Lot Numbered Item is enabled
- ✅ Lisa Slayman checkbox is UNCHECKED (FALSE)
- ✅ All 4 pricing fields have values:
  - Base Price Line 1: $100.00
  - Base Price Line 2: $150.00
  - Cost: $40.00
  - Roll Price: $50.00
- ✅ OPMS Item ID and Product ID custom fields populated

---

## Step 4: Expected Sync Results

When sync is triggered, the following should happen:

### OPMS Database Updates (Expected):

**T_PRODUCT_PRICE** (Customer Pricing):
```sql
p_res_cut:   0.00 → 100.00  (Base Price Line 1)
p_hosp_roll: 0.00 → 150.00  (Base Price Line 2)
```

**T_PRODUCT_PRICE_COST** (Vendor Costs):
```sql
cost_cut:  0.00 → 40.00  (Purchase Price)
cost_roll: 0.00 → 50.00  (Roll Price Custom)
```

---

## Step 5: Test Pricing Updates

After initial sync verification, test pricing updates:

### Update Test:
1. **In NetSuite**, change pricing:
   - Base Price Line 1: `100.00` → `125.00`
   - Base Price Line 2: `150.00` → `175.00`
   - Cost: `40.00` → `45.00`
   - Roll Price: `50.00` → `55.00`

2. **Save** the NetSuite item

3. **Trigger sync** via test script

4. **Verify** OPMS database shows new values

---

## Step 6: Test Lisa Slayman Skip Logic

### Skip Logic Test:
1. **In NetSuite**, check the **Lisa Slayman Item** checkbox (set to TRUE)

2. **Update pricing** again (change any value)

3. **Trigger sync** via test script

4. **Expected Result**: 
   - Sync should be SKIPPED
   - OPMS pricing should NOT change
   - Sync logs should show: "Lisa Slayman item - pricing sync disabled"

5. **Verify** in sync logs that item was skipped with proper reason

---

## NetSuite SuiteQL Query for Verification

Use this query in NetSuite's SuiteQL Query Tool to verify your test item:

```sql
SELECT 
    item.id AS internal_id,
    item.itemid AS item_code,
    item.displayname,
    item.isinactive,
    item.purchaseprice AS cost,
    item.custitemf3_lisa_item AS lisa_slayman_flag,
    item.custitem_f3_rollprice AS roll_price,
    item.custitem_opms_item_id AS opms_item_id,
    item.custitem_opms_prod_id AS opms_product_id
FROM item
WHERE item.itemid = 'opmsAPI-SYNC-TEST-001'
```

---

## Troubleshooting

### Common Issues:

**Issue**: Sync fails with "OPMS item not found"  
**Solution**: Verify `itemid` in NetSuite EXACTLY matches `T_ITEM.code` in OPMS (case-sensitive)

**Issue**: Pricing not updating in OPMS  
**Solution**: Check Lisa Slayman flag is FALSE in NetSuite

**Issue**: Some prices update, others don't  
**Solution**: Verify all pricing fields in NetSuite have numeric values (not blank or text)

**Issue**: Transaction rollback error  
**Solution**: Check OPMS database connection and table permissions

---

## Next Steps

After NetSuite item is created and verified:
1. ✅ Proceed to `3-manual-sync-test.js` to trigger test sync
2. ✅ Run validation queries in `4-validate-sync-results.sql`
3. ✅ Review sync logs and results
4. ✅ Clean up test data using `6-cleanup-test-data.sql`

---

## Important Notes

⚠️ **Test Item Identification**: Always use `opmsAPI-` prefix for test items  
⚠️ **Production Safety**: Test data is isolated and can be safely deleted  
⚠️ **Lisa Slayman Logic**: MUST be tested separately (FALSE first, then TRUE)  
⚠️ **Pricing Values**: Use distinct, recognizable test values for easy verification

