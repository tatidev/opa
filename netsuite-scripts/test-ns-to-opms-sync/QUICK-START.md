# 🚀 Quick Start - NetSuite to OPMS Sync Testing

## TL;DR - 5 Commands to Complete Testing

```bash
# Navigate to test directory
cd netsuite-scripts/test-ns-to-opms-sync

# 1. Setup OPMS test data
mysql -h <host> -u <user> -p <database> < 1-setup-opms-test-data.sql

# 2. Create NetSuite item (follow guide in 2-netsuite-test-item-setup-guide.md)
#    Item ID: opmsAPI-SYNC-TEST-001
#    Pricing: $100/$150/$40/$50

# 3. Run sync tests
node 3-manual-sync-test.js

# 4. Validate results
mysql -h <host> -u <user> -p <database> < 4-validate-sync-results.sql

# 5. Cleanup
mysql -h <host> -u <user> -p <database> < 6-cleanup-test-data.sql
```

## Or Use The Automated Script

```bash
# Run everything (interactive)
./run-tests.sh

# Skip OPMS setup if already done
./run-tests.sh --skip-setup

# Only cleanup
./run-tests.sh --cleanup
```

## Expected Results

### Test Output:
```
✅ TEST CASE 1: PASSED - Normal Pricing Sync
✅ TEST CASE 2: PASSED - Lisa Slayman Skip Logic
✅ TEST CASE 3: PASSED - Invalid Data Handling
✅ TEST CASE 4: PASSED - Missing Item Handling

FINAL RESULT: 4/4 tests passed
🎉 ALL TESTS PASSED!
```

### Validation Output:
```
Field: Customer Cut Price (p_res_cut)
Actual: $100.00 | Expected: $100.00 | Result: ✅ PASS

Field: Customer Roll Price (p_hosp_roll)
Actual: $150.00 | Expected: $150.00 | Result: ✅ PASS

Field: Vendor Cut Cost (cost_cut)
Actual: $40.00 | Expected: $40.00 | Result: ✅ PASS

Field: Vendor Roll Cost (cost_roll)
Actual: $50.00 | Expected: $50.00 | Result: ✅ PASS

✅ ALL VALIDATIONS PASSED
```

## What Gets Tested

✅ **Pricing Sync**: 4 fields from NetSuite → OPMS  
✅ **Skip Logic**: Lisa Slayman flag prevents unwanted syncs  
✅ **Validation**: Data type and business rule checking  
✅ **Error Handling**: Missing items, invalid data  
✅ **Transactions**: Atomic updates with rollback safety

## Test Data Isolation

All test data uses `opmsAPI-` prefix:
- Product: `opmsAPI-SYNC-TEST-PRODUCT`
- Item: `opmsAPI-SYNC-TEST-001`

**100% safe to delete** - no risk to production data.

## Time Required

- Setup: 5 minutes
- NetSuite item creation: 10 minutes
- Running tests: 5 minutes
- Validation: 5 minutes
- Cleanup: 2 minutes

**Total: ~30 minutes**

## Troubleshooting

### "OPMS item not found"
→ Verify NetSuite `itemid` exactly matches `opmsAPI-SYNC-TEST-001`

### "Sync skipped unexpectedly"
→ Check Lisa Slayman Item checkbox is UNCHECKED in NetSuite

### "API connection refused"
→ Start API server: `npm start`

### "Pricing doesn't match"
→ Run validation queries to see actual vs expected values

## Need More Details?

See `README.md` for comprehensive documentation.

## 🎉 Success = All Green Checkmarks

If all tests show ✅, your sync is working perfectly!

