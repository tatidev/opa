# NetSuite to OPMS Pricing Sync - Complete Test Suite
## Comprehensive Testing Guide for Lot Numbered Inventory Items

---

## 📋 Overview

This test suite validates the **NetSuite → OPMS pricing synchronization** for Lot Numbered Inventory Items. It tests the 4-field pricing sync with comprehensive validation including the critical **Lisa Slayman skip logic**.

### What This Tests

✅ **4 Pricing Fields Sync** from NetSuite to OPMS:
- Base Price Line 1 → `T_PRODUCT_PRICE.p_res_cut` (customer cut price)
- Base Price Line 2 → `T_PRODUCT_PRICE.p_hosp_roll` (customer roll price)
- Purchase Cost → `T_PRODUCT_PRICE_COST.cost_cut` (vendor cut cost)
- Roll Price Custom → `T_PRODUCT_PRICE_COST.cost_roll` (vendor roll cost)

✅ **Lisa Slayman Skip Logic**: Items flagged in NetSuite are skipped  
✅ **Transaction Safety**: Atomic updates with rollback capability  
✅ **Data Validation**: Pricing validation and business logic checks  
✅ **Error Handling**: Missing items, invalid data, and failure scenarios

---

## 🎯 Prerequisites

### Required Access:
- ✅ Production OPMS database access (MySQL)
- ✅ NetSuite Administrator account
- ✅ API server access (can run locally or deployed)
- ✅ Node.js 18+ installed

### Required Configuration:
- ✅ `NS_TO_OPMS_WEBHOOK_SECRET` environment variable set
- ✅ OPMS database connection configured
- ✅ NetSuite OAuth credentials (if using webhook)

---

## 📁 Test Suite Files

| File | Purpose | When to Use |
|------|---------|-------------|
| `1-setup-opms-test-data.sql` | Creates test product & item in OPMS | Run FIRST |
| `2-netsuite-test-item-setup-guide.md` | Guide for NetSuite test item creation | Run SECOND |
| `3-manual-sync-test.js` | Triggers sync and runs test cases | Run THIRD |
| `4-validate-sync-results.sql` | Validates pricing updates in OPMS | Run FOURTH |
| `6-cleanup-test-data.sql` | Removes all test data | Run LAST |
| `README.md` | This file - master guide | Reference throughout |

**Location**: `netsuite-scripts/test-ns-to-opms-sync/`

---

## 🚀 Quick Start (5-Step Process)

### Step 1: Setup OPMS Test Data (5 minutes)

```bash
# Navigate to test directory
cd netsuite-scripts/test-ns-to-opms-sync

# Run OPMS setup script
mysql -h <host> -u <user> -p <database> < 1-setup-opms-test-data.sql
```

**What This Does:**
- Creates test product: `opmsAPI-SYNC-TEST-PRODUCT`
- Creates test item: `opmsAPI-SYNC-TEST-001`
- Links item to a color
- Initializes pricing tables with baseline values

**Expected Output:**
```
Created Product ID: 1234
Created Item ID: 5678
Using Color ID: 42
*** COPY THIS INFO FOR NETSUITE SETUP ***
```

📝 **IMPORTANT**: Note the Product ID and Item ID for NetSuite setup.

---

### Step 2: Create NetSuite Test Item (10 minutes)

Follow the detailed guide in `2-netsuite-test-item-setup-guide.md`:

**Quick Checklist:**
1. ✅ Navigate to: **Lists → Accounting → Items → New → Inventory Item**
2. ✅ Set Item ID: `opmsAPI-SYNC-TEST-001` (must match OPMS)
3. ✅ Enable **Lot Numbered Item**
4. ✅ Set **Lisa Slayman Item** = ☐ UNCHECKED (FALSE)
5. ✅ Set pricing fields:
   - Base Price Line 1: `$100.00`
   - Base Price Line 2: `$150.00`
   - Cost: `$40.00`
   - Roll Price (custom): `$50.00`
6. ✅ Set OPMS IDs in custom fields (from Step 1 output)
7. ✅ Save and note NetSuite Internal ID

---

### Step 3: Start API Server (if not running)

```bash
# From project root
cd ../..

# Install dependencies if needed
npm install

# Start server
npm start

# Or in development mode
npm run dev
```

**Verify server is running:**
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "OK",
  "message": "Opuzen API is running"
}
```

---

### Step 4: Run Sync Tests (5 minutes)

```bash
# Make sure you're in the test directory
cd netsuite-scripts/test-ns-to-opms-sync

# Run test suite
node 3-manual-sync-test.js
```

**What This Tests:**
- ✅ **Test Case 1**: Normal pricing sync (Lisa Slayman = FALSE)
- ✅ **Test Case 2**: Skip logic test (Lisa Slayman = TRUE)
- ✅ **Test Case 3**: Invalid data handling
- ✅ **Test Case 4**: Missing item handling

**Expected Output:**
```
╔════════════════════════════════════════════════════════════╗
║  NetSuite to OPMS Pricing Sync - Manual Test Suite       ║
╚════════════════════════════════════════════════════════════╝

