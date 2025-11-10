# Finish and Fabric Width Fields Setup

## Overview
This document details the implementation of Finish and Fabric Width custom fields for NetSuite inventory items, mapping data from the OPMS database.

## NetSuite Custom Fields

### 1. Finish Field
- **NetSuite Field ID**: `custitem_opms_finish`
- **Field Type**: Free Form Text
- **Purpose**: Stores finish information from OPMS as comma-separated text

### 2. Fabric Width Field
- **NetSuite Field ID**: `custitem_opms_fabric_width`
- **Field Type**: Free Form Text
- **Purpose**: Stores fabric width measurements from OPMS

## OPMS Data Sources

### Finish Data
- **Primary Source**: `P_FINISH.name` (via `T_PRODUCT_FINISH` join)
- **Query Pattern**: `GROUP_CONCAT(DISTINCT f.name ORDER BY f.name SEPARATOR ', ') as finish_names`
- **Example Values**: "Scotchgard Protection, Stain Resistant, Anti-Microbial"

### Fabric Width Data
- **Primary Source**: `T_PRODUCT.width`
- **Data Type**: Decimal values (e.g., "54.00", "60.00")
- **Example Values**: "54.00", "60.00", "72.00"

## Implementation Details

### Database Queries
Both fields are included in `ItemModel.getItemInfoForTag()` and `ItemModel.getItemDetails()`:

```sql
-- Finish field (GROUP_CONCAT from P_FINISH)
GROUP_CONCAT(DISTINCT f.name ORDER BY f.name SEPARATOR ', ') as finish_names,

-- Fabric Width field (direct from T_PRODUCT)
p.width as width,

-- Required JOINs for Finish
LEFT JOIN T_PRODUCT_FINISH pf ON p.id = pf.product_id
LEFT JOIN P_FINISH f ON pf.finish_id = f.id
```

### API Field Name Support
The transformation layer supports both API and OPMS field names:

**Finish Field**:
- API field name: `finish`
- OPMS field name: `finish_names`

**Fabric Width Field**:
- API field name: `fabricWidth`
- OPMS field name: `width`

### RESTlet Implementation
The NetSuite RESTlet handles both fields with comprehensive error handling:

```javascript
// Set Finish field
if (requestBody.finish && requestBody.finish !== '') {
    setFieldValue(inventoryItem, 'custitem_opms_finish', requestBody.finish);
}

// Set Fabric Width field
if (requestBody.fabricWidth && requestBody.fabricWidth !== '') {
    setFieldValue(inventoryItem, 'custitem_opms_fabric_width', requestBody.fabricWidth);
}
```

## Testing

### Test Coverage
- **API Field Names**: Tests using `finish` and `fabricWidth`
- **OPMS Field Names**: Tests using `finish_names` and `width`
- **Integration Tests**: End-to-end NetSuite item creation

### Test Results
✅ **VERIFIED**: Both fields successfully populate in NetSuite
- NetSuite ID 6259: API field names test
- NetSuite ID 6163: OPMS field names test

## Status
- **Implementation**: ✅ **COMPLETED**
- **Testing**: ✅ **VERIFIED**
- **Documentation**: ✅ **COMPLETE**

## Related Files
- `src/models/ItemModel.js` - Database queries
- `src/services/netsuiteRestletService.js` - Field transformation
- `netsuite-scripts/CreateInventoryItemRestlet.js` - NetSuite field setting
- `scripts/test-finish-fabric-width.js` - Integration tests