# OPMS-to-NetSuite Synchronization Tests

## ⚠️ PRODUCTION ENVIRONMENT ⚠️

**Environment**: Production OPMS database → Production NetSuite
**Branch**: deployProd
**Purpose**: Test actual CRUD operations for item synchronization

## Test Suite (5 Tests)

### 1. Data Transformation Test
**File**: `test-1-data-transformation.js`
- Validates OPMS data extraction and transformation to NetSuite payload
- Tests field mapping, validation, and "src empty data" pattern
- Verifies all 25+ fields are correctly populated

### 2. Display Name Format Test
**File**: `test-2-display-name-format.js`
- Validates display names use "Product: Color" format (not dash separator)
- Tests with multiple items from OPMS database
- Confirms colon separator convention

### 3. Queue Status Test
**File**: `test-3-queue-status.js`
- Checks sync queue health and statistics
- Validates queue processing is active
- Reviews success/failure rates and pending jobs

### 4. Vendor Mapping Test
**File**: `test-4-vendor-mapping.js`
- Validates vendor mappings exist and are correct
- Checks NetSuite vendor IDs are valid
- Tests itemvendor sublist population logic

### 5. Single Item Sync Test (CREATES TEST ITEM)
**File**: `test-5-single-item-sync.js`
- **CREATES 1 TEST ITEM IN NETSUITE**
- End-to-end sync validation
- Tests complete workflow: OPMS → Transform → Queue → NetSuite
- Uses `opmsAPI-TEST-` prefix for easy cleanup

## Running Tests

```bash
# Individual tests
node netsuite-scripts/test-opms-to-netsuite-sync/test-1-data-transformation.js
node netsuite-scripts/test-opms-to-netsuite-sync/test-2-display-name-format.js
node netsuite-scripts/test-opms-to-netsuite-sync/test-3-queue-status.js
node netsuite-scripts/test-opms-to-netsuite-sync/test-4-vendor-mapping.js
node netsuite-scripts/test-opms-to-netsuite-sync/test-5-single-item-sync.js
```

## Cleanup

Test items created in NetSuite will have `opmsAPI-TEST-` prefix.
Search NetSuite for "opmsAPI-TEST-" to find and delete test items.

## Safety

- All test items use `opmsAPI-TEST-` naming convention
- Test 5 creates exactly 1 item in NetSuite
- Tests validate actual production sync functionality
