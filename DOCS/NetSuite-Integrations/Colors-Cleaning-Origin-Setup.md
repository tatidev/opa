# Colors, Cleaning, and Origin Fields Setup

## Overview
This document details the implementation of Colors, Cleaning, and Origin custom fields for NetSuite inventory items, mapping data from the OPMS database.

## NetSuite Custom Fields

### 1. Item Colors Field
- **NetSuite Field ID**: `custitem_opms_item_colors`
- **Field Type**: Free Form Text
- **Purpose**: Stores item colors as comma-separated text list

### 2. Cleaning Field
- **NetSuite Field ID**: `custitem_opms_fabric_cleaning`
- **Field Type**: Free Form Text
- **Purpose**: Stores cleaning instructions as comma-separated text list

### 3. Origin Field
- **NetSuite Field ID**: `custitem_opms_product_origin`
- **Field Type**: Free Form Text
- **Purpose**: Stores product origin information as comma-separated text list

## OPMS Data Sources

### Item Colors Data
- **Primary Source**: `P_COLOR.name` (via `T_ITEM_COLOR` join)
- **Query Pattern**: `GROUP_CONCAT(DISTINCT c.name ORDER BY ic.n_order SEPARATOR ' / ') as color`
- **Transformation**: Converts ' / ' separator to ', ' for NetSuite
- **Example Values**: "Red, Blue, Green" (from "Red / Blue / Green")

### Cleaning Data
- **Primary Source**: `P_CLEANING.name` (via `T_PRODUCT_CLEANING` join)
- **Query Pattern**: `GROUP_CONCAT(DISTINCT cl.name ORDER BY cl.name SEPARATOR ', ') as cleaning_names`
- **Example Values**: "Dry Clean Only, Professional Cleaning, Steam Clean"

### Origin Data
- **Primary Source**: `P_ORIGIN.name` (via `T_PRODUCT_ORIGIN` join)
- **Query Pattern**: `GROUP_CONCAT(DISTINCT o.name ORDER BY o.name SEPARATOR ', ') as origin_names`
- **Example Values**: "USA, Italy, France"

## Implementation Details

### Database Queries
All three fields are included in `ItemModel.getItemInfoForTag()` and `ItemModel.getItemDetails()`:

```sql
-- Colors field (GROUP_CONCAT from P_COLOR with order)
GROUP_CONCAT(DISTINCT c.name ORDER BY ic.n_order SEPARATOR ' / ') as color,

-- Cleaning field (GROUP_CONCAT from P_CLEANING)
GROUP_CONCAT(DISTINCT cl.name ORDER BY cl.name SEPARATOR ', ') as cleaning_names,

-- Origin field (GROUP_CONCAT from P_ORIGIN)
GROUP_CONCAT(DISTINCT o.name ORDER BY o.name SEPARATOR ', ') as origin_names,

-- Required JOINs
LEFT JOIN T_ITEM_COLOR ic ON i.id = ic.item_id
LEFT JOIN P_COLOR c ON ic.color_id = c.id
LEFT JOIN T_PRODUCT_CLEANING pcl ON p.id = pcl.product_id
LEFT JOIN P_CLEANING cl ON pcl.cleaning_id = cl.id
LEFT JOIN T_PRODUCT_ORIGIN po ON p.id = po.product_id
LEFT JOIN P_ORIGIN o ON po.origin_id = o.id
```

### API Field Name Support
The transformation layer supports both API and OPMS field names:

**Item Colors Field**:
- API field name: `itemColors`
- OPMS field name: `color` (with separator conversion)

**Cleaning Field**:
- API field name: `cleaning`
- OPMS field name: `cleaning_names`

**Origin Field**:
- API field name: `origin`
- OPMS field name: `origin_names`

### RESTlet Implementation
The NetSuite RESTlet handles all three fields with comprehensive error handling:

```javascript
// Set Item Colors field
if (requestBody.itemColors && requestBody.itemColors !== '') {
    setFieldValue(inventoryItem, 'custitem_opms_item_colors', requestBody.itemColors);
}

// Set Cleaning field
if (requestBody.cleaning && requestBody.cleaning !== '') {
    setFieldValue(inventoryItem, 'custitem_opms_fabric_cleaning', requestBody.cleaning);
}

// Set Origin field
if (requestBody.origin && requestBody.origin !== '') {
    setFieldValue(inventoryItem, 'custitem_opms_product_origin', requestBody.origin);
}
```

### Separator Conversion
Special handling for OPMS color format:

```javascript
// Convert OPMS ' / ' separator to NetSuite ', ' format
if (itemData.color) {
    payload.itemColors = itemData.color.replace(/ \/ /g, ', ');
}
```

## Testing

### Test Coverage
- **API Field Names**: Tests using `itemColors`, `cleaning`, `origin`
- **OPMS Field Names**: Tests using `color`, `cleaning_names`, `origin_names`
- **Separator Conversion**: Tests OPMS ' / ' to ', ' transformation
- **Integration Tests**: End-to-end NetSuite item creation

### Test Results
✅ **VERIFIED**: All three fields successfully populate in NetSuite
- NetSuite ID 6360: API field names test
- NetSuite ID 6361: OPMS field names test

## Status
- **Implementation**: ✅ **COMPLETED**
- **Testing**: ✅ **VERIFIED**
- **Documentation**: ✅ **COMPLETE**

## Related Files
- `src/models/ItemModel.js` - Database queries with new JOINs
- `src/services/netsuiteRestletService.js` - Field transformation and separator conversion
- `netsuite-scripts/CreateInventoryItemRestlet.js` - NetSuite field setting and read-back
- `scripts/test-colors-cleaning-origin.js` - Integration tests