# Parent Product Name Field Setup

## Overview
This document details the implementation of the Parent Product Name custom field for NetSuite inventory items, mapping data from the OPMS database.

## NetSuite Custom Field

### Parent Product Name Field
- **NetSuite Field ID**: `custitem_opms_parent_product_name`
- **Field Type**: Free Form Text
- **Purpose**: Stores the parent product name from OPMS T_PRODUCT table

## OPMS Data Source

### Parent Product Name Data
- **Primary Source**: `T_PRODUCT.name`
- **Query Pattern**: `p.name as product_name` (already available in existing queries)
- **Example Values**: "Luxury Fabric Collection Series A", "Premium Textile Collection Series B"

## Implementation Details

### Database Queries
The parent product name field leverages existing data already selected in `ItemModel` queries:

```sql
-- Parent Product Name (already available in existing queries)
IF(i.code IS NULL, CONCAT_WS(' ', v.abrev, p.name), p.name) as product_name,

-- The field is available from the existing T_PRODUCT join
LEFT JOIN T_PRODUCT p ON i.product_id = p.id
```

**Note**: No additional database changes were required as `T_PRODUCT.name` was already being selected as `product_name` in all relevant queries.

### API Field Name Support
The transformation layer supports both API and OPMS field names:

**Parent Product Name Field**:
- API field name: `parentProductName`
- OPMS field name: `product_name` (T_PRODUCT.name)

### RESTlet Implementation
The NetSuite RESTlet handles the field with comprehensive error handling:

```javascript
// Set Parent Product Name field
if (requestBody.parentProductName && requestBody.parentProductName !== '') {
    setFieldValue(inventoryItem, 'custitem_opms_parent_product_name', requestBody.parentProductName);
}
```

### Transformation Logic
```javascript
// Add Parent Product Name field - support both API and OPMS field names
if (itemData.parentProductName) {
  // Direct API field name
  payload.parentProductName = itemData.parentProductName;
} else if (itemData.product_name) {
  // OPMS database field name (T_PRODUCT.name)
  payload.parentProductName = itemData.product_name;
}
```

## Testing

### Test Coverage
- **API Field Names**: Tests using `parentProductName`
- **OPMS Field Names**: Tests using `product_name` (T_PRODUCT.name)
- **Integration Tests**: End-to-end NetSuite item creation

### Test Results
✅ **VERIFIED**: Parent Product Name field successfully populates in NetSuite
- NetSuite ID 6459: API field names test
- NetSuite ID 6460: OPMS field names test

## Status
- **Implementation**: ✅ **COMPLETED**
- **Testing**: ✅ **VERIFIED**
- **Documentation**: ✅ **COMPLETE**

## Related Files
- `src/services/netsuiteRestletService.js` - Field transformation
- `netsuite-scripts/CreateInventoryItemRestlet.js` - NetSuite field setting and read-back
- `scripts/test-parent-product-name.js` - Integration tests

## Notes
- This field leverages existing `T_PRODUCT.name` data already available in ItemModel queries
- No additional database JOINs were required
- The field provides direct access to the parent product name for NetSuite reporting and display