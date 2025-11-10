# Vendor Fields Setup - NetSuite Integration

## Overview
This document details the implementation of vendor-related fields for OPMS → NetSuite integration.

## Vendor Fields Mapping

| OPMS Source | OPMS Table.Field | NetSuite Field ID | NetSuite Field Type | Status |
|---|---|---|---|---|
| Vendor Business Name | Z_VENDOR.name | custitem_opms_vendor_name | Text | ✅ **IMPLEMENTED** |
| Vendor Product Name | T_PRODUCT_VARIOUS.vendor_product_name | custitem_opms_vendor_prod_name | Text | ✅ **IMPLEMENTED** |
| Vendor Item Color | T_ITEM.vendor_color | custitem_opms_vendor_color | Text | ✅ **IMPLEMENTED** |
| Vendor Item Code | T_ITEM.vendor_code | custitem_opms_vendor_color_cod | Text | ✅ **IMPLEMENTED** |

## Database Schema

### Vendor Business Name
- **Source**: `Z_VENDOR.name`
- **Relationship**: `T_PRODUCT` → `T_PRODUCT_VENDOR` → `Z_VENDOR`
- **Join Path**: 
  ```sql
  LEFT JOIN T_PRODUCT_VENDOR pven ON p.id = pven.product_id
  LEFT JOIN Z_VENDOR v ON pven.vendor_id = v.id
  ```

### Vendor Product Name
- **Source**: `T_PRODUCT_VARIOUS.vendor_product_name`
- **Relationship**: `T_PRODUCT` → `T_PRODUCT_VARIOUS`
- **Join Path**:
  ```sql
  LEFT JOIN T_PRODUCT_VARIOUS pv ON pv.product_id = p.id
  ```

### Vendor Item Color & Code
- **Source**: `T_ITEM.vendor_color`, `T_ITEM.vendor_code`
- **Relationship**: Direct fields on `T_ITEM` table
- **Access**: Direct field access on item record

## Implementation Details

### ItemModel Updates
All vendor fields added to:
- `getItemInfoForTag()` - both regular and digital product queries
- `getItemDetails()` - comprehensive item details query

### Service Layer
- **Dual Field Name Support**: Handles both API field names (`vendorName`) and OPMS database field names (`vendor_name`)
- **Transformation**: `transformToRestletPayload()` maps all vendor fields correctly

### NetSuite RESTlet
- **Field Setting**: All 4 vendor fields with comprehensive error handling
- **Logging**: Detailed debug logs for troubleshooting
- **Verification**: Read-back confirmation for all vendor fields

## Testing

### Test Coverage
- ✅ API field names (`vendorName`, `vendorProductName`, etc.)
- ✅ OPMS database field names (`vendor_name`, `vendor_product_name`, etc.)
- ✅ End-to-end NetSuite integration

### Test Results
- **NetSuite ID 6160**: API field names test - ✅ PASSED
- **NetSuite ID 6061**: OPMS field names test - ✅ PASSED

### Test Script
```bash
node scripts/test-vendor-fields.js
```

## NetSuite Custom Fields Required

The following custom fields must be created in NetSuite:

1. **custitem_opms_vendor_name**
   - Type: Free-Form Text
   - Label: "OPMS Vendor Name"
   - Length: 40 characters (matching Z_VENDOR.name)

2. **custitem_opms_vendor_prod_name**
   - Type: Free-Form Text
   - Label: "OPMS Vendor Product Name"
   - Length: 50 characters (matching T_PRODUCT_VARIOUS.vendor_product_name)

3. **custitem_opms_vendor_color**
   - Type: Free-Form Text
   - Label: "OPMS Vendor Color"
   - Length: 50 characters (matching T_ITEM.vendor_color)

4. **custitem_opms_vendor_color_cod**
   - Type: Free-Form Text
   - Label: "OPMS Vendor Color Code"
   - Length: 50 characters (matching T_ITEM.vendor_code)

## Usage Examples

### API Call with Vendor Fields
```javascript
const itemData = {
  itemId: "TEST-VENDOR-001",
  vendorName: "Acme Textiles Inc",
  vendorProductName: "Premium Cotton Series",
  vendorColor: "Navy Blue",
  vendorCode: "ACM-NB-001"
};
```

### OPMS Database Structure
```javascript
const opmsData = {
  code: "ITEM-001",
  vendor_name: "Global Fabrics Ltd",
  vendor_product_name: "Luxury Collection",
  vendor_color: "Charcoal Grey",
  vendor_code: "GFL-CG-001"
};
```

## Notes
- All vendor fields are optional
- Empty/null values are handled gracefully
- Comprehensive logging helps with troubleshooting
- Both API and OPMS field name formats are supported for maximum compatibility