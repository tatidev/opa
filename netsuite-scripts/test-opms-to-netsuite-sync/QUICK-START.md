# 🚀 Quick Start - OPMS to NetSuite Sync Testing

## TL;DR - 5 Commands to Complete Testing

```bash
# Navigate to test directory
cd netsuite-scripts/test-opms-to-netsuite-sync

# 1. Setup OPMS test data (identify test items)
mysql -h <host> -u <user> -p <database> < 1-setup-opms-test-data.sql

# 2. Run complete test suite
./run-tests.sh

# 3. Review results
cat test-results.json

# 4. Validate NetSuite results (optional)
node 3-validate-netsuite-results.js

# 5. Cleanup test data (optional)
node 4-cleanup-test-data.js
```

## Or Use The Automated Script

```bash
# Run everything (interactive)
./run-tests.sh

# Run only tests (skip setup and cleanup)
./run-tests.sh --test-only

# Run without cleanup
./run-tests.sh --no-cleanup

# Get help
./run-tests.sh --help
```

## Prerequisites

### Required Environment Variables:
```bash
# API Configuration
export API_BASE_URL=http://localhost:3000

# OPMS Database (for test data setup)
export OPMS_DB_HOST=your_opms_host
export OPMS_DB_USER=your_opms_user
export OPMS_DB_PASSWORD=your_opms_password
export OPMS_DB_NAME=your_opms_database

# NetSuite OAuth (configured in API server)
# These should already be set in your API server environment
```

### Required Software:
- ✅ Node.js 18+
- ✅ MySQL client (for test data setup)
- ✅ API server running on localhost:3000
- ✅ Production NetSuite access

## Expected Results

### Test Output:
```
🔄 OPMS to NetSuite Sync Test Runner
====================================
API Base URL: http://localhost:3000
Test Results: test-results.json

📋 Step 1: Validating API Connectivity
✅ API server is running
   Status: 200
   Response: {"status":"healthy","timestamp":"2025-01-15T10:30:00.000Z"}

📋 Step 2: Loading Test Items from OPMS
⚠️  WARNING: Using placeholder test items
   Please run 1-setup-opms-test-data.sql to get real item IDs
   and update the TEST_ITEMS object in this script

✅ Test items loaded (placeholder data)

📋 Step 3: Executing Test Cases

🧪 TEST CASE: Complete Item Sync
   Description: Test full synchronization with all fields populated
   Testing item ID: 13385
   ✅ NetSuite item created: opmsAPI-TEST-001
✅ Complete Item Sync: PASSED

🧪 TEST CASE: "src empty data" Handling
   Description: Test field validation for missing optional data
   Testing item ID: 13386 (with missing data)
   ✅ NetSuite item created with "src empty data" handling: opmsAPI-TEST-002
✅ "src empty data" Handling: PASSED

🧪 TEST CASE: Multiple Colors
   Description: Test color handling and display name format
   Testing item ID: 13387 (multiple colors)
   ✅ Display name format correct: "Tranquil: Ash, Fiesta"
✅ Multiple Colors: PASSED

🧪 TEST CASE: Vendor Mapping
   Description: Test vendor sublist population
   Testing item ID: 13385 (vendor mapping)
   ✅ Vendor mapping successful: 340
✅ Vendor Mapping: PASSED

🧪 TEST CASE: Mini-Forms Content
   Description: Test rich content field transformation
   Testing item ID: 13388 (mini-forms content)
   ✅ Mini-forms content processed: opmsAPI-TEST-005
✅ Mini-Forms Content: PASSED

🧪 TEST CASE: Error Handling
   Description: Test error scenarios
   Testing invalid item ID: 999999 (error handling)
   ✅ Error handling correct: Item not found in OPMS database
✅ Error Handling: PASSED

📋 Step 4: Generating Test Report

📊 TEST SUMMARY
================
Total Tests: 6
Passed: 6
Failed: 0
Skipped: 0
Duration: 15420ms

🎉 ALL TESTS PASSED!
📄 Detailed results saved to: test-results.json
```

