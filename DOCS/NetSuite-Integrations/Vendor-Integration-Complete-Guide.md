# NetSuite Vendor Integration - Complete Production Guide

## 🎯 **Overview**

This guide documents the complete solution for integrating vendor information with NetSuite inventory items, ensuring vendors appear in the native NetSuite "Vendors" section of inventory item forms.

## 🚨 **Critical Success Factors**

### **1. NetSuite Feature Requirements**
- ✅ **"Multiple Vendors" feature MUST be enabled**
- Navigate to: `Setup > Company > Enable Features > Items & Inventory > Multiple Vendors`
- Without this feature, the vendor sublist will not function

### **2. Vendor Configuration Requirements**
- ✅ **Vendors must be marked as "Can be purchased from"**
- ✅ **Vendors must be Active**
- ✅ **Vendors must have access to the same subsidiary as inventory items**

### **3. Correct Sublist Implementation**
- ✅ **Use `itemvendor` sublist** (not `vendorstab`)
- ✅ **Use correct field names**: `vendor`, `vendorcode`, `preferredvendor`
- ✅ **Commit sublist lines properly**

## 🔧 **Technical Implementation**

### **SuiteScript RESTlet Code**

```javascript
// CRITICAL: Add vendor to itemvendor sublist
if (requestBody.vendor) {
    var vendorId = parseInt(requestBody.vendor);
    if (!isNaN(vendorId) && vendorId > 0) {
        try {
            // Add line to itemvendor sublist
            inventoryItem.selectNewLine({ sublistId: 'itemvendor' });
            
            // Set vendor ID (required field)
            inventoryItem.setCurrentSublistValue({
                sublistId: 'itemvendor',
                fieldId: 'vendor',
                value: vendorId
            });
            
            // Set vendor code if provided
            if (requestBody.vendorcode) {
                inventoryItem.setCurrentSublistValue({
                    sublistId: 'itemvendor',
                    fieldId: 'vendorcode',
                    value: requestBody.vendorcode
                });
            }
            
            // Set as preferred vendor (CRITICAL: use 'preferredvendor' not 'preferred')
            inventoryItem.setCurrentSublistValue({
                sublistId: 'itemvendor',
                fieldId: 'preferredvendor',
                value: true
            });
            
            // Commit the sublist line
            inventoryItem.commitLine({ sublistId: 'itemvendor' });
            
        } catch (sublistError) {
            log.error('RESTlet', 'Error adding vendor to sublist: ' + sublistError.toString());
        }
    }
}
```

### **Verification Code (Read-back)**

```javascript
// Read back itemvendor sublist data for verification
try {
    var itemvendorLineCount = savedRecord.getLineCount({ sublistId: 'itemvendor' });
    customFieldsResult.itemvendorLineCount = itemvendorLineCount;
    
    if (itemvendorLineCount > 0) {
        var itemvendorData = [];
        for (var i = 0; i < itemvendorLineCount; i++) {
            var lineData = {
                vendor: savedRecord.getSublistValue({ 
                    sublistId: 'itemvendor', 
                    fieldId: 'vendor', 
                    line: i 
                }),
                vendorcode: savedRecord.getSublistValue({ 
                    sublistId: 'itemvendor', 
                    fieldId: 'vendorcode', 
                    line: i 
                }),
                preferredvendor: savedRecord.getSublistValue({ 
                    sublistId: 'itemvendor', 
                    fieldId: 'preferredvendor', 
                    line: i 
                })
            };
            itemvendorData.push(lineData);
        }
        customFieldsResult.itemvendorData = itemvendorData;
    }
} catch (error) {
    log.error('RESTlet', 'Could not read itemvendor sublist: ' + error.toString());
}
```

## 📋 **API Payload Structure**

### **Required Fields**
```javascript
{
    "itemId": "ITEM-001",
    "displayName": "Product Name",
    "upcCode": "UPC123456789",
    "taxScheduleId": "1",           // REQUIRED
    "vendor": 326,                  // Vendor internal ID (numeric)
    "vendorcode": "VENDOR-CODE-001", // Vendor's item code
    "vendorname": "Vendor Product Name" // Optional: vendor's product name
}
```

