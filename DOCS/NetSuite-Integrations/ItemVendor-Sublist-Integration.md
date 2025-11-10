# NetSuite ItemVendor Sublist Integration

## Overview

The **itemvendor sublist** is NetSuite's native mechanism for associating multiple vendors with inventory items. This document provides comprehensive guidance for integrating OPMS vendor data with NetSuite's itemvendor sublist functionality.

## Prerequisites

### NetSuite Configuration
1. **Multiple Vendors Feature**: Must be enabled at the company level
   - Navigate to: Setup → Company → Enable Features → Items & Inventory
   - Enable: "Multiple Vendors"
   - This feature enables the `itemvendor` sublist on inventory items

2. **Vendor Records**: All vendors must exist as proper NetSuite vendor records
   - Each vendor needs a valid internal ID
   - Vendor names must match between OPMS and NetSuite for accurate mapping

### Database Requirements
- **Vendor Mapping Table**: `opms_netsuite_vendor_mapping`
  ```sql
  CREATE TABLE opms_netsuite_vendor_mapping (
    id INT AUTO_INCREMENT PRIMARY KEY,
    opms_vendor_id INT NOT NULL,
    opms_vendor_name VARCHAR(255) NOT NULL,
    netsuite_vendor_id INT NOT NULL,
    netsuite_vendor_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_opms_vendor (opms_vendor_id),
    UNIQUE KEY unique_netsuite_vendor (netsuite_vendor_id)
  );
  ```

## RESTlet Implementation

### Critical RESTlet Code
The following SuiteScript code must be included in your NetSuite RESTlet for proper itemvendor sublist population:

```javascript
// CRITICAL: ADD VENDOR TO ITEMVENDOR SUBLIST
log.debug('CreateInventoryItemRestlet', '🔄 Processing Vendor Sublist (itemvendor)...');
if (requestBody.vendor) {
    var vendorId = parseInt(requestBody.vendor);
    if (!isNaN(vendorId) && vendorId > 0) {
        log.debug('CreateInventoryItemRestlet', '✓ Adding vendor to itemvendor sublist: ' + vendorId);
        try {
            // Add line to itemvendor sublist
            inventoryItem.selectNewLine({ sublistId: 'itemvendor' });
            
            // Set vendor ID (required field)
            inventoryItem.setCurrentSublistValue({
                sublistId: 'itemvendor',
                fieldId: 'vendor',
                value: vendorId
            });
            log.debug('CreateInventoryItemRestlet', '✓ Set vendor field in sublist: ' + vendorId);
            
            // Set vendor code if provided
            if (requestBody.vendorcode) {
                inventoryItem.setCurrentSublistValue({
                    sublistId: 'itemvendor',
                    fieldId: 'vendorcode',
                    value: requestBody.vendorcode
                });
                log.debug('CreateInventoryItemRestlet', '✓ Set vendorcode in sublist: ' + requestBody.vendorcode);
            }
            
            // Set as preferred vendor
            inventoryItem.setCurrentSublistValue({
                sublistId: 'itemvendor',
                fieldId: 'preferredvendor',
                value: true
            });
            log.debug('CreateInventoryItemRestlet', '✓ Set preferredvendor to true');
            
            // Commit the sublist line
            inventoryItem.commitLine({ sublistId: 'itemvendor' });
            log.debug('CreateInventoryItemRestlet', '✅ Vendor sublist line committed successfully');
            
        } catch (sublistError) {
            log.error('CreateInventoryItemRestlet', '❌ Error adding vendor to sublist: ' + sublistError.toString());
        }
    } else {
        log.debug('CreateInventoryItemRestlet', '⚠️ Invalid vendor ID for sublist, skipping: ' + requestBody.vendor);
    }
} else {
    log.debug('CreateInventoryItemRestlet', '⚠️ No vendor provided for sublist');
}
```

### Key RESTlet Fields
The RESTlet expects these fields in the payload for vendor integration:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `vendor` | Integer | Yes | NetSuite vendor internal ID |
| `vendorname` | String | No | Vendor name (for native vendor field) |
| `vendorcode` | String | No | Vendor-specific product code |

## API Integration

### Vendor Validation Service
Use the `VendorValidationService` to ensure proper vendor mapping:

```javascript
const VendorValidationService = require('../src/services/vendorValidationService');

// Validate and get NetSuite vendor ID
const vendorData = { id: opmsVendorId, name: opmsVendorName };
const netsuiteVendorId = await vendorService.getNetSuiteVendorId(vendorData);

if (netsuiteVendorId) {
    payload.vendor = netsuiteVendorId;
    payload.vendorname = opmsVendorName;
} else {
    // Handle unmapped vendor (item will import without vendor association)
    logger.warn(`No NetSuite mapping found for OPMS vendor: ${opmsVendorName}`);
}
```

### Payload Structure
Example payload for NetSuite RESTlet with vendor data:

```javascript
const payload = {
    itemId: "EXPORT-3600-0002",
    description: "OPMS Item 120 - Wimbledon Velvet",
    displayname: "Wimbledon Velvet - Barley",
    vendor: 591,  // NetSuite vendor internal ID
    vendorname: "Harper Home",  // OPMS vendor name
    vendorcode: "HH-3600-0002",  // Optional vendor product code
    // ... other item fields
};
```