============================================================
TEST CASE 1: Normal Pricing Sync
============================================================
✅ TEST CASE 1: PASSED
🎉 SUCCESS: Pricing sync completed

============================================================
TEST CASE 2: Lisa Slayman Skip Logic
============================================================
✅ TEST CASE 2: PASSED
🎉 SUCCESS: Item was correctly skipped

============================================================
FINAL RESULT: 4/4 tests passed
============================================================
🎉 ALL TESTS PASSED! Sync functionality is working correctly.
```

---

### Step 5: Validate Results (5 minutes)

```bash
# Run validation queries
mysql -h <host> -u <user> -p <database> < 4-validate-sync-results.sql
```

**What This Validates:**
- ✅ Customer pricing matches expected values
- ✅ Vendor costs match expected values
- ✅ Updates were made by sync service (user_id = 1)
- ✅ Profit margins are reasonable
- ✅ No orphaned records

**Expected Output:**
```
VALIDATION CHECKLIST
╚════════════════════════════════════════════════════════════╝

Field: Customer Cut Price (p_res_cut)
Actual Value: $100.00
Expected Value: $100.00
Result: ✅ PASS

[... all validations pass ...]

Final Result: ✅ ALL VALIDATIONS PASSED - Sync working correctly!
```

---

### Step 6: Cleanup Test Data (2 minutes)

```bash
# Remove test data from OPMS
mysql -h <host> -u <user> -p <database> < 6-cleanup-test-data.sql
```

**What This Removes:**
- All `opmsAPI-` prefixed products
- All `opmsAPI-` prefixed items
- Associated pricing records
- Associated color associations

**⚠️ NetSuite Cleanup:**
Remember to also delete the NetSuite test item:
1. Navigate to: **Lists → Accounting → Items**
2. Search for: `opmsAPI-SYNC-TEST-001`
3. Delete item
4. Empty trash/recycle bin

---

## 📊 Test Results Interpretation

### Success Indicators

✅ **All tests passed** - Sync working correctly  
✅ **Pricing values match** - Data transformation correct  
✅ **Lisa Slayman skip works** - Safety logic functional  
✅ **user_id = 1** - Sync service properly identified  
✅ **Profit margins positive** - Business logic validation passing

### Failure Scenarios

❌ **Test Case 1 fails** → Check OPMS database connection  
❌ **Test Case 2 fails** → Skip logic broken (CRITICAL)  
❌ **Pricing doesn't match** → Field mapping incorrect  
❌ **user_id ≠ 1** → Sync service not authenticated properly  
❌ **Negative margins** → Pricing validation needs attention

---

## 🔧 Troubleshooting

### Issue: "OPMS item not found"

**Cause**: NetSuite `itemid` doesn't match OPMS `T_ITEM.code`

**Solution**:
```sql
-- Verify item exists in OPMS
SELECT id, code FROM T_ITEM WHERE code = 'opmsAPI-SYNC-TEST-001';

-- Check for case sensitivity
SELECT id, code FROM T_ITEM WHERE LOWER(code) = LOWER('opmsAPI-sync-test-001');
```

### Issue: "Sync skipped unexpectedly"

**Cause**: Lisa Slayman flag is TRUE in NetSuite when it should be FALSE

**Solution**:
1. Open NetSuite item
2. Verify **Lisa Slayman Item** checkbox is UNCHECKED
3. Save item
4. Re-run test

### Issue: "Pricing not updating"

**Cause**: Transaction rollback or database permissions

**Solution**:
```sql
-- Check for recent updates
SELECT * FROM T_PRODUCT_PRICE 
WHERE product_id = <your_product_id> 
ORDER BY date DESC 
LIMIT 5;

-- Check database permissions
SHOW GRANTS FOR CURRENT_USER();
```

### Issue: "API server connection refused"

**Cause**: Server not running or wrong port

**Solution**:
```bash
# Check if server is running
curl http://localhost:3000/api/health

# Check which port is configured
echo $PORT

# Start server if needed
npm start
```

### Issue: "Webhook secret invalid"

**Cause**: Environment variable not set or mismatch

**Solution**:
```bash
# Check environment variable
echo $NS_TO_OPMS_WEBHOOK_SECRET

# Set if missing
export NS_TO_OPMS_WEBHOOK_SECRET="your-secret-here"

# Update test script if needed
# Edit CONFIG.webhookSecret in 3-manual-sync-test.js
```

---

## 📈 Advanced Testing

### Test Pricing Updates (Incremental Changes)

After initial sync, test incremental pricing changes:

1. **In NetSuite**, update pricing:
   - Base Price Line 1: `$100.00` → `$125.00`
   - Base Price Line 2: `$150.00` → `$175.00`

2. **Re-run sync test**:
   ```bash
   node 3-manual-sync-test.js
   ```

3. **Validate new values**:
   ```sql
   SELECT p_res_cut, p_hosp_roll 
   FROM T_PRODUCT_PRICE 
   WHERE product_id = <your_product_id>;
   ```

Expected: Values updated to `$125.00` and `$175.00`

### Test Concurrent Updates

Test transaction safety with concurrent sync attempts:

```bash
# Terminal 1
node 3-manual-sync-test.js