### **Expected Response**
```javascript
{
    "success": true,
    "id": 8477,
    "itemId": "ITEM-001",
    "customFields": {
        "itemvendorLineCount": 1,
        "itemvendorData": [
            {
                "vendor": "326",
                "vendorcode": "VENDOR-CODE-001",
                "preferredvendor": true
            }
        ]
    }
}
```

## 🔍 **Troubleshooting Guide**

### **Problem: Vendor dropdown is empty**
**Cause**: "Multiple Vendors" feature not enabled
**Solution**: Enable feature in NetSuite setup

### **Problem: Vendors exist but don't appear in dropdown**
**Cause**: Vendors not configured for purchasing
**Solution**: Check vendor "Can be purchased from" setting

### **Problem: RESTlet succeeds but no vendors in UI**
**Cause**: Wrong sublist field names
**Solution**: Use `preferredvendor` not `preferred`

### **Problem: "Missing required field: Tax Schedule ID"**
**Cause**: Missing taxScheduleId in payload
**Solution**: Always include `"taxScheduleId": "1"` in payload

## 🧪 **Testing Procedure**

### **1. Test Vendor Configuration**
```bash
# Check if vendor 326 (Dekortex) is properly configured
node scripts/test-vendor-config.js
```

### **2. Test Sublist Implementation**
```bash
# Test with correct field names
node scripts/debug-vendor-sublist-error.js
```

### **3. Verify in NetSuite UI**
1. Go to created inventory item
2. Navigate to "Purchasing/Inventory" tab
3. Check "Vendors" section
4. Should show vendor with code and "Preferred: Yes"

## 📊 **NetSuite Structure Reference**

### **Available Sublists**
- `itemvendor` ✅ **Use this for vendor relationships**
- `vendorstab` ❌ **UI-only, no fields available**

### **itemvendor Sublist Fields**
```javascript
[
    "sys_id",
    "schedule", 
    "preferredvendor",    // ✅ Use this (not 'preferred')
    "predconfidence",
    "vendorcurrencyid",
    "predicteddays", 
    "vendorprices",
    "vendor",            // ✅ Vendor internal ID
    "vendorcurrencyname",
    "vendorcode",        // ✅ Vendor item code
    "subsidiary",
    "purchaseprice"
]
```

## 🚀 **Production Deployment Checklist**

### **Pre-Deployment**
- [ ] Verify "Multiple Vendors" feature enabled
- [ ] Test with known vendor IDs
- [ ] Validate all required fields in payload
- [ ] Test read-back verification

### **Deployment**
- [ ] Deploy updated RESTlet with vendor sublist code
- [ ] Update API service to include taxScheduleId
- [ ] Test end-to-end integration
- [ ] Verify UI shows vendors correctly

### **Post-Deployment**
- [ ] Monitor for vendor-related errors
- [ ] Validate vendor data appears in NetSuite UI
- [ ] Test with multiple vendors per item
- [ ] Document any vendor-specific configurations

## 💡 **Best Practices**

### **Error Handling**
- Always wrap sublist operations in try-catch
- Log detailed error messages for troubleshooting
- Validate vendor IDs before sublist operations

### **Performance**
- Cache vendor ID mappings when possible
- Batch vendor operations for multiple items
- Use read-back verification sparingly in production

### **Data Integrity**
- Always validate vendor exists before adding to sublist
- Use deterministic vendor ID mapping
- Implement proper rollback on sublist errors

## 🔗 **Related Documentation**
- [NetSuite Authentication Guide](./Authentication-Quick-Reference.md)
- [Item Field Mapping](./Item-Field-Mapping.md)
- [Vendor Mapping Strategy](./Vendor-Mapping-Strategy.md)

---

**Last Updated**: 2025-08-15  
**Status**: ✅ Production Ready  
**Tested With**: NetSuite SuiteScript 2.1, Multiple Vendors Feature Enabled