## Data Flow

### OPMS → NetSuite Vendor Integration

1. **Extract OPMS Vendor Data**
   ```sql
   SELECT v.id, v.name 
   FROM Z_VENDOR v 
   JOIN T_PRODUCT_VENDOR pv ON v.id = pv.vendor_id 
   WHERE pv.product_id = ?
   ```

2. **Lookup NetSuite Mapping**
   ```sql
   SELECT netsuite_vendor_id, netsuite_vendor_name 
   FROM opms_netsuite_vendor_mapping 
   WHERE opms_vendor_id = ? AND opms_vendor_name = ?
   ```

3. **Build Payload with Vendor Data**
   - Include `vendor` (NetSuite ID) for itemvendor sublist
   - Include `vendorname` for native vendor field
   - Include `vendorcode` if available

4. **Send to NetSuite RESTlet**
   - RESTlet populates itemvendor sublist
   - Sets vendor as preferred vendor
   - Commits sublist line

## Vendor Mapping Management

### Creating Vendor Mappings
```javascript
// Example: Create mapping for Harper Home
const mapping = {
    opms_vendor_id: 160,
    opms_vendor_name: "Harper Home",
    netsuite_vendor_id: 591,
    netsuite_vendor_name: "Harper Home"
};

await db.query(`
    INSERT INTO opms_netsuite_vendor_mapping 
    (opms_vendor_id, opms_vendor_name, netsuite_vendor_id, netsuite_vendor_name) 
    VALUES (?, ?, ?, ?)
`, [mapping.opms_vendor_id, mapping.opms_vendor_name, mapping.netsuite_vendor_id, mapping.netsuite_vendor_name]);
```

### Validating Vendor Mappings
```javascript
// Check for mapping accuracy
const query = `
    SELECT 
        m.opms_vendor_id,
        m.opms_vendor_name,
        m.netsuite_vendor_id,
        m.netsuite_vendor_name,
        CASE 
            WHEN m.opms_vendor_name = m.netsuite_vendor_name THEN 'MATCH'
            ELSE 'MISMATCH'
        END as mapping_status
    FROM opms_netsuite_vendor_mapping m
    WHERE m.opms_vendor_name != m.netsuite_vendor_name
`;
```

## Testing & Validation

### Test Cases

1. **Valid Vendor Mapping**
   - OPMS vendor exists in mapping table
   - NetSuite vendor ID is valid
   - Expected: itemvendor sublist populates with 1 entry

2. **Invalid/Missing Vendor Mapping**
   - OPMS vendor not in mapping table
   - Expected: item imports successfully, itemvendor sublist remains empty

3. **Multiple Vendors** (Future Enhancement)
   - Multiple OPMS vendors for single product
   - Expected: itemvendor sublist populates with multiple entries

### Verification Scripts

Use these scripts to test vendor integration:

```bash
# Test single item with valid vendor
node scripts/test-simple-valid-vendor.js

# Test batch of items with valid vendors
node scripts/test-all-5-valid-vendors.js

# Export items with vendor validation
node scripts/export-5-with-valid-vendors-simple.js
```

## Troubleshooting

### Common Issues

1. **Empty Itemvendor Sublist**
   - **Cause**: "Multiple Vendors" feature not enabled
   - **Solution**: Enable feature in NetSuite setup

2. **Vendor ID Not Found**
   - **Cause**: Invalid NetSuite vendor internal ID
   - **Solution**: Verify vendor exists and get correct internal ID

3. **RESTlet Error on Sublist**
   - **Cause**: Missing or incorrect sublist field names
   - **Solution**: Use dynamic field inspection in RESTlet

4. **Mapping Data Inaccuracy**
   - **Cause**: Incorrect vendor ID mappings in database
   - **Solution**: Run mapping validation and correction scripts

### Debug Logging

Enable detailed logging in RESTlet for troubleshooting:

```javascript
log.debug('ItemVendor Debug', 'Vendor ID: ' + vendorId);
log.debug('ItemVendor Debug', 'Sublist Line Count: ' + inventoryItem.getLineCount({ sublistId: 'itemvendor' }));
```

## Production Considerations

### Performance
- Vendor mapping lookups are cached for batch operations
- Database indexes on `opms_vendor_id` and `netsuite_vendor_id` for fast lookups

### Data Integrity
- Regular validation of vendor mappings
- Backup of mapping table before bulk updates
- Monitoring for unmapped vendors in import logs

### Scalability
- Batch processing supports multiple vendor mappings
- Error handling for partial failures
- Retry logic for temporary NetSuite API issues

## Related Documentation

- [Item Field Mapping](./Item-Field-Mapping.md) - Complete field mapping reference
- [NetSuite Authentication](./Authentication-related/NetSuite-OAuth-Solution.md) - OAuth setup
- [RESTlet Development](./README-NetSuite-Integration.md) - RESTlet implementation guide

## Version History

- **v1.0** (2025-08-16): Initial itemvendor sublist integration
- **v1.1** (2025-08-16): Added comprehensive vendor mapping validation
- **v1.2** (2025-08-16): Production-ready with batch testing validation