# Terminal 2 (simultaneously)
node 3-manual-sync-test.js
```

Expected: Both complete successfully with proper transaction isolation

### Test Negative Margins

Test business validation warnings:

1. **In NetSuite**, set problematic pricing:
   - Base Price Line 1: `$10.00` (lower than cost)
   - Cost: `$40.00` (higher than price)

2. **Run sync** - should succeed but log warnings

3. **Check validation query**:
   ```sql
   -- Run Query 8 from 4-validate-sync-results.sql
   -- Should show negative margin warning
   ```

---

## 🔐 Production Safety

### Safe Testing Practices

✅ **Use opmsAPI- prefix** for all test items  
✅ **Test on non-business-hours** to minimize risk  
✅ **Backup before testing** (optional but recommended)  
✅ **Clean up immediately** after testing  
✅ **Document test results** for audit trail

### What NOT To Do

❌ Never test on production items without `opmsAPI-` prefix  
❌ Never skip the cleanup step  
❌ Never disable transaction wrapping  
❌ Never test during peak business hours  
❌ Never modify the skip logic without thorough testing

---

## 📚 Reference Documentation

### Related Specifications

- **Sync Specification**: `DOCS/ai-specs/app-technical-specifications/netsuite-to-opms-synchronization-spec.md`
- **Database Specification**: `DOCS/ai-specs/app-technical-specifications/opms-database-spec.md`
- **Application Spec**: `DOCS/ai-specs/app-technical-specifications/app-technical-specifications.md`

### Code References

- **Sync Service**: `src/services/NsToOpmsSyncService.js`
- **Webhook Service**: `src/services/NsToOpmsWebhookService.js`
- **Webhook Route**: `src/routes/ns-to-opms.js`
- **Product Model**: `src/models/ProductModel.js`
- **Item Model**: `src/models/ItemModel.js`

### Database Tables

- **T_PRODUCT**: Parent product records
- **T_ITEM**: Individual item/SKU records
- **T_PRODUCT_PRICE**: Customer pricing
- **T_PRODUCT_PRICE_COST**: Vendor costs
- **T_ITEM_COLOR**: Item-color relationships
- **P_COLOR**: Color master data

---

## ✅ Test Completion Checklist

### Pre-Test:
- [ ] OPMS database accessible
- [ ] NetSuite Administrator access confirmed
- [ ] API server running
- [ ] Environment variables configured

### During Test:
- [ ] OPMS test data created (Step 1)
- [ ] NetSuite test item created (Step 2)
- [ ] All 4 test cases passed (Step 4)
- [ ] Validation queries passed (Step 5)

### Post-Test:
- [ ] OPMS test data cleaned up (Step 6)
- [ ] NetSuite test item deleted
- [ ] Test results documented
- [ ] Any issues reported

---

## 🎯 Success Criteria

### Minimum Requirements:
✅ Test Case 1 (Normal Sync) passes  
✅ Test Case 2 (Skip Logic) passes  
✅ All 4 pricing fields update correctly  
✅ Validation queries show expected values  
✅ No errors in console/logs  
✅ Clean cleanup with no orphaned records

### Gold Standard:
✅ All 4 test cases pass  
✅ Zero validation failures  
✅ Profit margins validated  
✅ Concurrent updates handled correctly  
✅ Full audit trail maintained  
✅ Test completed in under 30 minutes

---

## 📞 Support

### If Tests Fail:

1. **Check logs**: Review API server console output
2. **Run troubleshooting queries**: See Troubleshooting section
3. **Verify configuration**: Double-check all environment variables
4. **Review specifications**: Consult reference documentation
5. **Document findings**: Note exact error messages and context

### For Questions:

- **Sync Logic**: See `NsToOpmsSyncService.js` implementation
- **Database Schema**: See OPMS database specification
- **API Endpoints**: See `ns-to-opms.js` route definitions
- **Field Mappings**: See NetSuite-to-OPMS sync specification

---

## 🎉 Conclusion

This test suite provides **comprehensive validation** of the NetSuite → OPMS pricing synchronization. By following this guide, you can confidently verify that:

- ✅ Pricing data flows correctly from NetSuite to OPMS
- ✅ Lisa Slayman skip logic prevents unwanted syncs
- ✅ Transaction safety protects data integrity
- ✅ Validation catches business logic issues
- ✅ Error handling works in edge cases

**Happy Testing! 🚀**

---

*Last Updated: October 2024*  
*Test Suite Version: 1.0.0*  
*Compatible with: opuzen-api v1.0.0+*