### Validation Output:
```
🔍 NetSuite Results Validation
==============================
API Base URL: http://localhost:3000
Test Results: test-results.json

📋 Step 1: Loading Test Results
✅ Loaded test results: 6 tests

📋 Step 2: Extracting NetSuite Item IDs
✅ Found 5 NetSuite items to validate

📋 Step 3: Validating NetSuite Items

🔍 Validating: Complete Item Sync
   NetSuite Item ID: opmsAPI-TEST-001
   OPMS Item ID: 13385
   ✅ Item exists in NetSuite
   ✅ Display name format correct: "Tranquil: Ash"
   ✅ Vendor sublist populated (1 entries)
   ✅ Custom fields populated (7/7)
   ✅ Field values match OPMS data
   ✅ Validation passed

🔍 Validating: "src empty data" Handling
   NetSuite Item ID: opmsAPI-TEST-002
   OPMS Item ID: 13386
   ✅ Item exists in NetSuite
   ✅ Display name format correct: "Berba: Fiesta"
   ✅ Vendor sublist populated (1 entries)
   ✅ Custom fields populated (5/7)
   ✅ Field values match OPMS data
   ✅ Validation passed

📊 VALIDATION SUMMARY
=====================
Total Validations: 5
Passed: 5
Failed: 0
Duration: 8230ms

🎉 ALL VALIDATIONS PASSED!
📄 Detailed results saved to: validation-results.json
```

## What Gets Tested

✅ **Complete Item Sync**: All 25+ fields from OPMS → NetSuite  
✅ **"src empty data" Handling**: Missing fields show "src empty data"  
✅ **Display Name Format**: "Product: Color" (colon separator)  
✅ **Vendor Mapping**: ItemVendor sublist populated correctly  
✅ **Mini-Forms Content**: Rich content fields transformed  
✅ **Error Handling**: Invalid items handled gracefully  
✅ **Field Validation**: All custom fields populated or marked empty  
✅ **Authentication**: OAuth 1.0a with production NetSuite  

## Test Data Safety

All test data uses `opmsAPI-` prefix:
- **NetSuite Items**: `opmsAPI-TEST-001`, `opmsAPI-TEST-002`, etc.
- **Easy Cleanup**: Single pattern `opmsAPI-*` cleans all test items
- **Production Safe**: No risk of affecting real business data
- **Reversible**: All test data can be safely removed

## Troubleshooting

### Common Issues:

| Issue | Solution |
|-------|----------|
| **API not responding** | Ensure API server is running on localhost:3000 |
| **Database connection failed** | Check OPMS database environment variables |
| **NetSuite authentication failed** | Verify OAuth credentials in API server |
| **No test items found** | Run 1-setup-opms-test-data.sql to identify items |
| **Tests fail with 404** | Update TEST_ITEMS with real OPMS item IDs |

### Debug Commands:
```bash
# Check API server status
curl http://localhost:3000/health

# Test NetSuite connection
curl -X POST http://localhost:3000/api/netsuite/test-connection

# Check OPMS database
mysql -h <host> -u <user> -p <database> -e "SELECT COUNT(*) FROM T_ITEM WHERE archived = 'N';"

# View detailed logs
tail -f test-execution.log
```

## Next Steps

After successful testing:

1. **Review Results**: Check `test-results.json` and `validation-results.json`
2. **Deploy to Live**: Deploy API server to production environment
3. **Monitor Sync**: Watch for real OPMS changes syncing to NetSuite
4. **Cleanup**: Remove test data when no longer needed

## Support

- **Documentation**: See `README.md` for complete details
- **Logs**: Check `test-execution.log` for detailed execution logs
- **Results**: Review JSON result files for detailed test data
- **Issues**: Check individual test case failures in result files



