# NetSuite Testing Tools

This directory contains tools and test data for NetSuite integration testing.

## Scripts

### `check-remaining.js`
**Purpose**: Dry-run check to verify remaining `opmsAPI-` prefixed items in NetSuite  
**Usage**: `node check-remaining.js`  
**Output**: Lists all remaining test items without deleting them

### `delete-all-opmsapi.js`  
**Purpose**: Comprehensive deletion tool with multi-round cleanup capability  
**Usage**: `node delete-all-opmsapi.js`  
**Features**: 
- Handles large batches with multiple deletion rounds
- Comprehensive error handling and logging
- Continues until all items are removed

## Test Data

### `test-100-items.csv`
**Purpose**: Large test dataset with 100 real OPMS items  
**Structure**: Complete NetSuite field structure with all 28 columns  
**Usage**: For comprehensive CSV import testing and performance validation

### `test-20-items.csv`
**Purpose**: Smaller test dataset for quick testing  
**Structure**: Same complete field structure as 100-item file  
**Usage**: For rapid testing cycles and development validation

## Usage Notes

- All test items use `opmsAPI-` prefix for easy identification and cleanup
- Scripts connect to NetSuite via the configured RESTlet service
- CSV files contain real OPMS data with full mini-forms HTML content
- Always run `check-remaining.js` before and after testing to verify cleanup

## Test Item Naming Convention

All NetSuite test items MUST use `opmsAPI-` prefix:
- ✅ `opmsAPI-1234-5678`
- ✅ `opmsAPI-MANUAL-TEST-001`
- ❌ `TEST-1234` (missing prefix)

This ensures easy cleanup and prevents accidental deletion of production items.
